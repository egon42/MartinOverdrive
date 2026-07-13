import { Link } from 'react-router-dom'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { compactSheet, parseChordSheet } from './chords'
import { chordShape, type ChordShape } from './chordShapes'
import type { Song } from './types'
import { statuses } from './types'
import { fretboardForVersion, octaveUpVariant, resolveFretboards, scaleName, type FretboardVersion } from './fretboard'
import { isStatus, usePractice } from './storage'
import { ampPresets, parsePresetLabel, presetBank, presetLabel, presetPosition } from './presets'
import { sheetsFor } from './sheets'
import { transposeFor, transposeLabel, transposeHint } from './transpose'
import { formatFingering, formatVerticalFingering, resolveFingering, useSettings, type FingeringSurface } from './settings'

export const unknown = (value: string | number | null) => value === '' || value == null ? 'Not provided' : value

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
export function ChordChip({ name, curatedShape, surface = 'chords', songId }: { name: string; curatedShape?: string; surface?: FingeringSurface; songId?: string }) {
  const { settings, isFingeringOnly } = useSettings()
  const prefs = settings[surface]
  const fingeringOnly = !!songId && isFingeringOnly(songId, surface)
  const fingering = resolveFingering(name, curatedShape, prefs.scope)
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
  // First render (box null) lays the popover out hidden so it can be measured; the effect
  // then pins it to the computed spot.
  const style: CSSProperties = box
    ? { position: 'fixed', left: box.left, top: box.top, ['--arrow-x' as string]: `${box.arrow}px` }
    : { position: 'fixed', left: 0, top: 0, visibility: 'hidden' }
  const pop = open && <span ref={popRef} className={box?.below ? 'chord-pop chord-pop--below' : 'chord-pop'} style={style} role="dialog" aria-label={`${name} chord`}>
    {shape ? <ChordDiagram name={name} shape={shape} /> : <span className="chord-pop-empty">No diagram for {name}</span>}
  </span>
  const openHandlers = {
    onClick: () => setOpen((value) => !value),
    onKeyDown: (event: ReactKeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setOpen((value) => !value) }
    },
  }
  // Per-song Shapes toggle: replace the chord name with a vertical tab chip (still tappable).
  if (fingering && fingeringOnly) {
    return <span className="chord-chip-wrap" ref={ref}>
      <b className="chord-chip chord-chip--fingering" role="button" tabIndex={0} aria-expanded={open}
        aria-label={name} {...openHandlers}>{formatVerticalFingering(fingering)}</b>
      {pop}
    </span>
  }
  const chip = <>
    <b className="chord-chip" role="button" tabIndex={0} aria-expanded={open} {...openHandlers}>{name}</b>
    {pop}
  </>
  // Ref stays on the chip-only wrap so the popover aims at the name, not the fingering.
  if (!fingering) return <span className="chord-chip-wrap" ref={ref}>{chip}</span>
  return <span className={`chord-with-fingering chord-with-fingering--${prefs.position}`}>
    <span className="chord-chip-wrap" ref={ref}>{chip}</span>
    <span className="chord-fingering">{formatFingering(fingering, prefs.position)}</span>
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
  const assignment = ampPresets[songId]
  if (!assignment) return null
  return <span className="preset-badges" aria-label="Amp preset">
    {assignment.presets.map((slot, index) => <span className="preset-badge-group" key={slot}>
      {index > 0 && <span className="preset-joiner" aria-hidden="true">{assignment.joiner}</span>}
      <b className={`preset-chip bank-${presetBank(slot).toLowerCase()}`} title={`${presetBank(slot)} bank, PRESET knob position ${presetPosition(slot)} (slot ${slot} of 24)`}>{presetLabel(slot)}</b>
    </span>)}
    {showNotes && assignment.notes && <span className="preset-notes">{assignment.notes}</span>}
  </span>
}

export function AmpPresetField({ songId, showNotes = true }: { songId: string, showNotes?: boolean }) {
  if (!ampPresets[songId]) return null
  return <div className="field"><dt>Amp preset</dt><dd><PresetBadges songId={songId} showNotes={showNotes} /></dd></div>
}

// Mid-song amp-change marker authored in a sheet's text as "[Amp: 7Red]" — renders the
// same colored circular chip as the at-a-glance preset badges above.
export function AmpChip({ label }: { label: string }) {
  const slot = parsePresetLabel(label)
  if (slot == null) return <>{label}</>
  return <b className={`preset-chip bank-${presetBank(slot).toLowerCase()}`} title={`${presetBank(slot)} bank, PRESET knob position ${presetPosition(slot)} (slot ${slot} of 24)`}>{presetPosition(slot)}</b>
}

// Splits the captured group of an "Amp: 7Red 2Green" (or "Amp: 7Red → 2Green") marker
// into individual preset-label tokens for AmpChip. Returns null if raw isn't an amp marker.
function ampMarkerTokens(raw: string): string[] | null {
  const match = /^Amp:\s*(.+)$/i.exec(raw.trim())
  if (!match) return null
  return match[1].split(/\s+|→/).map((token) => token.trim()).filter(Boolean)
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

function AmpMarkerSection({ tokens }: { tokens: string[] }) {
  return <div className="sheet-section amp-marker">{tokens.map((token, i) => <AmpChip label={token} key={i} />)}</div>
}

export function ChordSheetView({ text, songId, compact = false }: { text: string, songId?: string, compact?: boolean }) {
  const sheet = useMemo(() => parseChordSheet(text), [text])
  if (compact) {
    return <div className="sheet-compact">{compactSheet(sheet).map((line, index) => {
      if (line.kind === 'section') {
        const tokens = ampMarkerTokens(line.cue)
        return tokens ? <AmpMarkerSection tokens={tokens} key={index} /> : <div className="sheet-section" key={index}>{line.cue}</div>
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
        const tokens = ampMarkerTokens(line.raw)
        return tokens ? <AmpMarkerSection tokens={tokens} key={index} /> : <h4 className="sheet-section" key={index}>{line.raw}</h4>
      }
      return line.kind === 'tab'
        ? <pre className="sheet-tab" key={index}>{line.raw}</pre>
        : <p className={line.parts.every((part) => part.chord) ? 'sheet-line sheet-line--chords' : 'sheet-line'} key={index}>{line.parts.map((part, i) => part.chord ? <ChordChip name={part.chord} songId={songId} key={i} /> : <span key={i}>{part.text}</span>)}</p>
    })}
  </div>
}

// [^\]\n] (not just [^\]]) caps a typo'd unclosed marker to one line instead of
// swallowing everything up to the next ']' in the file (tabs already use '[...]'
// for section headers, e.g. "[[A] Intro]").
const AMP_INLINE_MARKER_RE = /\[Amp:\s*([^\]\n]+)\]/gi

export function TabText({ text }: { text: string }) {
  const nodes: ReactNode[] = []
  const re = new RegExp(AMP_INLINE_MARKER_RE)
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = re.exec(text))) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index))
    const tokens = match[1].split(/\s+|→/).map((token) => token.trim()).filter(Boolean)
    tokens.forEach((token, i) => nodes.push(<AmpChip label={token} key={`${match!.index}-${i}`} />))
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))
  return <pre className="tab-text">{nodes}</pre>
}

export type SheetKind = 'chords' | 'tabs'

// Curated tabs/chords built into the app (src/data/sheets). `view`/`onViewChange` keep
// the Chords/Tabs selection so the toggle can switch it.
export function SheetPanel({ song, view, onViewChange }: { song: Song, view: SheetKind | null, onViewChange: (kind: SheetKind) => void }) {
  const { get } = usePractice(); const entry = get(song.id)
  const { settings, isFingeringOnly, toggleFingeringOnly } = useSettings()
  const sheets = sheetsFor(song.id)
  const available: SheetKind[] = ([['chords', sheets.chords], ['tabs', sheets.tabs]] as const).filter(([, data]) => data).map(([kind]) => kind)
  if (!available.length) return <section className="panel chord-panel" id="song-sheet"><h2>Tabs & chords</h2><p className="launcher-hint">Nothing built in for this song yet.</p></section>
  const preferred = entry.preferredSource === 'tabs' || entry.preferredSource === 'chords' ? entry.preferredSource : available[0]
  const active = view && available.includes(view) ? view : available.includes(preferred) ? preferred : available[0]
  const chordsShapes = isFingeringOnly(song.id, 'chords')
  const selectChords = () => {
    if (active === 'chords') {
      if (settings.chords.scope !== 'none') toggleFingeringOnly(song.id, 'chords')
    } else onViewChange('chords')
  }
  return <section className="panel chord-panel" id="song-sheet">
    <div className="section-heading"><div><h2>Tabs & chords</h2></div>
      {(available.length > 1 || available[0] === 'chords') && <div className="fretboard-toggle" role="tablist" aria-label="Sheet type">
        {available.includes('chords') && <button type="button" role="tab" aria-selected={active === 'chords'} aria-pressed={active === 'chords' ? chordsShapes : undefined}
          className={`${active === 'chords' ? 'active' : ''}${chordsShapes ? ' shapes' : ''}`}
          title={active === 'chords' ? (chordsShapes ? 'Showing fingering chips — tap again for Settings layout' : 'Tap again for fingering chips') : undefined}
          onClick={selectChords}>Chords</button>}
        {available.includes('tabs') && <button type="button" role="tab" aria-selected={active === 'tabs'} className={active === 'tabs' ? 'active' : ''} onClick={() => onViewChange('tabs')}>Tabs</button>}
      </div>}
    </div>
    {active === 'chords' ? <ChordSheetView text={sheets.chords!} songId={song.id}/> : <TabText text={sheets.tabs!}/>}
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
  </section>
}
