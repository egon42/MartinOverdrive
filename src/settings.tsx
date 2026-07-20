import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { chordShape, type ChordShape } from './chordShapes'
import {
  applyTheme,
  MARTIN_DRIVE,
  THEME_COLOR_META,
  THEME_PRESETS,
  isThemePresetId,
  matchPreset,
  normalizeColors,
  type ThemeColorKey,
  type ThemeColors,
  type ThemePresetId,
} from './theme'

// Per-device display prefs (not synced practice data). Keyed per deployment like the
// show-mode pins so /dev/ and prod don't share a setting flip mid-rehearsal.
const KEY_SUFFIX = import.meta.env.BASE_URL.includes('/dev/') ? '-dev' : ''
const SETTINGS_KEY = `overdrive-settings${KEY_SUFFIX}`
const FINGERING_ONLY_KEY = `overdrive-fingering-only${KEY_SUFFIX}`
// A briefly-deployed build (2026-07-13, reverted same day) migrated settings to this key
// with scope forced to 'all'. Clear it so a future key bump can't resurrect stale values.
try { localStorage.removeItem(`overdrive-settings2${KEY_SUFFIX}`) } catch { /* storage unavailable */ }

export type FingeringScope = 'power' | 'all' | 'none'
export type FingeringPosition = 'under' | 'over' | 'left' | 'right'
/** Lyrics sheet: chips in the lyric flow, or stacked above each lyric segment (UG-style). */
export type LyricChordPlacement = 'inline' | 'above'
// Storage keys predate the tab rename: 'cheat' governs chips on the Cheat & Chords cards; 'chords' governs the Lyrics sheet.
export type FingeringSurface = 'cheat' | 'chords'

export interface FingeringPrefs {
  scope: FingeringScope
  position: FingeringPosition
}

export interface ThemePrefs {
  /** Named preset, or `'custom'` when any swatch has been edited. */
  preset: ThemePresetId | 'custom'
  colors: ThemeColors
  /** Subtle zebra tone on cheat-card section rows ( `|` breaks stay one row). */
  rowStripe: boolean
}

export interface AppSettings {
  cheat: FingeringPrefs
  chords: FingeringPrefs
  theme: ThemePrefs
  /** Where chord chips sit on the Lyrics sheet (practice + show). */
  lyricChordPlacement: LyricChordPlacement
}

/** Per-song, per-surface: when true, chord chips are replaced by vertical fingering chips. */
export type FingeringOnlyMap = Record<string, Partial<Record<FingeringSurface, boolean>>>

const DEFAULT_PREFS: FingeringPrefs = { scope: 'power', position: 'under' }
const DEFAULT_THEME: ThemePrefs = { preset: 'martin-drive', colors: { ...MARTIN_DRIVE }, rowStripe: true }
const DEFAULT_LYRIC_CHORD_PLACEMENT: LyricChordPlacement = 'inline'

const isScope = (v: unknown): v is FingeringScope => v === 'power' || v === 'all' || v === 'none'
const isPosition = (v: unknown): v is FingeringPosition =>
  v === 'under' || v === 'over' || v === 'left' || v === 'right'
const isLyricChordPlacement = (v: unknown): v is LyricChordPlacement =>
  v === 'inline' || v === 'above'

function readPrefs(raw: unknown, fallback: FingeringPrefs): FingeringPrefs {
  if (!raw || typeof raw !== 'object') return { ...fallback }
  const o = raw as Record<string, unknown>
  return {
    scope: isScope(o.scope) ? o.scope : fallback.scope,
    // Drop a briefly-shipped "only" position if still stored; that mode is now a per-song toggle.
    position: isPosition(o.position) ? o.position : fallback.position,
  }
}

function readTheme(raw: unknown): ThemePrefs {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_THEME, colors: { ...MARTIN_DRIVE } }
  const o = raw as Record<string, unknown>
  const colors = normalizeColors(o.colors, MARTIN_DRIVE)
  const rowStripe = o.rowStripe !== false
  if (isThemePresetId(o.preset)) {
    // Prefer the live preset palette so shipping a palette tweak updates saved presets.
    return { preset: o.preset, colors: { ...THEME_PRESETS[o.preset].colors }, rowStripe }
  }
  if (o.preset === 'custom') return { preset: 'custom', colors, rowStripe }
  // Older saves without a preset id — match if possible.
  return { preset: matchPreset(colors), colors, rowStripe }
}

function readSettings(): AppSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') as Record<string, unknown>
    // Migrate the original flat keys onto both surfaces so existing prefs aren't lost.
    const hasSurfaces = raw.cheat != null || raw.chords != null
    const legacy: FingeringPrefs = {
      scope: isScope(raw.fingeringScope) ? raw.fingeringScope : DEFAULT_PREFS.scope,
      position: isPosition(raw.fingeringPosition) ? raw.fingeringPosition : DEFAULT_PREFS.position,
    }
    const fallback = hasSurfaces ? DEFAULT_PREFS : legacy
    return {
      cheat: readPrefs(raw.cheat, fallback),
      chords: readPrefs(raw.chords, fallback),
      theme: readTheme(raw.theme),
      lyricChordPlacement: isLyricChordPlacement(raw.lyricChordPlacement)
        ? raw.lyricChordPlacement
        : DEFAULT_LYRIC_CHORD_PLACEMENT,
    }
  } catch {
    return {
      cheat: { ...DEFAULT_PREFS },
      chords: { ...DEFAULT_PREFS },
      theme: { ...DEFAULT_THEME, colors: { ...MARTIN_DRIVE } },
      lyricChordPlacement: DEFAULT_LYRIC_CHORD_PLACEMENT,
    }
  }
}

function readFingeringOnly(): FingeringOnlyMap {
  try {
    const raw = JSON.parse(localStorage.getItem(FINGERING_ONLY_KEY) || '{}')
    return raw && typeof raw === 'object' ? raw as FingeringOnlyMap : {}
  } catch {
    return {}
  }
}

interface SettingsStore {
  settings: AppSettings
  patchFingering: (surface: FingeringSurface, update: Partial<FingeringPrefs>) => void
  setLyricChordPlacement: (placement: LyricChordPlacement) => void
  setThemePreset: (preset: ThemePresetId) => void
  patchThemeColor: (key: ThemeColorKey, value: string) => void
  setRowStripe: (on: boolean) => void
  resetTheme: () => void
  isFingeringOnly: (songId: string, surface: FingeringSurface) => boolean
  toggleFingeringOnly: (songId: string, surface: FingeringSurface) => void
}

const SettingsContext = createContext<SettingsStore | null>(null)

function applyRowStripe(on: boolean) {
  if (on) document.documentElement.dataset.rowStripe = '1'
  else delete document.documentElement.dataset.rowStripe
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(readSettings)
  const [fingeringOnly, setFingeringOnly] = useState<FingeringOnlyMap>(readFingeringOnly)
  useEffect(() => { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)) }, [settings])
  useEffect(() => { localStorage.setItem(FINGERING_ONLY_KEY, JSON.stringify(fingeringOnly)) }, [fingeringOnly])
  useEffect(() => { applyTheme(settings.theme.colors) }, [settings.theme.colors])
  useEffect(() => { applyRowStripe(settings.theme.rowStripe) }, [settings.theme.rowStripe])
  const patchFingering = (surface: FingeringSurface, update: Partial<FingeringPrefs>) =>
    setSettings((old) => ({ ...old, [surface]: { ...old[surface], ...update } }))
  const setLyricChordPlacement = (placement: LyricChordPlacement) =>
    setSettings((old) => ({ ...old, lyricChordPlacement: placement }))
  const setThemePreset = (preset: ThemePresetId) =>
    setSettings((old) => ({
      ...old,
      theme: { ...old.theme, preset, colors: { ...THEME_PRESETS[preset].colors } },
    }))
  const patchThemeColor = (key: ThemeColorKey, value: string) =>
    setSettings((old) => {
      const colors = { ...old.theme.colors, [key]: value }
      return { ...old, theme: { ...old.theme, preset: matchPreset(colors), colors } }
    })
  const setRowStripe = (on: boolean) =>
    setSettings((old) => ({ ...old, theme: { ...old.theme, rowStripe: on } }))
  const resetTheme = () =>
    setSettings((old) => ({
      ...old,
      theme: { preset: 'martin-drive', colors: { ...MARTIN_DRIVE }, rowStripe: old.theme.rowStripe },
    }))
  const isFingeringOnly = (songId: string, surface: FingeringSurface) => !!fingeringOnly[songId]?.[surface]
  const toggleFingeringOnly = (songId: string, surface: FingeringSurface) => setFingeringOnly((old) => {
    const next = { ...old }
    const entry = { ...next[songId] }
    if (entry[surface]) delete entry[surface]
    else entry[surface] = true
    if (!entry.cheat && !entry.chords) delete next[songId]
    else next[songId] = entry
    return next
  })
  const value = useMemo(
    () => ({ settings, patchFingering, setLyricChordPlacement, setThemePreset, patchThemeColor, setRowStripe, resetTheme, isFingeringOnly, toggleFingeringOnly }),
    [settings, fingeringOnly],
  )
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings() {
  const value = useContext(SettingsContext)
  if (!value) throw new Error('SettingsProvider is missing')
  return value
}

// Encode a ChordShape as the 6-char cheat-card fingering (low-E → high-e). Frets 10+
// use hex letters (A=10…) so the string stays one char per string.
function shapeToTab(shape: ChordShape): string {
  return shape.map((fret) => {
    if (fret === 'x') return '-'
    if (fret <= 9) return String(fret)
    return 'ABCDEF'[fret - 10] ?? '?'
  }).join('')
}

const TAB_SHAPE_RE = /^[0-9A-FxX-]{6}$/

/** Power-chord token (C5, F#5, Bb5) — slash bass ignored. */
export function isPowerChord(name: string): boolean {
  return /^[A-G][#b]?5$/i.test(name.trim().split('/')[0])
}

/** Resolve the fingering string to show next to a chord chip, or null to hide it. */
export function resolveFingering(chord: string, curated: string | undefined, scope: FingeringScope): string | null {
  if (scope === 'none') return null
  if (curated) return curated
  if (scope === 'power' && !isPowerChord(chord)) return null
  const shape = chordShape(chord)
  return shape ? shapeToTab(shape) : null
}

/** Format a fingering for display: left/right stack 6-char tabs vertically
 *  (high-e on top → low-E on bottom, matching standard tablature). */
export function formatFingering(shape: string, position: FingeringPosition): string {
  if ((position === 'left' || position === 'right') && TAB_SHAPE_RE.test(shape)) {
    return shape.split('').reverse().join('\n')
  }
  return shape
}

/** Vertical high-e→low-E stack for the fingering-only chip mode. */
export function formatVerticalFingering(shape: string): string {
  if (TAB_SHAPE_RE.test(shape)) return shape.split('').reverse().join('\n')
  return shape
}

/** Class for the show-mode / sheet-panel view tabs: `shapes-hint` when retap is available, `shapes` when on. */
export function shapesTabClass(active: boolean, shapesOn: boolean, canToggle: boolean): string {
  const parts = [active ? 'active' : '']
  if (shapesOn) parts.push('shapes')
  else if (active && canToggle) parts.push('shapes-hint')
  return parts.filter(Boolean).join(' ')
}

function FingeringFields({ surface, label }: { surface: FingeringSurface; label: string }) {
  const { settings, patchFingering, setLyricChordPlacement } = useSettings()
  const prefs = settings[surface]
  return <div className="settings-surface">
    <h3>{label}</h3>
    <div className="settings-fields">
      {surface === 'chords' && <label>
        <span>Chord placement</span>
        <select
          aria-label={`${label}: chord placement`}
          value={settings.lyricChordPlacement}
          onChange={(e) => isLyricChordPlacement(e.target.value) && setLyricChordPlacement(e.target.value)}
        >
          <option value="inline">In the lyric line</option>
          <option value="above">Above the lyric line</option>
        </select>
      </label>}
      <label>
        <span>Show fingerings for</span>
        <select
          aria-label={`${label}: show fingerings for`}
          value={prefs.scope}
          onChange={(e) => isScope(e.target.value) && patchFingering(surface, { scope: e.target.value })}
        >
          <option value="power">Power chords only</option>
          <option value="all">All</option>
          <option value="none">None</option>
        </select>
      </label>
      <label>
        <span>Fingering position</span>
        <select
          aria-label={`${label}: fingering position`}
          value={prefs.position}
          onChange={(e) => isPosition(e.target.value) && patchFingering(surface, { position: e.target.value })}
          disabled={prefs.scope === 'none'}
        >
          <option value="under">Under</option>
          <option value="over">Over</option>
          <option value="left">Left</option>
          <option value="right">Right</option>
        </select>
      </label>
    </div>
  </div>
}

function ThemeFields() {
  const { settings, setThemePreset, patchThemeColor, setRowStripe, resetTheme } = useSettings()
  const { theme } = settings
  return <div className="settings-theme">
    <label className="theme-stripe-toggle">
      <input
        type="checkbox"
        checked={theme.rowStripe}
        onChange={(e) => setRowStripe(e.target.checked)}
      />
      <span className="theme-stripe-meta">
        <strong>Alternate section tone</strong>
        <small>Soft tint on every other cheat-card section.</small>
      </span>
    </label>
    <div className="theme-presets" role="group" aria-label="Color presets">
      {(Object.keys(THEME_PRESETS) as ThemePresetId[]).map((id) => {
        const preset = THEME_PRESETS[id]
        const active = theme.preset === id
        return <button
          key={id}
          type="button"
          className={active ? 'theme-preset active' : 'theme-preset'}
          aria-pressed={active}
          onClick={() => setThemePreset(id)}
        >
          <span className="theme-swatches" aria-hidden="true">
            <i style={{ background: preset.colors.bg }} />
            <i style={{ background: preset.colors.paper }} />
            <i style={{ background: preset.colors.acid }} />
            <i style={{ background: preset.colors.orange }} />
          </span>
          <span>{preset.label}</span>
        </button>
      })}
    </div>
    {theme.preset === 'custom' && <p className="theme-custom-note">Custom (edited from a preset)</p>}
    <div className="theme-colors">
      {THEME_COLOR_META.map(({ key, label, hint }) => (
        <label key={key} className="theme-color">
          <span className="theme-color-swatch" style={{ background: theme.colors[key] }}>
            <input
              type="color"
              aria-label={label}
              value={theme.colors[key]}
              onChange={(e) => patchThemeColor(key, e.target.value)}
            />
          </span>
          <span className="theme-color-meta">
            <strong>{label}</strong>
            <small>{hint}</small>
            <code>{theme.colors[key]}</code>
          </span>
        </label>
      ))}
    </div>
    <div className="theme-actions">
      <button type="button" className="button secondary" onClick={resetTheme}>Reset to Martin Drive</button>
    </div>
  </div>
}

export function SettingsPage() {
  const { settings } = useSettings()
  const presetLabel = settings.theme.preset === 'custom'
    ? 'Custom'
    : THEME_PRESETS[settings.theme.preset].label
  return <>
    <header className="page-title compact">
      <span className="eyebrow">On this device only</span>
      <h1>Settings</h1>
    </header>
    <section className="panel settings-panel">
      <span className="eyebrow">Chord chips</span>
      <h2>Chord fingerings</h2>
      <FingeringFields surface="cheat" label="Cheat & Chords cards" />
      <FingeringFields surface="chords" label="Lyrics sheet" />
    </section>
    <details className="settings-colors-disclosure">
      <summary>
        <span className="eyebrow">Look</span>
        <strong>Colors</strong>
        <span className="settings-colors-current">{presetLabel}</span>
      </summary>
      <div className="settings-colors-body">
        <p className="settings-lead">Pick a preset or customize each surface. Amp bank chips stay fixed so they match the hardware.</p>
        <ThemeFields />
      </div>
    </details>
  </>
}
