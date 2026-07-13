import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { chordShape, type ChordShape } from './chordShapes'

// Per-device display prefs (not synced practice data). Keyed per deployment like the
// show-mode pins so /dev/ and prod don't share a setting flip mid-rehearsal.
const KEY_SUFFIX = import.meta.env.BASE_URL.includes('/dev/') ? '-dev' : ''
// v2 store: the default fingering scope changed 'power' → 'all' (2026-07-13). The old
// 'power' default read as "fingerings stopped showing" on every device that never found
// the Settings knob. First v2 load migrates the v1 key: customized prefs carry over,
// untouched-default prefs upgrade to the new default.
const SETTINGS_KEY = `overdrive-settings2${KEY_SUFFIX}`
const LEGACY_SETTINGS_KEY = `overdrive-settings${KEY_SUFFIX}`
const FINGERING_ONLY_KEY = `overdrive-fingering-only${KEY_SUFFIX}`

export type FingeringScope = 'power' | 'all' | 'none'
export type FingeringPosition = 'under' | 'over' | 'left' | 'right'
export type FingeringSurface = 'cheat' | 'chords'

export interface FingeringPrefs {
  scope: FingeringScope
  position: FingeringPosition
}

export interface AppSettings {
  cheat: FingeringPrefs
  chords: FingeringPrefs
}

/** Per-song, per-surface: when true, chord chips are replaced by vertical fingering chips. */
export type FingeringOnlyMap = Record<string, Partial<Record<FingeringSurface, boolean>>>

const DEFAULT_PREFS: FingeringPrefs = { scope: 'all', position: 'under' }
// What the v1 store wrote for an untouched device — used to tell "user chose power"
// apart from "user never opened Settings" (identical bytes; we side with never-opened).
const V1_DEFAULT_PREFS: FingeringPrefs = { scope: 'power', position: 'under' }

const isScope = (v: unknown): v is FingeringScope => v === 'power' || v === 'all' || v === 'none'
const isPosition = (v: unknown): v is FingeringPosition =>
  v === 'under' || v === 'over' || v === 'left' || v === 'right'

function readPrefs(raw: unknown, fallback: FingeringPrefs): FingeringPrefs {
  if (!raw || typeof raw !== 'object') return { ...fallback }
  const o = raw as Record<string, unknown>
  return {
    scope: isScope(o.scope) ? o.scope : fallback.scope,
    // Drop a briefly-shipped "only" position if still stored; that mode is now a per-song toggle.
    position: isPosition(o.position) ? o.position : fallback.position,
  }
}

function readSettings(): AppSettings {
  try {
    const rawV2 = localStorage.getItem(SETTINGS_KEY)
    if (rawV2) {
      const raw = JSON.parse(rawV2) as Record<string, unknown>
      return {
        cheat: readPrefs(raw.cheat, DEFAULT_PREFS),
        chords: readPrefs(raw.chords, DEFAULT_PREFS),
      }
    }
    // First run on v2: migrate the v1 key. Resolve the v1 value exactly as the old code
    // did (including the even-older flat fingeringScope/Position keys), then upgrade any
    // surface still on the v1 default — that device never chose anything, and the whole
    // point of v2 is that its default is 'all'. A customized surface carries over as-is.
    const raw = JSON.parse(localStorage.getItem(LEGACY_SETTINGS_KEY) || '{}') as Record<string, unknown>
    const hasSurfaces = raw.cheat != null || raw.chords != null
    const legacyFlat: FingeringPrefs = {
      scope: isScope(raw.fingeringScope) ? raw.fingeringScope : V1_DEFAULT_PREFS.scope,
      position: isPosition(raw.fingeringPosition) ? raw.fingeringPosition : V1_DEFAULT_PREFS.position,
    }
    const v1Fallback = hasSurfaces ? V1_DEFAULT_PREFS : legacyFlat
    const upgrade = (p: FingeringPrefs) =>
      p.scope === V1_DEFAULT_PREFS.scope && p.position === V1_DEFAULT_PREFS.position ? { ...DEFAULT_PREFS } : p
    return {
      cheat: upgrade(readPrefs(raw.cheat, v1Fallback)),
      chords: upgrade(readPrefs(raw.chords, v1Fallback)),
    }
  } catch {
    return { cheat: { ...DEFAULT_PREFS }, chords: { ...DEFAULT_PREFS } }
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
  isFingeringOnly: (songId: string, surface: FingeringSurface) => boolean
  toggleFingeringOnly: (songId: string, surface: FingeringSurface) => void
}

const SettingsContext = createContext<SettingsStore | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(readSettings)
  const [fingeringOnly, setFingeringOnly] = useState<FingeringOnlyMap>(readFingeringOnly)
  useEffect(() => { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)) }, [settings])
  useEffect(() => { localStorage.setItem(FINGERING_ONLY_KEY, JSON.stringify(fingeringOnly)) }, [fingeringOnly])
  const patchFingering = (surface: FingeringSurface, update: Partial<FingeringPrefs>) =>
    setSettings((old) => ({ ...old, [surface]: { ...old[surface], ...update } }))
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
    () => ({ settings, patchFingering, isFingeringOnly, toggleFingeringOnly }),
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

/** Class for Cheat/Chords tabs: `shapes-hint` when retap is available, `shapes` when on. */
export function shapesTabClass(active: boolean, shapesOn: boolean, canToggle: boolean): string {
  const parts = [active ? 'active' : '']
  if (shapesOn) parts.push('shapes')
  else if (active && canToggle) parts.push('shapes-hint')
  return parts.filter(Boolean).join(' ')
}

function FingeringFields({ surface, label }: { surface: FingeringSurface; label: string }) {
  const { settings, patchFingering } = useSettings()
  const prefs = settings[surface]
  return <div className="settings-surface">
    <h3>{label}</h3>
    <div className="settings-fields">
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

export function SettingsPage() {
  return <>
    <header className="page-title compact">
      <span className="eyebrow">Display preferences stay on this device</span>
      <h1>Settings</h1>
    </header>
    <section className="panel settings-panel">
      <span className="eyebrow">Chord chips</span>
      <h2>Chord fingerings</h2>
      <FingeringFields surface="cheat" label="Cheat" />
      <FingeringFields surface="chords" label="Chords" />
    </section>
  </>
}
