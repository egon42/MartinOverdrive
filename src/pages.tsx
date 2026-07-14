import { Component, useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode, type RefObject } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { songs } from './data'
import { AmpPresetField, ChordChip, ChordSheetView, Difficulty, Field, FretboardPanel, HomeFretBadges, PracticeControls, PracticeLauncher, PresetBadges, SheetPanel, SongCard, SongLinks, TabText, unknown, type SheetKind } from './components'
import { usePractice } from './storage'
import { chordProgression } from './chords'
import { progressionFor } from './progressions'
import { transposeFor, transposeLabel, transposeHint } from './transpose'
import { sheetsFor } from './sheets'
import { SyncPanel } from './sync'
import { LiveOverlay, useLive } from './live'
import { setOrdered, tonightsSongs } from './setlist'
import { shapesTabClass, useSettings } from './settings'
import { statuses, type Song } from './types'

const styles = [...new Set(songs.map((song) => song.practiceStyle))]
const tunings = ['Standard', 'Drop D']
const priorityLabel = ['None', 'Low', 'Medium', 'High']
// Show-mode autoscroll speed, px/second (per-song, stored as PracticeEntry.scrollSpeed).
const DEFAULT_SCROLL_SPEED = 24, MIN_SCROLL_SPEED = 6, MAX_SCROLL_SPEED = 120, SCROLL_SPEED_STEP = 4
// localStorage (not sessionStorage): mobile OSes kill backgrounded tabs under memory
// pressure, and mid-set that must not reset the show to song 1. Keyed per deployment
// like the practice store, so /dev/ and prod don't share a show position.
const SHOW_KEY_SUFFIX = import.meta.env.BASE_URL.includes('/dev/') ? '-dev' : ''
const SHOW_INDEX_KEY = `overdrive-show-index${SHOW_KEY_SUFFIX}`
const SHOW_VIEW_KEY = `overdrive-show-view${SHOW_KEY_SUFFIX}`
// Per-song pinned default view (songId -> 'scale' | 'chords' | 'tabs'). Deliberately in
// localStorage, NOT the synced practice store: pins are a per-device rehearsal preference,
// not band data. Keyed per deployment like the other show keys.
const SHOW_PINS_KEY = `overdrive-show-pins${SHOW_KEY_SUFFIX}`
const readPins = (): Record<string, string> => {
  try { const p = JSON.parse(localStorage.getItem(SHOW_PINS_KEY) || '{}'); return p && typeof p === 'object' ? p : {} } catch { return {} }
}

export function Dashboard() {
  const { get, exportBackup, importBackup } = usePractice(); const navigate = useNavigate(); const fileRef = useRef<HTMLInputElement>(null)
  const statusCounts = statuses.map((status) => ({ status, count: songs.filter((s) => get(s.id).status === status).length }))
  const focus = [...songs].filter((s) => get(s.id).status !== 'Show Ready').sort((a, b) => get(b.id).priority - get(a.id).priority || (b.difficulty || 0) - (a.difficulty || 0)).slice(0, 4)
  const restore = async (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; try { await importBackup(file); alert('Practice backup restored.') } catch (error) { alert(error instanceof Error ? error.message : 'Could not restore backup.') } event.target.value = '' }
  return <><section className="dashboard-summary"><div className="stats stats-status">{statusCounts.map(({ status, count }) => <div key={status}><strong>{count}</strong><span>{status.toLowerCase()}</span></div>)}</div><div className="actions"><Link className="button" to="/practice">Start practice</Link><Link className="button secondary" to="/set">Tonight’s set</Link><Link className="button secondary" to="/show">Show mode</Link></div></section>
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
  // Jump straight to this song's stage view: seed the persisted show position, then
  // enter show mode (Show()'s initializer picks the id up; skipped songs resolve to
  // the nearest active one).
  const openInShow = () => localStorage.setItem(SHOW_INDEX_KEY, song.id)
  return <div className="song-detail"><div className="song-detail-top"><Link className="back" to="/practice">← Back to practice</Link><div><span className="eyebrow">Song {song.order} of {songs.length}</span><Difficulty value={song.difficulty}/></div></div><section className="song-title"><div><h1>{song.title}</h1><p>{song.artist}</p></div><Link className="button secondary song-show-link" to="/show" onClick={openInShow}>Stage view ↗</Link></section><PracticeLauncher song={song}/><SongLinks song={song} showBackingTrack={false}/><section className="detail-grid"><div className="panel"><h2>At a glance</h2><dl><AmpPresetField songId={song.id}/><Field label="Band tuning" value={song.tuning}/>{transpose && <Field label="Transpose recording" value={transposeHint(transpose)}/>}{song.recordingNote && <Field label="Tab / recording note" value={song.recordingNote}/>}<Field label="Likely role" value={song.role}/><Field label="Practice style" value={song.practiceStyle}/><Field label="Link quality" value={song.linkQuality}/></dl></div><div className="panel"><h2>Fretboard</h2><FretboardPanel song={song}/><dl><Field label="Scale hint" value={song.scaleHint}/></dl></div><div className="panel wide"><h2>Performance plan</h2><dl><Field label="Must-know part" value={song.mustKnow}/><Field label="Fallback part" value={song.fallback}/>{song.rehearsalNotes && <Field label="Ask the band" value={song.rehearsalNotes}/>}</dl></div></section><SheetPanel song={song} view={sheetView} onViewChange={setSheetView}/><PracticeControls song={song}/></div>
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
// `speed` px/second. Full spec + the history of why it's written exactly this way:
// docs/autoscroll-spec.md — read that before touching this hook.
//
// Core rule: NEVER route the crawl's math through the live scrollTop. Engines quantize
// scroll positions (writes snap to whole CSS or device pixels; some engines round reads
// too), so a read-modify-write of scrollTop re-quantizes every frame — sub-pixel deltas
// round away entirely (slow speeds stall) and everything faster pins near 1px/frame
// (all high speeds look identical): the "one speed above ~30px/s, nothing below" bug.
// Instead the hook owns a float `pos`, advances it by speed*dt per rAF tick (frame-rate
// independent on 60Hz and 120Hz alike), and only ever WRITES Math.floor(pos); the
// fraction stays in `pos`, so quantization can't feed back into the math.
//
// Manual scrolling coexists by adoption, not fighting: any frame where scrollTop isn't
// where our last write left it (native swipe, momentum fling, mouse wheel), we adopt
// that position into `pos` and skip the write — iOS kills a fling the moment a script
// writes scrollTop, so yielding until the sheet settles keeps swipes native, and the
// crawl resumes from wherever the finger/fling left it. A finger resting on the sheet
// pauses the creep (holding); up/cancel listen on window so a drag that drifts off the
// element still un-pauses (the lesson from 43f64da). Stops and calls onReachEnd at the
// bottom. No-op when ref is null (the cheat view auto-fits one screen).
function useAutoScroll(ref: RefObject<HTMLDivElement | null> | null, speed: number, playing: boolean, onReachEnd: () => void) {
  const onReachEndRef = useRef(onReachEnd)
  onReachEndRef.current = onReachEnd
  // Speed is read live through a ref, NOT an effect dep: a speed change (a +/- tap, or a
  // sync pull patching scrollSpeed mid-song) must adjust the crawl in place, not tear the
  // effect down — a restart resets `holding` to false while a finger may still be resting
  // on the sheet, letting the crawl creep under it (council finding, 2026-07-11). Don't
  // "fix" that with a holding ref that persists across ALL restarts: a finger lifting
  // while playing=false (listeners detached) would strand holding=true and make the next
  // ▶ appear dead. Scoping the fix to speed is deliberate.
  const speedRef = useRef(speed)
  speedRef.current = speed
  useEffect(() => {
    const el = ref?.current
    if (!el || !playing) return
    let raf = 0
    let last = 0 // rAF clock; 0 = no previous tick yet
    let pos = Math.max(0, el.scrollTop) // float position this hook owns — the DOM only ever sees Math.floor(pos)
    let written = Math.floor(pos) // last whole px we wrote/adopted; how we recognize our own motion next frame
    let holding = false
    const step = (now: number) => {
      raf = requestAnimationFrame(step)
      const dt = last ? Math.min((now - last) / 1000, 0.1) : 0 // clamp so a backgrounded tab doesn't jump on resume
      last = now
      if (holding || dt <= 0 || speedRef.current <= 0) return
      const actual = el.scrollTop
      if (Math.abs(actual - written) > 1) { // >1 tolerates engines snapping our write to device pixels
        pos = Math.max(0, actual) // the sheet moved without us — adopt the new position, yield this frame
        written = Math.floor(pos)
        return
      }
      const max = el.scrollHeight - el.clientHeight
      pos = Math.min(pos + speedRef.current * dt, max)
      const target = Math.floor(pos)
      if (target > written) { el.scrollTop = target; written = target }
      if (pos >= max - 1) { cancelAnimationFrame(raf); onReachEndRef.current() }
    }
    const onDown = () => { holding = true }
    const onUp = () => { holding = false } // the clock keeps ticking through a hold, so resuming carries no dt jump
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
  }, [ref, playing])
}

// The live cheat card — the default show-mode view. Everything needed to play the song
// on one screen: tuning strip, compact chord progression (derived from the chord sheet),
// role / must-know / fallback, and the collapsed fretboard + scale hint. `innerRef` is the
// height auto-fit ref from Show(), so a dense song shrinks to fit instead of scrolling.
function CheatCard({ song, innerRef }: { song: Song, innerRef: RefObject<HTMLDivElement | null> }) {
  const sheets = sheetsFor(song.id)
  const ownNotes = usePractice().get(song.id).notes.trim() // the player's own stage reminders
  // Prefer the curated per-section progression; fall back to one derived from the chord
  // sheet (a single loop, or the distinct chords used) when a song isn't researched yet.
  const custom = progressionFor(song.id)
  const transpose = transposeFor(song.id)
  const derived = useMemo(() => (!custom && sheets.chords ? chordProgression(sheets.chords) : null), [custom, sheets.chords])
  const rows = custom
    ? custom.sections.map((s) => ({ label: s.section, chords: s.chords.split(/\s+/).filter(Boolean), shapes: s.shapes ? s.shapes.split(/\s+/).filter(Boolean) : [], hint: s.hint, tab: s.tab }))
    : derived?.map((row) => ({ ...row, shapes: [] as string[], hint: undefined as string | undefined, tab: undefined as string | undefined }))
  return <div className="cheat-card" ref={innerRef}>
    <div className="cheat-strip">
      {song.tuning !== 'Standard' && <span className="cheat-chip cheat-tuning">{song.tuning}</span>}
      {transpose && <span className="cheat-chip cheat-transpose" title={transposeHint(transpose)}>Transpose {transposeLabel(transpose.semitones)}</span>}
      {custom?.capo && <span className="cheat-chip cheat-capo">{custom.capo}</span>}
      <PresetBadges songId={song.id} showNotes />
      <HomeFretBadges song={song} />
    </div>
    {rows && <div className="cheat-progression">
      {rows.map((row, i) => <div className="cheat-prog-row" key={i}>
        <span className="cheat-prog-label">{row.label}</span>
        <span className="cheat-prog-chords">{row.chords.map((chord, j) =>
          <ChordChip name={chord} curatedShape={row.shapes[j]} surface="cheat" songId={song.id} key={j} />)}</span>
        {row.hint && <span className="cheat-prog-hint">{row.hint}</span>}
        {row.tab && <pre className="cheat-prog-tab">{row.tab}</pre>}
      </div>)}
    </div>}
    <div className="show-content">
      <div className="show-scale"><FretboardPanel song={song} /><dl><Field label="Scale hint" value={song.scaleHint} /></dl></div>
      <div className="show-fields">
        <Field label="Role" value={song.role} />
        <Field label="Must know" value={song.mustKnow} />
        <Field label="Fallback" value={song.fallback} />
        {ownNotes && <Field label="My notes" value={ownNotes} />}
      </div>
    </div>
  </div>
}

// Last line of defense on stage: if anything in the song view throws mid-set (e.g. a
// sheet edited the night before breaks the parser), show the song's name instead of a
// white screen — the prev/next controls live outside the boundary and keep working.
// Keyed by song+view in Show() so navigating away retries rendering fresh.
class ShowSongBoundary extends Component<{ song: Song, onCheatView?: () => void, children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (!this.state.failed) return this.props.children
    const { song, onCheatView } = this.props
    return <article className="show-song cheat-view"><span className="eyebrow">{song.artist}</span><h1>{song.title}</h1>
      <p className="show-error">This song’s view hit an error — use ‹ › to keep the show moving.</p>
      {onCheatView && <p><button type="button" className="secondary" onClick={onCheatView}>Open the cheat card instead</button></p>}
      <div className="show-content"><div className="show-fields">
        <Field label="Role" value={song.role} />
        <Field label="Must know" value={song.mustKnow} />
        <Field label="Fallback" value={song.fallback} />
      </div></div></article>
  }
}

export function Show() {
  const { get, patch } = usePractice()
  const live = useLive()
  const following = live.config?.role === 'follow'
  // Tonight's set (skips + order from the Set page) — falls back to the full setlist
  // when nothing is configured. `get` is stable per practice-state change. While
  // following a live leader the walk list is the FULL ordered set (skips ignored):
  // navigation belongs to the leader, whose song must stay findable here even if
  // this device skipped it at soundcheck.
  const setSongs = useMemo(() => following ? setOrdered(get) : tonightsSongs(get), [get, following])
  // The saved position is the song id (survives set reorders/skips between sessions);
  // a legacy numeric index from earlier builds still restores as a clamped index.
  const [index, setIndex] = useState(() => {
    const saved = localStorage.getItem(SHOW_INDEX_KEY) || ''
    const byId = setSongs.findIndex((item) => item.id === saved)
    if (byId >= 0) return byId
    // Saved song got skipped at soundcheck: resume at the next active song after its
    // slot (or the last one), not back at song 1 — the whole point of persisting.
    const full = setOrdered(get)
    const at = full.findIndex((item) => item.id === saved)
    if (at >= 0) {
      for (let i = at + 1; i < full.length; i++) {
        const idx = setSongs.findIndex((item) => item.id === full[i].id)
        if (idx >= 0) return idx
      }
      return setSongs.length - 1
    }
    const numeric = Number(saved)
    return Number.isFinite(numeric) ? Math.max(0, Math.min(setSongs.length - 1, numeric)) : 0
  })
  const wakeLock = useRef<any>(null); const song = setSongs[Math.min(index, setSongs.length - 1)]
  // If tonight's set changes under us (a sync pull after a soundcheck edit on another
  // device), keep following the song that was on screen — or clamp if it was removed.
  // Without this, index can point past the end forever: "12 / 5" and dead nav buttons.
  const shownIdRef = useRef(song.id)
  useEffect(() => {
    const at = setSongs.findIndex((item) => item.id === shownIdRef.current)
    if (at >= 0) { setIndex(at); return }
    // The shown song fell out of the walk list — e.g. it was skipped mid-set on another
    // device, or the user stopped following the live leader while peeking at a skipped
    // song. Resume at the next song after its slot in full set order (the same walk the
    // index initializer does), not at a blindly clamped index.
    const full = setOrdered(get)
    const from = full.findIndex((item) => item.id === shownIdRef.current)
    if (from >= 0) {
      for (let i = from + 1; i < full.length; i++) {
        const idx = setSongs.findIndex((item) => item.id === full[i].id)
        if (idx >= 0) { setIndex(idx); return }
      }
      setIndex(setSongs.length - 1)
      return
    }
    setIndex((i) => Math.max(0, Math.min(setSongs.length - 1, i)))
  }, [setSongs, get])
  const sheets = sheetsFor(song.id)
  const { settings, isFingeringOnly, toggleFingeringOnly } = useSettings()
  const cheatShapes = isFingeringOnly(song.id, 'cheat')
  const chordsShapes = isFingeringOnly(song.id, 'chords')
  const [pins, setPins] = useState<Record<string, string>>(readPins)
  useEffect(() => { localStorage.setItem(SHOW_PINS_KEY, JSON.stringify(pins)) }, [pins])
  // Open each song on its pinned default view when present; otherwise fall back to the
  // last view used (carried over across songs) or the cheat card.
  const [view, setView] = useState(() => pins[song.id] || localStorage.getItem(SHOW_VIEW_KEY) || 'scale')
  useEffect(() => { localStorage.setItem(SHOW_VIEW_KEY, view) }, [view])
  const effective = view === 'chords' && sheets.chords ? 'chords' : view === 'tabs' && sheets.tabs ? 'tabs' : 'scale'
  // On song change, snap to that song's pinned view (a manual mid-song switch is transient
  // — the pin is the default we return to). Done in render, not an effect: an effect paints
  // the carried-over view first and corrects it after, flashing the wrong sheet and
  // remounting the song boundary (its key includes `effective`) twice per turn. Keyed on
  // song.id only, so pinning the current song (a setPins) never fights a fresh manual switch.
  const [lastSongId, setLastSongId] = useState(song.id)
  if (song.id !== lastSongId) {
    setLastSongId(song.id)
    const p = pins[song.id]
    if (p) setView(p)
  }
  const togglePin = () => setPins((prev) => {
    const next = { ...prev }
    if (next[song.id] === effective) delete next[song.id]; else next[song.id] = effective
    return next
  })
  const views = ['scale', ...(sheets.chords ? ['chords'] : []), ...(sheets.tabs ? ['tabs'] : [])]
  const cycleView = (dir: 1 | -1) => { const idx = views.indexOf(effective); setView(views[(idx + dir + views.length) % views.length]) }
  const selectCheat = () => {
    if (effective === 'scale') {
      if (settings.cheat.scope !== 'none') toggleFingeringOnly(song.id, 'cheat')
    } else setView('scale')
  }
  const selectChords = () => {
    if (effective === 'chords') {
      if (settings.chords.scope !== 'none') toggleFingeringOnly(song.id, 'chords')
    } else setView('chords')
  }
  const tabsRef = useFitScale([song.id, sheets.tabs, effective], 'width', 0.45)
  const cheatRef = useFitScale([song.id, sheets.chords, sheets.tabs, effective, get(song.id).notes, cheatShapes], 'height', 0.7)
  const chordsRef = useRef<HTMLDivElement>(null)
  // Autoscroll: only the chords/tabs sheets scroll (the cheat card auto-fits one screen).
  const speed = get(song.id).scrollSpeed || DEFAULT_SCROLL_SPEED
  const [playing, setPlaying] = useState(false)
  const [scrollable, setScrollable] = useState(false)
  const [picker, setPicker] = useState(false) // jump-to-song overlay (audible calls)
  const pickerCenteredRef = useRef(false) // center the current song once per open, not on every re-render
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
  useEffect(() => { shownIdRef.current = song.id; localStorage.setItem(SHOW_INDEX_KEY, song.id) }, [song.id])
  // Live show sync: report every displayed song (only a leading device broadcasts it),
  // and snap to the leader's song when following. `live.leader` changes identity only
  // when the leader really changes songs, so a local peek at another song survives the
  // leader's periodic heartbeats.
  const { reportSong } = live
  useEffect(() => { reportSong(song.id) }, [song.id, reportSong])
  const [liveOpen, setLiveOpen] = useState(false)
  const leaderUpdate = following ? live.leader : null
  // Identity guard: `setSongs` gets a new identity on every practice-state change (any
  // patch or sync pull), and without the ref that would re-run the snap and yank a
  // peeking follower back even though the leader never moved. Snap only when the
  // leader update object itself is new.
  const appliedLeaderRef = useRef<typeof leaderUpdate>(null)
  useEffect(() => {
    if (!leaderUpdate || leaderUpdate === appliedLeaderRef.current) return
    appliedLeaderRef.current = leaderUpdate
    const at = setSongs.findIndex((item) => item.id === leaderUpdate.songId)
    if (at >= 0) setIndex(at)
  }, [leaderUpdate, setSongs])
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (picker || liveOpen) { if (e.key === 'Escape') { setPicker(false); setLiveOpen(false) } return }
      // PageDown/PageUp: Bluetooth page-turner pedals (AirTurn etc.) send these —
      // prevent default so they turn the song instead of scrolling the sheet.
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); setIndex((i) => Math.min(setSongs.length - 1, i + 1)) }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); setIndex((i) => Math.max(0, i - 1)) }
      if (e.key === 'ArrowDown') cycleView(1)
      if (e.key === 'ArrowUp') cycleView(-1)
      // Space toggles autoscroll — but only as a global shortcut; if a control is focused,
      // let it handle its own Space (avoids a double-toggle with the button's native activation).
      if (e.key === ' ' && scrollable && !(e.target as HTMLElement)?.closest('button,a,input,textarea,select')) { e.preventDefault(); togglePlay() }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effective, sheets.chords, sheets.tabs, scrollable, setSongs, picker, liveOpen])
  // Swipe navigation, cheat view only (it never scrolls horizontally, so a horizontal
  // drag is unambiguous there; sheet views keep swipes for scrolling). Mostly-horizontal
  // moves past the threshold turn the song; pointercancel means the browser claimed the
  // gesture as a scroll, so it's dropped.
  const swipeStart = useRef<{ x: number, y: number } | null>(null)
  const onSwipeDown = (e: React.PointerEvent) => { if (e.pointerType !== 'mouse' && e.isPrimary) swipeStart.current = { x: e.clientX, y: e.clientY } }
  const onSwipeUp = (e: React.PointerEvent) => {
    if (!e.isPrimary) return // a second finger lifting must not read the first finger's start point
    const start = swipeStart.current
    swipeStart.current = null
    if (!start) return
    const dx = e.clientX - start.x, dy = e.clientY - start.y
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 2) return
    setIndex((i) => dx < 0 ? Math.min(setSongs.length - 1, i + 1) : Math.max(0, i - 1))
  }
  const swipeProps = effective === 'scale' ? { onPointerDown: onSwipeDown, onPointerUp: onSwipeUp, onPointerCancel: () => { swipeStart.current = null } } : {}
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
      <button type="button" className="show-counter" onClick={() => { pickerCenteredRef.current = false; setPicker(true) }} aria-label="Jump to a song">{index + 1} / {setSongs.length}</button>
      <button type="button"
        className={`show-live${live.config ? (live.config.role === 'lead' ? ' leading' : ' following') : ''}${live.config && !live.connected ? ' pending' : ''}`}
        onClick={() => setLiveOpen(true)}
        aria-label={live.config ? (live.config.role === 'lead' ? 'Leading the live show' : 'Following the live show') : 'Live show sync'}>
        {live.config?.role === 'lead' ? `Live · ${live.followers}` : live.config?.role === 'follow' ? 'Following' : 'Live'}
      </button>
      <div><i style={{ width: `${((index + 1) / setSongs.length) * 100}%` }}/></div>
      <button type="button" className="show-nav-btn" disabled={index === setSongs.length - 1} onClick={() => setIndex((i) => Math.min(setSongs.length - 1, i + 1))} aria-label="Next song">›</button>
    </div>
    <ShowSongBoundary song={song} key={`${song.id}:${effective}`} onCheatView={effective !== 'scale' ? () => setView('scale') : undefined}>
    <article className={`show-song${effective !== 'scale' ? ' sheet-view' : ' cheat-view'}`} {...swipeProps}><span className="eyebrow">{song.artist}</span><h1>{song.title}</h1>{effective !== 'scale' && <div className="show-preset"><PresetBadges songId={song.id} showNotes/><HomeFretBadges song={song}/></div>}
    <div className="show-view-bar">
      <div className="fretboard-toggle show-view-toggle" role="tablist" aria-label="Show mode view">
        <button type="button" role="tab" aria-selected={effective === 'scale'} aria-pressed={effective === 'scale' ? cheatShapes : undefined}
          className={shapesTabClass(effective === 'scale', cheatShapes, settings.cheat.scope !== 'none')}
          title={effective === 'scale' && settings.cheat.scope !== 'none' ? (cheatShapes ? 'Showing fingering chips — tap again for Settings layout' : 'Tap again for fingering chips') : undefined}
          onClick={selectCheat}>Cheat</button>
        {sheets.chords && <button type="button" role="tab" aria-selected={effective === 'chords'} aria-pressed={effective === 'chords' ? chordsShapes : undefined}
          className={shapesTabClass(effective === 'chords', chordsShapes, settings.chords.scope !== 'none')}
          title={effective === 'chords' && settings.chords.scope !== 'none' ? (chordsShapes ? 'Showing fingering chips — tap again for Settings layout' : 'Tap again for fingering chips') : undefined}
          onClick={selectChords}>Chords</button>}
        {sheets.tabs && <button type="button" role="tab" aria-selected={effective === 'tabs'} className={effective === 'tabs' ? 'active' : ''} onClick={() => setView('tabs')}>Tabs</button>}
      </div>
      {(sheets.chords || sheets.tabs) && <button type="button" className={`show-pin${pins[song.id] === effective ? ' pinned' : ''}`} aria-pressed={pins[song.id] === effective} title={pins[song.id] === effective ? 'This view is the default for this song - tap to unpin' : 'Pin this view as the default for this song'} aria-label={pins[song.id] === effective ? 'Unpin default view for this song' : 'Pin this view as default for this song'} onClick={togglePin}>Pin</button>}
    </div>
    {effective !== 'scale' && scrollable && <div className="show-autoscroll">
      <button type="button" className="autoscroll-play" aria-pressed={playing} aria-label="Autoscroll" onClick={togglePlay}>{playing ? '⏸' : '▶'}</button>
      <button type="button" className="autoscroll-step" aria-label="Slower" disabled={speed <= MIN_SCROLL_SPEED} onClick={() => bumpSpeed(-SCROLL_SPEED_STEP)}>−</button>
      <span className="autoscroll-speed" aria-label={`Scroll speed ${speed} pixels per second`}>{speed}<i>px/s</i></span>
      <button type="button" className="autoscroll-step" aria-label="Faster" disabled={speed >= MAX_SCROLL_SPEED} onClick={() => bumpSpeed(SCROLL_SPEED_STEP)}>+</button>
    </div>}
    {effective === 'chords'
      ? <div className="show-sheet" ref={chordsRef}><ChordSheetView text={sheets.chords!} songId={song.id}/></div>
      : effective === 'tabs'
        ? <div className="show-sheet show-tabs" ref={tabsRef}><TabText text={sheets.tabs!}/></div>
        : <CheatCard song={song} innerRef={cheatRef}/>}</article>
    </ShowSongBoundary>
    {index < setSongs.length - 1 && (() => { const next = setSongs[index + 1]; return <p className="show-upnext"><span className="show-upnext-label">Up next</span><b>{next.title}</b> {next.artist}{next.tuning !== 'Standard' ? <span className="cheat-chip cheat-tuning">{next.tuning}</span> : null}<PresetBadges songId={next.id}/></p> })()}
    {liveOpen && <LiveOverlay onClose={() => setLiveOpen(false)} onJump={(songId) => { const at = setSongs.findIndex((item) => item.id === songId); if (at >= 0) setIndex(at) }} />}
    {picker && <div className="show-picker" onClick={() => setPicker(false)}>
      <div className="show-picker-list" role="dialog" aria-label="Jump to song" onClick={(e) => e.stopPropagation()}>
        {setSongs.map((item, i) => <button type="button" key={item.id} className={i === index ? 'current' : ''}
          ref={i === index ? (el) => { if (el && !pickerCenteredRef.current) { pickerCenteredRef.current = true; el.scrollIntoView({ block: 'center' }) } } : undefined}
          onClick={() => { setIndex(i); setPicker(false) }}>
          <span className="show-picker-num">{String(i + 1).padStart(2, '0')}</span>
          <span className="show-picker-title">{item.title}</span>
          {item.tuning !== 'Standard' && <i className="show-picker-tuning">{item.tuning}</i>}
        </button>)}
      </div>
    </div>}
    </div>
}

function PageTitle({ eyebrow, title, copy, compact = false }: { eyebrow?: string, title: string, copy?: string, compact?: boolean }) { return <header className={`page-title ${compact ? 'compact' : ''}`}>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1>{copy && <p>{copy}</p>}</header> }
