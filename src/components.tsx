import { Link } from 'react-router-dom'
import { useState, type CSSProperties } from 'react'
import type { Song } from './types'
import { statuses } from './types'
import { fretboardForVersion, resolveFretboards, type FretboardVersion } from './fretboard'
import { isStatus, usePractice } from './storage'

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
      {!compact && <><div className="tag-row">{song.tuning !== 'Standard' && <span className="tag">{song.tuning}</span>}<span className="tag">{unknown(song.practiceStyle)}</span></div><Difficulty value={song.difficulty} /></>}
    </Link>
    {!compact && <StatusSelect songId={song.id} />}
  </article>
}

export function Field({ label, value }: { label: string, value: string | number | null }) {
  return <div className="field"><dt>{label}</dt><dd>{unknown(value)}</dd></div>
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

export function SongLinks({ song }: { song: Song }) {
  const { get, patch } = usePractice(); const entry = get(song.id)
  const searches = tabSearchUrls(song)
  const savedSongsterr = isSiteUrl(entry.savedSongsterrUrl, 'songsterr.com') ? entry.savedSongsterrUrl : ''
  const savedUltimateGuitar = isSiteUrl(entry.savedUltimateGuitarUrl, 'ultimate-guitar.com') ? entry.savedUltimateGuitarUrl : ''
  return <div className="actions song-links">
    {song.backingTrackUrl && <a className="button" href={song.backingTrackUrl} target="_blank" rel="noreferrer"><span className="button-text">Open backing track</span><span className="button-arrow" aria-hidden="true">↗</span></a>}
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
