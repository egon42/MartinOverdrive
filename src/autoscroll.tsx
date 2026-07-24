import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { usePractice } from './storage'
import scrollSpeedData from './data/scrollSpeeds.json'

// Autoscroll speed, px/second at 1× sheet zoom. Resolution order (same pattern as
// metronome bpm): PracticeEntry.scrollSpeed (synced override) → scrollSpeeds.json seed
// (polish-committed per song) → DEFAULT_SCROLL_SPEED. Crawl advances at speed * zoom so a
// dialed-in song length survives pinch-zoom (content height scales with --zoom; see
// docs/autoscroll-spec.md).
export const DEFAULT_SCROLL_SPEED = 24, MIN_SCROLL_SPEED = 6, MAX_SCROLL_SPEED = 120, SCROLL_SPEED_STEP = 4
// Lead-in before the crawl starts when ▶ is pressed at the top of the sheet — gives the
// first lines a beat to read before they scroll away. Duration = LEAD_IN_PX / speed
// (e.g. 96 px at 24 px/s → 4 s; faster speeds wait less). Mid-sheet presses skip it.
// Zoom cancels out of the duration (lead-in covers LEAD_IN_PX * zoom content px at
// speed * zoom), so the wait stays constant across pinch levels.
const SCROLL_LEAD_IN_PX = 96

type ScrollSpeedSeed = {
  speed: number
  leadInSec?: number
  /** Optional crawl when Ryan measure map is on; falls back to `speed`. */
  measureSpeed?: number
  /** Optional top lead-in for measure map; falls back to `leadInSec` then formula. */
  measureLeadInSec?: number
  note?: string
}
const scrollSpeedSeeds = scrollSpeedData as Record<string, ScrollSpeedSeed>

export type RyanScrollLayout = 'lyric' | 'measure'

/** Polished per-song default from src/data/scrollSpeeds.json, or undefined if unset. */
export function scrollSpeedSeed(songId: string, layout: RyanScrollLayout = 'lyric'): number | undefined {
  const entry = scrollSpeedSeeds[songId]
  if (!entry) return undefined
  if (layout === 'measure') {
    const measure = entry.measureSpeed
    if (typeof measure === 'number' && measure > 0) return measure
  }
  const speed = entry.speed
  return typeof speed === 'number' && speed > 0 ? speed : undefined
}

/** Effective 1×-normalized crawl speed: practice override → song seed → global default. */
export function scrollSpeedFor(songId: string, practiceSpeed: number, layout: RyanScrollLayout = 'lyric'): number {
  return practiceSpeed || scrollSpeedSeed(songId, layout) || DEFAULT_SCROLL_SPEED
}

/** Top-of-sheet lead-in seconds: optional per-song seed, else SCROLL_LEAD_IN_PX / speed. */
export function scrollLeadInSec(songId: string, speed: number, layout: RyanScrollLayout = 'lyric'): number {
  const entry = scrollSpeedSeeds[songId]
  if (layout === 'measure') {
    const measureLead = entry?.measureLeadInSec
    if (typeof measureLead === 'number' && Number.isFinite(measureLead) && measureLead >= 0) return measureLead
  }
  const seeded = entry?.leadInSec
  if (typeof seeded === 'number' && Number.isFinite(seeded) && seeded >= 0) return seeded
  return SCROLL_LEAD_IN_PX / Math.max(speed, 1)
}

function autoscrollInner(el: HTMLElement): HTMLElement | null {
  return el.querySelector(':scope > .autoscroll-inner')
}

function clearFrac(inner: HTMLElement | null) {
  if (inner) inner.style.transform = ''
}

// Must match CSS on .show-mode chrome: snappy collapse/pause expand vs slow natural-end settle.
const CHROME_COLLAPSE_MS = 180
const CHROME_EXPAND_MS = 10800

function pinScrollToBottom(el: HTMLElement) {
  clearFrac(autoscrollInner(el))
  // Instant pin — chrome expand is the visual; ResizeObserver fires many times during it,
  // and stacking smooth scrolls would fight each other.
  el.scrollTop = Math.max(0, el.scrollHeight - el.clientHeight)
}

function applyFrac(inner: HTMLElement | null, pos: number) {
  if (!inner) return
  const frac = pos - Math.floor(pos)
  // Sub-pixel remainder: scrollTop only accepts whole px; this keeps motion continuous
  // between those writes. translate3d promotes a layer so the crawl isn't painted steppy.
  inner.style.transform = frac > 0 ? `translate3d(0, ${-frac}px, 0)` : ''
}

// Teleprompter autoscroll: while `playing`, creep `ref`'s scroll container down at
// `speed * zoom` px/second. Full spec + the history of why it's written exactly this way:
// docs/autoscroll-spec.md — read that before touching this hook.
//
// Core rule: NEVER route the crawl's math through the live scrollTop. Engines quantize
// scroll positions (writes snap to whole CSS or device pixels; some engines round reads
// too), so a read-modify-write of scrollTop re-quantizes every frame — sub-pixel deltas
// round away entirely (slow speeds stall) and everything faster pins near 1px/frame
// (all high speeds look identical): the "one speed above ~30px/s, nothing below" bug.
// Instead the hook owns a float `pos`, advances it by speed*zoom*dt per rAF tick
// (frame-rate independent on 60Hz and 120Hz alike), and only ever WRITES Math.floor(pos);
// the fraction stays in `pos` (and on `.autoscroll-inner` via translateY) so quantization
// can't feed back into the math or the paint.
//
// Manual scrolling coexists by adoption, not fighting: any frame where scrollTop isn't
// where our last write left it (native swipe, momentum fling, mouse wheel), we adopt
// that position into `pos`, clear the frac transform, and skip the write — iOS kills a
// fling the moment a script writes scrollTop, so yielding until the sheet settles keeps
// swipes native, and the crawl resumes from wherever the finger/fling left it. A finger
// resting on the sheet (`pointerdown` on the element) pauses accumulation until
// `pointerup`/`pointercancel` **on window** — a drag that drifts off the element must
// still un-pause (the lesson from 43f64da). Stops and calls onReachEnd at the bottom.
// No-op when ref is null (the card views auto-fit one screen).
export function useAutoScroll(
  ref: RefObject<HTMLDivElement | null> | null,
  speed: number,
  playing: boolean,
  onReachEnd: () => void,
  zoom = 1,
) {
  const onReachEndRef = useRef(onReachEnd)
  onReachEndRef.current = onReachEnd
  // Speed and zoom are read live through refs, NOT effect deps: a speed/zoom change
  // (a +/- tap, a pinch, or a sync pull patching scrollSpeed mid-song) must adjust the
  // crawl in place, not tear the effect down — a restart resets `holding` to false while
  // a finger may still be resting on the sheet, letting the crawl creep under it (council
  // finding, 2026-07-11). Don't "fix" that with a holding ref that persists across ALL
  // restarts: a finger lifting while playing=false (listeners detached) would strand
  // holding=true and make the next ▶ appear dead. Scoping the fix to speed/zoom is deliberate.
  const speedRef = useRef(speed)
  speedRef.current = speed
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom
  useEffect(() => {
    const el = ref?.current
    if (!el || !playing) return
    let raf = 0
    let last = 0 // rAF clock; 0 = no previous tick yet
    let pos = Math.max(0, el.scrollTop) // float position this hook owns — the DOM only ever sees Math.floor(pos)
    let written = Math.floor(pos) // last whole px we wrote/adopted; how we recognize our own motion next frame
    let holding = false
    const inner = () => autoscrollInner(el)
    clearFrac(inner())
    const step = (now: number) => {
      raf = requestAnimationFrame(step)
      const dt = last ? Math.min((now - last) / 1000, 0.1) : 0 // clamp so a backgrounded tab doesn't jump on resume
      last = now
      if (holding || dt <= 0 || speedRef.current <= 0) return
      const actual = el.scrollTop
      if (Math.abs(actual - written) > 1) { // >1 tolerates engines snapping our write to device pixels
        pos = Math.max(0, actual) // the sheet moved without us — adopt the new position, yield this frame
        written = Math.floor(pos)
        clearFrac(inner())
        return
      }
      const max = el.scrollHeight - el.clientHeight
      const z = Math.max(zoomRef.current, 0.01)
      pos = Math.min(pos + speedRef.current * z * dt, max)
      const target = Math.floor(pos)
      if (target > written) { el.scrollTop = target; written = target }
      applyFrac(inner(), pos)
      if (pos >= max - 1) {
        clearFrac(inner())
        cancelAnimationFrame(raf)
        onReachEndRef.current()
      }
    }
    const onDown = () => {
      holding = true
      // Snap the frac transform away so a finger drag starts from a pixel-aligned sheet.
      pos = Math.max(0, el.scrollTop)
      written = Math.floor(pos)
      clearFrac(inner())
    }
    const onUp = () => { holding = false } // the clock keeps ticking through a hold, so resuming carries no dt jump
    el.addEventListener('pointerdown', onDown)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    raf = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(raf)
      clearFrac(inner())
      el.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [ref, playing])
}

// The state machine around the crawl, shared by show mode and the practice page's sheet
// panel: play/pause with the top-of-sheet lead-in countdown, "does this sheet even
// scroll" measurement (the ▶ control must only render when it does — the hook counts on
// that guard, see the spec), and speed persistence in the synced practice store so both
// surfaces read and write the same per-song speed.
export interface AutoScrollControls {
  playing: boolean
  delayLeft: number
  scrollable: boolean
  speed: number
  /** True when PracticeEntry.scrollSpeed is set (overrides the polished song seed). */
  overridden: boolean
  /** True after a natural crawl end — show mode uses the slow chrome-settle expand. */
  chromeSettle: boolean
  togglePlay: () => void
  bumpSpeed: (delta: number) => void
  /** Clear the practice override so the song seed / global default applies again. */
  clearSpeedOverride: () => void
}

export function useAutoScrollControls(
  target: RefObject<HTMLDivElement | null> | null,
  songId: string,
  resetKey: readonly unknown[],
  zoom = 1,
  /** Ryan measure map uses optional measureSpeed / measureLeadInSec seeds. */
  layout: RyanScrollLayout = 'lyric',
): AutoScrollControls {
  const { get, patch } = usePractice()
  const practiceSpeed = get(songId).scrollSpeed
  const speed = scrollSpeedFor(songId, practiceSpeed, layout)
  const overridden = practiceSpeed > 0
  const [playing, setPlaying] = useState(false)
  // Lead-in when ▶ is pressed at the top: `delayUntil` is a performance.now() deadline
  // (0 = none); `delayLeft` is the displayed seconds remaining.
  const [delayUntil, setDelayUntil] = useState(0)
  const [delayLeft, setDelayLeft] = useState(0)
  const [scrollable, setScrollable] = useState(false)
  // Slow chrome expand only after a natural crawl end (not pause). Show mode reads this.
  const [chromeSettle, setChromeSettle] = useState(false)
  // When the crawl hits the collapsed-chrome bottom and playing clears, chrome re-expands
  // and the scrollport shrinks — leaving sheet content below the fold. Keep pinned to the
  // true bottom across that layout until the user plays again or changes song/view.
  const stickBottomRef = useRef(false)
  const pinBottom = useCallback(() => {
    const el = target?.current
    if (el) pinScrollToBottom(el)
  }, [target])
  // Hook only crawls after any top-of-sheet lead-in finishes. Zoom scales the crawl so a
  // dialed song length survives pinch-zoom (show mode); practice passes the default 1.
  useAutoScroll(target, speed, playing && delayUntil === 0, () => {
    stickBottomRef.current = true
    setChromeSettle(true)
    setPlaying(false)
  }, zoom)
  // After natural end (or pause-at-bottom): re-pin through the chrome-expand transition.
  useLayoutEffect(() => {
    if (playing) {
      stickBottomRef.current = false
      return
    }
    if (!stickBottomRef.current) return
    pinBottom()
    const el = target?.current
    let ro: ResizeObserver | undefined
    if (el && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => { if (stickBottomRef.current) pinBottom() })
      ro.observe(el)
    }
    // One extra pin after chrome expand settles (slow only on natural end).
    const settleMs = chromeSettle ? CHROME_EXPAND_MS : CHROME_COLLAPSE_MS
    const t = window.setTimeout(pinBottom, settleMs + 80)
    return () => { ro?.disconnect(); window.clearTimeout(t) }
  }, [playing, chromeSettle, target, pinBottom])
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
  // New song or view (`resetKey`): start paused at the top, and re-measure whether the
  // sheet overflows. Window resize and element ResizeObserver (chrome collapse while
  // crawling grows the scrollport) only re-measure — they must not yank scroll to the top.
  useLayoutEffect(() => {
    setPlaying(false)
    setDelayUntil(0)
    setDelayLeft(0)
    setChromeSettle(false)
    stickBottomRef.current = false
    const el = target?.current
    if (el) {
      el.scrollTop = 0
      clearFrac(autoscrollInner(el))
    }
    const measure = () => setScrollable(!!el && el.scrollHeight > el.clientHeight + 1)
    measure()
    window.addEventListener('resize', measure)
    let ro: ResizeObserver | undefined
    if (el && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(measure)
      ro.observe(el)
    }
    return () => {
      window.removeEventListener('resize', measure)
      ro?.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, resetKey as unknown[])
  // Pinch-zoom reflows the sheet (font-size --zoom) without a song/view change — re-measure
  // overflow so the ▶ bar appears/disappears correctly, but do not reset scroll or pause.
  // (ResizeObserver above also catches zoom reflow; this keeps the zoom dep explicit.)
  useLayoutEffect(() => {
    const el = target?.current
    setScrollable(!!el && el.scrollHeight > el.clientHeight + 1)
  }, [target, zoom])
  const bumpSpeed = (delta: number) => patch(songId, { scrollSpeed: Math.max(MIN_SCROLL_SPEED, Math.min(MAX_SCROLL_SPEED, speed + delta)) })
  const clearSpeedOverride = () => patch(songId, { scrollSpeed: 0 })
  // Toggle play; if we're starting from the very bottom (a finished crawl), rewind to the top
  // first. At the top, arm a speed-based lead-in so the first lines aren't scrolled away
  // before you can read them; mid-sheet presses crawl immediately.
  //
  // Ref indirection so the returned function is called-fresh even from long-lived
  // closures: show mode's global Space shortcut binds in an effect that deliberately
  // doesn't re-run on playing/speed changes, and a stale `playing` here would re-arm
  // the lead-in instead of pausing.
  const togglePlayRef = useRef(() => {})
  togglePlayRef.current = () => {
    if (playing) {
      const el = target?.current
      // Pausing while flush with the collapsed bottom — still pin, but expand is snappy
      // (chromeSettle stays false). Slow settle is reserved for natural crawl end.
      if (el && el.scrollTop + el.clientHeight >= el.scrollHeight - 2) stickBottomRef.current = true
      setChromeSettle(false)
      setPlaying(false)
      setDelayUntil(0)
      setDelayLeft(0)
      return
    }
    stickBottomRef.current = false
    setChromeSettle(false)
    const el = target?.current
    if (el && el.scrollTop + el.clientHeight >= el.scrollHeight - 1) {
      el.scrollTop = 0
      clearFrac(autoscrollInner(el))
    }
    const atTop = !el || el.scrollTop <= 1
    if (atTop) {
      const secs = scrollLeadInSec(songId, speed, layout)
      setDelayUntil(performance.now() + secs * 1000)
      setDelayLeft(secs)
    } else {
      setDelayUntil(0)
      setDelayLeft(0)
    }
    setPlaying(true)
  }
  const togglePlay = useCallback(() => togglePlayRef.current(), [])
  return { playing, delayLeft, scrollable, speed, overridden, chromeSettle, togglePlay, bumpSpeed, clearSpeedOverride }
}

/** The ▶ / countdown / −speed+ control strip. Callers must only render it when
 *  `scroll.scrollable` (and the target sheet is on screen) — see useAutoScrollControls. */
export function AutoScrollBar({ scroll }: { scroll: AutoScrollControls }) {
  const { playing, delayLeft, speed, overridden, togglePlay, bumpSpeed, clearSpeedOverride } = scroll
  return <div className="show-autoscroll">
    <button type="button" className="autoscroll-play" aria-pressed={playing} aria-label="Autoscroll" onClick={togglePlay}>{playing ? '⏸' : '▶'}</button>
    {playing && delayLeft > 0 && <span className="autoscroll-delay" aria-live="polite" aria-label={`Starting in ${delayLeft.toFixed(1)} seconds`}>{delayLeft.toFixed(1)}<i>s</i></span>}
    <button type="button" className="autoscroll-step" aria-label="Slower" disabled={speed <= MIN_SCROLL_SPEED} onClick={() => bumpSpeed(-SCROLL_SPEED_STEP)}>−</button>
    {overridden
      ? <button type="button" className="autoscroll-speed overridden" aria-label={`Scroll speed ${speed} pixels per second at one times zoom. Tap to restore song default`} title="Tap to restore song default" onClick={clearSpeedOverride}>{speed}<i>px/s</i></button>
      : <span className="autoscroll-speed" aria-label={`Scroll speed ${speed} pixels per second at one times zoom`}>{speed}<i>px/s</i></span>}
    <button type="button" className="autoscroll-step" aria-label="Faster" disabled={speed >= MAX_SCROLL_SPEED} onClick={() => bumpSpeed(SCROLL_SPEED_STEP)}>+</button>
  </div>
}
