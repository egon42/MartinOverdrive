# Show-mode autoscroll — spec, failure history, and phone test script

Owner code: `useAutoScroll` in `src/pages.tsx`. Speed persistence:
`PracticeEntry.scrollSpeed` (per-song, rides the sync merge), bounds in
`DEFAULT_SCROLL_SPEED / MIN / MAX / STEP` (24 / 6 / 120 / 4 px/s).

This feature failed on-device repeatedly. This document exists so the next change
starts from the proven root cause instead of re-deriving it.

## The root cause, with numbers

`scrollTop` is a **quantized** property. Browsers snap scroll positions to whole CSS
pixels or whole device pixels on write, and several engines round on read as well
(WebKit historically returns integers; Blink returns device-pixel-snapped fractions).
Any implementation that routes its per-frame math **through** `scrollTop` gets
re-quantized every frame.

The original implementation (`f7a7414`) did exactly that:

```js
el.scrollTop += speed * dt   // dt ≈ 1/60 s per rAF frame
```

On a 60 Hz phone whose engine rounds scroll writes to the nearest whole pixel:

| set speed | delta/frame = speed/60 | rounds to | actual motion |
|-----------|------------------------|-----------|---------------|
| 10 px/s   | 0.167 px               | 0         | **frozen**    |
| 24 px/s (default) | 0.4 px         | 0         | **frozen**    |
| 30 px/s   | 0.5 px                 | 1 px      | **60 px/s**   |
| 60 px/s   | 1.0 px                 | 1 px      | **60 px/s**   |
| 88 px/s   | 1.467 px               | 1 px      | **60 px/s**   |
| 120 px/s  | 2.0 px                 | 2 px      | 120 px/s      |

The write `scrollTop = 0 + 0.4` stores `0`, so the next frame reads `0` again — the
fraction is destroyed, not carried. Everything from 30–88 px/s renders as exactly one
speed (1 px/frame = 60 px/s), and everything below 30 never moves. That is verbatim
the reported symptom: *"If I set px/s to ~30 or more, it moves at one speed, no matter
how high the value. Below that, it doesn't scroll at all."* (The ~30 threshold also
tells us the reporting device was 60 Hz with round-half-up snapping; a truncating
engine puts the threshold at 60, a 120 Hz display doubles it.)

If the app allowed 300 px/s it would still look identical to 30 on engines that round
reads: 300/60 = 5 px/frame survives, but on the engines where the *getter* also
rounds/floors while the setter snaps to device pixels, the read-modify-write can chew
the delta back down — which is why the fix below refuses to route math through
`scrollTop` at all rather than special-casing one engine's rounding mode.

## Prior attempts and why each failed

1. **`f7a7414` (2026-07-09 15:40) — teleprompter autoscroll.** Raw
   `el.scrollTop += speed * dt`. The quantization bug above. Council-reviewed for
   lifecycle issues but never device-tested; the math bug shipped.
2. **`7db5686` (2026-07-09 16:41, same session) — sub-pixel accumulator.** Kept a float
   *delta* accumulator and pushed only whole pixels: `acc += speed*dt;
   whole = trunc(acc); acc -= whole; el.scrollTop += whole`. The accumulator math is
   correct and was verified by numeric simulation — **but only by simulation**, and it
   still *increments the live `scrollTop`* (read-modify-write). Two residual on-device
   hazards: (a) on engines where the getter is rounded/floored while the setter snaps
   to device pixels, `scrollTop += 1` re-reads a quantized value each frame and the
   error repeats instead of averaging out; (b) the loop keeps writing during native
   momentum flings, and iOS cancels a fling the moment a script writes `scrollTop`, so
   a mid-crawl swipe feels dead. No commit after it changed the math (`d12b4bc` was
   nav/swipe hardening), so this is what the user last tested.
3. **This pass — absolute float position.** See below.

Also relevant: this repo has a documented history of stale service-worker bundles
masking fixes (see CLAUDE.md, Deploy section). Any on-device retest of autoscroll must
hard-refresh first, or it may be exercising a pre-fix bundle.

## The definitive design (current code)

Invariants — all five must survive any future edit:

1. **The crawl's position lives in a float the hook owns (`pos`), never in
   `scrollTop`.** Each rAF tick: `pos += speed * dt` (`dt` from rAF timestamps, so
   60 Hz vs 120 Hz is irrelevant; clamped at 0.1 s so a backgrounded tab doesn't jump
   on resume).
2. **Only whole pixels are ever written**: `scrollTop = Math.floor(pos)`, and only when
   that floor advances past the last written value. The fractional remainder stays in
   `pos`. Quantization of the write can never feed back into the math because nothing
   is read back into the accumulator.
3. **Manual scroll coexists by adoption, not fighting.** Each tick compares the live
   `scrollTop` against the last value we wrote (`written`, tolerance ±1 px for
   device-pixel snapping). If they disagree, someone else moved the sheet (finger drag,
   momentum fling, mouse wheel): adopt that position into `pos`, skip the write, check
   again next frame. A fling therefore plays out natively (no writes to cancel it) and
   the crawl resumes from wherever the sheet settles. A finger resting on the sheet
   (`pointerdown` on the element) pauses accumulation until `pointerup`/`pointercancel`
   **on window** — a drag that drifts off the element must still un-pause (43f64da).
4. **Bottom stop**: when `pos` reaches `scrollHeight - clientHeight - 1`, cancel the
   loop and fire `onReachEnd` (Show un-latches ▶; pressing ▶ again at the bottom
   rewinds to the top first — that lives in `togglePlay`, not the hook).
5. **Speed changes adjust the crawl in place** — `speed` is read via a ref each tick
   and is deliberately NOT an effect dependency. Restarting the effect on a speed
   change resets the local `holding` flag while a finger may still be resting on the
   sheet (reachable: a sync pull patches `scrollSpeed` mid-touch), letting the crawl
   creep under a motionless finger (council finding, 2026-07-11). Do not "fix" that
   with a holding ref that persists across ALL restarts — a finger lifting while
   `playing=false` (listeners detached) would strand it true and make the next ▶
   appear dead.

Additional load-bearing details the council verified: both strict comparisons
(`|actual - written| > 1` and `target > written`) must stay strict — `>=` on the first
causes spurious adoption on engines whose getter floors device-pixel-snapped positions
(worst-case error is exactly 1), and `>=` on the second re-writes the same pixel every
frame, which re-cancels iOS momentum. The hook also relies on the ▶ control only
rendering when `scrollHeight > clientHeight + 1` (so `max ≥ 2` whenever it runs); if
that render guard ever changes, add a `max` guard to the hook.

Worked example, 30 px/s at 60 Hz: `pos` gains 0.5/frame → 0.5, 1.0, 1.5, 2.0 … writes
land on frames where `floor(pos)` advances: 1 px on frames 2, 4, 6 … = 30 px/s exactly.
At 120 Hz the gain is 0.25/frame and writes land every 4th frame — same 30 px/s.
10 px/s writes 1 px every 6th frame (60 Hz). 120 px/s writes 2 px every frame. The set
number is now the real speed at any refresh rate.

## What is verified and what is not

- Verified here: root cause reconstructed from `f7a7414`'s code; the new math walked
  frame-by-frame at 10/30/120 px/s on 60 Hz and 120 Hz; `npm run build` (strict tsc)
  passes; council-reviewed (animation math + React lifecycle lenses).
- **Not verified: real phone behavior.** Nobody in this chain of sessions has watched
  it scroll on the actual device. Run the script below before calling this fixed.

## 5-minute phone test script

Setup: deploy the branch (or `npm run dev -- --host` and open the LAN URL on the
phone). **Hard-refresh first** (or kill/reopen the installed PWA twice) so the service
worker can't serve a stale bundle. Open Show mode → any song with a long chord sheet
(e.g. one where the Chords view clearly overflows the screen) → Chords view.

1. **10 px/s (slow creep test).** Tap − until the readout shows ~8–10 px/s. Press ▶.
   Expected: the sheet visibly creeps — slower than comfortable reading speed, but
   *moving* (≈1 cm every 4–6 s). FAIL if it sits frozen for 10+ seconds.
2. **30 px/s (the old plateau, low end).** Tap + to ~30. Expected: a comfortable slow
   read speed, clearly ~3× faster than step 1.
3. **120 px/s (the old plateau, top end).** Tap + to 120. Expected: obviously fast —
   **4× the speed of step 2** (a screenful in a few seconds), not the same speed as 30.
   This is the step that catches the one-speed bug.
4. **Manual scroll coexistence.** At ~30 px/s while playing: swipe the sheet up and
   flick (momentum). Expected: the fling runs naturally, isn't jerked back, and the
   crawl resumes from where the sheet settled. Hold a finger on the sheet: crawl
   pauses; lift: resumes without a jump.
5. **End + song change.** Let it reach the bottom: ▶ un-latches. Tap ▶ again: it
   rewinds to the top and restarts. Change songs mid-crawl (› button): new song starts
   at the top, paused.

If step 1 fails or steps 2/3 look the same speed, the bug is *not* fixed — capture the
phone model + browser and whether the URL was the /dev/ deployment, and check for a
stale bundle before touching the math.
