import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type RefObject } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { songs } from './data'
import { AmpPresetField, BackingTrack, ChordChip, ChordSheetView, Difficulty, Field, FretboardPanel, PracticeControls, PracticeLauncher, PresetBadges, SheetPanel, SongCard, SongLinks, TabText, unknown, type SheetKind } from './components'
import { usePractice } from './storage'
import { chordProgression } from './chords'
import { progressionFor } from './progressions'
import { transposeFor, transposeLabel, transposeHint } from './transpose'
import { sheetsFor } from './sheets'
import { SyncPanel } from './sync'
import { statuses, type Song } from './types'

const styles = [...new Set(songs.map((song) => song.practiceStyle))]
const tunings = ['Standard', 'Drop D']
const priorityLabel = ['None', 'Low', 'Medium', 'High']
// Show-mode autoscroll speed, px/second (per-song, stored as PracticeEntry.scrollSpeed).
const DEFAULT_SCROLL_SPEED = 24, MIN_SCROLL_SPEED = 6, MAX_SCROLL_SPEED = 120, SCROLL_SPEED_STEP = 4

export function Dashboard() {
  const { get, exportBackup, importBackup } = usePractice(); const navigate = useNavigate(); const fileRef = useRef<HTMLInputElement>(null)
  const statusCounts = statuses.map((status) => ({ status, count: songs.filter((s) => get(s.id).status === status).length }))
  const focus = [...songs].filter((s) => get(s.id).status !== 'Show Ready').sort((a, b) => get(b.id).priority - get(a.id).priority || (b.difficulty || 0) - (a.difficulty || 0)).slice(0, 4)
  const restore = async (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; try { await importBackup(file); alert('Practice backup restored.') } catch (error) { alert(error instanceof Error ? error.message : 'Could not restore backup.') } event.target.value = '' }
  return <><section className="dashboard-summary"><div className="stats stats-status">{statusCounts.map(({ status, count }) => <div key={status}><strong>{count}</strong><span>{status.toLowerCase()}</span></div>)}</div><div className="actions"><Link className="button" to="/practice">Start practice</Link><Link className="button secondary" to="/show">Show mode</Link></div></section>
    <section><div className="section-heading"><div><span className="eyebrow">Today’s practice</span><h2>Prioritized suggestions</h2></div><button className="text-button" onClick={() => navigate(`/song/${songs[Math.floor(Math.random() * songs.length)].id}`)}>Random song ↗</button></div><div className="card-grid">{focus.map((song) => <SongCard song={song} key={song.id} />)}</div></section>
    <section className="panel backup"><div><span className="eyebrow">Portable local data</span><h2>Backup & restore</h2><p>Your status and notes stay in this browser unless you export them.</p></div><div className="actions"><button onClick={exportBackup}>Export backup</button><button className="secondary" onClick={() => fileRef.current?.click()}>Restore backup</button><input ref={fileRef} hidden type="file" accept="application/json" onChange={restore} /></div></section>
    <SyncPanel /></>
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
  const { filtered, props } = useFilteredSongs(); const { get } = usePractice()
  const [sort, setSort] = useState(() => localStorage.getItem('overdrive-practice-sort') || 'priority')
  const [direction, setDirection] = useState<'asc' | 'desc'>(() => (localStorage.getItem('overdrive-practice-sort-dir') as 'asc' | 'desc') || 'desc')
  useEffect(() => { localStorage.setItem('overdrive-practice-sort', sort) }, [sort])
  useEffect(() => { localStorage.setItem('overdrive-practice-sort-dir', direction) }, [direction])
  const ordered = [...filtered].sort((a, b) => {
    const comparison = sort === 'difficulty'
      ? (a.difficulty || 0) - (b.difficulty || 0)
      : sort === 'set'
        ? a.order - b.order
        : get(a.id).priority - get(b.id).priority
    return comparison === 0 ? a.order - b.order : direction === 'asc' ? comparison : -comparison
  })
  const changeSort = (value: string) => { setSort(value); if (value === 'set') setDirection('asc') }
  return <><PageTitle title="Practice" compact/><SongFilters {...props}/><div className="sort-row"><span>{ordered.length} songs</span><div className="sort-controls"><label>Sort <select value={sort} onChange={(e) => changeSort(e.target.value)}><option value="priority">Priority</option><option value="difficulty">Difficulty</option><option value="set">Set order</option></select></label><label>Order <select aria-label="Sort direction" value={direction} onChange={(e) => setDirection(e.target.value as 'asc' | 'desc')}><option value="desc">Descending</option><option value="asc">Ascending</option></select></label></div></div><div className="practice-list">{ordered.map((song) => { const entry = get(song.id); return <Link className="practice-row" to={`/song/${song.id}`} key={song.id}><div className="practice-row-main"><span className="eyebrow">{String(song.order).padStart(2, '0')} · {entry.status} · {priorityLabel[entry.priority]} priority</span> <PresetBadges songId={song.id} /><h3>{song.title}</h3><p>{song.artist}</p></div><Difficulty value={song.difficulty} /></Link>})}</div></>
}

export function SongDetail() {
  const { id } = useParams(); const song = songs.find((item) => item.id === id)
  const [sheetView, setSheetView] = useState<SheetKind | null>(null)
  if (!song) return <PageTitle eyebrow="Not found" title="That song isn’t in this set" copy="Return to the full song list and try another." />
  const transpose = transposeFor(song.id)
  return <div className="song-detail"><div className="song-detail-top"><Link className="back" to="/practice">← Back to practice</Link><div><span className="eyebrow">Song {song.order} of {songs.length}</span><Difficulty value={song.difficulty}/></div></div><section className="song-title"><div><h1>{song.title}</h1><p>{song.artist}</p></div></section><PracticeLauncher song={song}/><SongLinks song={song} showBackingTrack={false}/><section className="detail-grid"><div className="panel"><h2>At a glance</h2><dl><AmpPresetField songId={song.id}/><Field label="Band tuning" value={song.tuning}/>{transpose && <Field label="Transpose recording" value={transposeHint(transpose)}/>}{song.recordingNote && <Field label="Tab / recording note" value={song.recordingNote}/>}<Field label="Likely role" value={song.role}/><Field label="Practice style" value={song.practiceStyle}/><Field label="Link quality" value={song.linkQuality}/></dl></div><div className="panel"><h2>Fretboard</h2><FretboardPanel song={song}/><dl><Field label="Scale hint" value={song.scaleHint}/></dl></div><div className="panel wide"><h2>Performance plan</h2><dl><Field label="Must-know part" value={song.mustKnow}/><Field label="Fallback part" value={song.fallback}/></dl></div></section><SheetPanel song={song} view={sheetView} onViewChange={setSheetView}/><PracticeControls song={song}/></div>
}

export function Jam() {
  const jamSongs = songs.filter((song) => /pentatonic|blues improv/i.test(song.practiceStyle))
  return <><PageTitle title="Jam" compact/><div className="jam-list">{jamSongs.map((song) => <article className="panel jam-card" key={song.id}><div><span className="eyebrow">{song.artist}</span><h2><Link to={`/song/${song.id}`}>{song.title}</Link></h2></div><dl><AmpPresetField songId={song.id}/><Field label="Suggested scale" value={song.scaleHint}/><Field label="Focus" value={song.mustKnow}/></dl><SongLinks song={song}/><div className="jam-backing"><BackingTrack song={song}/></div><div className="jam-pattern"><FretboardPanel song={song}/></div></article>)}</div></>
}

// Shrinks the sheet's font until it fits the container (height for compact chords,
// width for monospace tab lines), so a phone in show mode sees as much of the song
// as possible without scrolling. Floored — extreme songs scroll a little instead.
function useFitScale(deps: unknown[], axis: 'height' | 'width' = 'height', floor = 0.6) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      el.style.setProperty('--sheet-fit', '1')
      const ratio = axis === 'height' ? el.clientHeight / el.scrollHeight : el.clientWidth / el.scrollWidth
      el.style.setProperty('--sheet-fit', String(ratio < 1 ? Math.max(floor, ratio * 0.97) : 1))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return ref
}

// Teleprompter autoscroll: while `playing`, creep `ref`'s scroll container down at
// `speed` px/second. rAF timestamps make it frame-rate independent. `scrollTop` is
// pixel-quantized, so we can't just add `speed*dt` each frame — a sub-pixel delta gets
// rounded away, which stalls slow speeds and pins fast ones near 1px/frame. Instead we
// keep a private float accumulator and only push WHOLE pixels into scrollTop; the
// fraction carries to the next frame. Adding a whole-pixel delta to the live scrollTop
// still lets a native swipe reposition the sheet mid-crawl (it resumes from wherever the
// finger left it). A finger on the sheet pauses the creep (holding); up/cancel listen on
// window so a drag that drifts off the element still un-pauses (the lesson from 43f64da).
// Stops and calls onReachEnd at the bottom. No-op when ref is null (cheat view).
function useAutoScroll(ref: RefObject<HTMLDivElement | null> | null, speed: number, playing: boolean, onReachEnd: () => void) {
  const onReachEndRef = useRef(onReachEnd)
  onReachEndRef.current = onReachEnd
  useEffect(() => {
    const el = ref?.current
    if (!el || !playing || speed <= 0) return
    let raf = 0
    let last = 0
    let acc = 0 // sub-pixel remainder carried between frames
    let holding = false
    const step = (now: number) => {
      if (!last) last = now
      const dt = Math.min((now - last) / 1000, 0.1) // clamp so a backgrounded tab doesn't jump on resume
      last = now
      if (!holding && dt > 0) {
        acc += speed * dt
        const whole = Math.trunc(acc)
        if (whole >= 1) {
          acc -= whole
          el.scrollTop += whole
          if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) { onReachEndRef.current(); return }
        }
      }
      raf = requestAnimationFrame(step)
    }
    const onDown = () => { holding = true }
    const onUp = () => { holding = false; last = 0 } // reset clock so the paused gap isn't one big jump
    el.addEventListener('pointerdown', onDown)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    raf = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [ref, speed, playing])
}

// The live cheat card — the default show-mode view. Everything needed to play the song
// on one screen: tuning strip, compact chord progression (derived from the chord sheet),
// role / must-know / fallback, and the collapsed fretboard + scale hint. `innerRef` is the
// height auto-fit ref from Show(), so a dense song shrinks to fit instead of scrolling.
function CheatCard({ song, innerRef }: { song: Song, innerRef: RefObject<HTMLDivElement | null> }) {
  const sheets = sheetsFor(song.id)
  // Prefer the curated per-section progression; fall back to one derived from the chord
  // sheet (a single loop, or the distinct chords used) when a song isn't researched yet.
  const custom = progressionFor(song.id)
  const transpose = transposeFor(song.id)
  const derived = useMemo(() => (!custom && sheets.chords ? chordProgression(sheets.chords) : null), [custom, sheets.chords])
  const rows = custom
    ? custom.sections.map((s) => ({ label: s.section, chords: s.chords.split(/\s+/).filter(Boolean), shapes: s.shapes ? s.shapes.split(/\s+/).filter(Boolean) : [], hint: s.hint }))
    : derived?.map((row) => ({ ...row, shapes: [] as string[], hint: undefined as string | undefined }))
  return <div className="cheat-card" ref={innerRef}>
    <div className="cheat-strip">
      {song.tuning !== 'Standard' && <span className="cheat-chip cheat-tuning">{song.tuning}</span>}
      {transpose && <span className="cheat-chip cheat-transpose" title={transposeHint(transpose)}>Transpose {transposeLabel(transpose.semitones)}</span>}
      {custom?.capo && <span className="cheat-chip cheat-capo">{custom.capo}</span>}
      <PresetBadges songId={song.id} showNotes />
    </div>
    {rows && <div className="cheat-progression">
      {rows.map((row, i) => <div className="cheat-prog-row" key={i}>
        <span className="cheat-prog-label">{row.label}</span>
        <span className="cheat-prog-chords">{row.chords.map((chord, j) => row.shapes[j]
          ? <span className="cheat-prog-chord" key={j}><ChordChip name={chord} /><span className="cheat-prog-shape">{row.shapes[j]}</span></span>
          : <ChordChip name={chord} key={j} />)}</span>
        {row.hint && <span className="cheat-prog-hint">{row.hint}</span>}
      </div>)}
    </div>}
    <div className="show-content">
      <div className="show-scale"><FretboardPanel song={song} /><dl><Field label="Scale hint" value={song.scaleHint} /></dl></div>
      <div className="show-fields">
        <Field label="Role" value={song.role} />
        <Field label="Must know" value={song.mustKnow} />
        <Field label="Fallback" value={song.fallback} />
      </div>
    </div>
  </div>
}

export function Show() {
  const [index, setIndex] = useState(() => Number(sessionStorage.getItem('overdrive-show-index') || 0)); const wakeLock = useRef<any>(null); const song = songs[Math.min(index, songs.length - 1)]
  const sheets = sheetsFor(song.id)
  const [view, setView] = useState(() => sessionStorage.getItem('overdrive-show-view') || 'scale')
  useEffect(() => { sessionStorage.setItem('overdrive-show-view', view) }, [view])
  const effective = view === 'chords' && sheets.chords ? 'chords' : view === 'tabs' && sheets.tabs ? 'tabs' : 'scale'
  const views = ['scale', ...(sheets.chords ? ['chords'] : []), ...(sheets.tabs ? ['tabs'] : [])]
  const cycleView = (dir: 1 | -1) => { const idx = views.indexOf(effective); setView(views[(idx + dir + views.length) % views.length]) }
  const tabsRef = useFitScale([song.id, sheets.tabs, effective], 'width', 0.45)
  const cheatRef = useFitScale([song.id, sheets.chords, sheets.tabs, effective], 'height', 0.7)
  const chordsRef = useRef<HTMLDivElement>(null)
  // Autoscroll: only the chords/tabs sheets scroll (the cheat card auto-fits one screen).
  const { get, patch } = usePractice()
  const speed = get(song.id).scrollSpeed || DEFAULT_SCROLL_SPEED
  const [playing, setPlaying] = useState(false)
  const [scrollable, setScrollable] = useState(false)
  const scrollTarget = effective === 'tabs' ? tabsRef : effective === 'chords' ? chordsRef : null
  useAutoScroll(scrollTarget, speed, playing, () => setPlaying(false))
  // New song or view: start paused at the top, and re-measure whether the sheet overflows.
  // Resize (e.g. phone rotation) only re-measures — it must not yank scroll back to the top.
  useLayoutEffect(() => {
    setPlaying(false)
    const el = scrollTarget?.current
    if (el) el.scrollTop = 0
    const measure = () => setScrollable(!!el && el.scrollHeight > el.clientHeight + 1)
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, effective, sheets.chords, sheets.tabs])
  const bumpSpeed = (delta: number) => patch(song.id, { scrollSpeed: Math.max(MIN_SCROLL_SPEED, Math.min(MAX_SCROLL_SPEED, speed + delta)) })
  // Toggle play; if we're starting from the very bottom (a finished crawl), rewind to the top first.
  const togglePlay = () => setPlaying((p) => {
    const el = scrollTarget?.current
    if (!p && el && el.scrollTop + el.clientHeight >= el.scrollHeight - 1) el.scrollTop = 0
    return !p
  })
  useEffect(() => { sessionStorage.setItem('overdrive-show-index', String(index)) }, [index])
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(songs.length - 1, i + 1))
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1))
      if (e.key === 'ArrowDown') cycleView(1)
      if (e.key === 'ArrowUp') cycleView(-1)
      // Space toggles autoscroll — but only as a global shortcut; if a control is focused,
      // let it handle its own Space (avoids a double-toggle with the button's native activation).
      if (e.key === ' ' && scrollable && !(e.target as HTMLElement)?.closest('button,a,input,textarea,select')) { e.preventDefault(); togglePlay() }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effective, sheets.chords, sheets.tabs, scrollable])
  // Auto wake lock: request on mount, release on unmount, and silently re-acquire on
  // visibilitychange (the browser drops the lock whenever the tab/screen goes
  // background and never restores it automatically).
  useEffect(() => {
    if (!('wakeLock' in navigator)) return
    let cancelled = false
    let acquiring = false
    const acquire = async () => {
      if (acquiring || wakeLock.current) return
      acquiring = true
      try {
        const lock = await (navigator as any).wakeLock.request('screen')
        if (cancelled) { lock.release(); return }
        wakeLock.current = lock
        lock.addEventListener('release', () => { wakeLock.current = null })
      } catch { /* denied or unsupported right now — no-op */ }
      finally { acquiring = false }
    }
    acquire()
    const onVisibility = () => { if (document.visibilityState === 'visible') acquire() }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      if (wakeLock.current) { wakeLock.current.release(); wakeLock.current = null }
    }
  }, [])
  return <div className="show-mode">
    <Link className="show-exit" to="/" aria-label="Exit show mode">×</Link>
    <div className="show-progress">
      <button type="button" className="show-nav-btn" disabled={index === 0} onClick={() => setIndex((i) => Math.max(0, i - 1))} aria-label="Previous song">‹</button>
      <span>{index + 1} / {songs.length}</span>
      <div><i style={{ width: `${((index + 1) / songs.length) * 100}%` }}/></div>
      <button type="button" className="show-nav-btn" disabled={index === songs.length - 1} onClick={() => setIndex((i) => Math.min(songs.length - 1, i + 1))} aria-label="Next song">›</button>
    </div>
    <article className={`show-song${effective !== 'scale' ? ' sheet-view' : ' cheat-view'}`}><span className="eyebrow">{song.artist}</span><h1>{song.title}</h1>{effective !== 'scale' && <div className="show-preset"><PresetBadges songId={song.id} showNotes/></div>}
    {(sheets.chords || sheets.tabs) && <div className="fretboard-toggle show-view-toggle" role="tablist" aria-label="Show mode view"><button type="button" role="tab" aria-selected={effective === 'scale'} className={effective === 'scale' ? 'active' : ''} onClick={() => setView('scale')}>Cheat</button>{sheets.chords && <button type="button" role="tab" aria-selected={effective === 'chords'} className={effective === 'chords' ? 'active' : ''} onClick={() => setView('chords')}>Chords</button>}{sheets.tabs && <button type="button" role="tab" aria-selected={effective === 'tabs'} className={effective === 'tabs' ? 'active' : ''} onClick={() => setView('tabs')}>Tabs</button>}</div>}
    {effective !== 'scale' && scrollable && <div className="show-autoscroll">
      <button type="button" className="autoscroll-play" aria-pressed={playing} aria-label="Autoscroll" onClick={togglePlay}>{playing ? '⏸' : '▶'}</button>
      <button type="button" className="autoscroll-step" aria-label="Slower" disabled={speed <= MIN_SCROLL_SPEED} onClick={() => bumpSpeed(-SCROLL_SPEED_STEP)}>−</button>
      <span className="autoscroll-speed" aria-label={`Scroll speed ${speed} pixels per second`}>{speed}<i>px/s</i></span>
      <button type="button" className="autoscroll-step" aria-label="Faster" disabled={speed >= MAX_SCROLL_SPEED} onClick={() => bumpSpeed(SCROLL_SPEED_STEP)}>+</button>
    </div>}
    {effective === 'chords'
      ? <div className="show-sheet" ref={chordsRef}><ChordSheetView text={sheets.chords!}/></div>
      : effective === 'tabs'
        ? <div className="show-sheet show-tabs" ref={tabsRef}><TabText text={sheets.tabs!}/></div>
        : <CheatCard song={song} innerRef={cheatRef}/>}</article></div>
}

function PageTitle({ eyebrow, title, copy, compact = false }: { eyebrow?: string, title: string, copy?: string, compact?: boolean }) { return <header className={`page-title ${compact ? 'compact' : ''}`}>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1>{copy && <p>{copy}</p>}</header> }
