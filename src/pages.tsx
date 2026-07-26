import { Component, useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode, type RefObject } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { songs } from './data'
import { AmpPresetField, CheatCard, ChordSheetView, Difficulty, Field, FretboardPanel, HomeFretBadges, PracticeControls, PracticeLauncher, PresetBadges, SheetPanel, SongCard, SongLinks, TabText, unknown, type SheetKind } from './components'
import { usePractice } from './storage'
import { AutoScrollBar, useAutoScrollControls } from './autoscroll'
import { progressionFor } from './progressions'
import { transposeFor, transposeLabel, transposeHint } from './transpose'
import { sheetsFor } from './sheets'
import { SyncPanel } from './sync'
import { LiveOverlay, useLive } from './live'
import { setOrdered, tonightsSongs } from './setlist'
import { shapesTabClass, useSettings } from './settings'
import { statuses, type PracticeEntry, type Song } from './types'

const styles = [...new Set(songs.map((song) => song.practiceStyle))]
const tunings = ['Standard', 'Drop D']
const priorityLabel = ['None', 'Low', 'Medium', 'High']
// localStorage (not sessionStorage): mobile OSes kill backgrounded tabs under memory
// pressure, and mid-set that must not reset the show to song 1. Keyed per deployment
// like the practice store, so /dev/ and prod don't share a show position.
const SHOW_KEY_SUFFIX = import.meta.env.BASE_URL.includes('/dev/') ? '-dev' : ''
const SHOW_INDEX_KEY = `overdrive-show-index${SHOW_KEY_SUFFIX}`
// Show-mode view ids: 'cheat' (building-blocks card), 'chords' (full roadmap card),
// 'lyrics' (chord-over-lyric sheet), 'tabs'. The 2026-07 tab rename shifted meanings —
// 'scale' was the roadmap card and 'chords' was the lyric sheet — so the view/pin keys
// were bumped to *2 and legacy values are mapped on first read (an un-bumped key would
// make a stored 'chords' ambiguous between the old sheet and the new card).
const migrateLegacyView = (v: string): string => (v === 'scale' ? 'chords' : v === 'chords' ? 'lyrics' : v)
const SHOW_VIEW_KEY = `overdrive-show-view2${SHOW_KEY_SUFFIX}`
const LEGACY_SHOW_VIEW_KEY = `overdrive-show-view${SHOW_KEY_SUFFIX}`
const readShowView = (): string => {
  try {
    const v = localStorage.getItem(SHOW_VIEW_KEY)
    if (v) return v
    const legacy = localStorage.getItem(LEGACY_SHOW_VIEW_KEY)
    return legacy ? migrateLegacyView(legacy) : ''
  } catch { return '' }
}
// Per-song pinned default view (songId -> view id above). Deliberately in localStorage,
// NOT the synced practice store: pins are a per-device rehearsal preference, not band
// data. Keyed per deployment like the other show keys.
const SHOW_PINS_KEY = `overdrive-show-pins2${SHOW_KEY_SUFFIX}`
const LEGACY_SHOW_PINS_KEY = `overdrive-show-pins${SHOW_KEY_SUFFIX}`
const readPins = (): Record<string, string> => {
  try {
    const raw = localStorage.getItem(SHOW_PINS_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    if (parsed && typeof parsed === 'object') return parsed
    const legacy = JSON.parse(localStorage.getItem(LEGACY_SHOW_PINS_KEY) || '{}')
    if (legacy && typeof legacy === 'object') {
      return Object.fromEntries(Object.entries(legacy).map(([id, v]) => [id, migrateLegacyView(String(v))]))
    }
    return {}
  } catch { return {} }
}

/** Resolve a saved show position (song id, or legacy numeric index) to an index in the
 * walk list. Skipped songs resume at the next active slot after their set position. */
function resolveShowIndex(saved: string, setSongs: Song[], get: (id: string) => PracticeEntry): number {
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
    return Math.max(0, setSongs.length - 1)
  }
  const numeric = Number(saved)
  return Number.isFinite(numeric) ? Math.max(0, Math.min(setSongs.length - 1, numeric)) : 0
}

export function Dashboard() {
  const { get, exportBackup, importBackup } = usePractice(); const navigate = useNavigate(); const fileRef = useRef<HTMLInputElement>(null)
  const statusCounts = statuses.map((status) => ({ status, count: songs.filter((s) => get(s.id).status === status).length }))
  const focus = [...songs].filter((s) => get(s.id).status !== 'Show Ready').sort((a, b) => get(b.id).priority - get(a.id).priority || (b.difficulty || 0) - (a.difficulty || 0)).slice(0, 4)
  const restore = async (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; try { await importBackup(file); alert('Practice backup restored.') } catch (error) { alert(error instanceof Error ? error.message : 'Could not restore backup.') } event.target.value = '' }
  return <><section className="dashboard-summary"><div className="stats stats-status">{statusCounts.map(({ status, count }) => <div key={status}><strong>{count}</strong><span>{status.toLowerCase()}</span></div>)}</div><div className="actions"><Link className="button" to="/practice">Start practice</Link><Link className="button secondary" to="/set">Tonight’s set</Link><Link className="button secondary" to="/show">Show mode</Link></div></section>
    <section><div className="section-heading"><div><span className="eyebrow">Today’s practice</span><h2>Needs work</h2></div><button className="text-button" onClick={() => navigate(`/song/${songs[Math.floor(Math.random() * songs.length)].id}`)}>Random song ↗</button></div><div className="card-grid">{focus.map((song) => <SongCard song={song} key={song.id} />)}</div></section>
    <section className="panel backup"><div><span className="eyebrow">This browser</span><h2>Backup & restore</h2><p>Your status and notes stay here unless you export them.</p></div><div className="actions"><button onClick={exportBackup}>Export backup</button><button className="secondary" onClick={() => fileRef.current?.click()}>Restore backup</button><input ref={fileRef} hidden type="file" accept="application/json" onChange={restore} /></div></section>
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

/** Jump-to-song overlay, shared by show mode and the song (practice) page. Mounted per
 *  open (callers render it conditionally), so the one-time centering resets each open. */
function SongPicker({ list, currentId, onPick, onClose }: { list: Song[], currentId: string, onPick: (song: Song, index: number) => void, onClose: () => void }) {
  const centeredRef = useRef(false)
  return <div className="show-picker" onClick={onClose}>
    <div className="show-picker-list" role="dialog" aria-label="Jump to song" onClick={(e) => e.stopPropagation()}>
      {list.map((item, i) => <button type="button" key={item.id} className={item.id === currentId ? 'current' : ''}
        ref={item.id === currentId ? (el) => { if (el && !centeredRef.current) { centeredRef.current = true; el.scrollIntoView({ block: 'center' }) } } : undefined}
        onClick={() => { onPick(item, i); onClose() }}>
        <span className="show-picker-num">{String(i + 1).padStart(2, '0')}</span>
        <span className="show-picker-title">{item.title}</span>
        {item.tuning !== 'Standard' && <i className="show-picker-tuning">{item.tuning}</i>}
      </button>)}
    </div>
  </div>
}

export function SongDetail() {
  const { id } = useParams(); const song = songs.find((item) => item.id === id)
  const navigate = useNavigate()
  const [sheetView, setSheetView] = useState<SheetKind | null>(null)
  const [picker, setPicker] = useState(false)
  // Practice navigation mirrors show mode's controls (‹ › + tap-the-counter picker) but
  // walks the FULL setlist in set order — practice isn't scoped to tonight's set.
  const index = song ? songs.indexOf(song) : -1
  const goTo = (i: number) => {
    const target = songs[Math.max(0, Math.min(songs.length - 1, i))]
    if (target && target.id !== song?.id) navigate(`/song/${target.id}`)
  }
  // Same keys as show mode (ArrowLeft/Right + PageUp/PageDown pedals), but bail whenever
  // a form control is focused — arrows must keep editing the notes textarea, not turn songs.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (!song) return // not-found page: arrows must not silently jump to song 1
      if ((e.target as HTMLElement)?.closest('input,textarea,select')) return
      if (picker) { if (e.key === 'Escape') setPicker(false); return }
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); goTo(index + 1) }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); goTo(index - 1) }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, picker])
  // Song→song nav reuses this mounted page — start each song at the top like show mode.
  // Layout effect: after paint the old scroll offset flashes for a frame on song turn.
  useLayoutEffect(() => { window.scrollTo(0, 0) }, [id])
  if (!song) return <PageTitle eyebrow="Not found" title="That song isn’t in this set" copy="Return to the full song list and try another." />
  const transpose = transposeFor(song.id)
  // Keyed like show mode's ShowSongBoundary: prev/next now reuses this mounted route, and
  // per-song child state (fretboard variant toggle, chip popovers) must reset per song.
  return <div className="song-detail" key={song.id}><div className="song-detail-top"><Link className="back" to="/practice">← Back to practice</Link><div className="song-nav">
      <button type="button" className="show-nav-btn" disabled={index === 0} onClick={() => goTo(index - 1)} aria-label="Previous song">‹</button>
      <button type="button" className="show-counter" onClick={() => setPicker(true)} aria-label="Jump to a song">{index + 1} / {songs.length}</button>
      <button type="button" className="show-nav-btn" disabled={index === songs.length - 1} onClick={() => goTo(index + 1)} aria-label="Next song">›</button>
      <Difficulty value={song.difficulty}/>
    </div></div>
    {picker && <SongPicker list={songs} currentId={song.id} onPick={(_, i) => goTo(i)} onClose={() => setPicker(false)}/>}<section className="song-title"><div><h1>{song.title}</h1><p>{song.artist}</p></div><Link className="button secondary song-show-link" to={`/show/${song.id}`}>Stage view ↗</Link></section><PracticeLauncher song={song}/><SongLinks song={song} showBackingTrack={false}/><section className="detail-grid"><div className="panel"><h2>Song info</h2><dl><AmpPresetField songId={song.id}/><Field label="Band tuning" value={song.tuning}/>{transpose && <Field label="Transpose recording" value={transposeHint(transpose)}/>}{song.recordingNote && <Field label="Tab / recording note" value={song.recordingNote}/>}<Field label="Role" value={song.role}/><Field label="Practice style" value={song.practiceStyle}/><Field label="Link quality" value={song.linkQuality}/></dl></div><div className="panel"><h2>Fretboard</h2><FretboardPanel song={song}/><dl><Field label="Scale hint" value={song.scaleHint}/></dl></div><div className="panel wide"><h2>Performance plan</h2><dl><Field label="Must-know part" value={song.mustKnow}/><Field label="Fallback part" value={song.fallback}/>{song.rehearsalNotes && <Field label="Ask the band" value={song.rehearsalNotes}/>}</dl></div></section><SheetPanel song={song} view={sheetView} onViewChange={setSheetView}/><PracticeControls song={song}/></div>
}

// Shrinks the sheet's font until it fits the container (height for compact chords,
// width for monospace tab lines), so a phone in show mode sees as much of the song
// as possible without scrolling. Floored — extreme songs scroll a little instead.
// `frozen` suspends fitting: while the user has pinch-zoomed the card, --sheet-fit is
// left at its last fitted value (the 1× baseline) and --zoom multiplies from there, so
// auto-fit and the user's zoom don't fight over the same font-size on the same element.
function useFitScale(deps: unknown[], axis: 'height' | 'width' = 'height', floor = 0.6, frozen = false) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || frozen) return
    const measure = () => {
      el.style.setProperty('--sheet-fit', '1')
      const ratio = axis === 'height' ? el.clientHeight / el.scrollHeight : el.clientWidth / el.scrollWidth
      el.style.setProperty('--sheet-fit', String(ratio < 1 ? Math.max(floor, ratio * 0.97) : 1))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, frozen])
  return ref
}

// Pinch-to-zoom for show-mode sheets. Multiplies a --zoom CSS var (minZoom–3×) that scales
// font-size — real reflow, so chord chips and lyric lines re-wrap smartly as you zoom in,
// unlike a transform:scale that would just magnify and overflow. Two-finger pinch (via a
// non-passive touchmove so we can preventDefault the native page-zoom/scroll) plus
// ctrl+wheel for trackpads/desktop. Resets to `initialZoom` whenever `resetKey` changes
// (song or view switch). `enabled` is false on the Tabs sheet, which stays fit-to-width.
const MAX_ZOOM = 3
function useZoom(resetKey: string, minZoom: number, enabled: boolean, initialZoom = 1) {
  const [zoom, setZoom] = useState(initialZoom)
  const zoomRef = useRef(initialZoom)
  zoomRef.current = zoom
  const elRef = useRef<HTMLElement | null>(null)
  const pinch = useRef<{ d0: number, z0: number } | null>(null)
  // Fresh baseline per song/view. Layout effect so the reset lands before paint.
  useLayoutEffect(() => { setZoom(initialZoom) }, [resetKey, initialZoom])
  // resetKey is in the deps because the article that holds elRef is remounted on every
  // song/view change (ShowSongBoundary's key). Without it, listeners would stay bound to
  // the detached old node and the fresh article would get none — pinch dead after turn 1.
  useEffect(() => {
    const el = elRef.current
    if (!el || !enabled) return
    const clamp = (z: number) => Math.min(MAX_ZOOM, Math.max(minZoom, z))
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
    const onStart = (e: TouchEvent) => { if (e.touches.length === 2) pinch.current = { d0: dist(e.touches), z0: zoomRef.current } }
    const onMove = (e: TouchEvent) => {
      if (!pinch.current || e.touches.length < 2) return
      e.preventDefault() // owns the 2-finger gesture: no native zoom, no scroll fighting it
      if (pinch.current.d0 > 0) setZoom(clamp(pinch.current.z0 * (dist(e.touches) / pinch.current.d0)))
    }
    const onEnd = (e: TouchEvent) => { if (e.touches.length < 2) pinch.current = null }
    const onWheel = (e: WheelEvent) => { if (!e.ctrlKey) return; e.preventDefault(); setZoom(clamp(zoomRef.current * (1 - e.deltaY / 100))) }
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd)
    el.addEventListener('touchcancel', onEnd)
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
      el.removeEventListener('wheel', onWheel)
    }
  }, [enabled, minZoom, resetKey])
  return { zoom, setZoom, elRef, initialZoom }
}

/** Shared stage chrome strip: tuning / transpose / capo / amp presets / home frets. */
function ShowStageStrip({ song, includeHomeFrets = false }: { song: Song, includeHomeFrets?: boolean }) {
  const transpose = transposeFor(song.id)
  // Known limit: always the LIVE entry's capo — the dev version dropdown in CheatCard
  // doesn't reach up here, so an archived version with a different capo would show the
  // current capo chip. Acceptable while no card uses `capo`; lift the choice up if one does.
  const capo = progressionFor(song.id)?.capo
  return <div className="show-stage-strip">
    {song.tuning !== 'Standard' && <span className="cheat-chip cheat-tuning">{song.tuning}</span>}
    {transpose && <span className="cheat-chip cheat-transpose" title={transposeHint(transpose)}>Transpose {transposeLabel(transpose.semitones)}</span>}
    {capo && <span className="cheat-chip cheat-capo">{capo}</span>}
    <PresetBadges songId={song.id} showNotes />
    {/* Sheet views park home-fret chips next to AutoScrollBar so they survive chrome collapse. */}
    {includeHomeFrets && <HomeFretBadges song={song} />}
  </div>
}

// Last line of defense on stage: if anything in the song view throws mid-set (e.g. a
// sheet edited the night before breaks the parser), show the song's name instead of a
// white screen — the prev/next controls live outside the boundary and keep working.
// Keyed by song+view in Show() so navigating away retries rendering fresh. `onCardView`
// escapes to the other progression card (a different code path than whatever crashed).
class ShowSongBoundary extends Component<{ song: Song, onCardView?: () => void, cardLabel?: string, children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (!this.state.failed) return this.props.children
    const { song, onCardView, cardLabel } = this.props
    return <article className="show-song cheat-view"><span className="eyebrow">{song.artist}</span><h1>{song.title}</h1>
      <p className="show-error">This song’s view hit an error. Use ‹ › to keep the show moving.</p>
      {onCardView && <p><button type="button" className="secondary" onClick={onCardView}>{cardLabel ?? 'Open the chords card instead'}</button></p>}
      <div className="show-content"><div className="show-fields">
        <Field label="Role" value={song.role} />
        <Field label="Must know" value={song.mustKnow} />
        <Field label="Fallback" value={song.fallback} />
      </div></div></article>
  }
}

export function Show() {
  const { songId: urlSongId } = useParams()
  const navigate = useNavigate()
  const { get } = usePractice()
  const live = useLive()
  const following = live.config?.role === 'follow'
  // Tonight's set (skips + order from the Set page) — falls back to the full setlist
  // when nothing is configured. `get` is stable per practice-state change. While
  // following a live leader the walk list is the FULL ordered set (skips ignored):
  // navigation belongs to the leader, whose song must stay findable here even if
  // this device skipped it at soundcheck.
  const setSongs = useMemo(() => following ? setOrdered(get) : tonightsSongs(get), [get, following])
  // Song id lives in the URL (`/show/:songId`) so the browser back/forward buttons
  // step through songs instead of leaving show mode. Bare `/show` (nav links) falls
  // back to the persisted id; skipped/missing ids resume at the next active slot.
  const index = resolveShowIndex(urlSongId || localStorage.getItem(SHOW_INDEX_KEY) || '', setSongs, get)
  const wakeLock = useRef<any>(null); const song = setSongs[Math.min(index, setSongs.length - 1)]
  // Canonicalize the URL onto the resolved song (bare `/show`, skipped id, set-list
  // edits that drop the current song). replace — don't invent a history entry for a
  // redirect the user didn't navigate.
  useEffect(() => {
    if (!song) return
    if (urlSongId !== song.id) navigate(`/show/${song.id}`, { replace: true })
  }, [song?.id, urlSongId, navigate])
  // Push (or replace) a history entry when turning the set. Every in-show next/prev
  // goes through here so Back returns to the previous song.
  const goTo = (i: number, replace = false) => {
    const clamped = Math.max(0, Math.min(setSongs.length - 1, i))
    const id = setSongs[clamped]?.id
    if (!id || (id === urlSongId && !replace)) return
    navigate(`/show/${id}`, { replace })
  }
  const sheets = sheetsFor(song.id)
  const { settings, isFingeringOnly, toggleFingeringOnly, isRyanMeasure, toggleRyanMeasure } = useSettings()
  // Fingering surfaces predate the tab rename: 'cheat' governs chips on BOTH progression
  // cards (Cheat and Chords tabs share one toggle per song); 'chords' governs the Lyrics sheet.
  const cardShapes = isFingeringOnly(song.id, 'cheat')
  const lyricsShapes = isFingeringOnly(song.id, 'chords')
  // Lanes: production measure map from .ryan.txt (no flag). Ryan: same file, flag-gated.
  const lanesOn = !!sheets.ryan
  const ryanOn = !!sheets.ryan && settings.ryanTab
  const [pins, setPins] = useState<Record<string, string>>(readPins)
  useEffect(() => { localStorage.setItem(SHOW_PINS_KEY, JSON.stringify(pins)) }, [pins])
  // Open each song on its pinned default view when present; otherwise fall back to the
  // last view used (carried over across songs) or the roadmap card.
  const [view, setView] = useState(() => pins[song.id] || readShowView() || 'chords')
  useEffect(() => { localStorage.setItem(SHOW_VIEW_KEY, view) }, [view])
  // Sheets need their file to exist; unknown/legacy ids land on the roadmap card.
  const effective = view === 'lanes' && lanesOn ? 'lanes' : view === 'ryan' && ryanOn ? 'ryan' : view === 'lyrics' && sheets.chords ? 'lyrics' : view === 'tabs' && sheets.tabs ? 'tabs' : view === 'cheat' ? 'cheat' : 'chords'
  const cardView = effective === 'cheat' || effective === 'chords'
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
  const views = [...(ryanOn ? ['ryan'] : []), ...(lanesOn ? ['lanes'] : []), 'cheat', 'chords', ...(sheets.chords ? ['lyrics'] : []), ...(sheets.tabs ? ['tabs'] : [])]
  const cycleView = (dir: 1 | -1) => { const idx = views.indexOf(effective); setView(views[(idx + dir + views.length) % views.length]) }
  // Tapping the already-active card tab re-taps into fingering chips (both cards share
  // the 'cheat' surface); same retap on the Lyrics tab flips its own 'chords' surface.
  const selectCard = (target: 'cheat' | 'chords') => {
    if (effective === target) {
      if (settings.cheat.scope !== 'none') toggleFingeringOnly(song.id, 'cheat')
    } else setView(target)
  }
  const selectLyrics = () => {
    if (effective === 'lyrics') {
      if (settings.chords.scope !== 'none') toggleFingeringOnly(song.id, 'chords')
    } else setView('lyrics')
  }
  // Retap Ryan: lyric-led UG layout ↔ equal-width measure (play-along) columns.
  const selectRyan = () => {
    if (effective === 'ryan') toggleRyanMeasure(song.id)
    else setView('ryan')
  }
  const ryanMeasure = isRyanMeasure(song.id)
  const measureScroll = effective === 'lanes' || (effective === 'ryan' && ryanMeasure)
  // Pinch-zoom the three text sheets (not the fit-to-width Tabs). Cards can't shrink below
  // their fitted 1× baseline (min 1); the lyric sheet can shrink a little to show more.
  // Lanes / Ryan start at 0.75× so the measure map fits the phone without a pinch first;
  // min 0.6× lets a long sheet shrink further on stage. Lyrics stay min 0.75× / start 1×.
  const zoomMin = measureScroll || effective === 'ryan' ? 0.6 : effective === 'lyrics' ? 0.75 : 1
  const zoomInitial = measureScroll || effective === 'ryan' ? 0.75 : 1
  const { zoom, setZoom, elRef: zoomElRef, initialZoom } = useZoom(`${song.id}:${effective}`, zoomMin, effective !== 'tabs', zoomInitial)
  const tabsRef = useFitScale([song.id, sheets.tabs, effective], 'width', 0.45)
  const cheatRef = useFitScale([song.id, sheets.chords, sheets.tabs, effective, get(song.id).notes, cardShapes], 'height', 0.7, zoom !== 1)
  const lyricsRef = useRef<HTMLDivElement>(null)
  const ryanRef = useRef<HTMLDivElement>(null)
  const lanesRef = useRef<HTMLDivElement>(null)
  const [picker, setPicker] = useState(false) // jump-to-song overlay (audible calls)
  // Autoscroll: only the lyrics/tabs/lanes/ryan sheets scroll (the progression cards auto-fit
  // one screen). State machine + speed persistence shared with the practice page: autoscroll.tsx.
  const scrollTarget = effective === 'tabs' ? tabsRef : effective === 'lyrics' ? lyricsRef : effective === 'ryan' ? ryanRef : effective === 'lanes' ? lanesRef : null
  // Pass show-mode pinch --zoom so the crawl scales with content height (set-and-forget
  // speed survives zoom). Tabs aren't pinch-zoomable (fit-to-width); still pass zoom for
  // consistency when the user was mid-gesture on another view.
  const scroll = useAutoScrollControls(scrollTarget, song.id, [index, effective, sheets.chords, sheets.tabs, sheets.ryan, ryanMeasure], zoom, measureScroll ? 'measure' : 'lyric')
  useEffect(() => { localStorage.setItem(SHOW_INDEX_KEY, song.id) }, [song.id])
  // Live show sync: report every displayed song (only a leading device broadcasts it),
  // and snap to the leader's song when following. `live.leader` changes identity only
  // when the leader really changes songs, so a local peek at another song survives the
  // leader's periodic heartbeats.
  const { reportSong } = live
  useEffect(() => { reportSong(song.id) }, [song.id, reportSong])
  const [liveOpen, setLiveOpen] = useState(false)
  const leaderUpdate = following && !live.paused ? live.leader : null
  // Identity guard: `setSongs` gets a new identity on every practice-state change (any
  // patch or sync pull), and without the ref that would re-run the snap and yank a
  // peeking follower back even though the leader never moved. Snap only when the
  // leader update object itself is new. replace: leader-driven turns shouldn't stack
  // history the follower would have to back through. Pause following clears this
  // update (channel stays up); resume bumps leader.seq so the snap fires again.
  const appliedLeaderRef = useRef<typeof leaderUpdate>(null)
  useEffect(() => {
    if (!leaderUpdate || leaderUpdate === appliedLeaderRef.current) return
    appliedLeaderRef.current = leaderUpdate
    const at = setSongs.findIndex((item) => item.id === leaderUpdate.songId)
    if (at >= 0) goTo(at, true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaderUpdate, setSongs])
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (picker || liveOpen) { if (e.key === 'Escape') { setPicker(false); setLiveOpen(false) } return }
      // PageDown/PageUp: Bluetooth page-turner pedals (AirTurn etc.) send these —
      // prevent default so they turn the song instead of scrolling the sheet.
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); goTo(index + 1) }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); goTo(index - 1) }
      if (e.key === 'ArrowDown') cycleView(1)
      if (e.key === 'ArrowUp') cycleView(-1)
      // Space toggles autoscroll — but only as a global shortcut; if a control is focused,
      // let it handle its own Space (avoids a double-toggle with the button's native activation).
      if (e.key === ' ' && scroll.scrollable && !(e.target as HTMLElement)?.closest('button,a,input,textarea,select')) { e.preventDefault(); scroll.togglePlay() }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effective, sheets.chords, sheets.tabs, lanesOn, ryanOn, scroll.scrollable, setSongs, picker, liveOpen, index, urlSongId])
  // Swipe navigation, card views only (they never scroll horizontally, so a horizontal
  // drag is unambiguous there; sheet views keep swipes for scrolling). Mostly-horizontal
  // moves past the threshold turn the song; pointercancel means the browser claimed the
  // gesture as a scroll, so it's dropped. Pointer count is tracked so a two-finger
  // pinch-zoom never reads as a swipe: `multi` latches once a 2nd finger lands and a
  // swipe is only committed if the whole gesture stayed single-touch.
  const swipeStart = useRef<{ x: number, y: number } | null>(null)
  const pointers = useRef<Set<number>>(new Set())
  const multi = useRef(false)
  const onSwipeDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') return
    pointers.current.add(e.pointerId)
    if (pointers.current.size > 1) { multi.current = true; swipeStart.current = null; return }
    if (cardView) swipeStart.current = { x: e.clientX, y: e.clientY }
  }
  const onSwipeUp = (e: React.PointerEvent) => {
    const wasMulti = multi.current
    pointers.current.delete(e.pointerId)
    if (pointers.current.size === 0) multi.current = false
    if (!e.isPrimary || wasMulti || !cardView) return // multi-touch gesture (pinch) — not a swipe
    const start = swipeStart.current
    swipeStart.current = null
    if (!start) return
    const dx = e.clientX - start.x, dy = e.clientY - start.y
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 2) return
    goTo(dx < 0 ? index + 1 : index - 1)
  }
  const onSwipeCancel = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size === 0) multi.current = false
    swipeStart.current = null
  }
  const swipeProps = { onPointerDown: onSwipeDown, onPointerUp: onSwipeUp, onPointerCancel: onSwipeCancel }
  // The article that owns these pointers remounts on every song/view change (ShowSongBoundary
  // key). If it remounts while a finger rests on it — a live-sync snap or page-turner pedal
  // mid-touch — that pointer's up lands on the new node and never clears the old id, stranding
  // `pointers` non-empty so every later touch reads as multi-touch and swipe dies for the
  // session. Clear on the same boundary; resetKey never changes mid-pinch, so no live gesture
  // is clobbered.
  useEffect(() => { pointers.current.clear(); multi.current = false; swipeStart.current = null }, [song.id, effective])
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
  // Collapse non-essential chrome while autoscroll is armed (playing or lead-in) so the
  // sheet gets max viewport. Keep × exit, compact title, ‹ n/N ›, Live chip, AutoScrollBar,
  // and home-fret scale chips (parked beside the scroll controls on sheet views).
  return <div className={`show-mode${scroll.playing ? ' show-mode--crawling' : ''}${!scroll.playing && scroll.chromeSettle ? ' show-mode--chrome-settle' : ''}`}>
    <Link className="show-exit" to="/" aria-label="Exit show mode">×</Link>
    <div className="show-progress">
      <button type="button" className="show-nav-btn" disabled={index === 0} onClick={() => goTo(index - 1)} aria-label="Previous song">‹</button>
      <button type="button" className="show-counter" onClick={() => setPicker(true)} aria-label="Jump to a song">{index + 1} / {setSongs.length}</button>
      <button type="button"
        className={`show-live${live.config ? (live.config.role === 'lead' ? ' leading' : live.paused ? ' paused' : ' following') : ''}${live.config && !live.connected ? ' pending' : ''}`}
        onClick={() => setLiveOpen(true)}
        aria-label={live.config ? (live.config.role === 'lead' ? 'Leading the live show' : live.paused ? 'Live follow paused' : 'Following the live show') : 'Live show sync'}>
        {live.config?.role === 'lead' ? `Live · ${live.followers}` : live.config?.role === 'follow' ? (live.paused ? 'Paused' : 'Following') : 'Live'}
      </button>
      <div><i style={{ width: `${((index + 1) / setSongs.length) * 100}%` }}/></div>
      <button type="button" className="show-nav-btn" disabled={index === setSongs.length - 1} onClick={() => goTo(index + 1)} aria-label="Next song">›</button>
    </div>
    <ShowSongBoundary song={song} key={`${song.id}:${effective}`} onCardView={effective !== 'chords' ? () => setView('chords') : () => setView('cheat')} cardLabel={effective !== 'chords' ? 'Open the chords card instead' : 'Open the cheat card instead'}>
    <article ref={zoomElRef as RefObject<HTMLElement>} style={{ ['--zoom' as string]: zoom } as React.CSSProperties} className={`show-song${cardView ? ' cheat-view' : ' sheet-view'}${effective !== 'tabs' ? ' show-zoomable' : ''}`} {...swipeProps}><div className="show-song-head"><span className="eyebrow">{song.artist}</span><h1>{song.title}</h1></div>
    <div className="show-view-bar">
      <div className="fretboard-toggle show-view-toggle" role="tablist" aria-label="Show mode view">
        {ryanOn && <button type="button" role="tab" aria-selected={effective === 'ryan'} aria-pressed={effective === 'ryan' ? ryanMeasure : undefined}
          className={shapesTabClass(effective === 'ryan', ryanMeasure, true)}
          title={effective === 'ryan' ? (ryanMeasure ? 'Measure map on. Tap again for lyric layout' : 'Tap again for measure map') : undefined}
          onClick={selectRyan}>Ryan</button>}
        {lanesOn && <button type="button" role="tab" aria-selected={effective === 'lanes'} className={effective === 'lanes' ? 'active' : ''} onClick={() => setView('lanes')}>Lanes</button>}
        <button type="button" role="tab" aria-selected={effective === 'cheat'} aria-pressed={effective === 'cheat' ? cardShapes : undefined}
          className={shapesTabClass(effective === 'cheat', cardShapes, settings.cheat.scope !== 'none')}
          title={effective === 'cheat' && settings.cheat.scope !== 'none' ? (cardShapes ? 'Showing fingering chips. Tap again for Settings layout' : 'Tap again for fingering chips') : undefined}
          onClick={() => selectCard('cheat')}>Cheat</button>
        <button type="button" role="tab" aria-selected={effective === 'chords'} aria-pressed={effective === 'chords' ? cardShapes : undefined}
          className={shapesTabClass(effective === 'chords', cardShapes, settings.cheat.scope !== 'none')}
          title={effective === 'chords' && settings.cheat.scope !== 'none' ? (cardShapes ? 'Showing fingering chips. Tap again for Settings layout' : 'Tap again for fingering chips') : undefined}
          onClick={() => selectCard('chords')}>Chords</button>
        {sheets.chords && <button type="button" role="tab" aria-selected={effective === 'lyrics'} aria-pressed={effective === 'lyrics' ? lyricsShapes : undefined}
          className={shapesTabClass(effective === 'lyrics', lyricsShapes, settings.chords.scope !== 'none')}
          title={effective === 'lyrics' && settings.chords.scope !== 'none' ? (lyricsShapes ? 'Showing fingering chips. Tap again for Settings layout' : 'Tap again for fingering chips') : undefined}
          onClick={selectLyrics}>Lyrics</button>}
        {sheets.tabs && <button type="button" role="tab" aria-selected={effective === 'tabs'} className={effective === 'tabs' ? 'active' : ''} onClick={() => setView('tabs')}>Tabs</button>}
      </div>
      <button type="button" className={`show-pin${pins[song.id] === effective ? ' pinned' : ''}`} aria-pressed={pins[song.id] === effective} title={pins[song.id] === effective ? 'This view is the default for this song - tap to unpin' : 'Pin this view as the default for this song'} aria-label={pins[song.id] === effective ? 'Unpin default view for this song' : 'Pin this view as default for this song'} onClick={togglePin}>Pin</button>
    </div>
    <ShowStageStrip song={song} includeHomeFrets={cardView} />
    {!cardView && <div className="show-sheet-tools">
      {scroll.scrollable && <AutoScrollBar scroll={scroll}/>}
      <HomeFretBadges song={song} />
    </div>}
    {effective === 'lanes'
      ? <div className="show-sheet" ref={lanesRef}><div className="autoscroll-inner"><ChordSheetView text={sheets.ryan!} songId={song.id} frets powerFingerings layout="measure" omitFills/></div></div>
      : effective === 'ryan'
        ? <div className="show-sheet" ref={ryanRef}><div className="autoscroll-inner"><ChordSheetView text={sheets.ryan!} songId={song.id} frets powerFingerings layout={ryanMeasure ? 'measure' : 'lyric'}/></div></div>
        : effective === 'lyrics'
          ? <div className="show-sheet" ref={lyricsRef}><div className="autoscroll-inner"><ChordSheetView text={sheets.chords!} songId={song.id}/></div></div>
          : effective === 'tabs'
            ? <div className="show-sheet show-tabs" ref={tabsRef}><div className="autoscroll-inner"><TabText text={sheets.tabs!}/></div></div>
            : <CheatCard song={song} innerRef={cheatRef} variant={effective === 'cheat' ? 'cheat' : 'chords'} zoomFrozen={zoom !== 1}/>}</article>
    </ShowSongBoundary>
    {effective !== 'tabs' && zoom !== initialZoom && <button type="button" className="show-zoom-reset" onClick={() => setZoom(initialZoom)} aria-label="Reset zoom to fit">{zoom.toFixed(1)}× · Reset</button>}
    {index < setSongs.length - 1 && (() => { const next = setSongs[index + 1]; return <button type="button" className="show-upnext" onClick={() => goTo(index + 1)} aria-label={`Next song: ${next.title}`}>
      <span className="show-upnext-label">Up next</span><b>{next.title}</b> {next.artist}{next.tuning !== 'Standard' ? <span className="cheat-chip cheat-tuning">{next.tuning}</span> : null}<PresetBadges songId={next.id}/>
    </button> })()}
    {liveOpen && <LiveOverlay onClose={() => setLiveOpen(false)} onJump={(songId) => { const at = setSongs.findIndex((item) => item.id === songId); if (at >= 0) goTo(at) }} />}
    {picker && <SongPicker list={setSongs} currentId={song.id} onPick={(_, i) => goTo(i)} onClose={() => setPicker(false)}/>}
    </div>
}

function PageTitle({ eyebrow, title, copy, compact = false }: { eyebrow?: string, title: string, copy?: string, compact?: boolean }) { return <header className={`page-title ${compact ? 'compact' : ''}`}>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1>{copy && <p>{copy}</p>}</header> }
