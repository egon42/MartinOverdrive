import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { songs } from './data'
import { Difficulty, Field, PracticeControls, ScalePattern, SongCard, SongLinks, unknown } from './components'
import { usePractice } from './storage'
import { statuses } from './types'

const styles = [...new Set(songs.map((song) => song.practiceStyle))]
const tunings = [...new Set(songs.map((song) => song.tuning).filter(Boolean))].sort()
const priorityLabel = ['None', 'Low', 'Medium', 'High']

export function Dashboard() {
  const { get, exportBackup, importBackup } = usePractice(); const navigate = useNavigate(); const fileRef = useRef<HTMLInputElement>(null)
  const statusCounts = statuses.map((status) => ({ status, count: songs.filter((s) => get(s.id).status === status).length }))
  const focus = [...songs].filter((s) => get(s.id).status !== 'Show Ready').sort((a, b) => get(b.id).priority - get(a.id).priority || (b.difficulty || 0) - (a.difficulty || 0)).slice(0, 4)
  const restore = async (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; try { await importBackup(file); alert('Practice backup restored.') } catch (error) { alert(error instanceof Error ? error.message : 'Could not restore backup.') } event.target.value = '' }
  return <><section className="dashboard-summary"><div className="stats stats-status">{statusCounts.map(({ status, count }) => <div key={status}><strong>{count}</strong><span>{status.toLowerCase()}</span></div>)}</div><div className="actions"><Link className="button" to="/practice">Start practice</Link><Link className="button secondary" to="/show">Show mode</Link></div></section>
    <section><div className="section-heading"><div><span className="eyebrow">Today’s practice</span><h2>Prioritized suggestions</h2></div><button className="text-button" onClick={() => navigate(`/song/${songs[Math.floor(Math.random() * songs.length)].id}`)}>Random song ↗</button></div><div className="card-grid">{focus.map((song) => <SongCard song={song} key={song.id} />)}</div></section>
    <section className="panel backup"><div><span className="eyebrow">Portable local data</span><h2>Backup & restore</h2><p>Your status and notes stay in this browser unless you export them.</p></div><div className="actions"><button onClick={exportBackup}>Export backup</button><button className="secondary" onClick={() => fileRef.current?.click()}>Restore backup</button><input ref={fileRef} hidden type="file" accept="application/json" onChange={restore} /></div></section></>
}

function SongFilters({ query, setQuery, difficulty, setDifficulty, style, setStyle, tuning, setTuning, status, setStatus }: any) {
  return <div className="filters"><label className="search"><span>Search</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Song or artist" /></label><label><span>Difficulty</span><select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}><option value="">All</option>{[2,3,4,5].map((d) => <option key={d}>{d}</option>)}</select></label><label><span>Tuning</span><select value={tuning} onChange={(e) => setTuning(e.target.value)}><option value="">All</option>{tunings.map((value) => <option key={value}>{value}</option>)}</select></label><label><span>Practice style</span><select value={style} onChange={(e) => setStyle(e.target.value)}><option value="">All</option>{styles.map((s) => <option key={s}>{s}</option>)}</select></label><label><span>Status</span><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All</option><option value="needs">Needs work</option>{statuses.map((s) => <option key={s}>{s}</option>)}</select></label></div>
}

function useFilteredSongs() {
  const { get } = usePractice(); const [query, setQuery] = useState(''); const [difficulty, setDifficulty] = useState(''); const [style, setStyle] = useState(''); const [tuning, setTuning] = useState(''); const [status, setStatus] = useState('')
  const filtered = useMemo(() => songs.filter((song) => { const entry = get(song.id); return (!query || `${song.title} ${song.artist}`.toLowerCase().includes(query.toLowerCase())) && (!difficulty || song.difficulty === Number(difficulty)) && (!tuning || song.tuning === tuning) && (!style || song.practiceStyle === style) && (!status || (status === 'needs' ? entry.status !== 'Show Ready' : entry.status === status)) }), [query, difficulty, style, tuning, status, get])
  return { filtered, props: { query, setQuery, difficulty, setDifficulty, style, setStyle, tuning, setTuning, status, setStatus } }
}

export function Practice() {
  const { filtered, props } = useFilteredSongs(); const { get } = usePractice(); const [sort, setSort] = useState('priority'); const [direction, setDirection] = useState<'asc' | 'desc'>('desc')
  const ordered = [...filtered].sort((a, b) => {
    const comparison = sort === 'difficulty'
      ? (a.difficulty || 0) - (b.difficulty || 0)
      : get(a.id).priority - get(b.id).priority
    return comparison === 0 ? a.order - b.order : direction === 'asc' ? comparison : -comparison
  })
  return <><PageTitle title="Practice" compact/><SongFilters {...props}/><div className="sort-row"><span>{ordered.length} songs</span><div className="sort-controls"><label>Sort <select value={sort} onChange={(e) => setSort(e.target.value)}><option value="priority">Priority</option><option value="difficulty">Difficulty</option></select></label><label>Order <select aria-label="Sort direction" value={direction} onChange={(e) => setDirection(e.target.value as 'asc' | 'desc')}><option value="desc">Descending</option><option value="asc">Ascending</option></select></label></div></div><div className="practice-list">{ordered.map((song) => { const entry = get(song.id); return <Link className="practice-row" to={`/song/${song.id}`} key={song.id}><div className="practice-row-main"><span className="eyebrow">{String(song.order).padStart(2, '0')} · {entry.status} · {priorityLabel[entry.priority]} priority</span><h3>{song.title}</h3><p>{song.artist}</p></div><Difficulty value={song.difficulty} /></Link>})}</div></>
}

export function SongDetail() {
  const { id } = useParams(); const song = songs.find((item) => item.id === id)
  if (!song) return <PageTitle eyebrow="Not found" title="That song isn’t in this set" copy="Return to the full song list and try another." />
  return <div className="song-detail"><div className="song-detail-top"><Link className="back" to="/practice">← Back to practice</Link><div><span className="eyebrow">Song {song.order} of {songs.length}</span><Difficulty value={song.difficulty}/></div></div><section className="song-title"><div><h1>{song.title}</h1><p>{song.artist}</p></div></section><SongLinks song={song}/><section className="detail-grid"><div className="panel"><h2>At a glance</h2><dl><Field label="Tuning" value={song.tuning}/><Field label="Likely role" value={song.role}/><Field label="Practice style" value={song.practiceStyle}/><Field label="Link quality" value={song.linkQuality}/></dl></div><div className="panel"><h2>Fretboard</h2><ScalePattern value={song.pentatonicBox}/><dl><Field label="Scale hint" value={song.scaleHint}/><Field label="Source pattern" value={song.pentatonicBox}/></dl></div><div className="panel wide"><h2>Performance plan</h2><dl><Field label="Must-know part" value={song.mustKnow}/><Field label="Fallback part" value={song.fallback}/></dl></div></section><PracticeControls song={song}/></div>
}

export function Jam() {
  const jamSongs = songs.filter((song) => /pentatonic|blues improv/i.test(song.practiceStyle))
  return <><PageTitle title="Jam" compact/><div className="jam-list">{jamSongs.map((song) => <article className="panel jam-card" key={song.id}><div><span className="eyebrow">{song.artist}</span><h2><Link to={`/song/${song.id}`}>{song.title}</Link></h2></div><dl><Field label="Suggested scale" value={song.scaleHint}/><Field label="Focus" value={song.mustKnow}/></dl><SongLinks song={song}/><div className="jam-pattern"><ScalePattern value={song.pentatonicBox}/></div></article>)}</div></>
}

export function Show() {
  const [index, setIndex] = useState(() => Number(sessionStorage.getItem('overdrive-show-index') || 0)); const [awake, setAwake] = useState(false); const wakeLock = useRef<any>(null); const song = songs[Math.min(index, songs.length - 1)]
  useEffect(() => { sessionStorage.setItem('overdrive-show-index', String(index)) }, [index])
  useEffect(() => { const key = (e: KeyboardEvent) => { if (e.key === 'ArrowRight') setIndex((i) => Math.min(songs.length - 1, i + 1)); if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1)) }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key) }, [])
  const toggleWake = async () => { if (!('wakeLock' in navigator)) return alert('Screen wake lock is not supported by this browser.'); if (wakeLock.current) { await wakeLock.current.release(); wakeLock.current = null; setAwake(false) } else { try { wakeLock.current = await (navigator as any).wakeLock.request('screen'); setAwake(true); wakeLock.current.addEventListener('release', () => setAwake(false)) } catch { alert('The browser could not keep the screen awake.') } } }
  return <div className="show-mode"><div className="show-toolbar"><Link to="/">Exit show mode</Link><button className="secondary" onClick={toggleWake}>{awake ? 'Screen awake ✓' : 'Keep screen awake'}</button></div><div className="show-progress"><span>{index + 1} / {songs.length}</span><div><i style={{ width: `${((index + 1) / songs.length) * 100}%` }}/></div></div><article className="show-song"><span className="eyebrow">{song.artist}</span><h1>{song.title}</h1><div className="show-content"><div className="show-scale"><ScalePattern value={song.pentatonicBox}/><dl><Field label="Scale hint" value={song.scaleHint}/></dl></div><div className="show-fields"><Field label="Tuning" value={song.tuning}/><Field label="Role" value={song.role}/><Field label="Must know" value={song.mustKnow}/><Field label="Fallback" value={song.fallback}/></div></div></article><div className="show-nav"><button disabled={index === 0} onClick={() => setIndex((i) => Math.max(0, i - 1))}>← Previous</button><button disabled={index === songs.length - 1} onClick={() => setIndex((i) => Math.min(songs.length - 1, i + 1))}>Next →</button></div></div>
}

function PageTitle({ eyebrow, title, copy, compact = false }: { eyebrow?: string, title: string, copy?: string, compact?: boolean }) { return <header className={`page-title ${compact ? 'compact' : ''}`}>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1>{copy && <p>{copy}</p>}</header> }
