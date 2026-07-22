import { Link } from 'react-router-dom'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type RefObject } from 'react'
import { chordProgression, compactSheet, cueNumber, isCueToken, isFretToken, parseChordSheet, type SheetPart } from './chords'
import { basicRowsFor, cheatRowsFor, progressionFor, progressionVersionsFor, type CheatChordSpan } from './progressions'
import { AutoScrollBar, useAutoScrollControls } from './autoscroll'
import { chordShape, type ChordShape } from './chordShapes'
import type { Song } from './types'
import { statuses } from './types'
import { fretboardForVersion, homeFretsFor, octaveUpVariant, resolveFretboards, scaleName, type FretboardVersion } from './fretboard'
import { isStatus, usePractice } from './storage'
import { Metronome } from './metronome'
import { ampPresets, parsePresetLabel, presetBank, presetLabel, presetPosition } from './presets'
import { sheetsFor } from './sheets'
import { transposeFor, transposeLabel, transposeHint } from './transpose'
import { formatFingering, formatVerticalFingering, resolveFingering, shapesTabClass, useSettings, type FingeringSurface } from './settings'

export const unknown = (value: string | number | null) => value === '' || value == null ? 'Not provided' : value

/** Tab fingering text: fretted digits white; muted `-` / `x` stay grey. */
function FingeringText({ text }: { text: string }) {
  return <>{Array.from(text).map((ch, i) =>
    ch === '-' || ch === 'x' || ch === 'X'
      ? <span className="chord-fingering-mute" key={i}>{ch}</span>
      : ch)}</>
}

// A small SVG fingering diagram for one chord. Strings run left→right as low-E (6th)
// to high-e (1st), the standard chord-chart layout; a labelled row underneath removes
// any ambiguity. Frets 5+ shift into a window with a "Nfr" position label.
function ChordDiagram({ name, shape }: { name: string; shape: ChordShape }) {
  const played = shape.filter((f): f is number => typeof f === 'number' && f > 0)
  const maxFret = played.length ? Math.max(...played) : 0
  const minFret = played.length ? Math.min(...played) : 1
  const baseFret = maxFret > 4 ? minFret : 1
  const fretCount = Math.max(4, maxFret - baseFret + 1)
  const GAP = 15, FRET = 19, X0 = 16, Y0 = 20
  const x = (s: number) => X0 + s * GAP
  const width = X0 * 2 + GAP * 5
  const height = Y0 + FRET * fretCount + 18
  const labels = ['E', 'A', 'D', 'G', 'B', 'e']
  return <svg className="chord-diagram" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${name} chord diagram`}>
    <text className="cd-name" x={width / 2} y={11} textAnchor="middle">{name}</text>
    {/* nut (thick) when at the top of the neck, otherwise a position label */}
    {baseFret === 1
      ? <rect className="cd-nut" x={x(0)} y={Y0 - 2} width={GAP * 5} height={3} />
      : <text className="cd-basefret" x={x(0) - 6} y={Y0 + FRET * 0.7} textAnchor="end">{baseFret}fr</text>}
    {Array.from({ length: fretCount + 1 }, (_, i) => <line key={`f${i}`} className="cd-fret" x1={x(0)} y1={Y0 + i * FRET} x2={x(5)} y2={Y0 + i * FRET} />)}
    {Array.from({ length: 6 }, (_, s) => <line key={`s${s}`} className="cd-string" x1={x(s)} y1={Y0} x2={x(s)} y2={Y0 + FRET * fretCount} />)}
    {shape.map((fret, s) => {
      if (fret === 'x') return <text key={s} className="cd-mark" x={x(s)} y={Y0 - 6} textAnchor="middle">✕</text>
      if (fret === 0) return <circle key={s} className="cd-open" cx={x(s)} cy={Y0 - 9} r={3} />
      const cy = Y0 + (fret - baseFret + 0.5) * FRET
      return <circle key={s} className="cd-dot" cx={x(s)} cy={cy} r={5} />
    })}
    {labels.map((label, s) => <text key={`l${s}`} className="cd-label" x={x(s)} y={height - 4} textAnchor="middle">{label}</text>)}
  </svg>
}

// A chord name rendered as a chip that, when tapped, pops open its fingering diagram.
// Used everywhere chords appear (sheets, compact show-mode lines, the cheat card).
// Optional `curatedShape` (cheat-card progressions) overrides the generated tab fingering.
// `surface` picks which Settings prefs apply (Cheat vs Chords are independent).
// `songId` enables the per-song "Shapes" toggle (fingering-only chips).
export function ChordChip({ name, curatedShape, surface = 'chords', songId, ghost = false, bare = false }: { name: string; curatedShape?: string; surface?: FingeringSurface; songId?: string; ghost?: boolean; bare?: boolean }) {
  const { settings, isFingeringOnly } = useSettings()
  const prefs = settings[surface]
  const fingeringOnly = !!songId && isFingeringOnly(songId, surface)
  // The per-song Shapes retap is an explicit "show me fingerings" request, so it resolves
  // as if scope were 'all' — under the default power-only scope the mode would otherwise
  // be a silent no-op on every non-power chord ("retap doesn't do anything"). Scope 'none'
  // still wins: it disables the retap toggle, so a stored flag for it is stale.
  const fingering = resolveFingering(name, curatedShape, fingeringOnly && prefs.scope === 'power' ? 'all' : prefs.scope)
  const [open, setOpen] = useState(false)
  const [box, setBox] = useState<{ left: number; top: number; below: boolean; arrow: number } | null>(null)
  const ref = useRef<HTMLSpanElement>(null)
  const popRef = useRef<HTMLSpanElement>(null)
  const shape = useMemo(() => chordShape(name), [name])
  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    const onDown = (event: PointerEvent) => {
      const node = event.target as Node
      if (!ref.current?.contains(node) && !popRef.current?.contains(node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', onDown); document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', close, true) // a fixed popover would drift on scroll — just close it
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey); window.removeEventListener('scroll', close, true) }
  }, [open])
  // Position the popover as a fixed overlay computed from the chip's rect: this can't spill
  // off-screen or expand the page. Clamp it into the viewport horizontally, flip it above or
  // below depending on where the chip sits, and slide its arrow to keep pointing at the chip.
  useLayoutEffect(() => {
    if (!open || !popRef.current || !ref.current) { setBox(null); return }
    const chip = ref.current.getBoundingClientRect()
    const pop = popRef.current.getBoundingClientRect()
    const margin = 8
    const viewport = document.documentElement.clientWidth
    const center = chip.left + chip.width / 2
    const left = Math.max(margin, Math.min(center - pop.width / 2, viewport - pop.width - margin))
    const below = chip.top < window.innerHeight * 0.45 // high on screen → open downward, clear of the header
    const top = below ? chip.bottom + 8 : chip.top - 8 - pop.height
    const limit = Math.max(0, pop.width / 2 - 12) // keep the arrow within the popover
    const arrow = Math.max(-limit, Math.min(limit, center - (left + pop.width / 2)))
    setBox({ left, top, below, arrow })
  }, [open])
  // Numeric tokens are A-string fret cues (The Middle verse, etc.) — chip shows the fret,
  // no diagram popover. Cue tokens (`^1`) are numbered triangle chips linking a lyric word
  // to a matching fill block. Both returns sit below every hook call so a token that flips
  // between kinds at the same tree position can't change the hook order.
  const cue = cueNumber(name)
  if (cue != null) {
    return <b className="chord-chip chord-chip--cue" aria-label={`Fill cue ${cue}`} title={`Fill cue ${cue}`}>{cue}</b>
  }
  if (isFretToken(name)) {
    return <b className="chord-chip chord-chip--fret" aria-label={`A string fret ${name}`} title={`A string fret ${name}`}>{name}</b>
  }
  // First render (box null) lays the popover out hidden so it can be measured; the effect
  // then pins it to the computed spot.
  const style: CSSProperties = box
    ? { position: 'fixed', left: box.left, top: box.top, ['--arrow-x' as string]: `${box.arrow}px` }
    : { position: 'fixed', left: 0, top: 0, visibility: 'hidden' }
  const label = ghost ? `${name} (don't play)` : name
  const pop = open && <span ref={popRef} className={box?.below ? 'chord-pop chord-pop--below' : 'chord-pop'} style={style} role="dialog" aria-label={`${name} chord`}>
    {shape ? <ChordDiagram name={name} shape={shape} /> : <span className="chord-pop-empty">No diagram for {name}</span>}
  </span>
  const openHandlers = {
    onClick: () => setOpen((value) => !value),
    onKeyDown: (event: ReactKeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setOpen((value) => !value) }
    },
  }
  const chipClass = ghost ? 'chord-chip chord-chip--ghost' : 'chord-chip'
  // Per-song Shapes toggle: replace the chord name with a vertical tab chip (still tappable).
  if (fingering && fingeringOnly) {
    return <span className="chord-chip-wrap" ref={ref}>
      <b className={`${chipClass} chord-chip--fingering`} role="button" tabIndex={0} aria-expanded={open}
        aria-label={label} title={ghost ? "Don't play; keep the beat" : undefined} {...openHandlers}>{formatVerticalFingering(fingering)}</b>
      {pop}
    </span>
  }
  const chip = <>
    <b className={chipClass} role="button" tabIndex={0} aria-expanded={open} aria-label={label}
      title={ghost ? "Don't play; keep the beat" : undefined} {...openHandlers}>{name}</b>
    {pop}
  </>
  // Ref stays on the chip-only wrap so the popover aims at the name, not the fingering.
  // `bare`: UG-style above-lyrics mode — name only; tap still opens the diagram.
  if (!fingering || bare) return <span className="chord-chip-wrap" ref={ref}>{chip}</span>
  return <span className={`chord-with-fingering chord-with-fingering--${prefs.position}`}>
    <span className="chord-chip-wrap" ref={ref}>{chip}</span>
    <span className="chord-fingering"><FingeringText text={formatFingering(fingering, prefs.position)} /></span>
  </span>
}

export function Difficulty({ value }: { value: number | null }) {
  return <span className="difficulty" aria-label={`Difficulty ${value ?? 'unknown'} out of 5`}>{value ? '◆'.repeat(value) + '◇'.repeat(5 - value) : 'Unknown'}</span>
}

export function StatusSelect({ songId }: { songId: string }) {
  const { get, patch } = usePractice(); const entry = get(songId)
  return <select aria-label="Practice status" value={entry.status} onChange={(e) => isStatus(e.target.value) && patch(songId, { status: e.target.value })}>
    {statuses.map((status) => <option key={status}>{status}</option>)}
  </select>
}

export function SongCard({ song, compact = false }: { song: Song, compact?: boolean }) {
  const { get } = usePractice(); const entry = get(song.id); const transpose = transposeFor(song.id)
  return <article className="song-card">
    <Link className="song-card-main" to={`/song/${song.id}`}>
      <span className="eyebrow">{String(song.order).padStart(2, '0')} · {entry.status}</span>
      <h3>{song.title}</h3><p>{song.artist}</p>
      {!compact && <><div className="tag-row">{song.tuning !== 'Standard' && <span className="tag">{song.tuning}</span>}{transpose && <span className="tag tag-transpose" title={transposeHint(transpose)}>Transpose {transposeLabel(transpose.semitones)}</span>}<span className="tag">{unknown(song.practiceStyle)}</span><PresetBadges songId={song.id} /></div><Difficulty value={song.difficulty} /></>}
    </Link>
    {!compact && <StatusSelect songId={song.id} />}
  </article>
}

export function Field({ label, value }: { label: string, value: string | number | null }) {
  return <div className="field"><dt>{label}</dt><dd>{unknown(value)}</dd></div>
}

export function PresetBadges({ songId, showNotes = false }: { songId: string, showNotes?: boolean }) {
  const { settings } = useSettings()
  const assignment = ampPresets[songId]
  if (!settings.showAmpChips || !assignment) return null
  return <span className="preset-badges" aria-label="Amp preset">
    {assignment.presets.map((slot, index) => <span className="preset-badge-group" key={slot}>
      {index > 0 && (assignment.footswitch
        ? <StompChip />
        : <span className="preset-joiner" aria-hidden="true">{assignment.joiner}</span>)}
      <b className={`preset-chip bank-${presetBank(slot).toLowerCase()}`} title={`${presetBank(slot)} bank, PRESET knob position ${presetPosition(slot)} (slot ${slot} of 24)`}>{presetLabel(slot)}</b>
    </span>)}
    {showNotes && assignment.notes && <span className="preset-notes">{assignment.notes}</span>}
  </span>
}

// Hollow square chips for the scale's home-row frets (e.g. S.O.B. → [3][15]), shown to
// the right of the amp presets on Cheat / Chords / Tabs.
export function HomeFretBadges({ song }: { song: Song }) {
  const frets = homeFretsFor(song)
  if (!frets.length) return null
  return <span className="home-frets" aria-label="Scale home frets">
    {frets.map((fret) => <b className="home-fret-chip" key={fret} title={`Scale box home at fret ${fret}`}>{fret}</b>)}
  </span>
}

export function AmpPresetField({ songId, showNotes = true }: { songId: string, showNotes?: boolean }) {
  const { settings } = useSettings()
  if (!settings.showAmpChips || !ampPresets[songId]) return null
  return <div className="field"><dt>Amp preset</dt><dd><PresetBadges songId={songId} showNotes={showNotes} /></dd></div>
}

/** Footswitch stomp cue — distinct from round bank chips so it reads as an action. */
export function StompChip({ target }: { target?: string }) {
  const slot = target ? parsePresetLabel(target) : null
  const title = slot != null
    ? `Footswitch: stomp to ${presetBank(slot)} ${presetPosition(slot)}`
    : 'Footswitch: stomp for the other tone'
  return <span className="stomp-chip-group" title={title}>
    <b className="stomp-chip" aria-label={title}>FS</b>
    {slot != null && <b className={`preset-chip bank-${presetBank(slot).toLowerCase()}`} aria-hidden="true">{presetPosition(slot)}</b>}
  </span>
}

// Mid-song amp-change marker authored in a sheet's text as "[Amp: 7Red]" — renders the
// same colored circular chip as the at-a-glance preset badges above.
export function AmpChip({ label }: { label: string }) {
  const slot = parsePresetLabel(label)
  if (slot == null) return <>{label}</>
  return <b className={`preset-chip bank-${presetBank(slot).toLowerCase()}`} title={`${presetBank(slot)} bank, PRESET knob position ${presetPosition(slot)} (slot ${slot} of 24)`}>{presetPosition(slot)}</b>
}

/** Section/cue line: "Amp: 1Red 2Green", "Stomp", or "Stomp: 2Red". */
type SheetAmpCue =
  | { kind: 'amp'; tokens: string[] }
  | { kind: 'stomp'; target?: string }

function parseSheetAmpCue(raw: string): SheetAmpCue | null {
  const text = raw.trim()
  const amp = /^Amp:\s*(.+)$/i.exec(text)
  if (amp) {
    const tokens = amp[1].split(/\s+|→|↔/).map((token) => token.trim()).filter(Boolean)
    return tokens.length ? { kind: 'amp', tokens } : null
  }
  const stomp = /^Stomp(?:\s*:\s*(.+))?$/i.exec(text)
  if (stomp) return { kind: 'stomp', target: stomp[1]?.trim() || undefined }
  return null
}

/** Trailing `^N` on a section title (`Fill ^1`) — chip sits on the FILL line itself. */
function parseSectionCueLabel(raw: string): { label: string; cue: number | null } {
  const match = /^(.*?)\s*(\^[1-9][0-9]?)\s*$/.exec(raw.trim())
  if (!match) return { label: raw.trim(), cue: null }
  return { label: match[1].trim() || raw.trim(), cue: cueNumber(match[2]) }
}

function SheetSectionHeading({ raw }: { raw: string }) {
  const { label, cue } = parseSectionCueLabel(raw)
  if (cue == null) return <h4 className="sheet-section">{label}</h4>
  return <h4 className="sheet-section sheet-section--cue">{label} <ChordChip name={`^${cue}`} /></h4>
}

export function ScalePattern({ value }: { value: string }) {
  const colon = value.indexOf(':')
  if (colon < 0) return <div className="scale-pattern"><p>{unknown(value)}</p></div>

  const name = scaleName(value)
  const firstPattern = value.slice(colon + 1).split(/,\s*or\s+/i)[0]
  const strings = firstPattern.split('/').slice(0, 6).map((part) => [...part.matchAll(/\d+/g)].map((match) => Number(match[0])))
  if (strings.length !== 6 || strings.some((frets) => frets.length < 2)) return <div className="scale-pattern"><strong>{name}</strong><p>{value.slice(colon + 1).trim()}</p></div>

  const usedFrets = strings.flat()
  const min = Math.min(...usedFrets)
  const max = Math.max(...usedFrets)
  const frets = Array.from({ length: max - min + 1 }, (_, index) => min + index)
  const rootAt = (stringIndex: number, fret: number) =>
    /minor box 1/i.test(name) && ((stringIndex === 0 && fret === strings[0][0]) || (stringIndex === 2 && fret === strings[2][1]) || (stringIndex === 5 && fret === strings[5][0]))
  const gridStyle = { '--fret-count': frets.length } as CSSProperties

  return <figure className="scale-pattern" aria-label={`${name} fretboard pattern`}>
    <figcaption><strong>{name}</strong><span><i className="root-key">R</i> named minor root</span></figcaption>
    <div className="fret-numbers" style={gridStyle}><span>String</span>{frets.map((fret) => <span key={fret}>{fret}</span>)}</div>
    {strings.map((_, displayIndex) => {
      const stringIndex = strings.length - 1 - displayIndex
      const notes = strings[stringIndex]
      return <div className="fret-string" style={gridStyle} key={stringIndex}>
        <span className="string-name">{6 - stringIndex}{stringIndex === 0 ? ' low' : stringIndex === 5 ? ' high' : ''}</span>
        {frets.map((fret) => <span className="fret-cell" key={fret}>{notes.includes(fret) && <b className={rootAt(stringIndex, fret) ? 'root' : ''}>{rootAt(stringIndex, fret) ? 'R' : fret}</b>}</span>)}
      </div>
    })}
  </figure>
}

export function FretboardPanel({ song }: { song: Song }) {
  const { hasToggle } = resolveFretboards(song)
  const [version, setVersion] = useState<FretboardVersion>('standard')
  const value = fretboardForVersion(song, version)
  const alt = useMemo(() => octaveUpVariant(value), [value])
  return <>
    <details className="fretboard-disclosure">
      <summary>{scaleName(value)}</summary>
      {hasToggle && <div className="fretboard-toggle" role="tablist" aria-label="Fretboard tuning reference">
        <button type="button" role="tab" aria-selected={version === 'standard'} className={version === 'standard' ? 'active' : ''} onClick={() => setVersion('standard')}>Standard tuning</button>
        <button type="button" role="tab" aria-selected={version === 'original'} className={version === 'original' ? 'active' : ''} onClick={() => setVersion('original')}>Original / recording</button>
      </div>}
      <ScalePattern value={value} />
    </details>
    {alt && <details className="fretboard-disclosure">
      <summary>Also playable: box 1 at {alt.fret}th</summary>
      <ScalePattern value={alt.value} />
    </details>}
  </>
}

export function SongLinks({ song, showBackingTrack = true }: { song: Song, showBackingTrack?: boolean }) {
  const { get, patch } = usePractice(); const entry = get(song.id)
  const searches = tabSearchUrls(song)
  const savedSongsterr = isSiteUrl(entry.savedSongsterrUrl, 'songsterr.com') ? entry.savedSongsterrUrl : ''
  const savedUltimateGuitar = isSiteUrl(entry.savedUltimateGuitarUrl, 'ultimate-guitar.com') ? entry.savedUltimateGuitarUrl : ''
  return <div className="actions song-links">
    {showBackingTrack && song.backingTrackUrl && <a className="button" href={song.backingTrackUrl} target="_blank" rel="noreferrer"><span className="button-text">Open backing track</span><span className="button-arrow" aria-hidden="true">↗</span></a>}
    <TabServiceControl label="Songsterr" domain="songsterr.com" savedUrl={entry.savedSongsterrUrl} openUrl={savedSongsterr || song.songsterrUrl} isSaved={!!savedSongsterr} searchUrl={searches.songsterr} onChange={(value) => patch(song.id, { savedSongsterrUrl: value })}/>
    <TabServiceControl label="Ultimate Guitar" domain="ultimate-guitar.com" savedUrl={entry.savedUltimateGuitarUrl} openUrl={savedUltimateGuitar || song.ultimateGuitarUrl} isSaved={!!savedUltimateGuitar} searchUrl={searches.ultimateGuitar} alignRight onChange={(value) => patch(song.id, { savedUltimateGuitarUrl: value })}/>
  </div>
}

function TabServiceControl({ label, domain, savedUrl, openUrl, searchUrl, isSaved, alignRight = false, onChange }: { label: string, domain: string, savedUrl: string, openUrl: string, searchUrl: string, isSaved: boolean, alignRight?: boolean, onChange: (value: string) => void }) {
  const valid = !savedUrl || isSiteUrl(savedUrl, domain)
  const destination = openUrl || searchUrl
  return <div className={`tab-split ${isSaved ? 'has-saved' : ''} ${alignRight ? 'align-right' : ''}`}>
    <a className="button secondary" href={destination} target="_blank" rel="noreferrer"><span className="button-text">{isSaved ? `${label} ✓` : label}</span><span className="button-arrow" aria-hidden="true">↗</span></a>
    <details className="tab-manage"><summary aria-label={`Manage ${label} shortcut`}>⌄</summary><div className="tab-control-menu">
      <strong>{label} shortcut</strong><p>Choose a version in search, copy its address, and paste it here.</p>
      <label><span>Exact version URL</span><input type="url" value={savedUrl} aria-invalid={!valid} onChange={(event) => onChange(event.target.value.trim())} placeholder={`https://${domain}/…`} /></label>
      {!valid && <small>Paste a {domain} URL.</small>}
      <div className="tab-control-actions"><a href={searchUrl} target="_blank" rel="noreferrer">{openUrl ? 'Search another version' : `Search ${label}`} ↗</a>{savedUrl && <button className="text-button" onClick={() => onChange('')}>Clear saved URL</button>}</div>
    </div></details>
  </div>
}

function AmpMarkerSection({ cue }: { cue: SheetAmpCue }) {
  if (cue.kind === 'stomp') return <div className="sheet-section amp-marker"><StompChip target={cue.target} /></div>
  return <div className="sheet-section amp-marker">{cue.tokens.map((token, i) => <AmpChip label={token} key={i} />)}</div>
}

/** UG-style: chord name above the lyric segment where it falls. Name-only chips
 *  (no under-fingerings) so the lyric stays readable and dense like UG charts.
 *
 *  Columns split at every chord (a chip sits above the text that follows), but they
 *  are grouped into WORDS so a chord landing mid-word (e.g. "th"+[B]+"e" for "the")
 *  can't push half the word onto the next line. Each word is a nowrap unit; the line
 *  wraps only at spaces between words. Sub-word chip placement is preserved. */
interface AboveCol { chord?: string; ghost?: boolean; text: string }
function aboveWords(parts: SheetPart[]): AboveCol[][] {
  const groups: AboveCol[][] = []
  let group: AboveCol[] = []
  let col: AboveCol | null = null
  const pushCol = () => { if (col && (col.chord || col.text)) group.push(col); col = null }
  const pushGroup = () => { pushCol(); if (group.length) { groups.push(group); group = [] } }
  for (const part of parts) {
    if (part.chord) { pushCol(); col = { chord: part.chord, ghost: part.ghost, text: '' }; continue }
    if (part.text == null) continue
    for (const ch of part.text) {
      if (!col) col = { text: '' }
      col.text += ch
      if (/\s/.test(ch)) pushGroup() // space ends the word — the only place a wrap may fall
    }
  }
  pushGroup()
  return groups
}

function LyricLineInline({ parts, songId }: { parts: SheetPart[]; songId?: string }) {
  // Fill cues (`^1`) must sit above the following word even when the user prefers inline
  // chords — fall through to the above layout for any line that carries one.
  if (parts.some((part) => part.chord && isCueToken(part.chord))) {
    return <LyricLineAbove parts={parts} songId={songId} />
  }
  const chordsOnly = parts.every((part) => part.chord)
  return <p className={chordsOnly ? 'sheet-line sheet-line--chords' : 'sheet-line'}>
    {parts.map((part, i) => part.chord
      ? <ChordChip name={part.chord} ghost={part.ghost} songId={songId} key={i} />
      : <span key={i}>{part.text}</span>)}
  </p>
}

function LyricLineAbove({ parts, songId }: { parts: SheetPart[]; songId?: string }) {
  if (parts.every((part) => part.chord)) {
    return <p className="sheet-line sheet-line--chords sheet-line--above-chords">
      {parts.map((part, i) => part.chord
        ? <ChordChip name={part.chord} ghost={part.ghost} songId={songId} bare key={i} />
        : null)}
    </p>
  }
  // No chords on this line — skip the empty chord slot and render plain text so
  // chordless lyric lines don't each eat a wasted ~1.35em row (denser, less scroll).
  if (parts.every((part) => !part.chord)) {
    return <p className="sheet-line sheet-line--above-plain">
      {parts.map((part, i) => <span key={i}>{part.text}</span>)}
    </p>
  }
  return <div className="sheet-line sheet-line--above">
    {aboveWords(parts).map((group, gi) => (
      <span className="sheet-above-word" key={gi}>
        {group.map((col, ci) => (
          <span className="sheet-above-col" key={ci}>
            <span className="sheet-above-chord">
              {col.chord ? <ChordChip name={col.chord} ghost={col.ghost} songId={songId} bare /> : null}
            </span>
            <span className="sheet-above-lyric">{col.text}</span>
          </span>
        ))}
      </span>
    ))}
  </div>
}

export function ChordSheetView({ text, songId, compact = false, frets = false }: { text: string, songId?: string, compact?: boolean, frets?: boolean }) {
  const sheet = useMemo(() => parseChordSheet(text, { frets }), [text, frets])
  const { settings } = useSettings()
  const above = settings.lyricChordPlacement === 'above'
  const showAmp = settings.showAmpChips
  if (compact) {
    return <div className="sheet-compact">{compactSheet(sheet).map((line, index) => {
      if (line.kind === 'section') {
        const cue = parseSheetAmpCue(line.cue)
        if (cue) return showAmp ? <AmpMarkerSection cue={cue} key={index} /> : null
        const { label, cue: fillCue } = parseSectionCueLabel(line.cue)
        return <div className={fillCue != null ? 'sheet-section sheet-section--cue' : 'sheet-section'} key={index}>
          {label}{fillCue != null ? <>{' '}<ChordChip name={`^${fillCue}`} /></> : null}
        </div>
      }
      return line.kind === 'tab'
        ? <pre className="sheet-tab" key={index}>{line.cue}</pre>
        : <div className="compact-line" key={index}><span className="compact-chords">{line.chords.map((chord, i) => <ChordChip name={chord} songId={songId} key={i} />)}</span><span className="compact-cue">{line.cue}</span></div>
    })}</div>
  }
  return <div className="sheet-full">
    {sheet.meta.map((line, index) => <p className="sheet-meta" key={index}>{line}</p>)}
    {sheet.lines.map((line, index) => {
      if (line.kind === 'section') {
        const cue = parseSheetAmpCue(line.raw)
        if (cue) return showAmp ? <AmpMarkerSection cue={cue} key={index} /> : null
        return <SheetSectionHeading raw={line.raw} key={index} />
      }
      if (line.kind === 'tab') return <pre className="sheet-tab" key={index}>{line.raw}</pre>
      return above
        ? <LyricLineAbove parts={line.parts} songId={songId} key={index} />
        : <LyricLineInline parts={line.parts} songId={songId} key={index} />
    })}
  </div>
}

// [^\]\n] (not just [^\]]) caps a typo'd unclosed marker to one line instead of
// swallowing everything up to the next ']' in the file (tabs already use '[...]'
// for section headers, e.g. "[[A] Intro]").
const AMP_INLINE_MARKER_RE = /\[(?:Amp|Stomp):\s*([^\]\n]+)\]|\[Stomp\]/gi

export function TabText({ text }: { text: string }) {
  const { settings } = useSettings()
  const showAmp = settings.showAmpChips
  const nodes: ReactNode[] = []
  const re = new RegExp(AMP_INLINE_MARKER_RE)
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = re.exec(text))) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index))
    if (showAmp) {
      const inner = match[0].slice(1, -1) // strip [ ]
      const cue = parseSheetAmpCue(inner)
      if (cue?.kind === 'stomp') nodes.push(<StompChip target={cue.target} key={match.index} />)
      else if (cue?.kind === 'amp') {
        cue.tokens.forEach((token, i) => nodes.push(<AmpChip label={token} key={`${match!.index}-${i}`} />))
      }
    }
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))
  return <pre className="tab-text">{nodes}</pre>
}

// Cheat-card version picker (hidden Dev mode flag + local dev server): songId -> archived
// version label, '' / absent = the live "Current" entry. Per-device review preference,
// NOT synced practice data. The picker renders only where the device-local devMode
// setting is on (or under the local dev server), so a device that never flips it always
// plays the current card even if this key somehow exists there. Key suffix mirrors the
// practice store's /dev/ split (same expression as pages.tsx's SHOW_KEY_SUFFIX; importing
// it from there would be a components→pages cycle).
const CHEAT_VERSION_KEY = `overdrive-cheat-version${import.meta.env.BASE_URL.includes('/dev/') ? '-dev' : ''}`
const readCheatVersionChoices = (): Record<string, string> => {
  try { const p = JSON.parse(localStorage.getItem(CHEAT_VERSION_KEY) || '{}'); return p && typeof p === 'object' ? p : {} } catch { return {} }
}

/** Highlight ×N / xN in section labels (e.g. "Verse ×4") so the count reads white. */
function renderProgLabel(label: string) {
  const parts = label.split(/([×xX]\s*\d+)/u)
  return parts.map((part, i) =>
    /^[×xX]\s*\d+$/u.test(part)
      ? <span className="cheat-prog-label-times" key={i}>{part}</span>
      : part)
}

// The two progression cards, one component — show mode's Cheat and Chords tabs, and the
// same cards on the practice page's sheet panel. `variant` 'chords' is the full roadmap
// card (form order + repeats — the original "cheat card", now the Chords tab); 'cheat'
// is the building-blocks card (each section once, plus fills — trusts the player to know
// the song's shape). `innerRef` is the height auto-fit ref from Show(), which pins the
// chord rows to one screen; omit it (practice page) and the card renders at natural
// height. `withMore` gates the Cheat variant's below-fold fretboard/role/must-know block
// — the practice page passes false because it already shows those in its own panels.
export function CheatCard({ song, innerRef, variant, zoomFrozen = false, withMore = true }: { song: Song, innerRef?: RefObject<HTMLDivElement | null>, variant: 'cheat' | 'chords', zoomFrozen?: boolean, withMore?: boolean }) {
  const sheets = sheetsFor(song.id)
  const ownNotes = usePractice().get(song.id).notes.trim() // the player's own stage reminders
  const { settings } = useSettings()
  // Dev-mode version picker (roadmap card only): choose an archived cheat-card version to
  // render instead of the live entry, so old and new forms can be A/B'd against the
  // recording. The Cheat card always shows the CURRENT sections — the refined data is
  // the source of truth, not the pre-research basic forms.
  const versionsUi = import.meta.env.DEV || settings.devMode
  const versions = variant === 'chords' && versionsUi ? progressionVersionsFor(song.id) : []
  const [versionChoices, setVersionChoices] = useState(readCheatVersionChoices)
  const pickVersion = (label: string) => {
    const next = { ...versionChoices }
    if (label) next[song.id] = label
    else delete next[song.id]
    setVersionChoices(next)
    try { localStorage.setItem(CHEAT_VERSION_KEY, JSON.stringify(next)) } catch { /* storage full/blocked: picker still works for this session */ }
  }
  const chosenLabel = versions.length ? versionChoices[song.id] ?? '' : ''
  const chosen = chosenLabel ? versions.find((v) => v.label === chosenLabel) ?? null : null
  // Prefer the curated per-section progression; fall back to one derived from the chord
  // sheet (a single loop, or the distinct chords used) when a song isn't researched yet.
  const custom = chosen ?? progressionFor(song.id)
  const derived = useMemo(() => (!custom && sheets.chords ? chordProgression(sheets.chords) : null), [custom, sheets.chords])
  // Roadmap variant: `form` order when set (labels like "Verse ×4"), fills excluded.
  // Cheat variant: each section once in stored order, fills included.
  const rows = custom
    ? (variant === 'chords' ? cheatRowsFor(custom) : basicRowsFor(custom))
    : derived?.map((row) => ({
        label: row.label,
        spans: row.chords.map((chord): CheatChordSpan => ({ chords: [chord], ghosts: [false], shapes: [], times: 1 })),
        hint: undefined as string | undefined,
        tab: undefined as string | undefined,
        tabMore: undefined as string | undefined,
      }))
  // Re-run height auto-fit after More fills opens/closes — otherwise the newly
  // revealed tabs overflow (or leave empty space) until the next resize. The
  // secondary "More" details (fretboard/fields) does NOT refit — chips keep size.
  // Suspended while pinch-zoomed: the user owns --sheet-fit's baseline then, and a
  // refit here would divide the zoom back out (same fight useFitScale's `frozen` avoids).
  // No-op without an innerRef (practice page): natural height, nothing to fit.
  const refitCheat = () => {
    const el = innerRef?.current
    if (!el || zoomFrozen) return
    requestAnimationFrame(() => {
      el.style.setProperty('--sheet-fit', '1')
      const ratio = el.clientHeight / el.scrollHeight
      el.style.setProperty('--sheet-fit', String(ratio < 1 ? Math.max(0.7, ratio * 0.97) : 1))
    })
  }
  // Switching card versions changes row count without changing song — refit or the
  // taller/shorter card keeps the previous version's scale.
  useEffect(() => { refitCheat() }, [chosenLabel]) // eslint-disable-line react-hooks/exhaustive-deps
  return <div className="cheat-card">
    {/* Exactly one card-height (flex-shrink:0), so the chord rows own the first screen and
        the reference block below can't steal height from them. Auto-fit measures `.cheat-fit`
        inside this box, so the version picker reduces its space without escaping the fold. */}
    <div className={`cheat-screen${variant === 'cheat' ? ' cheat-screen-peek' : ''}`}>
      {versions.length > 0 && <label className="cheat-version">
        <span>Card version</span>
        <select
          value={chosen ? chosenLabel : ''}
          onChange={(e) => pickVersion(e.target.value)}
        >
          <option value="">Current</option>
          {versions.map((v) => <option key={v.label} value={v.label}>{v.label}</option>)}
        </select>
      </label>}
      <div className="cheat-fit" ref={innerRef}>
        {rows && <div className="cheat-progression">
          {rows.map((row, i) => <div className="cheat-prog-row" key={i}>
            <span className="cheat-prog-label">{renderProgLabel(row.label)}</span>
            <div className="cheat-prog-body">
              <span className="cheat-prog-chords">{row.spans.map((span, s) =>
                <span className={span.breakBefore ? 'cheat-prog-span cheat-prog-span--line' : 'cheat-prog-span'} key={s}>
                  {span.chords.map((chord, j) =>
                    <ChordChip name={chord} curatedShape={span.shapes[j]} ghost={span.ghosts[j]} surface="cheat" songId={song.id} key={j} />)}
                  {span.times > 1 && <span className="cheat-prog-times" aria-label={`repeat ${span.times} times`}>×{span.times}</span>}
                </span>)}</span>
              {row.hint && <span className="cheat-prog-hint">{row.hint}</span>}
              {row.tab && <pre className="cheat-prog-tab">{row.tab}</pre>}
              {row.tabMore && <MoreFills tab={row.tabMore} onToggle={refitCheat} />}
            </div>
          </div>)}
        </div>}
      </div>
    </div>
    {/* Cheat tab only: plain content past the fold rather than a disclosure — scroll the
        card to reach it. The roadmap card doesn't carry it at all. */}
    {variant === 'cheat' && withMore && <div className="cheat-more">
      <div className="show-content">
        <div className="show-scale"><FretboardPanel song={song} /><dl><Field label="Scale hint" value={song.scaleHint} /></dl></div>
        <div className="show-fields">
          <Field label="Role" value={song.role} />
          <Field label="Must know" value={song.mustKnow} />
          <Field label="Fallback" value={song.fallback} />
          {ownNotes && <Field label="My notes" value={ownNotes} />}
        </div>
      </div>
    </div>}
  </div>
}

/** Extra ASCII fills behind a disclosure. Bottom "Hide fills" stays reachable after
 *  auto-fit scrolls the summary off-screen; summary itself also relabels when open. */
function MoreFills({ tab, onToggle }: { tab: string, onToggle: () => void }) {
  const detailsRef = useRef<HTMLDetailsElement>(null)
  const [open, setOpen] = useState(false)
  const hide = () => {
    const details = detailsRef.current
    if (!details || !details.open) return
    details.open = false
  }
  return <details
    className="cheat-prog-more"
    ref={detailsRef}
    onToggle={(e) => {
      const next = e.currentTarget.open
      setOpen(next)
      onToggle()
      if (next) {
        // After refit shrinks the card, keep the summary on-screen so the top control stays tappable.
        requestAnimationFrame(() => {
          detailsRef.current?.querySelector('summary')?.scrollIntoView({ block: 'nearest' })
        })
      }
    }}
  >
    <summary>{open ? 'Hide fills' : 'More fills'}</summary>
    <pre className="cheat-prog-tab">{tab}</pre>
    <button type="button" className="cheat-prog-hide" onClick={hide}>Hide fills</button>
  </details>
}

// Practice-page sheet ids. 'cheat' and 'roadmap' are the two progression cards (labels
// Cheat / Chords, matching show mode — 'roadmap' because the id 'chords' already means
// the lyric sheet here, part of the 2026-07 label/internals split; see CLAUDE.md).
// 'ryan' is the flag-gated personal sheet (only for songs with a .ryan.txt file).
export type SheetKind = 'cheat' | 'roadmap' | 'chords' | 'tabs' | 'ryan'

// Sheet panel on the song (practice) page — the same views as show mode: Cheat
// (building-blocks card), Chords (roadmap card), Lyrics (chord-over-lyric sheet), Tabs,
// plus the flag-gated Ryan sheet in front when the song has one.
// `view`/`onViewChange` keep the selection so the toggle can switch it.
export function SheetPanel({ song, view, onViewChange }: { song: Song, view: SheetKind | null, onViewChange: (kind: SheetKind) => void }) {
  const { get } = usePractice(); const entry = get(song.id)
  const { settings, isFingeringOnly, toggleFingeringOnly } = useSettings()
  const sheets = sheetsFor(song.id)
  // The cards render from a curated progression, or derive one from the chords sheet.
  const hasCard = !!progressionFor(song.id) || !!sheets.chords
  const available: SheetKind[] = [
    ...(sheets.ryan && settings.ryanTab ? (['ryan'] as SheetKind[]) : []),
    ...(hasCard ? (['cheat', 'roadmap'] as SheetKind[]) : []),
    ...(sheets.chords ? (['chords'] as SheetKind[]) : []),
    ...(sheets.tabs ? (['tabs'] as SheetKind[]) : []),
  ]
  // Default stays the lyric/tab sheet (the pre-cards behavior); the cards are a tap away.
  const preferred = entry.preferredSource === 'tabs' || entry.preferredSource === 'chords' ? entry.preferredSource : null
  const sheetDefault = (['chords', 'tabs'] as const).find((kind) => available.includes(kind))
  const active = view && available.includes(view) ? view : preferred && available.includes(preferred) ? preferred : sheetDefault ?? available[0]
  // Fingering surfaces predate the tab rename: 'cheat' governs chips on BOTH progression
  // cards (one toggle per song, same as show mode); 'chords' governs the Lyrics sheet.
  const cardShapes = isFingeringOnly(song.id, 'cheat')
  const chordsShapes = isFingeringOnly(song.id, 'chords')
  // Autoscroll for the two text sheets, sharing show mode's per-song synced speed
  // (PracticeEntry.scrollSpeed). The sheet scrolls inside a capped-height container
  // (.practice-sheet) so the crawl has a scrollport. Hooks stay above the early return.
  // chordsShapes is in the reset key: a fingering-chip retap re-lays-out the lyric sheet
  // (different height), so "scrollable" must re-measure or the ▶ bar strands stale.
  const sheetRef = useRef<HTMLDivElement>(null)
  const scroll = useAutoScrollControls(sheetRef, song.id, [song.id, active, chordsShapes])
  if (!available.length) return <section className="panel chord-panel" id="song-sheet"><h2>Song sheets</h2><p className="launcher-hint">Nothing built in for this song yet.</p></section>
  const selectCard = (kind: 'cheat' | 'roadmap') => {
    if (active === kind) {
      if (settings.cheat.scope !== 'none') toggleFingeringOnly(song.id, 'cheat')
    } else onViewChange(kind)
  }
  const selectChords = () => {
    if (active === 'chords') {
      if (settings.chords.scope !== 'none') toggleFingeringOnly(song.id, 'chords')
    } else onViewChange('chords')
  }
  const cardTab = (kind: 'cheat' | 'roadmap', label: string) => <button type="button" role="tab" aria-selected={active === kind} aria-pressed={active === kind ? cardShapes : undefined}
    className={shapesTabClass(active === kind, cardShapes, settings.cheat.scope !== 'none')}
    title={active === kind && settings.cheat.scope !== 'none' ? (cardShapes ? 'Showing fingering chips. Tap again for Settings layout' : 'Tap again for fingering chips') : undefined}
    onClick={() => selectCard(kind)}>{label}</button>
  return <section className="panel chord-panel" id="song-sheet">
    <div className="section-heading"><div><h2>Song sheets</h2></div>
      {available.length > 1 && <div className="fretboard-toggle" role="tablist" aria-label="Sheet type">
        {available.includes('ryan') && <button type="button" role="tab" aria-selected={active === 'ryan'} className={active === 'ryan' ? 'active' : ''} onClick={() => onViewChange('ryan')}>Ryan</button>}
        {hasCard && cardTab('cheat', 'Cheat')}
        {hasCard && cardTab('roadmap', 'Chords')}
        {available.includes('chords') && <button type="button" role="tab" aria-selected={active === 'chords'} aria-pressed={active === 'chords' ? chordsShapes : undefined}
          className={shapesTabClass(active === 'chords', chordsShapes, settings.chords.scope !== 'none')}
          title={active === 'chords' && settings.chords.scope !== 'none' ? (chordsShapes ? 'Showing fingering chips. Tap again for Settings layout' : 'Tap again for fingering chips') : undefined}
          onClick={selectChords}>Lyrics</button>}
        {available.includes('tabs') && <button type="button" role="tab" aria-selected={active === 'tabs'} className={active === 'tabs' ? 'active' : ''} onClick={() => onViewChange('tabs')}>Tabs</button>}
      </div>}
    </div>
    {(active === 'chords' || active === 'tabs' || active === 'ryan') && scroll.scrollable && <AutoScrollBar scroll={scroll}/>}
    {active === 'cheat' || active === 'roadmap'
      ? <CheatCard song={song} variant={active === 'cheat' ? 'cheat' : 'chords'} withMore={false}/>
      : <div className="practice-sheet" ref={sheetRef}>
          <div className="autoscroll-inner">
            {active === 'ryan' ? <ChordSheetView text={sheets.ryan!} songId={song.id} frets/>
              : active === 'chords' ? <ChordSheetView text={sheets.chords!} songId={song.id}/>
              : <TabText text={sheets.tabs!}/>}
          </div>
        </div>}
  </section>
}

// Inline YouTube backing-track player with a play/pause toggle — self-contained so
// it can drop anywhere a song card needs it.
export function BackingTrack({ song }: { song: Song }) {
  const [playing, setPlaying] = useState(false)
  const videoId = youtubeId(song.backingTrackUrl)
  if (!videoId) return null
  return <>
    <button className="backing-play" onClick={() => setPlaying((value) => !value)}>{playing ? 'Stop backing track' : 'Play backing track'}</button>
    {playing && <div className="backing-player"><iframe src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1`} title={`Backing track for ${song.title}`} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen /></div>}
  </>
}

// Backing-track panel for the song page: play the track here and scroll to whatever
// you want to see below. (No embed possible for a few songs — fall back to a link.)
export function PracticeLauncher({ song }: { song: Song }) {
  const videoId = youtubeId(song.backingTrackUrl)
  if (!song.backingTrackUrl) return null
  return <section className="practice-launcher">
    {videoId
      ? <BackingTrack song={song} />
      : <a className="button backing-play" href={song.backingTrackUrl} target="_blank" rel="noreferrer"><span className="button-text">Open backing track</span><span className="button-arrow" aria-hidden="true">↗</span></a>}
  </section>
}

function youtubeId(url: string) {
  if (!url) return ''
  try {
    const parsed = new URL(url)
    if (/(^|\.)youtu\.be$/.test(parsed.hostname)) return parsed.pathname.slice(1).split('/')[0]
    if (/(^|\.)youtube(-nocookie)?\.com$/.test(parsed.hostname)) {
      if (parsed.pathname === '/watch') return parsed.searchParams.get('v') || ''
      const match = parsed.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]+)/)
      if (match) return match[1]
    }
  } catch { /* not a URL */ }
  return ''
}

function tabSearchUrls(song: Song) {
  const query = encodeURIComponent(`${song.title} ${song.artist}`)
  return {
    songsterr: `https://www.songsterr.com/?pattern=${query}`,
    ultimateGuitar: `https://www.ultimate-guitar.com/search.php?search_type=title&value=${query}`
  }
}

function isSiteUrl(value: string, domain: string) {
  if (!value) return false
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) && (url.hostname === domain || url.hostname.endsWith(`.${domain}`))
  } catch { return false }
}

export function PracticeControls({ song }: { song: Song }) {
  const { get, patch } = usePractice(); const entry = get(song.id)
  return <section className="panel practice-controls">
    <span className="eyebrow">Your local data</span>
    <h2>Practice notes</h2>
    <div className="practice-fields">
      <label><span>Status</span><StatusSelect songId={song.id} /></label>
      <label><span>Priority</span><select value={entry.priority} onChange={(e) => patch(song.id, { priority: Number(e.target.value) })}><option value="0">None</option><option value="1">Low</option><option value="2">Medium</option><option value="3">High</option></select></label>
      <label className="practice-notes"><span>Quick notes</span><textarea value={entry.notes} onChange={(e) => patch(song.id, { notes: e.target.value })} placeholder="Fingering, tone, rehearsal changes…" /></label>
    </div>
    {/* Keyed: beats/feel seed from bpm.json at mount, so a song change must remount. */}
    <Metronome songId={song.id} key={song.id} />
  </section>
}
