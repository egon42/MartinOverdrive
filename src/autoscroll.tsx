import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { usePractice } from './storage'

// Autoscroll speed, px/second (per-song, stored as PracticeEntry.scrollSpeed — one
// synced value shared by show mode and the practice page's sheet panel).
export const DEFAULT_SCROLL_SPEED = 24, MIN_SCROLL_SPEED = 6, MAX_SCROLL_SPEED = 120, SCROLL_SPEED_STEP = 4
// Lead-in before the crawl starts when ▶ is pressed at the top of the sheet — gives the
// first lines a beat to read before they scroll away. Duration = LEAD_IN_PX / speed
// (e.g. 96 px at 24 px/s → 4 s; faster speeds wait less). Mid-sheet presses skip it.
const SCROLL_LEAD_IN_PX = 96

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
export function useAutoScroll(ref: RefObject<HTMLDivElement | null> | null, speed: number, playing: boolean, onReachEnd: () => void) {
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
  togglePlay: () => void
  bumpSpeed: (delta: number) => void
}

export function useAutoScrollControls(target: RefObject<HTMLDivElement | null> | null, songId: string, resetKey: readonly unknown[]): AutoScrollControls {
  const { get, patch } = usePractice()
  const speed = get(songId).scrollSpeed || DEFAULT_SCROLL_SPEED
  const [playing, setPlaying] = useState(false)
  // Lead-in when ▶ is pressed at the top: `delayUntil` is a performance.now() deadline
  // (0 = none); `delayLeft` is the displayed seconds remaining.
  const [delayUntil, setDelayUntil] = useState(0)
  const [delayLeft, setDelayLeft] = useState(0)
  const [scrollable, setScrollable] = useState(false)
  // Hook only crawls after any top-of-sheet lead-in finishes.
  useAutoScroll(target, speed, playing && delayUntil === 0, () => setPlaying(false))
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
  // sheet overflows. Resize (e.g. phone rotation) only re-measures — it must not yank
  // scroll back to the top.
  useLayoutEffect(() => {
    setPlaying(false)
    setDelayUntil(0)
    setDelayLeft(0)
    const el = target?.current
    if (el) el.scrollTop = 0
    const measure = () => setScrollable(!!el && el.scrollHeight > el.clientHeight + 1)
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, resetKey as unknown[])
  const bumpSpeed = (delta: number) => patch(songId, { scrollSpeed: Math.max(MIN_SCROLL_SPEED, Math.min(MAX_SCROLL_SPEED, speed + delta)) })
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
    if (playing) { setPlaying(false); setDelayUntil(0); setDelayLeft(0); return }
    const el = target?.current
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
  const togglePlay = useCallback(() => togglePlayRef.current(), [])
  return { playing, delayLeft, scrollable, speed, togglePlay, bumpSpeed }
}

/** The ▶ / countdown / −speed+ control strip. Callers must only render it when
 *  `scroll.scrollable` (and the target sheet is on screen) — see useAutoScrollControls. */
export function AutoScrollBar({ scroll }: { scroll: AutoScrollControls }) {
  const { playing, delayLeft, speed, togglePlay, bumpSpeed } = scroll
  return <div className="show-autoscroll">
    <button type="button" className="autoscroll-play" aria-pressed={playing} aria-label="Autoscroll" onClick={togglePlay}>{playing ? '⏸' : '▶'}</button>
    {playing && delayLeft > 0 && <span className="autoscroll-delay" aria-live="polite" aria-label={`Starting in ${delayLeft.toFixed(1)} seconds`}>{delayLeft.toFixed(1)}<i>s</i></span>}
    <button type="button" className="autoscroll-step" aria-label="Slower" disabled={speed <= MIN_SCROLL_SPEED} onClick={() => bumpSpeed(-SCROLL_SPEED_STEP)}>−</button>
    <span className="autoscroll-speed" aria-label={`Scroll speed ${speed} pixels per second`}>{speed}<i>px/s</i></span>
    <button type="button" className="autoscroll-step" aria-label="Faster" disabled={speed >= MAX_SCROLL_SPEED} onClick={() => bumpSpeed(SCROLL_SPEED_STEP)}>+</button>
  </div>
}
