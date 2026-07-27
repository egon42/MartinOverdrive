---
name: continue-final-week
description: >-
  Resume Martin Overdrive final-week stage push from where you left off across
  Cursor or Claude Code. Use when the user says "/continue", "continue final
  week", "where was I", "resume push", or asks to pick up the Aug 1 show prep.
---

# Continue final week

Cross-tool resume for the Harden week through **2026-08-01**. One next action only.

## Triggers

`/continue` · `continue final week` · `where was I` · `resume push`

## Startup (every run)

Read in order:

1. [`practice-sessions/final-week-2026-08-01.md`](../../practice-sessions/final-week-2026-08-01.md) — week rules + calendar
2. [`practice-sessions/HANDOFF.md`](../../practice-sessions/HANDOFF.md) — living bookmark (required)
3. Today’s worksheet `practice-sessions/YYYY-MM-DD.md` if it exists; else latest filled `YYYY-MM-DD.md`
4. [`.claude/skills/stage-cheat-card/progress.md`](../stage-cheat-card/progress.md) — next unfinished kill-zone / stage card if track is day-app

Then start **exactly one** next action from HANDOFF’s **Next** line (day-app card, desk block, body micro/Pre/Post, or `/coach` step). Do **not** dump the queue.

If HANDOFF is missing or stale vs today, rebuild Next from the calendar in the final-week doc + first blank coach step / first unchecked kill-zone card, then rewrite HANDOFF.

## Track routing

| HANDOFF track | Do |
|---|---|
| `day-app` | One song: `stage-cheat-card` (or named lift). Snapshot → apply → validate → commit → bare `git push`. Update stage progress + HANDOFF. |
| `desk` | One desk-board micro-block, then body micro (see final-week Body section). |
| `body` | Run Pre, desk micro, or Post as HANDOFF says; check off on today’s worksheet if present. |
| `eve-guitar` | Hand off to **practice-coach** on today’s sheet (or offer **practice-session** if missing). Body Pre before Priority if not done. |

## On pause

When user says `pause` / `stop for now` / end of block, **overwrite** `practice-sessions/HANDOFF.md` with:

- Updated timestamp
- Track (`day-app` / `desk` / `body` / `eve-guitar`)
- Last completed (one line)
- **Next** (one concrete action)
- Never-skip reminder: Darkness · Pretender · Thunderstruck · set slice · body
- Any open card TODOs

Dated copies (e.g. `HANDOFF-2026-07-26-coach.md`) are optional archives; **`HANDOFF.md` is always the live file**.

## Never do

- Regenerate the whole week plan
- Open Ryan polish unless Cheat is empty/wrong and user asks
- Build `show-ready` skill
- Commit `fill_page.html` or unsolicited practice markdown
- Advance past a coach step that still needs a rating
