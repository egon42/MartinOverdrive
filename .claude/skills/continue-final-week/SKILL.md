---
name: continue-final-week
description: >-
  Resume Martin Overdrive final-week stage push from where you left off across
  Cursor or Claude Code. Use when the user says "/continue", "/continue desk",
  "/continue guitar", "continue final week", "where was I", "resume push", or
  asks to pick up the Aug 1 show prep. Confirms the recommended model/tool
  before starting the next action.
---

# Continue final week

Cross-tool resume for the Harden week through **2026-08-01**. One next action only.
**Gate on the recommended model before doing any work.**

## Triggers

| Say | Track |
|---|---|
| `/continue desk` · `continue desk` | **desk** — app work without guitar |
| `/continue guitar` · `continue guitar` · `/coach` (when continuing Harden) | **guitar** — Body + timed practice |
| `/continue` · `continue final week` · `where was I` · `resume push` | Use HANDOFF **Track** if set; else ask **desk or guitar?** (one question, then proceed) |

## Two tracks (settled 2026-07-27)

| Track | Where | Work |
|---|---|---|
| **desk** | Remote work / meetings / daytime at computer | App updates that need no guitar: Cheat layouts, landmarks, UI/CSS, validate/push, deploy check, card leftovers. Fake-fretboard fingering is **opportunistic only** (user grabs it in downtime) — do **not** run desk-board as the main `/continue desk` action unless they ask `desk board`. |
| **guitar** | At the instrument | Body Pre → `/coach` on today’s worksheet → Body Post. Never-skip trio + set slice. |

HANDOFF keeps **both** next lines (`Next desk` + `Next guitar`). The slash command picks which one to run.

## Startup (every run)

1. Resolve **track** from the trigger table (ask if bare `/continue` and HANDOFF Track is ambiguous).
2. Read in order:
   1. [`practice-sessions/final-week-2026-08-01.md`](../../practice-sessions/final-week-2026-08-01.md) — week rules + calendar + model routing
   2. [`practice-sessions/HANDOFF.md`](../../practice-sessions/HANDOFF.md) — living bookmark (required)
   3. Today’s worksheet `practice-sessions/YYYY-MM-DD.md` if it exists; else latest filled `YYYY-MM-DD.md`
   4. If track is **desk**: [`.claude/skills/stage-cheat-card/progress.md`](../stage-cheat-card/progress.md) + HANDOFF card TODOs / UI leftovers
3. Resolve **exactly one** next action from that track’s HANDOFF line (`Next desk` or `Next guitar`). Rebuild that line if missing/stale. Do **not** dump the other track’s queue. Do **not** start the action yet.

## Model gate (required — before any work)

Map the next action to a recommended home using the table below (HANDOFF **Recommended desk** / **Recommended guitar** wins if present and still matches the action).

| Next action kind | Recommended | Notes |
|---|---|---|
| Stage-card judgment / layout / landmarks / Ryan→Cheat lift (taste) | **Claude Fable 5** (Claude Code, or Cursor with Fable if available) | Best musical/layout judgment |
| Form research vs recording | **Claude Fable 5** | Keep lyric excerpts minimal |
| Apply already-decided mock → `progressions.json` / validate / commit / push | **Cursor** (Composer / fast coding agent OK) | Mechanical |
| Small Cheat CSS / render / UI bug | **Cursor** | Needs repo + phone verify |
| `gig preflight` / `deploy check` | **Cursor** (shell) | Checklist + `gh` |
| `/coach` / `/practice` / worksheet writeback | **Either** (whichever chat is at the guitar) | Continuity > model |
| Body Pre·micro·Post (around guitar or stretch break) | **Either** (fast/cheap OK) | Low stakes |
| Desk-board fingering (only if user asked `desk board`) | **Either** | Not the default desk track |

Then **stop and confirm** in one short message:

1. Track + next action (one line)
2. Recommended model/tool
3. Ask them to confirm they’re there (or say `run here anyway` / `switch done`)

**Do not** instruct the drill, edit files, snapshot, coach a song, or otherwise start until they confirm.

Exceptions (skip the wait, still name the recommendation once):

- Recommended is **Either** and they’re already in Cursor or Claude → proceed after naming it
- They already said in this message `run here anyway` / `stay` / `use this model`

If they’re in the wrong place (e.g. Cursor but Fable is recommended): tell them to open/switch to that model, say `/continue desk` or `/continue guitar` there (or reply `switch done` / `run here anyway` here). Do not start the action in the wrong home unless they override.

## After confirmation — track routing

| Track | Do |
|---|---|
| **desk** | One app slice: stage-cheat-card / named leftover / UI fix / phone-verify / deploy check — whatever **Next desk** says. Snapshot when rewriting cards → apply → `npm run validate` → commit → bare `git push`. Update stage progress + both HANDOFF next lines as needed. Remind once that fingering is optional downtime; do not coach Isolate/Neighbor unless they asked. |
| **guitar** | Hand off to **practice-coach** on today’s sheet (or offer **practice-session** if missing). Body Pre before Priority if not done. Body Post after cool-down. |

Legacy HANDOFF track names (`day-app`, `eve-guitar`, `desk`, `body`): map `day-app` → **desk**, `eve-guitar` → **guitar**, old `desk`/`body` alone → ask which track unless the Next line is clearly app vs practice.

## On pause

When user says `pause` / `stop for now` / end of block, **overwrite** `practice-sessions/HANDOFF.md` with:

- Updated timestamp
- **Track** last used (`desk` or `guitar`)
- Last completed (one line)
- **Next desk** (one concrete app action — layouts, UI, leftovers, preflight…)
- **Next guitar** (one concrete practice action — usually Body Pre → `/coach`…)
- **Recommended desk** / **Recommended guitar** (from the table above)
- Never-skip reminder: Darkness · Pretender · Thunderstruck · set slice · body
- Any open card / UI TODOs
- Note: fingering board = opportunistic; not a HANDOFF blocker

Dated copies (e.g. `HANDOFF-2026-07-26-coach.md`) are optional archives; **`HANDOFF.md` is always the live file**.

## Never do

- Start work before the model gate passes (unless Either / override)
- Treat desk-board fingering as the primary desk action (unless user said `desk board`)
- Regenerate the whole week plan
- Open Ryan polish unless Cheat is empty/wrong and user asks
- Build `show-ready` skill
- Commit `fill_page.html` or unsolicited practice markdown
- Advance past a coach step that still needs a rating
- Run guitar coach steps during `/continue desk` (or app edits during `/continue guitar`) unless they switch tracks
