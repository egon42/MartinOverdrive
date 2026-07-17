import { Component, useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode, type RefObject } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { songs } from './data'
import { AmpPresetField, ChordChip, ChordSheetView, Difficulty, Field, FretboardPanel, HomeFretBadges, PracticeControls, PracticeLauncher, PresetBadges, SheetPanel, SongCard, SongLinks, TabText, unknown, type SheetKind } from './components'
import { usePractice } from './storage'
import { chordProgression } from './chords'
import { basicRowsFor, cheatRowsFor, progressionFor, progressionVersionsFor, type CheatChordSpan } from './progressions'
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
// Show-mode autoscroll speed, px/second (per-song, stored as PracticeEntry.scrollSpeed).
const DEFAULT_SCROLL_SPEED = 24, MIN_SCROLL_SPEED = 6, MAX_SCROLL_SPEED = 120, SCROLL_SPEED_STEP = 4
// Lead-in before the crawl starts when ▶ is pressed at the top of the sheet — gives the
// first lines a beat to read before they scroll away. Duration = LEAD_IN_PX / speed
// (e.g. 96 px at 24 px/s → 4 s; faster speeds wait less). Mid-sheet presses skip it.
const SCROLL_LEAD_IN_PX = 96
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

// Cheat-card version picker (dev deploys + local dev server only): songId -> archived
// version label, '' / absent = the live "Current" entry. Per-device review preference,
// like pins — NOT synced practice data. Prod never renders the picker, so prod always
// plays the current card even if this key somehow exists there.
const CHEAT_VERSIONS_UI = import.meta.env.DEV || import.meta.env.BASE_URL.includes('/dev/')
const CHEAT_VERSION_KEY = `overdrive-cheat-version${SHOW_KEY_SUFFIX}`
const readCheatVersionChoices = (): Record<string, string> => {
  try { const p = JSON.parse(localStorage.getItem(CHEAT_VERSION_KEY) || '{}'); return p && typeof p === 'object' ? p : {} } catch { return {} }
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

export function SongDetail() {
  const { id } = useParams(); const song = songs.find((item) => item.id === id)
  const [sheetView, setSheetView] = useState<SheetKind | null>(null)
  if (!song) return <PageTitle eyebrow="Not found" title="That song isn’t in this set" copy="Return to the full song list and try another." />
  const transpose = transposeFor(song.id)
  return <div className="song-detail"><div className="song-detail-top"><Link className="back" to="/practice">← Back to practice</Link><div><span className="eyebrow">Song {song.order} of {songs.length}</span><Difficulty value={song.difficulty}/></div></div><section className="song-title"><div><h1>{song.title}</h1><p>{song.artist}</p></div><Link className="button secondary song-show-link" to={`/show/${song.id}`}>Stage view ↗</Link></section><PracticeLauncher song={song}/><SongLinks song={song} showBackingTrack={false}/><section className="detail-grid"><div className="panel"><h2>Song info</h2><dl><AmpPresetField songId={song.id}/><Field label="Band tuning" value={song.tuning}/>{transpose && <Field label="Transpose recording" value={transposeHint(transpose)}/>}{song.recordingNote && <Field label="Tab / recording note" value={song.recordingNote}/>}<Field label="Role" value={song.role}/><Field label="Practice style" value={song.practiceStyle}/><Field label="Link quality" value={song.linkQuality}/></dl></div><div className="panel"><h2>Fretboard</h2><FretboardPanel song={song}/><dl><Field label="Scale hint" value={song.scaleHint}/></dl></div><div className="panel wide"><h2>Performance plan</h2><dl><Field label="Must-know part" value={song.mustKnow}/><Field label="Fallback part" value={song.fallback}/>{song.rehearsalNotes && <Field label="Ask the band" value={song.rehearsalNotes}/>}</dl></div></section><SheetPanel song={song} view={sheetView} onViewChange={setSheetView}/><PracticeControls song={song}/></div>
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
// bottom. No-op when ref is null (the card views auto-fit one screen).
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

/** Highlight ×N / xN in section labels (e.g. "Verse ×4") so the count reads white. */
function renderProgLabel(label: string) {
  const parts = label.split(/([×xX]\s*\d+)/u)
  return parts.map((part, i) =>
    /^[×xX]\s*\d+$/u.test(part)
      ? <span className="cheat-prog-label-times" key={i}>{part}</span>
      : part)
}

// The two progression cards in show mode, one component: `variant` 'chords' is the full
// roadmap card (form order + repeats — the original "cheat card", now the Chords tab);
// 'cheat' is the building-blocks card (each section once, plus fills — trusts the player
// to know the song's shape). Both put everything on one screen: tuning strip, chord
// rows, and the collapsed fretboard + role / must-know / fallback. `innerRef` is the
// height auto-fit ref from Show(), so a dense song shrinks to fit instead of scrolling.
function CheatCard({ song, innerRef, variant }: { song: Song, innerRef: RefObject<HTMLDivElement | null>, variant: 'cheat' | 'chords' }) {
  const sheets = sheetsFor(song.id)
  const ownNotes = usePractice().get(song.id).notes.trim() // the player's own stage reminders
  // Dev-only version picker (roadmap card only): choose an archived cheat-card version to
  // render instead of the live entry, so old and new forms can be A/B'd against the
  // recording. The Cheat card always shows the CURRENT sections — the refined data is
  // the source of truth, not the pre-research basic forms.
  const versions = variant === 'chords' && CHEAT_VERSIONS_UI ? progressionVersionsFor(song.id) : []
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
  const refitCheat = () => {
    const el = innerRef.current
    if (!el) return
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
    {/* The compact Cheat card has room to spare, so More starts open there; the dense
        roadmap card keeps it collapsed. `open` only seeds the initial state — React
        never rewrites it, so tapping the summary still toggles freely. */}
    <details className="cheat-more" open={variant === 'cheat'}>
      <summary>More</summary>
      <div className="show-content">
        <div className="show-scale"><FretboardPanel song={song} /><dl><Field label="Scale hint" value={song.scaleHint} /></dl></div>
        <div className="show-fields">
          <Field label="Role" value={song.role} />
          <Field label="Must know" value={song.mustKnow} />
          <Field label="Fallback" value={song.fallback} />
          {ownNotes && <Field label="My notes" value={ownNotes} />}
        </div>
      </div>
    </details>
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

/** Shared stage chrome strip: tuning / transpose / capo / amp presets / home frets. */
function ShowStageStrip({ song }: { song: Song }) {
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
    <HomeFretBadges song={song} />
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
  const { get, patch } = usePractice()
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
  const { settings, isFingeringOnly, toggleFingeringOnly } = useSettings()
  // Fingering surfaces predate the tab rename: 'cheat' governs chips on BOTH progression
  // cards (Cheat and Chords tabs share one toggle per song); 'chords' governs the Lyrics sheet.
  const cardShapes = isFingeringOnly(song.id, 'cheat')
  const lyricsShapes = isFingeringOnly(song.id, 'chords')
  const [pins, setPins] = useState<Record<string, string>>(readPins)
  useEffect(() => { localStorage.setItem(SHOW_PINS_KEY, JSON.stringify(pins)) }, [pins])
  // Open each song on its pinned default view when present; otherwise fall back to the
  // last view used (carried over across songs) or the roadmap card.
  const [view, setView] = useState(() => pins[song.id] || readShowView() || 'chords')
  useEffect(() => { localStorage.setItem(SHOW_VIEW_KEY, view) }, [view])
  // Sheets need their file to exist; unknown/legacy ids land on the roadmap card.
  const effective = view === 'lyrics' && sheets.chords ? 'lyrics' : view === 'tabs' && sheets.tabs ? 'tabs' : view === 'cheat' ? 'cheat' : 'chords'
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
  const views = ['cheat', 'chords', ...(sheets.chords ? ['lyrics'] : []), ...(sheets.tabs ? ['tabs'] : [])]
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
  const tabsRef = useFitScale([song.id, sheets.tabs, effective], 'width', 0.45)
  const cheatRef = useFitScale([song.id, sheets.chords, sheets.tabs, effective, get(song.id).notes, cardShapes], 'height', 0.7)
  const lyricsRef = useRef<HTMLDivElement>(null)
  // Autoscroll: only the lyrics/tabs sheets scroll (the progression cards auto-fit one screen).
  const speed = get(song.id).scrollSpeed || DEFAULT_SCROLL_SPEED
  const [playing, setPlaying] = useState(false)
  // Lead-in when ▶ is pressed at the top: `delayUntil` is a performance.now() deadline
  // (0 = none); `delayLeft` is the displayed seconds remaining.
  const [delayUntil, setDelayUntil] = useState(0)
  const [delayLeft, setDelayLeft] = useState(0)
  const [scrollable, setScrollable] = useState(false)
  const [picker, setPicker] = useState(false) // jump-to-song overlay (audible calls)
  const pickerCenteredRef = useRef(false) // center the current song once per open, not on every re-render
  const scrollTarget = effective === 'tabs' ? tabsRef : effective === 'lyrics' ? lyricsRef : null
  // Hook only crawls after any top-of-sheet lead-in finishes.
  useAutoScroll(scrollTarget, speed, playing && delayUntil === 0, () => setPlaying(false))
  // Tick the lead-in countdown while a deadline is armed.
  useEffect(() => {
    if (!playing || delayUntil === 0) return
    let raf = 0
    const tick = (now: number) => {
      const left = Math.max(0, (delayUntil - now) / 1000)
      setDelayLeft(left)
      if (left > 0) raf = requestAnimationFrame(tick)
      else setDelayUntil(0)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, delayUntil])
  // New song or view: start paused at the top, and re-measure whether the sheet overflows.
  // Resize (e.g. phone rotation) only re-measures — it must not yank scroll back to the top.
  useLayoutEffect(() => {
    setPlaying(false)
    setDelayUntil(0)
    setDelayLeft(0)
    const el = scrollTarget?.current
    if (el) el.scrollTop = 0
    const measure = () => setScrollable(!!el && el.scrollHeight > el.clientHeight + 1)
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, effective, sheets.chords, sheets.tabs])
  const bumpSpeed = (delta: number) => patch(song.id, { scrollSpeed: Math.max(MIN_SCROLL_SPEED, Math.min(MAX_SCROLL_SPEED, speed + delta)) })
  // Toggle play; if we're starting from the very bottom (a finished crawl), rewind to the top
  // first. At the top, arm a speed-based lead-in so the first lines aren't scrolled away
  // before you can read them; mid-sheet presses crawl immediately.
  const togglePlay = () => {
    if (playing) { setPlaying(false); setDelayUntil(0); setDelayLeft(0); return }
    const el = scrollTarget?.current
    if (el && el.scrollTop + el.clientHeight >= el.scrollHeight - 1) el.scrollTop = 0
    const atTop = !el || el.scrollTop <= 1
    if (atTop) {
      const secs = SCROLL_LEAD_IN_PX / Math.max(speed, 1)
      setDelayUntil(performance.now() + secs * 1000)
      setDelayLeft(secs)
    } else {
      setDelayUntil(0)
      setDelayLeft(0)
    }
    setPlaying(true)
  }
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
      if (e.key === ' ' && scrollable && !(e.target as HTMLElement)?.closest('button,a,input,textarea,select')) { e.preventDefault(); togglePlay() }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effective, sheets.chords, sheets.tabs, scrollable, setSongs, picker, liveOpen, index, urlSongId])
  // Swipe navigation, card views only (they never scroll horizontally, so a horizontal
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
    goTo(dx < 0 ? index + 1 : index - 1)
  }
  const swipeProps = cardView ? { onPointerDown: onSwipeDown, onPointerUp: onSwipeUp, onPointerCancel: () => { swipeStart.current = null } } : {}
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
      <button type="button" className="show-nav-btn" disabled={index === 0} onClick={() => goTo(index - 1)} aria-label="Previous song">‹</button>
      <button type="button" className="show-counter" onClick={() => { pickerCenteredRef.current = false; setPicker(true) }} aria-label="Jump to a song">{index + 1} / {setSongs.length}</button>
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
    <article className={`show-song${cardView ? ' cheat-view' : ' sheet-view'}`} {...swipeProps}><div className="show-song-head"><span className="eyebrow">{song.artist}</span><h1>{song.title}</h1></div>
    <div className="show-view-bar">
      <div className="fretboard-toggle show-view-toggle" role="tablist" aria-label="Show mode view">
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
    <ShowStageStrip song={song} />
    {!cardView && scrollable && <div className="show-autoscroll">
      <button type="button" className="autoscroll-play" aria-pressed={playing} aria-label="Autoscroll" onClick={togglePlay}>{playing ? '⏸' : '▶'}</button>
      {playing && delayLeft > 0 && <span className="autoscroll-delay" aria-live="polite" aria-label={`Starting in ${delayLeft.toFixed(1)} seconds`}>{delayLeft.toFixed(1)}<i>s</i></span>}
      <button type="button" className="autoscroll-step" aria-label="Slower" disabled={speed <= MIN_SCROLL_SPEED} onClick={() => bumpSpeed(-SCROLL_SPEED_STEP)}>−</button>
      <span className="autoscroll-speed" aria-label={`Scroll speed ${speed} pixels per second`}>{speed}<i>px/s</i></span>
      <button type="button" className="autoscroll-step" aria-label="Faster" disabled={speed >= MAX_SCROLL_SPEED} onClick={() => bumpSpeed(SCROLL_SPEED_STEP)}>+</button>
    </div>}
    {effective === 'lyrics'
      ? <div className="show-sheet" ref={lyricsRef}><ChordSheetView text={sheets.chords!} songId={song.id}/></div>
      : effective === 'tabs'
        ? <div className="show-sheet show-tabs" ref={tabsRef}><TabText text={sheets.tabs!}/></div>
        : <CheatCard song={song} innerRef={cheatRef} variant={effective === 'cheat' ? 'cheat' : 'chords'}/>}</article>
    </ShowSongBoundary>
    {index < setSongs.length - 1 && (() => { const next = setSongs[index + 1]; return <button type="button" className="show-upnext" onClick={() => goTo(index + 1)} aria-label={`Next song: ${next.title}`}>
      <span className="show-upnext-label">Up next</span><b>{next.title}</b> {next.artist}{next.tuning !== 'Standard' ? <span className="cheat-chip cheat-tuning">{next.tuning}</span> : null}<PresetBadges songId={next.id}/>
    </button> })()}
    {liveOpen && <LiveOverlay onClose={() => setLiveOpen(false)} onJump={(songId) => { const at = setSongs.findIndex((item) => item.id === songId); if (at >= 0) goTo(at) }} />}
    {picker && <div className="show-picker" onClick={() => setPicker(false)}>
      <div className="show-picker-list" role="dialog" aria-label="Jump to song" onClick={(e) => e.stopPropagation()}>
        {setSongs.map((item, i) => <button type="button" key={item.id} className={i === index ? 'current' : ''}
          ref={i === index ? (el) => { if (el && !pickerCenteredRef.current) { pickerCenteredRef.current = true; el.scrollIntoView({ block: 'center' }) } } : undefined}
          onClick={() => { goTo(i); setPicker(false) }}>
          <span className="show-picker-num">{String(i + 1).padStart(2, '0')}</span>
          <span className="show-picker-title">{item.title}</span>
          {item.tuning !== 'Standard' && <i className="show-picker-tuning">{item.tuning}</i>}
        </button>)}
      </div>
    </div>}
    </div>
}

function PageTitle({ eyebrow, title, copy, compact = false }: { eyebrow?: string, title: string, copy?: string, compact?: boolean }) { return <header className={`page-title ${compact ? 'compact' : ''}`}>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1>{copy && <p>{copy}</p>}</header> }
