---
name: practice-session
description: >-
  Generate a timed 2-hour Martin Overdrive practice worksheet for today's session,
  guided by prior session notes and the baseline practice-notes worksheet. Use when
  the user says "practice session", "practice worksheet", "today's practice",
  "/practice", "generate practice", or asks to start / plan a practice block before
  the Aug 1 show.
---

# Practice session

Generate **one dated 2-hour worksheet**, leave blanks for the user to fill while
practicing, then stop. The **next** run reads those notes and builds the following
session. Do not practice for the user; do not invent comfort scores they did not write.

## Fixed constraints (this gig)

| | |
|---|---|
| Show date | **2026-08-01** |
| Session length | **2 hours** |
| Set | **All 31 songs** (setlist order) |
| App | Cheat card Fills / More fills, home-fret chips, show mode |

Phases by calendar (inclusive):

| Phase | Dates | Goal |
|---|---|---|
| 1 Rescue | through 2026-07-20 | Comfort ≤2 songs → ≥3 |
| 2 Form+fills | 2026-07-21 – 07-26 | Form locks + curated fills; half-set glue |
| 3 Harden | 2026-07-27 – 07-31 | Ordered half-sets / abbreviated full set |
| Show day | 2026-08-01 | Warm-up only (~25 min) — still generate a short sheet |

Set order, priority tiers, changeover pairs, and the worksheet template live in
[reference.md](reference.md) — **read it every run**.

## Inputs (read in this order)

1. **Today's date** (from user_info / environment). Compute days until show.
2. **Baseline:** `practice-notes-worksheet.md` (repo root) — comfort ratings + shaky notes.
3. **Prior sessions:** every file in `practice-sessions/*.md` except `_README.md`,
   sorted by date in the filename (`YYYY-MM-DD.md`). Prefer the **latest filled**
   session (has notes under Session log / song blocks). If none exist yet, baseline only.
4. **Setlist** only if you need titles/tunings: `src/data/setlist.json`.

If `practice-sessions/YYYY-MM-DD.md` **already exists for today**:
- If mostly blank → tell the user it exists and ask regenerate vs keep.
- If filled → do not overwrite; offer a short "bonus block" appendix or stop.

## What to pick for today

Use phase + prior notes. Always bias toward the **first fail** and **lowest comfort**
from the latest session.

### Every session includes

1. **Priority drill (~45 min)** — phase-appropriate hard songs (see reference).
2. **Ordered set slice (~50 min)** — consecutive songs in setlist order (reference).
3. **Worst-fail replay (~15 min)** — leave blank until after the slice; prompt them to
   name the first break and re-drill it.
4. **Cool-down (~5–10 min)** — one solid ≥4 song so they end clean.

### Selection rules

- **Darkness + Pretender** appear in Priority A at least **4 days per week** until both
  are ≥3 (then maintenance 10–15 min).
- Prefer songs marked shaky / "need fills" / form memory in baseline or last session.
- For set slices: comfort ≥4 → verse+chorus once; ≤3 → fuller play. At Drop D songs
  (**The Middle #21**, **Fat Bottomed Girls #27**) note **actually retune**.
- Do **not** spend the Priority block on Pink Pony / Small Things / Save a Horse alone —
  those are cool-down or set glue only.
- On **2026-08-01**: Priority = openers 1–4 + Pretender entrance + Drop D tuning check;
  skip long set slice; total ~25–30 min.

Rotate set slices so over a week they cover **1–16** and **17–31**. If the last session
did first half, do second half (and vice versa), unless notes demand revisiting a kill zone
(1–6, 17–22, 23–27).

## Output

1. Create `practice-sessions/` if missing.
2. Write **`practice-sessions/YYYY-MM-DD.md`** using the template in reference.md.
3. Fill in the timed plan (songs, minutes, specific drills). Leave **all note fields blank**
   for the user.
4. Reply with a short summary: phase, day's focus, path to the file, and
   "Fill notes as you go; run this skill again next session."

Do **not** commit unless asked. Do **not** deploy.

## After the user practices (same or later chat)

If they say they finished / paste notes / ask to "close out" the session:

1. Read today's worksheet.
2. Update the **Carry-forward** section at the bottom (or add it) with: biggest fail,
   wins, comfort deltas they wrote, what tomorrow must include.
3. Optionally patch comfort numbers in `practice-notes-worksheet.md` **only where they
   explicitly rated a change** — do not invent ratings.

## Anti-patterns

- Regenerating a filled session without asking
- Full 31-song run as the daily plan (too long; use half-sets / abbreviated)
- Ignoring yesterday's "first fail"
- Replacing cheat-card fill work with "just improv"
