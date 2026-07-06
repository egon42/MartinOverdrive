import { Link } from 'react-router-dom'
import { useMemo, useState, type CSSProperties } from 'react'
import { compactSheet, parseChordSheet } from './chords'
import type { Song } from './types'
import { statuses } from './types'
import { fretboardForVersion, resolveFretboards, type FretboardVersion } from './fretboard'
import { isStatus, usePractice } from './storage'
import { ampPresets, presetBank, presetLabel, presetPosition } from './presets'

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

export function ScalePattern({ value }: { value: string }) {
  const colon = value.indexOf(':')
  if (colon < 0) return <div className="scale-pattern"><p>{unknown(value)}</p></div>

  const name = value.slice(0, colon).trim()
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
  return <>
    {hasToggle && <div className="fretboard-toggle" role="tablist" aria-label="Fretboard tuning reference">
      <button type="button" role="tab" aria-selected={version === 'standard'} className={version === 'standard' ? 'active' : ''} onClick={() => setVersion('standard')}>Standard tuning</button>
      <button type="button" role="tab" aria-selected={version === 'original'} className={version === 'original' ? 'active' : ''} onClick={() => setVersion('original')}>Original / recording</button>
    </div>}
    <ScalePattern value={fretboardForVersion(song, version)} />
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

export function ChordSheetView({ text, compact = false }: { text: string, compact?: boolean }) {
  const sheet = useMemo(() => parseChordSheet(text), [text])
  if (compact) {
    return <div className="sheet-compact">{compactSheet(sheet).map((line, index) => line.kind === 'section'
      ? <div className="sheet-section" key={index}>{line.cue}</div>
      : line.kind === 'tab'
        ? <pre className="sheet-tab" key={index}>{line.cue}</pre>
        : <div className="compact-line" key={index}><span className="compact-chords">{line.chords.map((chord, i) => <b className="chord-chip" key={i}>{chord}</b>)}</span><span className="compact-cue">{line.cue}</span></div>)}</div>
  }
  return <div className="sheet-full">
    {sheet.meta.map((line, index) => <p className="sheet-meta" key={index}>{line}</p>)}
    {sheet.lines.map((line, index) => line.kind === 'section'
      ? <h4 className="sheet-section" key={index}>{line.raw}</h4>
      : line.kind === 'tab'
        ? <pre className="sheet-tab" key={index}>{line.raw}</pre>
        : <p className="sheet-line" key={index}>{line.parts.map((part, i) => part.chord ? <b className="chord-chip" key={i}>{part.chord}</b> : <span key={i}>{part.text}</span>)}</p>)}
  </div>
}

// Per-song pasted tabs/chords, stored in practice state (so it syncs across devices).
export function ChordSheetPanel({ song }: { song: Song }) {
  const { get, patch } = usePractice(); const entry = get(song.id)
  const [draft, setDraft] = useState<string | null>(null)
  const editing = draft !== null
  const save = () => { patch(song.id, { chordSheet: (draft || '').trim() ? draft! : '' }); setDraft(null) }
  return <section className="panel chord-panel" id="chord-sheet">
    <div className="section-heading"><div><span className="eyebrow">In-app practice source</span><h2>Tabs & chords</h2></div>
      <button className="text-button" onClick={() => setDraft(editing ? null : entry.chordSheet)}>{editing ? 'Cancel' : entry.chordSheet ? 'Edit / replace' : 'Paste sheet'}</button></div>
    {editing
      ? <><textarea value={draft ?? ''} onChange={(e) => setDraft(e.target.value)} placeholder="Paste chord or tab text here — an Ultimate Guitar copy/paste works as-is." spellCheck={false}/>
        <div className="actions"><button onClick={save}>Save sheet</button>{entry.chordSheet && <button className="secondary" onClick={() => { patch(song.id, { chordSheet: '' }); setDraft(null) }}>Remove sheet</button>}</div></>
      : entry.chordSheet
        ? <ChordSheetView text={entry.chordSheet}/>
        : <p className="launcher-hint">No sheet saved yet. Paste the exact chords/tab text you practice from: it renders here in full, syncs to your other devices, and show mode gets a compact chords-plus-cues view of it. Inline-chord pastes (Ultimate Guitar mobile copy) keep exact chord positions; chord-above-lyric pastes still work but chords land at the start of their line.</p>}
  </section>
}

// One-click practice: opens the remembered tab/chord source in a new tab and starts
// the backing track embedded here, replacing the old juggle of three browser tabs.
// (Songsterr and Ultimate Guitar both forbid iframing, so the source opens externally.)
export function PracticeLauncher({ song }: { song: Song }) {
  const { get, patch } = usePractice(); const entry = get(song.id)
  const [playing, setPlaying] = useState(false)
  const videoId = youtubeId(song.backingTrackUrl)
  const searches = tabSearchUrls(song)
  const savedSongsterr = isSiteUrl(entry.savedSongsterrUrl, 'songsterr.com') ? entry.savedSongsterrUrl : ''
  const savedUltimateGuitar = isSiteUrl(entry.savedUltimateGuitarUrl, 'ultimate-guitar.com') ? entry.savedUltimateGuitarUrl : ''
  const sourceUrls = {
    songsterr: savedSongsterr || song.songsterrUrl || searches.songsterr,
    ultimateGuitar: savedUltimateGuitar || song.ultimateGuitarUrl || searches.ultimateGuitar,
  }
  const hasSheet = !!entry.chordSheet
  const fallback = hasSheet ? 'sheet' : savedSongsterr || song.songsterrUrl ? 'songsterr' : 'ultimateGuitar'
  const source = entry.preferredSource === 'sheet' && !hasSheet ? fallback : entry.preferredSource || fallback
  const start = () => {
    // rAF so the scroll runs after the backing player mounts above the sheet — a
    // synchronous scroll would land ~330px short of the target after the layout shift.
    if (source === 'sheet') requestAnimationFrame(() => document.getElementById('chord-sheet')?.scrollIntoView({ behavior: 'smooth' }))
    else window.open(sourceUrls[source], '_blank', 'noopener')
    if (videoId) setPlaying(true)
    patch(song.id, { lastPracticed: new Date().toISOString().slice(0, 10), sessions: entry.sessions + 1 })
  }
  return <section className="panel practice-launcher">
    <div className="launcher-row">
      <button onClick={start}>▶ Start practice</button>
      <label><span>Tabs / chords source</span>
        <select value={source} onChange={(e) => patch(song.id, { preferredSource: e.target.value as 'songsterr' | 'ultimateGuitar' | 'sheet' })}>
          {hasSheet && <option value="sheet">In-app sheet</option>}
          <option value="songsterr">Songsterr (tabs)</option>
          <option value="ultimateGuitar">Ultimate Guitar (chords)</option>
        </select>
      </label>
      {videoId
        ? <button className="secondary" onClick={() => setPlaying(!playing)}>{playing ? 'Stop backing track' : 'Play backing track'}</button>
        : song.backingTrackUrl && <a className="button secondary" href={song.backingTrackUrl} target="_blank" rel="noreferrer"><span className="button-text">Open backing track</span><span className="button-arrow" aria-hidden="true">↗</span></a>}
    </div>
    <p className="launcher-hint">Start practice opens your remembered source in a new tab and plays the backing track here — switch back once the tab loads.</p>
    {playing && videoId && <div className="backing-player"><iframe src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1`} title={`Backing track for ${song.title}`} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen /></div>}
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
