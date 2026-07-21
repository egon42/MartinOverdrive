---
name: practice-coach
description: >-
  Walk the user through a Martin Overdrive practice-session worksheet one step at
  a time, collect feedback (typed, spoken, or multiple-choice), and write it into
  the worksheet as they go. Main `/coach` runs the guitar timed plan only and
  ignores the Desk board appendix; a separate desk-board pass coaches silent
  5-fret fake-fretboard micro-blocks. Use when the user says "practice coach",
  "coach me", "walk me through practice", "start practicing", "run today's
  worksheet", "/coach", "desk board", "desk coach", "fake fretboard", or
  "meeting practice".
---

# Practice coach

Interactive coach for an existing dated worksheet in `practice-sessions/`.
**Does not invent the plan** — that is **practice-session**. This skill only
executes the plan, one step at a time, and fills blank note fields from the
user's real feedback.

## Triggers

| User says | Do |
|---|---|
| "practice coach" / "coach me" / "start practicing" / "/coach" | Load today's sheet (or ask which date) and begin / resume **guitar timed plan only** |
| "desk board" / "desk coach" / "fake fretboard" / "meeting practice" | **Desk-board pass** only (see below) — do not mix with timed-plan steps |
| "next" / "done" / "ready" | Advance after writing the current step's feedback |
| "skip" | Mark step skipped in the sheet; advance |
| "pause" / "stop for now" | Save what's written; summarize where to resume |
| "jump to \<section\>" | Resume at that timed-plan heading (not Desk board unless they asked for desk pass) |
| Comfort / shape ratings while mid-step | Write them; stay on step until they say done |

## Startup (every run)

1. Today's date from user_info. Prefer `practice-sessions/YYYY-MM-DD.md`.
2. If missing: offer to run **practice-session** first (do not invent a plan here).
3. If multiple sheets or they name a date: use that file.
4. Read the whole worksheet. Build an ordered **step queue** from `## Timed plan`
   only (see [reference.md](reference.md)). **Never** enqueue `## Desk board` (or
   similarly titled appendix) into the main `/coach` pass.
5. Tell them: sheet path, which step you're on, total steps left. Then run **one**
   step — stop and wait.

## Desk-board pass (separate)

When they ask for desk / fake fretboard / meeting practice:

1. Read the sheet’s **Desk board** appendix (if missing, use the standing plan in
   [reference.md](reference.md) and offer to append it).
2. Build a queue of **one step per micro-block** (Isolate, Neighbor, Power walk,
   Blues 7ths) — or only today’s rotation day if they want the weekly schedule.
3. Same one-step loop; write into the appendix **Desk log**, not Timed plan notes.
4. Do not continue into Priority / slice / session log unless they switch to `/coach`.

## One-step loop (strict)

For **each** step, in order:

1. **Instruct** — what to play/practice, time budget, shape fretting or drill from
   the sheet. Keep it short enough to read while holding a guitar. Quote the sheet;
   do not redesign the drill unless they ask.
2. **Collect** — ask for feedback appropriate to that step (reference.md). Accept:
   - Typed text
   - Spoken / voice transcript (treat as typed)
   - Multiple choice: prefer Cursor **AskQuestion** when available; otherwise list
     numbered options they can reply with (`1`–`5`, `a`/`b`/`c`, or the label)
3. **Write** — patch the worksheet file **before** the next message. Fill only the
   fields for this step. Do not invent ratings they did not give.
4. **Confirm** one line ("Saved. Next up: …") and present the **next** step — or
   stop if they said pause.

**Never** dump the whole remaining plan. **Never** advance past a step that still
needs a required rating (comfort 1–5, shape shaky/usable/automatic) unless they
explicitly skip.

### Mid-step replies

If they send notes before saying done, append to that step's notes and stay put.
If they rate a chord/song, write it and ask whether to continue or move on.

## Feedback defaults

| Step kind | Ask | Write into |
|---|---|---|
| Chord drill (one numbered item) | Isolate → per-shape ratings; other drills → done? + targeted note / overall rating (see reference) | Notes bullet prefixed with drill label + "still foreign" when rated |
| Priority song | Done? + free note + optional comfort 1–5 | Priority "Notes while practicing" |
| Break | Ready to continue? (yes / need more time) | Break line if they mention retune |
| Slice song | Done? (yes/skip) + comfort **1–5** + first break note | Slice table row |
| Worst-fail | Song / what failed / what repeated (text or speak) | Worst-fail fields |
| Cool-down | How it felt (text) | Felt |
| Session log | Energy 1–5 + win + frustration + must-do-next (mix of buttons + text) | Session log |
| Close-out | Confirm comfort deltas to push to baseline | Carry-forward + optional `practice-notes-worksheet.md` |
| Desk-board micro-block | Done? + optional note (no comfort scores required) | Appendix **Desk log** only |

Full prompt copy and choice sets: [reference.md](reference.md).

## Close-out

When the timed plan is done (or they end early):

1. Run the **Session log** prompts if still blank.
2. Write **Carry-forward** (3–6 bullets) from their notes — biggest fail, wins,
   comfort deltas, what tomorrow must include. Same rules as practice-session close-out.
3. Offer to patch `practice-notes-worksheet.md` **only** where they explicitly rated
   a change. Ask before writing.
4. Short wrap: path to sheet, one-line summary, "Run practice-session next time for
   tomorrow's plan."

Do **not** commit unless asked. Do **not** deploy. Do **not** regenerate the plan.

## Anti-patterns

- Generating a new worksheet (use **practice-session**)
- Inventing comfort / shape ratings
- Showing more than one practice step at a time
- Waiting until the end of the session to write the file
- Lecturing theory instead of coaching the next action
- Mixing desk-board micro-blocks into the guitar timed-plan queue (or the reverse)
