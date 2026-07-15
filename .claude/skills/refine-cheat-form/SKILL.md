---
name: refine-cheat-form
description: >-
  Walk Martin Overdrive songs one-by-one and refine cheat-card form/roadmap + section
  cycles against the recording (and chords sheet). Use when the user says "form pass",
  "refine cheat form", "next song form", "check form against the recording", "cheat form
  for <song>", or wants to go song-by-song fixing section order/repeats like Welcome Home.
---

# Refine cheat form (song-by-song)

Curate the **live cheat card roadmap** so it matches what you play against the recording.
Owns `form` + section `chords` / hints in `src/data/progressions.json`. Does **not** own
key alignment (use **align-song-key**) or sheet imports (use **import-song-sheet**).

Authority order when they conflict:

1. **User + recording** (what they just played / counted)
2. In-app `src/data/sheets/<songId>.chords.txt` (especially `[Section]` markers)
3. Existing `progressions.json` entry (often a stub or over-collapsed)

## One song per turn

Do **not** batch-edit the whole setlist. For each song:

1. Load context → propose deltas → wait for confirm on the **form content** (unless they already stated the fix)
2. Apply → `npm run validate` → **commit + bare `git push` to `dev`** (never ask — shipping to `/dev/` for on-device review is the default)
3. Mark progress → point them at the live `/MartinOverdrive/dev/` cheat card → offer the **next** unchecked song

Resume from [progress.md](progress.md). Setlist order = `src/data/setlist.json` ids.

### Triggers

| User says | Do |
|---|---|
| "form pass" / "start form pass" | Open progress; start at first unchecked (or ask) |
| "next" / "next song" | Next unchecked after the last done |
| Song title / id | That song only |
| Specific fix ("Bridge ×2 then Outro") | Apply immediately; still validate + push |
| "push to dev" / "for review" / "ship it" / "ok" / "lgtm" | Treat as accept of the pending proposal → apply + validate + commit + push (do not re-ask) |

## Step 1 — Load

For song id `NN-slug`:

1. Current cheat: `src/data/progressions.json` → that key (`sections`, `form`, hints)
2. Chords sheet if present: `src/data/sheets/<id>.chords.txt`
3. Title/tuning from `src/data/setlist.json` if needed
4. Render what show mode will show (form labels + chord spans) so the user can compare

Show a short **before** block:

```
Song: Welcome Home (01-welcome-home)
Form: Intro → Verse ×4 → Chorus → …
Sections: Intro Em | Verse Em C D | Chorus (F Am C)×2 | …
```

## Step 2 — Find gaps

Check against sheet + (when available) user/recording notes:

| Look for | Typical fix |
|---|---|
| Missing Intro / Outro / Solo / Interlude | Add section + form step |
| Wrong end (e.g. Chorus after Bridge when recording returns to verse) | Rewrite tail of `form` |
| Under-counted cycles (verse is ×4 not ×2) | Form `Verse ×4`, chords stay unit cycle |
| Over-collapsed cycle (`E A` vs four E–A pairs) | Stage-length unit or form ×N (see notation) |
| Mixed tiles written long (`E A E A E A E G A…`) | Chord groups `(E A) ×3 (E G A) ×2` |
| Useless / wrong hint | Trim or rewrite; no lecture copy ("not back to chorus") |
| Generic template form (`Verse ×2 → Chorus → Verse → Chorus ×2`) that ignores the sheet | Rebuild form from sheet section order + user counts |

**Ask** when sheet and recording disagree, or when a section name is ambiguous (Bridge vs Chorus tag).

## Step 3 — Notation rules (settled)

Read [reference.md](reference.md) if unsure. Short version:

- **Whole section = N plays of one cycle** → `form` label `Verse ×4` + chords `Em C D`  
  (×N on the **label**, not on the chips)
- **One section mixes different tiles** → chords `(E A) ×3 (E G A) ×2`  
  (×N on the **chips**)
- Form ×N is per roadmap slot; section chords are shared — if the same section is ×2 in one place and ×1 in another, **keep ×N on the form**, don't bake it into chords
- `shapes` align 1:1 with chord **names as written** (one pass of each `(…)` group)
- Hints: one line, stage-useful; no negative "don't do X" copy unless the user asks
- Fills stay last; don't put `Fills` in `form`

Welcome Home worked example is in the reference.

## Step 4 — Apply

Edit only that song's entry in `src/data/progressions.json`.

```bash
npm run validate
```

If validate fails (orphan form step, shape count, bad `(…) ×N` syntax), fix before committing.

## Step 5 — Ship to `dev` for review + progress

**Standing rule:** after each song is applied, **always** commit and bare `git push` to `dev`. Do **not** ask “commit?” / “push?” — live review on the `/dev/` deploy *is* the confirm loop for feel/×N. One song per commit when practical.

```text
Refine <Song title> cheat form.

<one line: what changed and why, e.g. Bridge ×2 then verse-pattern outro>
```

Update [progress.md](progress.md): mark the song done, one-line note of what changed.

Then print the **after** roadmap, remind them to check the cheat card on
`https://egon42.github.io/MartinOverdrive/dev/` (hard-refresh if SW is sticky),
and ask: next song, tweak this one, or stop?

If they come back with a tweak (“Pre ends on B”, “Chorus ×3”), apply → validate → commit → push again — still no ask.

## Out of scope

- Key / transpose / shapes-for-new-key → **align-song-key**
- New `.chords.txt` / `.tabs.txt` from UG/Songsterr → **import-song-sheet**
- Promoting `dev` → `main` (ff-only) unless the user asks
- Inventing form from memory when the user hasn't played it yet — propose from sheet, mark uncertain

## Parallel skills

| Skill | When |
|---|---|
| align-song-key | Wrong key / stale cheat chords vs sheet |
| import-song-sheet | Need better source chords/tabs first |
| deploy-check | "Did it deploy?" after push |
| verify | Broader prove-it-works before a big promote |
