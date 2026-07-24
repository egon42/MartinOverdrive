import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
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
const RYAN_MEASURE_KEY = `overdrive-ryan-measure${KEY_SUFFIX}`
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
  /** Subtle zebra tone on cheat-card section rows and Lyrics-sheet lines. */
  rowStripe: boolean
  /** Ink % mixed into even rows when rowStripe is on (CSS `--row-stripe`). */
  rowStripeStrength: number
}

export interface AppSettings {
  cheat: FingeringPrefs
  chords: FingeringPrefs
  theme: ThemePrefs
  /** Where chord chips sit on the Lyrics sheet (practice + show). */
  lyricChordPlacement: LyricChordPlacement
  /** Above-mode only: em offset pulling each chord chip down onto the lyric beneath it
   *  (negative = overlap, the chip layers under the text). Applied as the --chip-pull var. */
  lyricChipPull: number
  /** Bank chips in song headers + mid-song Amp/Stomp cues on Lyrics/Tabs. Off by default. */
  showAmpChips: boolean
  /** Hidden Developer toggle: shows the Card version dropdown on the Chords card. */
  devMode: boolean
  /** Hidden Developer toggle: shows the personal Ryan tab (show mode + song pages). */
  ryanTab: boolean
}

/** Per-song, per-surface: when true, chord chips are replaced by vertical fingering chips. */
export type FingeringOnlyMap = Record<string, Partial<Record<FingeringSurface, boolean>>>
/** Per-song Ryan play-along map (equal measure columns). Retap the Ryan tab to toggle. */
export type RyanMeasureMap = Record<string, true>

const DEFAULT_PREFS: FingeringPrefs = { scope: 'power', position: 'under' }
const DEFAULT_THEME: ThemePrefs = {
  preset: 'martin-drive',
  colors: { ...MARTIN_DRIVE },
  rowStripe: true,
  rowStripeStrength: 5.5,
}
const DEFAULT_LYRIC_CHORD_PLACEMENT: LyricChordPlacement = 'inline'
const DEFAULT_LYRIC_CHIP_PULL = -0.5
const DEFAULT_SHOW_AMP_CHIPS = false
/** Clamp the range the slider offers, so a stored/edited value can't hide chips or blow up layout. */
export const CHIP_PULL_MIN = -0.9
export const CHIP_PULL_MAX = 0.1
/** Alternate-section tone strength (% of --ink mixed into even rows). 5.5 matched the old hard-coded wash. */
export const ROW_STRIPE_MIN = 0
export const ROW_STRIPE_MAX = 18

const isScope = (v: unknown): v is FingeringScope => v === 'power' || v === 'all' || v === 'none'
const isPosition = (v: unknown): v is FingeringPosition =>
  v === 'under' || v === 'over' || v === 'left' || v === 'right'
const isLyricChordPlacement = (v: unknown): v is LyricChordPlacement =>
  v === 'inline' || v === 'above'
const readChipPull = (v: unknown): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(CHIP_PULL_MAX, Math.max(CHIP_PULL_MIN, v)) : DEFAULT_LYRIC_CHIP_PULL
const readRowStripeStrength = (v: unknown): number =>
  typeof v === 'number' && Number.isFinite(v)
    ? Math.min(ROW_STRIPE_MAX, Math.max(ROW_STRIPE_MIN, v))
    : DEFAULT_THEME.rowStripeStrength

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
  const rowStripeStrength = readRowStripeStrength(o.rowStripeStrength)
  if (isThemePresetId(o.preset)) {
    // Prefer the live preset palette so shipping a palette tweak updates saved presets.
    return { preset: o.preset, colors: { ...THEME_PRESETS[o.preset].colors }, rowStripe, rowStripeStrength }
  }
  if (o.preset === 'custom') return { preset: 'custom', colors, rowStripe, rowStripeStrength }
  // Older saves without a preset id — match if possible.
  return { preset: matchPreset(colors), colors, rowStripe, rowStripeStrength }
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
      lyricChipPull: readChipPull(raw.lyricChipPull),
      showAmpChips: raw.showAmpChips === true,
      devMode: raw.devMode === true,
      ryanTab: raw.ryanTab === true,
    }
  } catch {
    return {
      cheat: { ...DEFAULT_PREFS },
      chords: { ...DEFAULT_PREFS },
      theme: { ...DEFAULT_THEME, colors: { ...MARTIN_DRIVE } },
      lyricChordPlacement: DEFAULT_LYRIC_CHORD_PLACEMENT,
      lyricChipPull: DEFAULT_LYRIC_CHIP_PULL,
      showAmpChips: DEFAULT_SHOW_AMP_CHIPS,
      devMode: false,
      ryanTab: false,
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

function readRyanMeasure(): RyanMeasureMap {
  try {
    const raw = JSON.parse(localStorage.getItem(RYAN_MEASURE_KEY) || '{}')
    if (!raw || typeof raw !== 'object') return {}
    const out: RyanMeasureMap = {}
    for (const [id, on] of Object.entries(raw as Record<string, unknown>)) {
      if (on) out[id] = true
    }
    return out
  } catch {
    return {}
  }
}

interface SettingsStore {
  settings: AppSettings
  patchFingering: (surface: FingeringSurface, update: Partial<FingeringPrefs>) => void
  setLyricChordPlacement: (placement: LyricChordPlacement) => void
  setLyricChipPull: (em: number) => void
  setShowAmpChips: (on: boolean) => void
  setDevMode: (on: boolean) => void
  setRyanTab: (on: boolean) => void
  setThemePreset: (preset: ThemePresetId) => void
  patchThemeColor: (key: ThemeColorKey, value: string) => void
  setRowStripe: (on: boolean) => void
  setRowStripeStrength: (pct: number) => void
  resetTheme: () => void
  isFingeringOnly: (songId: string, surface: FingeringSurface) => boolean
  toggleFingeringOnly: (songId: string, surface: FingeringSurface) => void
  isRyanMeasure: (songId: string) => boolean
  toggleRyanMeasure: (songId: string) => void
}

const SettingsContext = createContext<SettingsStore | null>(null)

function applyRowStripe(on: boolean) {
  if (on) document.documentElement.dataset.rowStripe = '1'
  else delete document.documentElement.dataset.rowStripe
}

function applyRowStripeStrength(pct: number) {
  document.documentElement.style.setProperty('--row-stripe', `${pct}%`)
}

function applyChipPull(em: number) {
  document.documentElement.style.setProperty('--chip-pull', `${em}em`)
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(readSettings)
  const [fingeringOnly, setFingeringOnly] = useState<FingeringOnlyMap>(readFingeringOnly)
  const [ryanMeasure, setRyanMeasure] = useState<RyanMeasureMap>(readRyanMeasure)
  useEffect(() => { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)) }, [settings])
  useEffect(() => { localStorage.setItem(FINGERING_ONLY_KEY, JSON.stringify(fingeringOnly)) }, [fingeringOnly])
  useEffect(() => { localStorage.setItem(RYAN_MEASURE_KEY, JSON.stringify(ryanMeasure)) }, [ryanMeasure])
  useEffect(() => { applyTheme(settings.theme.colors) }, [settings.theme.colors])
  useEffect(() => { applyRowStripe(settings.theme.rowStripe) }, [settings.theme.rowStripe])
  useEffect(() => { applyRowStripeStrength(settings.theme.rowStripeStrength) }, [settings.theme.rowStripeStrength])
  useEffect(() => { applyChipPull(settings.lyricChipPull) }, [settings.lyricChipPull])
  const patchFingering = (surface: FingeringSurface, update: Partial<FingeringPrefs>) =>
    setSettings((old) => ({ ...old, [surface]: { ...old[surface], ...update } }))
  const setLyricChordPlacement = (placement: LyricChordPlacement) =>
    setSettings((old) => ({ ...old, lyricChordPlacement: placement }))
  const setLyricChipPull = (em: number) =>
    setSettings((old) => ({ ...old, lyricChipPull: Math.min(CHIP_PULL_MAX, Math.max(CHIP_PULL_MIN, em)) }))
  const setShowAmpChips = (on: boolean) =>
    setSettings((old) => ({ ...old, showAmpChips: on }))
  const setDevMode = (on: boolean) =>
    setSettings((old) => ({ ...old, devMode: on }))
  const setRyanTab = (on: boolean) =>
    setSettings((old) => ({ ...old, ryanTab: on }))
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
  const setRowStripeStrength = (pct: number) =>
    setSettings((old) => ({
      ...old,
      theme: {
        ...old.theme,
        rowStripeStrength: Math.min(ROW_STRIPE_MAX, Math.max(ROW_STRIPE_MIN, pct)),
      },
    }))
  const resetTheme = () =>
    setSettings((old) => ({
      ...old,
      theme: {
        preset: 'martin-drive',
        colors: { ...MARTIN_DRIVE },
        rowStripe: old.theme.rowStripe,
        rowStripeStrength: old.theme.rowStripeStrength,
      },
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
  const isRyanMeasure = (songId: string) => !!ryanMeasure[songId]
  const toggleRyanMeasure = (songId: string) => setRyanMeasure((old) => {
    const next = { ...old }
    if (next[songId]) delete next[songId]
    else next[songId] = true
    return next
  })
  const value = useMemo(
    () => ({ settings, patchFingering, setLyricChordPlacement, setLyricChipPull, setShowAmpChips, setDevMode, setRyanTab, setThemePreset, patchThemeColor, setRowStripe, setRowStripeStrength, resetTheme, isFingeringOnly, toggleFingeringOnly, isRyanMeasure, toggleRyanMeasure }),
    [settings, fingeringOnly, ryanMeasure],
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

/** Power-chord chip: low E–A–D–G only (drop B/e), left→right = low-E→G. Mute = ×. */
export function formatPowerFingering(shape: string): string {
  if (TAB_SHAPE_RE.test(shape)) return shape.slice(0, 4).replace(/-/g, '×')
  return shape
}

/** Class for the show-mode / sheet-panel view tabs: `shapes-hint` when retap is available, `shapes` when on. */
export function shapesTabClass(active: boolean, shapesOn: boolean, canToggle: boolean): string {
  const parts = [active ? 'active' : '']
  if (shapesOn) parts.push('shapes')
  else if (active && canToggle) parts.push('shapes-hint')
  return parts.filter(Boolean).join(' ')
}

/** Live sample of the above-mode chip overlap — uses the real sheet classes so it
 *  tracks the --chip-pull var as the slider moves, right here in Settings. */
function ChipPullExample() {
  // Same wrapper/classes/size as the real Lyrics sheet so the overlap matches it exactly.
  return <div className="chip-pull-example" aria-hidden="true">
    <div className="sheet-full">
      <div className="sheet-line sheet-line--above">
        {[['Em', 'Midnight '], ['C', 'train '], ['G', 'going ']].map(([chord, word], i) => (
          <span className="sheet-above-word" key={i}>
            <span className="sheet-above-col">
              {/* Mirror ChordChip(bare)'s DOM — the .chord-chip-wrap inherits the sheet's
                  line-height and lifts the chip, so without it the preview overlaps more
                  than the real sheet does. */}
              <span className="sheet-above-chord"><span className="chord-chip-wrap"><b className="chord-chip">{chord}</b></span></span>
              <span className="sheet-above-lyric">{word}</span>
            </span>
          </span>
        ))}
      </div>
    </div>
  </div>
}

function FingeringFields({ surface, label }: { surface: FingeringSurface; label: string }) {
  const { settings, patchFingering, setLyricChordPlacement, setLyricChipPull } = useSettings()
  const prefs = settings[surface]
  const above = settings.lyricChordPlacement === 'above'
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
          <option value="above">Above the lyric line (UG-style)</option>
        </select>
      </label>}
      {surface === 'chords' && above && <div className="chip-pull-field">
        <div className="chip-pull-head">
          <span>Chord overlap</span>
          <b className="chip-pull-val">{settings.lyricChipPull.toFixed(2)}em</b>
        </div>
        <ChipPullExample />
        <input
          type="range"
          aria-label="Chord overlap amount"
          min={CHIP_PULL_MIN}
          max={CHIP_PULL_MAX}
          step={0.01}
          value={settings.lyricChipPull}
          onChange={(e) => setLyricChipPull(Number(e.target.value))}
        />
        <small className="chip-pull-hint">How far the chord chips tuck down onto the lyrics. More negative = tighter overlap (chips sit under the letters).</small>
      </div>}
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

/** Live sample of alternate-section tone — real cheat-row classes so it tracks `--row-stripe`. */
function RowStripeExample() {
  const rows = [
    { label: 'Verse', chords: 'Em  C  G  D' },
    { label: 'Chorus', chords: 'C  G  D  Em' },
    { label: 'Bridge', chords: 'Am  Em  F  C' },
    { label: 'Solo', chords: 'Em  G  D  A' },
  ]
  return <div className="row-stripe-example" aria-hidden="true">
    <div className="cheat-progression">
      {rows.map((row) => (
        <div className="cheat-prog-row" key={row.label}>
          <span className="cheat-prog-label">{row.label}</span>
          <div className="cheat-prog-body">
            <span className="cheat-prog-chords">{row.chords}</span>
          </div>
        </div>
      ))}
    </div>
  </div>
}

function ThemeFields() {
  const { settings, setThemePreset, patchThemeColor, setRowStripe, setRowStripeStrength, resetTheme } = useSettings()
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
        <small>Soft tint on every other cheat-card section and lyric line.</small>
      </span>
    </label>
    {theme.rowStripe && <div className="row-stripe-field">
      <div className="row-stripe-head">
        <span>Tone strength</span>
        <b className="row-stripe-val">{theme.rowStripeStrength.toFixed(1)}%</b>
      </div>
      <RowStripeExample />
      <input
        type="range"
        aria-label="Alternate section tone strength"
        min={ROW_STRIPE_MIN}
        max={ROW_STRIPE_MAX}
        step={0.5}
        value={theme.rowStripeStrength}
        onChange={(e) => setRowStripeStrength(Number(e.target.value))}
      />
      <small className="row-stripe-hint">How strong the tint is on even rows. 5.5% is the original default.</small>
    </div>}
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
  const { settings, setShowAmpChips, setDevMode, setRyanTab } = useSettings()
  const presetLabel = settings.theme.preset === 'custom'
    ? 'Custom'
    : THEME_PRESETS[settings.theme.preset].label
  // Android-style hidden unlock: 7 quick taps on the heading reveal the Developer
  // section (1.5s of no taps resets the count — but not once revealed, or the section
  // would vanish 1.5s after the unlocking tap). Once either flag is on, the section
  // stays visible without the gesture so it can be turned back off.
  const [revealTaps, setRevealTaps] = useState(0)
  const tapTimer = useRef<number | undefined>(undefined)
  const tapHeading = () => {
    window.clearTimeout(tapTimer.current)
    const next = revealTaps + 1
    if (next < 7) tapTimer.current = window.setTimeout(() => setRevealTaps(0), 1500)
    setRevealTaps(next)
  }
  useEffect(() => () => window.clearTimeout(tapTimer.current), [])
  const revealed = settings.devMode || settings.ryanTab || revealTaps >= 7
  return <>
    <header className="page-title compact">
      <span className="eyebrow">On this device only</span>
      <h1 onClick={tapHeading}>Settings</h1>
    </header>
    <section className="panel settings-panel">
      <span className="eyebrow">Chord chips</span>
      <h2>Chord fingerings</h2>
      <FingeringFields surface="cheat" label="Cheat & Chords cards" />
      <FingeringFields surface="chords" label="Lyrics sheet" />
    </section>
    <section className="panel settings-panel">
      <span className="eyebrow">Amp</span>
      <h2>Amp presets</h2>
      <label className="theme-stripe-toggle">
        <input
          type="checkbox"
          checked={settings.showAmpChips}
          onChange={(e) => setShowAmpChips(e.target.checked)}
        />
        <span className="theme-stripe-meta">
          <strong>Show amp chips</strong>
          <small>Bank chips in song headers, and mid-song Amp / FS cues on Lyrics and Tabs. Footswitch songs use a distinct FS chip.</small>
        </span>
      </label>
    </section>
    {revealed && <section className="panel settings-panel">
      <span className="eyebrow">Hidden</span>
      <h2>Developer</h2>
      <label className="theme-stripe-toggle">
        <input
          type="checkbox"
          checked={settings.devMode}
          onChange={(e) => setDevMode(e.target.checked)}
        />
        <span className="theme-stripe-meta">
          <strong>Dev mode</strong>
          <small>Shows the Card version dropdown on the Chords card.</small>
        </span>
      </label>
      <label className="theme-stripe-toggle">
        <input
          type="checkbox"
          checked={settings.ryanTab}
          onChange={(e) => setRyanTab(e.target.checked)}
        />
        <span className="theme-stripe-meta">
          <strong>Ryan sheets</strong>
          <small>Shows the Ryan tab in show mode and on song pages, for songs that have one.</small>
        </span>
      </label>
    </section>}
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
