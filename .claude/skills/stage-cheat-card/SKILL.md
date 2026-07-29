---
name: stage-cheat-card
description: >-
  Walk Martin Overdrive songs one-by-one and polish the show-mode Cheat / Chords
  roadmap card as the primary stage surface (big, readable at arm's length while
  playing). Prefer an editable Markdown mock the user can rearrange, then apply
  to progressions.json. Use when the user says "stage card", "stage cheat",
  "stage pass", "next stage card", "cheat card for stage", "polish show card",
  "stage-cheat-card", or wants the Banditos-style stage card on another song.
---

# Stage cheat card (song-by-song)

Make the **show-mode Cheat + Chords cards** the thing you play from on stage.
Ryan / Lyrics / Tabs stay for learning. Owns stage layout in
`src/data/progressions.json` (`sections` chords/hints/shapes, `form` only when
roadmap order must change). Does **not** own form-from-recording research
(**research-song-form** / **refine-cheat-form**), Ryan sheets, or key alignment.

**Pilot:** Banditos (`31-banditos`) — mock-driven Chorus stack. Worked example in
[reference.md](reference.md).

Authority when they conflict:

1. **User mock / what they want on the phone** (edit → apply loop)
2. User + recording / play-along
3. Ryan / chords sheets (lyric landmarks, real cycles)
4. Existing `progressions.json` entry

## One song per turn

Do **not** batch the setlist. For each song:

1. Seed or open a mock → user edits (or accepts a tight proposal)
2. Snapshot → apply mock → `npm run validate` → **commit + bare `git push` to `dev`**
3. Mark [progress.md](progress.md) → point at `/MartinOverdrive/dev/` → offer next

### Triggers

| User says | Do |
|---|---|
| "stage pass" / "stage cards" / "start stage pass" | Open progress; start at first unchecked (or ask) |
| "next" / "next stage card" | Next unchecked after last done |
| Song title / id | That song only |
| Edited mock / "use the mock" / "apply the mock" | Apply that song's mock immediately |
| Specific layout ("stack vamp on its own line") | Apply; still validate + push |
| "ok" / "lgtm" / "ship it" on a pending proposal | Apply + validate + commit + push |

## Goal checklist (stage-ready)

A song is done when the user can play the track from the **Cheat** (and/or roadmap
**Chords**) card without needing Ryan/Lyrics for orientation:

- [ ] Section identity clear at a glance (Intro vs Chorus vs tag/outro)
- [ ] Chord rows match how they think through the part (not over-collapsed)
- [ ] Lyric / landmark hints where a repeat or turn would otherwise blur
- [ ] Readable at arm's length on phone (prefer lean content over tiny auto-fit type)
- [ ] Form roadmap still correct (fix ×N on labels; don't bake song order into chords)

## Step 1 — Load

For song id `NN-slug`:

1. Live card: `src/data/progressions.json` → that key
2. Optional spine: `src/data/sheets/<id>.ryan.txt` and/or `.chords.txt`
3. Title from `src/data/setlist.json` if needed
4. Mock path: `practice-sessions/<id>-stage-card-mock.md`

If the mock file is missing, **seed it** from the live card (template in
[reference.md](reference.md)). Show a short before block, then either:

- **Mock path (default when layout is taste-y):** ask them to edit the Cheat
  building-blocks section and say "use the mock", or
- **Propose path:** one concrete layout (1–2 options max) when the fix is obvious

Do **not** invent multi-line Chorus drama without their ear or mock. Banditos lesson:
"second half" was wrong; "double pass + vamp" was right — they drew it in the mock.

## Step 2 — Stage layout rules

Full notation in [reference.md](reference.md). Short version:

| Want | Do |
|---|---|
| Whole section N times in the song | `form` label `Verse ×4`; chords stay one cycle |
| Mixed tiles inside one section | `(E A) ×3 (E G A) ×2` |
| Force a new chip row | `\|` between **grouped** spans — prefer `(row1) \| (row2)` so each line is one span (bare `A B \| C D` only breaks before the next single chord) |
| Hide from Cheat only | `"cheatHide": true` on a section — still on Chords roadmap via `form` |
| Lyric landmark | `hint: "quoted lyric"` — **one hint per section**; keep the quotes so show mode highlights them |
| Cue under a mid-section row | Split into two section names **or** combine into one hint |
| Don't-play beat chip | `~Am` |
| Short tag (not a full bar) | `+G` |
| Strum once, let ring | `=B` |
| Keep strumming N measures | `D]]]]` (one `]` per measure, min 2) |
| Orange reminder by section name | `"remind": "Sung chorus first, no guitar"` |
| Fills | Cheat tab only; never in `form` |

Copy rules:

- No em-dashes in hints / UI strings
- Hints are stage cues, not essays. Put **lyric landmarks in straight double quotes**
  (`"Same old story"`) so the app paints them blue; leave plain how-to notes unquoted
- Prefer content cues over CSS / auto-fit surgery. Tall cards shrink in show mode —
  lean the layout before fighting `--sheet-fit`

Shapes: keep existing fingerings when chords unchanged; when adding chords, copy
neighbor shapes for the same name or leave `shapes` short (chips still render).

## Step 3 — Apply the mock

1. Snapshot:
   ```bash
   node scripts/snapshot-progression.mjs <songId> "pre stage card <short label> YYYY-MM-DD"
   ```
2. Translate mock → that song's `sections` / `form` in `src/data/progressions.json`
   - Blank line / `---` between chord lines in the mock → `|` in `chords`
   - Keep straight double quotes around lyric landmarks in hints (UI highlights them);
     do not strip those quotes. Plain instructional notes stay unquoted.
   - Section names in **Roadmap** must match building-block labels (`formStepBase`)
3. `npm run validate` (fix if shape/`(…) ×N` errors)
4. Commit + bare `git push` (never ask). One song per commit when practical.

```text
Stage-polish <Song title> cheat card.

<one line: what changed, e.g. Chorus stacked ID-card / vamp / Everybody>
```

5. Update [progress.md](progress.md). Remind: hard-refresh `/MartinOverdrive/dev/`,
   show mode → song → **Cheat** (and **Chords** if form changed). Ask: tweak, next, or stop?

## Out of scope

- Reconstructing form from the recording with no stage-readability goal → **refine-cheat-form** / **research-song-form**
- Ryan polish / autoscroll → **polish-ryan-sheet**
- Key / transpose → **align-song-key**
- Disabling show-mode auto-fit globally (content first; ask before CSS)
- Promoting `dev` → `main` unless asked

## Parallel skills

| Skill | When |
|---|---|
| refine-cheat-form | Form order / ×N wrong vs recording |
| research-song-form | Need researched form + version archive |
| polish-ryan-sheet | Personal lyric sheet, not the chord card |
| deploy-check | "Is it live?" after push |
| verify | Broader prove-it-works |
