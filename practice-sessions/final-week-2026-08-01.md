# Final week plan — show 2026-08-01

- Written: 2026-07-26; **superseded/refreshed 2026-07-27** (final-week stage push; desk≠fingering)
- Stage screen: **Cheat tab only** (show mode). Ryan / Lyrics / Tabs / roadmap Chords = learning archives.
- Goal: glance-mode from Cheat (section + chords + catch-up hints), not line-by-line staring.
- Daily engine: Body Pre → **practice-session** → **/coach** → Body Post.
- **Desk track** = app work without guitar (layouts, UI, leftovers). Fingering board = spare-moment only.
- **Guitar track** = timed practice at the instrument.
- Resume: **`/continue desk`** or **`/continue guitar`** (bare `/continue` asks which). Reads this file + `HANDOFF.md`.

## Standing rules

- Cheat only; if lost → next section on card → rejoin → keep going.
- Card edits: mock → snapshot → apply → `npm run validate` → commit → bare `git push` on `dev`.
- **Thu 7/30 after evening:** freeze card edits unless broken for Friday.
- Drop first when time slips: Free Bird, fills, non-kill-zone stage passes.
- **Never skip:** Darkness + Pretender + **Thunderstruck** (when/where) + ordered set slice + **body protocol**.
- Soreness climbing day-over-day → shorten Priority, keep never-skip trio + stretch, drop fills first.

## Resume — `/continue`

| Say | Does |
| --- | --- |
| `/continue desk` | Next **app** slice (Cheat layout, UI, leftovers, verify, preflight) |
| `/continue guitar` | Body + `/coach` on today’s worksheet |
| `/continue` | Asks desk vs guitar if unclear |

Skill: `.claude/skills/continue-final-week/`. Living bookmark: [`HANDOFF.md`](HANDOFF.md) (both **Next desk** + **Next guitar**; overwrite on every pause).

## Body conditioning (back / neck / shoulders / forearms)

Not medical advice. Stop sharp or radiating pain. No max-effort strength this week.

| Slot | When | Time |
| --- | --- | --- |
| **Desk micro** | Every ~45–60 min sitting (stretch break; optional after fingering) | 2–3 min |
| **Pre-guitar** | Before Priority | 5–7 min |
| **Post-guitar** | After cool-down song | 8–10 min |

Fri: Pre before first song; **2-min reset between sets**; Post after load-out. Sat: Pre before short warm-up.

### Desk micro (pick 4–5)

1. Chin tuck ×8 (3s hold)
2. Seated thoracic open ×5/side
3. Shoulder blade squeezes ×10
4. Doorway/wall pec opener 30s/side
5. Wrist flexor stretch 30s/arm (palm up)
6. Wrist extensor stretch 30s/arm (palm down)
7. Stand + walk 60–90s (look far)

### Pre-guitar

March 60s + arm circles ×10; cat–cow ×8; thread-the-needle or open-book ×4/side; shoulder rolls + scap squeezes ×8; wrist circles + both wrist stretches 20s; optional easy band pull-aparts ×10.

### Post-guitar

Child’s pose or folded sit 45–60s; knees-to-chest or figure-4 30s/side; pec opener 30–45s/side; upper-trap stretch 20–30s/side; forearm flush (both stretches + fist open/close); tiny neck yes/no/maybe ×5 + 2 chin tucks.

### Hygiene

Phone at chest/eye height; sit/stand alternate; strap high enough; forearm pump → 60s shake-out + wrist stretches mid-block.

## Desk track queue (daytime app — freeze cards Thu)

Primary daytime work is **in the repo / on `/dev/`**, not the fake fretboard.

| # | Song | Job |
| --- | --- | --- |
| 1 | Pretender | Hide Intro + Interlude from Cheat; quiet→heavy entrance cue |
| 2 | Valerie | Verse→pre→chorus; 2nd verse longer cue |
| 3 | Mama | Pre / chorus / Face / bridge landmarks |
| 4 | Don't Stop Believin' | Pre vs chorus at a glance |
| 5 | Darkness | Measure-end / clap landmarks |
| 6 | Gently Weeps | Finish stage pass from mock |
| 7 | Thunderstruck | when/where landmarks only if Priority still fails |

**Ryan→Cheat lifts:** The Middle A-string PM (after kill-zone or before Wed changeover). Minimum lift only.

Nice-if-time (desk): Lola F#m/Em; Dirtbag full chords cue; Fat Bottomed stops; any UI/CSS Cheat bugs; phone-verify kill-zone on `/dev/`.

**Opportunistic fingering** (not a continue step): Mon/Thu Fret-2; Tue Am/Em barre; Wed powers + E5–B5. Grab in meeting gaps; log on the worksheet Desk board if useful.

## Dual-track calendar

| Day | Desk (`/continue desk`) | Guitar (`/continue guitar`) |
| --- | --- | --- |
| **Mon 7/27** | Kill-zone leftovers / phone-verify / UI | Body Pre → Priority Lola+Mama+Darkness 10+Thunderstruck → slice **#17–#31** → Body Post |
| **Tue 7/28** | Mama/DSB/Darkness cue polish if needed; leftovers | Body Pre → DSB+Hunger+Dirtbag → slice **#1–#16** → Body Post |
| **Wed 7/29** | Gently Weeps / Middle / Thunderstruck card tweaks if Priority failed | Body Pre → changeovers 3→Darkness, 16→Pretender, 5→Thunderstruck, 24→Valerie, 20→Middle, 26→Fat Bottomed → Body Post |
| **Thu 7/30** | Leftovers + UI; **freeze cards** after evening | Body Pre → weakest ≤3 (max 3) + abbreviated full set → Body Post |
| **Fri 7/31** | `gig preflight` morning | Band rehearsal (Body Pre / between-set resets / Post). Light eve or sleep |
| **Sat 8/1** | — | Body Pre → ~25 min warm-up only. No learning. No card edits |

## Skills

| Need | Say |
| --- | --- |
| Resume desk (app) | `/continue desk` |
| Resume guitar | `/continue guitar` |
| Resume (ask track) | `/continue` |
| Today's worksheet | `practice session` / `/practice` |
| Walk worksheet | `/coach` |
| Fingering board (optional) | `desk board` |
| Body stretch only | `body` / `stretch` |
| Stage Cheat card | `stage pass` / song name / `lift from Ryan` |
| Form vs recording | `refine cheat form` / `research song form` |
| Pre-show | `gig preflight` (Fri morning) |
| Deploy live? | `deploy check` |
| Ryan | **skip** unless Cheat empty/wrong |

## Model routing

`/continue desk` / `/continue guitar` **confirm** the recommended model/tool before starting (see continue-final-week skill). Override with `run here anyway`.

| Job | Model |
| --- | --- |
| Stage-card judgment / form research | Claude Fable 5 |
| Apply mock → validate → push / UI CSS | Fast Cursor / Composer |
| `/coach` / `/practice` / body | Either (guitar chat wins for coach) |
| `gig preflight` / deploy | Fast Cursor shell agent |


## Parked until after the show

Ryan polish / scroll locks; full 32-song stage pass; Free Bird dual-lead; `show-ready` skill; Lyrics/Tabs as stage UI; ATS Nana; baseline comfort rewrite.

## Success criteria

- Kill-zone glance-OK from Cheat on `/dev/`
- Darkness + Pretender + Thunderstruck ≥3 (Thunderstruck = when/where)
- `/continue desk` + `/continue guitar` land correctly via `HANDOFF.md`
- Thu abbreviated full set without restarts
- Fri preflight PASS; body resets between sets
- Body protocol done most days
