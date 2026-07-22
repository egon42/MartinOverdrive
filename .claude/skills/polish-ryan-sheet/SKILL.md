---
name: polish-ryan-sheet
description: >-
  Walk Martin Overdrive songs one-by-one and polish personal Ryan sheets (.ryan.txt)
  for show use: sections, lyrics order, numbered fill cues, amp chips, trim stage noise,
  dial autoscroll. Use when the user says "polish ryan", "ryan pass", "next ryan sheet",
  "ryan polish for <song>", or wants to finalize .ryan.txt sheets like Tribute.
---

# Polish Ryan sheet (song-by-song)

Curate the **personal Ryan sheet** (`src/data/sheets/<songId>.ryan.txt`) so it is
stage-ready under the hidden **Ryan sheets** flag. Owns the `.ryan.txt` file (and any
Ryan-only display syntax). Does **not** own band `.chords.txt` / cheat cards (use
**import-song-sheet** / **refine-cheat-form**) unless the user asks to mirror an amp cue.

Authority order when they conflict:

1. **User + recording** (what they play / follow along to)
2. Band `src/data/sheets/<id>.chords.txt` for lyric/section spine
3. Existing `.ryan.txt` (personal chord/tab choices win over band when intentional)

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

## Step 1 — Load

For song id `NN-slug`:

1. Ryan sheet if present: `src/data/sheets/<id>.ryan.txt` (else start from band chords + user intent)
2. Band lyrics: `src/data/sheets/<id>.chords.txt`
3. Amp mapping: `src/data/amp-presets.json` + any mid-song `[Amp:]` in the sheets
4. Title/tuning from `src/data/setlist.json` if needed
5. Practice notes for that song in `practice-notes-worksheet.md` (fill research links, amp TODOs)

Show a short **before** block:

```
Song: Tribute (07-tribute)
Ryan: yes · Sections: Intro, Fill^1, Fill^2, Fill^3, ROCK…
Amp: 4Amber → 5Amber
Fills: ^1 long · ^2 looked · ^3 men
```

## Step 2 — Checklist

| Check | Typical fix |
|---|---|
| Missing Intro / follow-along sections | Add `[Intro - spoken, follow along]` (or similar) even if not playing |
| Lyrics incomplete or wrong order | Diff against band `.chords.txt` + recording; keep Ryan chord/tab choices |
| One-off fills not marked | Numbered cues: `^N` above the lyric word + `[Fill ^N]` on the FILL line (see [reference.md](reference.md)) |
| Chord chips where only fills are played | Strip chord tokens in that stretch (Tribute: no chords before ROCK) |
| Amp chips wrong for what is actually played | Update `[Amp:]` + `amp-presets.json` notes; retune a slot in `amp-presets/generate_presets.py` only when nothing else needs the old tone |
| Stage noise (chords-used lists, full stitched Songsterr dumps) | Cut — kills set-and-forget autoscroll; full tab stays on Tabs |
| Autoscroll | After content is stable, dial on `/dev/` **with chrome collapsed** (see Dial-in below) |
| Default show zoom | Ryan opens at **0.8×** (show mode); don't fight that in the sheet |

**Ask** when band lyrics and recording disagree, or when a fill cue word is uncertain (propose + ear-check).

### Dial-in (after content is stable)

`scrollSpeed` is per-song practice state (synced), not a file in the repo. The user dials it
on device; you only tweak constants if lead-in feels wrong globally.

1. Hard-refresh `/MartinOverdrive/dev/` → song → Ryan (flag on). Zoom at default **0.8×**.
2. Press ▶ — show chrome collapses while `scroll.playing` (incl. lead-in countdown). Dial
   against this larger viewport; pausing restores chrome.
3. Tap − / + (`SCROLL_SPEED_STEP` = 4) until crawl hits the sheet end with the track.
   Stored value is 1×-normalized; crawl runs at `speed * zoom` (pinch mid-song should still
   roughly hold song length). See `docs/autoscroll-spec.md`.
4. Lead-in is global: `SCROLL_LEAD_IN_PX = 96` → seconds = `96 / speed` (not per-song). If
   first lines vanish too soon/late after dial, adjust that constant in `src/autoscroll.tsx`
   and note it in the spec — don't invent a per-song lead-in without asking.
5. Confirm numbered fill cues against the recording (practice-notes links when present).

Chrome while crawling (product, already wired in `Show`): keep × exit, compact title,
‹ n/N ›, Live chip, AutoScrollBar; hide artist eyebrow, view bar + Pin, stage strip, Up next,
zoom-reset. Practice SheetPanel does not collapse yet.

## Step 3 — Settled Ryan syntax

Read [reference.md](reference.md). Short version:

- Same UG own-line chord/lyric format as band sheets; parse with `frets: true` (fret chips + cues)
- Fill cues: `^1` … `^99` on a chord line above the cue word; matching `[Fill ^1]` section header
- Section notes in the bracket title: `[Intro - spoken, follow along]`
- Amp: `[Amp: 4Amber]` section lines (same as band)
- Bare `0`–`24` = A-string fret chips (The Middle); never enable frets on band lyrics sheets
- Chip hints (`Am{Hold}`) — reserved; add when a song needs them
- App copy: no em-dashes

## Step 4 — Ship

```bash
npm run validate
# commit ryan sheet (+ any amp/docs) then bare git push on dev
```

Point at `/MartinOverdrive/dev/` → song → Ryan tab (flag on). Hard-refresh if the SW looks stale.

## Out of scope

- Batch-creating Ryan sheets for every setlist song in one turn
- Changing band `.chords.txt` / cheat cards unless asked
- Loading amp hardware (tell the user to run the mustang loader when a `.fuse` changed)
