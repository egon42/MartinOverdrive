import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { compactSheet, parseChordSheet } from './chords'
import type { Song } from './types'
import { statuses } from './types'
import { fretboardForVersion, octaveUpVariant, resolveFretboards, scaleName, type FretboardVersion } from './fretboard'
import { isStatus, usePractice } from './storage'
import { ampPresets, parsePresetLabel, presetBank, presetLabel, presetPosition } from './presets'
import { sheetsFor } from './sheets'

export const unknown = (value: string | number | null) => value === '' || value == null ? 'Not provided' : value

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
  const { get } = usePractice(); const entry = get(song.id)
  return <article className="song-card">
    <Link className="song-card-main" to={`/song/${song.id}`}>
      <span className="eyebrow">{String(song.order).padStart(2, '0')} · {entry.status}</span>
      <h3>{song.title}</h3><p>{song.artist}</p>
      {!compact && <><div className="tag-row">{song.tuning !== 'Standard' && <span className="tag">{song.tuning}</span>}<span className="tag">{unknown(song.practiceStyle)}</span><PresetBadges songId={song.id} /></div><Difficulty value={song.difficulty} /></>}
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

export function ChordSheetView({ text, compact = false }: { text: string, compact?: boolean }) {
  const sheet = useMemo(() => parseChordSheet(text), [text])
  if (compact) {
    return <div className="sheet-compact">{compactSheet(sheet).map((line, index) => {
      if (line.kind === 'section') {
        const tokens = ampMarkerTokens(line.cue)
        return tokens ? <AmpMarkerSection tokens={tokens} key={index} /> : <div className="sheet-section" key={index}>{line.cue}</div>
      }
      return line.kind === 'tab'
        ? <pre className="sheet-tab" key={index}>{line.cue}</pre>
        : <div className="compact-line" key={index}><span className="compact-chords">{line.chords.map((chord, i) => <b className="chord-chip" key={i}>{chord}</b>)}</span><span className="compact-cue">{line.cue}</span></div>
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
        : <p className="sheet-line" key={index}>{line.parts.map((part, i) => part.chord ? <b className="chord-chip" key={i}>{part.chord}</b> : <span key={i}>{part.text}</span>)}</p>
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

// Curated tabs/chords built into the app (src/data/sheets + public/sheets).
// `view` is lifted so the practice launcher can flip the panel to the source it opens.
export function SheetPanel({ song, view, onViewChange }: { song: Song, view: SheetKind | null, onViewChange: (kind: SheetKind) => void }) {
  const { get } = usePractice(); const entry = get(song.id)
  const sheets = sheetsFor(song.id)
  const available: SheetKind[] = ([['chords', sheets.chords], ['tabs', sheets.tabs]] as const).filter(([, data]) => data).map(([kind]) => kind)
  if (!available.length) return <section className="panel chord-panel" id="song-sheet"><span className="eyebrow">In-app practice source</span><h2>Tabs & chords</h2><p className="launcher-hint">Nothing built in for this song yet. Hand Claude the chord/tab text (or drop source material in TabsAndChords\) and it gets added to src/data/sheets/.</p></section>
  const preferred = entry.preferredSource === 'tabs' || entry.preferredSource === 'chords' ? entry.preferredSource : available[0]
  const active = view && available.includes(view) ? view : available.includes(preferred) ? preferred : available[0]
  return <section className="panel chord-panel" id="song-sheet">
    <div className="section-heading"><div><span className="eyebrow">In-app practice source</span><h2>Tabs & chords</h2></div>
      {available.length > 1 && <div className="fretboard-toggle" role="tablist" aria-label="Sheet type"><button type="button" role="tab" aria-selected={active === 'chords'} className={active === 'chords' ? 'active' : ''} onClick={() => onViewChange('chords')}>Chords</button><button type="button" role="tab" aria-selected={active === 'tabs'} className={active === 'tabs' ? 'active' : ''} onClick={() => onViewChange('tabs')}>Tabs</button></div>}</div>
    {active === 'chords' ? <ChordSheetView text={sheets.chords!}/> : <TabText text={sheets.tabs!}/>}
  </section>
}

// Inline YouTube backing-track player with a play/pause toggle — self-contained so
// it can drop into both the practice launcher and jam-page cards. `autoPlaySignal`
// lets a caller (PracticeLauncher's "Start practice" button) trigger playback from
// outside without lifting the playing state itself: bump the number to start it.
export function BackingTrack({ song, autoPlaySignal }: { song: Song, autoPlaySignal?: number }) {
  const [playing, setPlaying] = useState(false)
  const videoId = youtubeId(song.backingTrackUrl)
  useEffect(() => { if (autoPlaySignal) setPlaying(true) }, [autoPlaySignal])
  if (!videoId) return null
  return <>
    <button className="secondary" onClick={() => setPlaying((value) => !value)}>{playing ? 'Stop backing track' : 'Play backing track'}</button>
    {playing && <div className="backing-player"><iframe src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1`} title={`Backing track for ${song.title}`} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen /></div>}
  </>
}

// One-click practice: opens the remembered tab/chord source in a new tab and starts
// the backing track embedded here, replacing the old juggle of three browser tabs.
// (Songsterr and Ultimate Guitar both forbid iframing, so those open externally;
// curated in-app sheets don't need a second tab at all.)
export function PracticeLauncher({ song, onOpenSheet }: { song: Song, onOpenSheet?: (kind: SheetKind) => void }) {
  const { get, patch } = usePractice(); const entry = get(song.id)
  const [autoPlaySignal, setAutoPlaySignal] = useState(0)
  const videoId = youtubeId(song.backingTrackUrl)
  const searches = tabSearchUrls(song)
  const sheets = sheetsFor(song.id)
  const savedSongsterr = isSiteUrl(entry.savedSongsterrUrl, 'songsterr.com') ? entry.savedSongsterrUrl : ''
  const savedUltimateGuitar = isSiteUrl(entry.savedUltimateGuitarUrl, 'ultimate-guitar.com') ? entry.savedUltimateGuitarUrl : ''
  const sourceUrls = {
    songsterr: savedSongsterr || song.songsterrUrl || searches.songsterr,
    ultimateGuitar: savedUltimateGuitar || song.ultimateGuitarUrl || searches.ultimateGuitar,
  }
  // 'sheet' was the pre-curation value for the in-app source; treat it as chords.
  const stored = (entry.preferredSource as string) === 'sheet' ? 'chords' : entry.preferredSource
  const valid = (value: string) => value === 'songsterr' || value === 'ultimateGuitar' || (value === 'chords' && sheets.chords) || (value === 'tabs' && sheets.tabs)
  const fallback = sheets.chords ? 'chords' : sheets.tabs ? 'tabs' : savedSongsterr || song.songsterrUrl ? 'songsterr' : 'ultimateGuitar'
  const source = (stored && valid(stored) ? stored : fallback) as 'songsterr' | 'ultimateGuitar' | SheetKind
  const start = () => {
    if (source === 'chords' || source === 'tabs') {
      onOpenSheet?.(source)
      // rAF so the scroll runs after the backing player mounts above the sheet — a
      // synchronous scroll would land ~330px short of the target after the layout shift.
      requestAnimationFrame(() => document.getElementById('song-sheet')?.scrollIntoView({ behavior: 'smooth' }))
    } else window.open(sourceUrls[source], '_blank', 'noopener')
    if (videoId) setAutoPlaySignal((n) => n + 1)
    patch(song.id, { lastPracticed: new Date().toISOString().slice(0, 10), sessions: entry.sessions + 1 })
  }
  return <section className="panel practice-launcher">
    <div className="launcher-row">
      <button onClick={start}>▶ Start practice</button>
      <label><span>Tabs / chords source</span>
        <select value={source} onChange={(e) => patch(song.id, { preferredSource: e.target.value as 'songsterr' | 'ultimateGuitar' | SheetKind })}>
          {sheets.chords && <option value="chords">In-app chords</option>}
          {sheets.tabs && <option value="tabs">In-app tabs</option>}
          <option value="songsterr">Songsterr (tabs)</option>
          <option value="ultimateGuitar">Ultimate Guitar (chords)</option>
        </select>
      </label>
      {!videoId && song.backingTrackUrl && <a className="button secondary" href={song.backingTrackUrl} target="_blank" rel="noreferrer"><span className="button-text">Open backing track</span><span className="button-arrow" aria-hidden="true">↗</span></a>}
    </div>
    <p className="launcher-hint">Start practice opens your remembered source in a new tab and plays the backing track here. Switch back once the tab loads.</p>
    <BackingTrack song={song} autoPlaySignal={autoPlaySignal} />
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
