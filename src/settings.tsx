import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { chordShape, type ChordShape } from './chordShapes'

// Per-device display prefs (not synced practice data). Keyed per deployment like the
// show-mode pins so /dev/ and prod don't share a setting flip mid-rehearsal.
const KEY_SUFFIX = import.meta.env.BASE_URL.includes('/dev/') ? '-dev' : ''
const SETTINGS_KEY = `overdrive-settings${KEY_SUFFIX}`

export type FingeringScope = 'power' | 'all' | 'none'
export type FingeringPosition = 'under' | 'over' | 'left' | 'right'

export interface AppSettings {
  fingeringScope: FingeringScope
  fingeringPosition: FingeringPosition
}

const DEFAULTS: AppSettings = { fingeringScope: 'power', fingeringPosition: 'under' }

const isScope = (v: unknown): v is FingeringScope => v === 'power' || v === 'all' || v === 'none'
const isPosition = (v: unknown): v is FingeringPosition => v === 'under' || v === 'over' || v === 'left' || v === 'right'

function readSettings(): AppSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')
    return {
      fingeringScope: isScope(raw.fingeringScope) ? raw.fingeringScope : DEFAULTS.fingeringScope,
      fingeringPosition: isPosition(raw.fingeringPosition) ? raw.fingeringPosition : DEFAULTS.fingeringPosition,
    }
  } catch {
    return { ...DEFAULTS }
  }
}

interface SettingsStore {
  settings: AppSettings
  patch: (update: Partial<AppSettings>) => void
}

const SettingsContext = createContext<SettingsStore | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(readSettings)
  useEffect(() => { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)) }, [settings])
  const patch = (update: Partial<AppSettings>) => setSettings((old) => ({ ...old, ...update }))
  const value = useMemo(() => ({ settings, patch }), [settings])
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

/** Resolve the fingering string to show next to a chord chip, or null to hide it. */
export function resolveFingering(chord: string, curated: string | undefined, scope: FingeringScope): string | null {
  if (scope === 'none') return null
  if (curated) return curated
  if (scope === 'power') return null
  const shape = chordShape(chord)
  return shape ? shapeToTab(shape) : null
}

/** Format a fingering for display: left/right stack 6-char tabs vertically. */
export function formatFingering(shape: string, position: FingeringPosition): string {
  if ((position === 'left' || position === 'right') && TAB_SHAPE_RE.test(shape)) {
    return shape.split('').join('\n')
  }
  return shape
}

export function SettingsPage() {
  const { settings, patch } = useSettings()
  return <>
    <header className="page-title compact">
      <span className="eyebrow">Display preferences stay on this device</span>
      <h1>Settings</h1>
    </header>
    <section className="panel settings-panel">
      <span className="eyebrow">Cheat card</span>
      <h2>Chord fingerings</h2>
      <p>Controls the tab-style fingering next to chord chips on the show-mode cheat card (e.g. <code>355---</code>). The tap-to-open chord diagram is unchanged.</p>
      <div className="settings-fields">
        <label>
          <span>Show fingerings for</span>
          <select
            aria-label="Show fingerings for"
            value={settings.fingeringScope}
            onChange={(e) => isScope(e.target.value) && patch({ fingeringScope: e.target.value })}
          >
            <option value="power">Power chords only</option>
            <option value="all">All</option>
            <option value="none">None</option>
          </select>
        </label>
        <label>
          <span>Fingering position</span>
          <select
            aria-label="Fingering position"
            value={settings.fingeringPosition}
            onChange={(e) => isPosition(e.target.value) && patch({ fingeringPosition: e.target.value })}
            disabled={settings.fingeringScope === 'none'}
          >
            <option value="under">Under</option>
            <option value="over">Over</option>
            <option value="left">Left</option>
            <option value="right">Right</option>
          </select>
        </label>
      </div>
      <p className="settings-hint">
        {settings.fingeringScope === 'power' && 'Shows curated tab fingerings when a song has them (power-chord riffs and similar).'}
        {settings.fingeringScope === 'all' && 'Shows curated fingerings when available, otherwise a generated voicing for every chord.'}
        {settings.fingeringScope === 'none' && 'Hides all tab fingerings beside chord chips.'}
        {' '}
        {settings.fingeringScope !== 'none' && settings.fingeringPosition === 'under' && 'Fingerings sit under the chord name.'}
        {settings.fingeringScope !== 'none' && settings.fingeringPosition === 'over' && 'Fingerings sit above the chord name.'}
        {settings.fingeringScope !== 'none' && settings.fingeringPosition === 'left' && 'Six-string fingerings stack vertically to the left of the chord.'}
        {settings.fingeringScope !== 'none' && settings.fingeringPosition === 'right' && 'Six-string fingerings stack vertically to the right of the chord.'}
      </p>
    </section>
  </>
}
