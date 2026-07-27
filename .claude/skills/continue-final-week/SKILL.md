---
name: continue-final-week
description: >-
  Resume Martin Overdrive final-week stage push from where you left off across
  Cursor or Claude Code. Use when the user says "/continue", "continue final
  week", "where was I", "resume push", or asks to pick up the Aug 1 show prep.
  Confirms the recommended model/tool before starting the next action.
---

# Continue final week

Cross-tool resume for the Harden week through **2026-08-01**. One next action only.
**Gate on the recommended model before doing any work.**

## Triggers

`/continue` · `continue final week` · `where was I` · `resume push`

## Startup (every run)

Read in order:

1. [`practice-sessions/final-week-2026-08-01.md`](../../practice-sessions/final-week-2026-08-01.md) — week rules + calendar + model routing
2. [`practice-sessions/HANDOFF.md`](../../practice-sessions/HANDOFF.md) — living bookmark (required)
3. Today’s worksheet `practice-sessions/YYYY-MM-DD.md` if it exists; else latest filled `YYYY-MM-DD.md`
4. [`.claude/skills/stage-cheat-card/progress.md`](../stage-cheat-card/progress.md) — next unfinished kill-zone / stage card if track is day-app

Resolve **exactly one** next action from HANDOFF’s **Next** line (or rebuild Next if HANDOFF is missing/stale). Do **not** dump the queue. Do **not** start the action yet.

## Model gate (required — before any work)

Map the next action to a recommended home using the table below (HANDOFF **Recommended** line wins if present and still matches the action).

| Next action kind | Recommended | Notes |
|---|---|---|
| Stage-card judgment / layout / landmarks / Ryan→Cheat lift (taste) | **Claude Fable 5** (Claude Code, or Cursor with Fable if available) | Best musical/layout judgment |
| Form research vs recording | **Claude Fable 5** | Keep lyric excerpts minimal |
| Apply already-decided mock → `progressions.json` / validate / commit / push | **Cursor** (Composer / fast coding agent OK) | Mechanical |
| `/coach` / `/practice` / worksheet writeback | **Either** (whichever chat is at the guitar) | Continuity > model |
| Desk board / body Pre·micro·Post | **Either** (fast/cheap OK) | Low stakes |
| `gig preflight` / `deploy check` | **Cursor** (shell) | Checklist + `gh` |
| Small Cheat CSS / render bug | **Cursor** | Needs repo + phone verify |

Then **stop and confirm** in one short message:

1. What the next action is (one line)
2. Recommended model/tool
3. Ask them to confirm they’re there (or say `run here anyway` / `switch done`)

**Do not** instruct the drill, edit files, snapshot, coach a song, or otherwise start until they confirm.

Exceptions (skip the wait, still name the recommendation once):

- Recommended is **Either** and they’re already in Cursor or Claude → proceed after naming it
- They already said in this message `run here anyway` / `stay` / `use this model`

If they’re in the wrong place (e.g. Cursor but Fable is recommended): tell them to open/switch to that model, say `/continue` there (or reply `switch done` / `run here anyway` here). Do not start the action in the wrong home unless they override.

## After confirmation — track routing

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
- **Recommended** model/tool for that Next (from the table above)
- Never-skip reminder: Darkness · Pretender · Thunderstruck · set slice · body
- Any open card TODOs

Dated copies (e.g. `HANDOFF-2026-07-26-coach.md`) are optional archives; **`HANDOFF.md` is always the live file**.

## Never do

- Start work before the model gate passes (unless Either / override)
- Regenerate the whole week plan
- Open Ryan polish unless Cheat is empty/wrong and user asks
- Build `show-ready` skill
- Commit `fill_page.html` or unsolicited practice markdown
- Advance past a coach step that still needs a rating
