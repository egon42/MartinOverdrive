---
name: polish-ryan-sheet
description: >-
  Walk Martin Overdrive songs one-by-one and polish personal Ryan sheets (.ryan.txt)
  for show use: sections, lyrics order, numbered fill cues, amp chips, trim stage noise,
  dial autoscroll. Chord/lyric body must stay Ultimate Guitar mid-word-split format
  (never "clean" into space-aligned chord-over-lyric lines). Use when the user says
  "polish ryan", "ryan pass", "next ryan sheet", "ryan polish for <song>", or wants to
  finalize .ryan.txt sheets like Tribute.
---

# Polish Ryan sheet (song-by-song)

Curate the **personal Ryan sheet** (`src/data/sheets/<songId>.ryan.txt`) so it is
stage-ready under the hidden **Ryan sheets** flag. Owns the `.ryan.txt` file (and any
Ryan-only display syntax). Does **not** own band `.chords.txt` / cheat cards (use
**import-song-sheet** / **refine-cheat-form**) unless the user asks to mirror an amp cue.

### Hard rule — lyric spine format (learned 2026-07-22 on Welcome Home)

`parseChordSheet` only understands **UG paste style**: one chord per its own line,
mid-word lyric splits, blank line = end of row. Mid-word cuts (`b` / `C` / `een`) are
**alignment**, not typos — do not rewrite them into “readable” full words with
space-padded chord lines (`Em          C` over `You could've been…`). That looks tidy
in the file and **misaligns chips + drops/glues spaces** on screen.

When creating or repairing a Ryan sheet: **copy the band `.chords.txt` chord/lyric body
verbatim**, then layer Ryan-only edits (sections, `[Amp:]`, fills/`^N`, ghosts/`~`,
sit-out intros, outro repeats). Chord *names* may change when the user plays different
shapes; the **split/blank-line structure** must stay UG. Full examples in
[reference.md](reference.md) § Sheet format.

Authority order when they conflict:

1. **User + recording** (what they play / follow along to)
2. Band `src/data/sheets/<id>.chords.txt` for lyric/section **spine** (UG format included)
3. Existing `.ryan.txt` (personal chord/tab choices win over band when intentional —
   still keep UG line structure)

## One song per turn

Do **not** batch-edit the whole setlist. For each song:

1. Load context → propose deltas → wait for confirm (unless they already stated the fix)
2. Apply → `npm run validate` → **commit + bare `git push` to `dev`** (shipping to `/dev/`
   for on-device review is the default — standing user instruction)
3. Mark progress → point them at live `/MartinOverdrive/dev/` Ryan tab → offer the **next**
   unchecked song

Resume from [progress.md](progress.md). Prefer songs that already have a `.ryan.txt`, then
setlist order for new ones. Ryan tab only appears when `settings.ryanTab` is on (7 taps on
Settings → Developer).

### Triggers

| User says | Do |
|---|---|
| "ryan pass" / "polish ryan" / "start ryan polish" | Open progress; start at first unchecked (or ask) |
| "next" / "next ryan sheet" | Next unchecked after the last done |
| Song title / id | That song only |
| Specific fix ("move fill 3 to beast") | Apply immediately; still validate + push |
| "push to dev" / "for review" / "ship it" / "ok" / "lgtm" | Treat as accept of the pending proposal → apply + validate + commit + push |
| "lock this in" / "locked" / "perfect" (after dial + content) | Check off in progress.md; commit seed + notes; offer next song |

## Step 1 — Load

For song id `NN-slug`:

1. Ryan sheet if present: `src/data/sheets/<id>.ryan.txt` (else **copy band `.chords.txt` body
   as the starting spine** — do not invent a cleaned lyric layout)
2. Band lyrics: `src/data/sheets/<id>.chords.txt` (source of truth for UG splits / blanks)
3. Amp mapping: `src/data/amp-presets.json` + any mid-song `[Amp:]` in the sheets
4. Title/tuning from `src/data/setlist.json` if needed
5. Practice notes for that song in `practice-notes-worksheet.md` (fill research links, amp TODOs)
6. Existing scroll seed if any: `src/data/scrollSpeeds.json`

If an existing `.ryan.txt` already has space-aligned chord rows or full-word lyrics where
the band sheet mid-splits, treat that as a bug: restore the band spine, re-apply Ryan layers.

Show a short **before** block:

```
Song: Tribute (07-tribute)
Ryan: yes · Sections: Intro, Fill^1, Fill^2, Fill^3, ROCK…
Amp: 4Amber → 5Amber
Fills: ^1 long · ^2 looked · ^3 men
Scroll: 10 px/s · leadInSec 11.6
```

## Step 2 — Checklist

| Check | Typical fix |
|---|---|
| Missing Intro / follow-along sections | Add `[Intro - spoken, follow along]` (or similar) even if not playing |
| Lyrics incomplete or wrong order | Diff against band `.chords.txt` + recording; keep Ryan chord/tab *choices* |
| **UG spine intact** (mandatory) | Band mid-word splits and blank-line row breaks still present. **Never** “tidy” into space-aligned `Em          C` / full-word lyric lines. New sheets = band body + Ryan layers only (reference § Sheet format) |
| One-off fills not marked | Numbered cues: `^N` on its own line before the lyric fragment + `[Fill ^N]` on the FILL line (see [reference.md](reference.md)) — same UG line rules as chords |
| Chord chips where only fills are played | Strip chord tokens in that stretch (Tribute: no chords before ROCK) |
| Vocal-only bar over a vamp / before a solo | Ghost chips: same chord names with `~` prefix (`~Am ~G ~D ~F`) so the beat is visible but don't play |
| Amp chips wrong for what is actually played | Update `[Amp:]` + `amp-presets.json` notes; retune a slot in `amp-presets/generate_presets.py` only when nothing else needs the old tone |
| Stage noise (chords-used lists, full stitched Songsterr dumps) | Cut — kills set-and-forget autoscroll; full tab stays on Tabs |
| Autoscroll | After content is stable, dial on `/dev/` **with chrome collapsed**, then commit to `src/data/scrollSpeeds.json` (see Dial-in). Re-dial if you later add/remove rows (ghost bars, fills) |
| Default show zoom | Ryan opens at **0.75×** (min **0.6×**); don't fight that in the sheet |

**Ask** when band lyrics and recording disagree, or when a fill cue word is uncertain (propose + ear-check).

### Dial-in (after content is stable)

Per-song default lives in **`src/data/scrollSpeeds.json`** (same seed pattern as `bpm.json`).
Resolution: practice override (`PracticeEntry.scrollSpeed`) → song seed → global 24.
Fresh installs and devices with no override pick up the polished seed.

1. Hard-refresh `/MartinOverdrive/dev/` → song → Ryan (flag on). Zoom at default **0.75×**.
2. If the readout is acid-colored, tap it once to clear any old practice override (restores the song seed / global default).
3. Press ▶ — show chrome collapses while `scroll.playing` (incl. lead-in). Dial −/+ against
   this larger viewport. Aim for the **currently played section in the upper-middle** of the
   screen (not only "sheet ends with the track"). Spoken intros with sparse chips vs dense
   ROCK sections mean end-aligned math can put ROCK too low or too high — trust ears on device.
4. **Save the default:** set `"<songId>": { "speed": N, "leadInSec": S?, "note": "…" }` in
   `src/data/scrollSpeeds.json` (1×-normalized px/s; crawl runs at `speed * zoom`).
   Optional `leadInSec` overrides the global `96 / speed` lead-in (Tribute locked at
   **10** + **11.6s** = formula +2s). Commit with the Ryan sheet. After deploy, tap the
   acid readout on devices that still have an override so they pick up the seed.
5. Lead-in default is global (`SCROLL_LEAD_IN_PX = 96` → seconds = `96 / speed`) unless
   the song seed sets `leadInSec`. Don't invent other lead-in mechanisms without asking.
6. Confirm numbered fill cues against the recording (practice-notes links when present).
7. When the user says the crawl feels right ("perfect" / "lock this in"), check off
   [progress.md](progress.md) and stop tweaking that song's seed unless content changes.

**Estimating a starting seed (before device dial):** calibrate against locked **Tribute**
rather than re-deriving px/line from CSS. Full recipe in [reference.md](reference.md)
§ Scroll seed estimate. Short version:

1. **Anchor** — `07-tribute`: `speed` **10**, `leadInSec` **11.6**, studio **4:08** (248s).
   Crawl time ≈ `248 − 11.6` → scroll distance ≈ `10 × 236.4` ≈ **2364px**.
   Assume collapsed viewport **V ≈ 600** → Tribute sheet height **H_t ≈ 2964px**.
2. **Ratio** — count lines (prefer **non-empty**) in the new `.ryan.txt` vs Tribute’s.
   `H ≈ H_t × (nonEmpty_new / nonEmpty_tribute)`.
3. **leadInSec** — start from formula `96 / speed` once you have a speed guess. **Override
   longer** when the first played chips sit after a long sit-out / sparse intro (Welcome
   Home: ~48s so ringing Em holds through the lead riff). Sparse→dense sheets need this
   more than pure end-of-sheet math.
4. **speed** — `round((H − V) / (studioSec − leadInSec))`. Clamp to validator bounds
   **6–120** (`SCROLL_MIN` / `SCROLL_MAX` in `scripts/validate-song-data.mjs`). Welcome
   Home raw ≈5 → stored **6**.
5. **Write** the seed with `note: "Estimate YYYY-MM-DD. …"` (anchor, duration, any
   lead-in rationale). Ship for on-device dial; prefer **upper-middle at the first played
   section** over end-aligned timing when density is uneven. Only drop “Estimate” / lock
   in progress when the user confirms the crawl.

Chrome while crawling (product, already wired in `Show`): keep × exit, compact title,
‹ n/N ›, Live chip, AutoScrollBar, home-fret scale chips (sheet views park them to the
right of the scroll controls so collapse does not hide them); hide artist eyebrow, view
bar + Pin, stage strip, Up next, zoom-reset. Crawl end pins to the true bottom after chrome
re-expands (collapsed max ≠ expanded max). Practice SheetPanel does not collapse yet.

## Step 3 — Settled Ryan syntax

Read [reference.md](reference.md) **before writing sheet text** (especially § Sheet format). Short version:

- **UG mid-word-split format only** (band `.chords.txt` / Tribute ROCK) — never space-padded chord-over-lyric rewrites
- Parse with `frets: true` (fret chips + cues + ghosts)
- Fill cues: `^1` … `^99` on their own line before the lyric fragment; matching `[Fill ^1]` section header
- Section notes in the bracket title: `[Intro - spoken, follow along]`
- Amp: `[Amp: 4Amber]` section lines (same as band)
- Ghost / don't-play chips: prefix `~` (`~Am ~G ~D ~F`) — dashed strikethrough chip, keep the beat (same marker as cheat-card progressions)
- Bare `0`–`24` = A-string fret chips (The Middle); never enable frets on band lyrics sheets
- Cue triangles sit at the **top** of the above-slot (`align-items: flex-start`); never change `--chip-pull` to "fix" overlap (that moves lyric text)
- Chip hints (`Am{Hold}`) — reserved; add when a song needs them
- App copy: no em-dashes

## Step 4 — Ship

Before validate: spot-check that chorded lyric stretches still mid-split like the band sheet
(if you “cleaned” wording for readability, undo that and re-layer).

```bash
npm run validate
# commit ryan sheet (+ scrollSpeeds.json / amp / docs) then bare git push on dev
```

Point at `/MartinOverdrive/dev/` → song → Ryan tab (flag on). Hard-refresh if the SW looks stale.
When locking in: update [progress.md](progress.md), then offer the next unchecked song
(prefer existing `.ryan.txt`, else setlist order).

## Out of scope / anti-patterns

- Batch-creating Ryan sheets for every setlist song in one turn
- Changing band `.chords.txt` / cheat cards unless asked
- Loading amp hardware (tell the user to run the mustang loader when a `.fuse` changed)
- **Rewriting lyrics into “pretty” full lines with space-aligned chords** — breaks
  `parseChordSheet` (Welcome Home regression 2026-07-22); always band spine + Ryan layers
