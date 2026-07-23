---
name: polish-ryan-sheet
description: >-
  Walk Martin Overdrive songs one-by-one and polish personal Ryan sheets (.ryan.txt)
  for show use: sections, lyrics order, numbered fill cues, amp chips, trim stage noise,
  dial autoscroll. Chord/lyric body must stay Ultimate Guitar mid-word-split format
  (never "clean" into space-aligned chord-over-lyric lines). Supports bulk draft of
  remaining songs (drafted ≠ locked). Use when the user says "polish ryan", "ryan pass",
  "next ryan sheet", "ryan polish for <song>", "bulk ryan", or wants to finalize
  .ryan.txt sheets like Tribute.
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

**UG spine gate (fail ship):** before validate/commit, spot-check that chorded lyric
stretches still mid-split like the band sheet. If you “tidied” wording or joined
splits into space-aligned rows, undo and re-layer. Prefer a quick diff of lyric
fragments vs `.chords.txt` over trusting memory.

Authority order when they conflict:

1. **User + recording** (what they play / follow along to)
2. Band `src/data/sheets/<id>.chords.txt` for lyric/section **spine** (UG format included)
3. Existing `.ryan.txt` (personal chord/tab choices win over band when intentional —
   still keep UG line structure)

## Modes

| Mode | When | Ships as |
|---|---|---|
| **Polish** (default) | One song, ear-check / fix / dial | May reach **locked** `[x]` after user confirms crawl |
| **Bulk draft** | “bulk ryan”, “draft remaining”, fan-out | **drafted** only — never `[x]` without device pass |

### Always ship to `/dev/` (standing rule — 2026-07-22)

Every applied change (new/edited `.ryan.txt`, scroll seed, amp notes, progress check-off)
**must** end with validate → commit → bare `git push` on `dev`. Do **not** wait for
"push to dev" / "ship it" / permission to push. On-device review at `/MartinOverdrive/dev/`
is how polish happens; leaving work only local is a miss. Stay on `dev` (or checkout
`dev` first). Never ask whether to push.

Resume from [progress.md](progress.md). Prefer songs that already have a `.ryan.txt`, then
setlist order for new ones. Ryan tab only appears when `settings.ryanTab` is on (7 taps on
Settings → Developer).

### Triggers

| User says | Do |
|---|---|
| "ryan pass" / "polish ryan" / "start ryan polish" | Open progress; start at first unchecked (or ask) |
| "next" / "next ryan sheet" | Next unchecked after the last done |
| Song title / id | That song only |
| "bulk ryan" / "draft remaining" / "bulk draft" | **Bulk draft** mode (below) |
| Specific fix ("move fill 3 to beast") | Apply immediately → validate → commit → push (no ask) |
| "for review" / "ship it" / "ok" / "lgtm" / "push to dev" | Accept pending proposal → apply → validate → commit → push (push is always implied) |
| "lock this in" / "locked" / "perfect" (after dial + content) | Check off in progress.md; commit seed + notes; push; offer next song |

## Bulk draft mode (learned 2026-07-22 after multi-song polish)

Goal: get a usable Ryan tab on `/dev/` for every remaining song **without** pretending
the sheet is stage-locked. Cap concurrent subagents at ~5 (fleet spend gotcha).

Per song:

1. **Role card** (from user, practice notes, or one-line guess — state it in the commit note):
   - Cut: studio / single / live
   - Role: sit-out intro? fills? chords-while-singing? power/`*5`?
   - End: hard stop / fade / outro collapse
2. Copy band `.chords.txt` body → Ryan layers only (amp, sections, obvious sit-outs,
   strip stage noise). Do **not** invent fill cue words or between-line riff maps
   without tab/recording evidence.
3. UG spine gate → row-based scroll **estimate** via helper (`note` starts with `Estimate`)
4. `npm run validate` → commit → bare `git push`
5. Mark progress as **drafted** (not `[x]`). Offer a device pass list when the wave ends.

**Bulk must not:** lock progress, invent `^N` cue words, collapse ×N before form is
verified, invent cleaned lyric spines, retune shared amp slots, or invent new chip types.

**Safe to auto-draft vs human-gated:** see [reference.md](reference.md) § Bulk draft
boundaries.

## Second-half lessons (audit 2026-07-23)

Half the set is locked or good-enough; the rest is mostly **history-pass drafted**. What
bit us and what to do differently:

| Lesson | Do this |
|---|---|
| Non-empty scroll math runs ~2× fast on dense UG sheets | Use **rows** + `estimate-scroll.mjs`; soft-cap ≤12 |
| Bulk/history scroll seeds are often wrong | Re-estimate on every polish pass before dial |
| Lead-in ≠ "song has an intro" | Longer lead-in only when the **sheet** is sparse at top |
| Role card drives everything | Ask/state cut · role · end before editing |
| Device dial is one checkpoint, not end-of-sheet math | Landmark lyric + upper-middle; expect one slow-down |
| Thin sheets (Purple Rain, Ain't Goin' Down, The Middle) | Expand content before trusting any seed |
| Skip "good enough" (04–06) unless asked | Continue setlist order at first real unchecked polish target |

## One song per polish turn

For polish (non-bulk), do **not** batch-edit the whole setlist. For each song:

1. Load context → propose deltas → wait for confirm (unless they already stated the fix)
2. Apply → re-estimate scroll with the helper → `npm run validate` → **commit + bare
   `git push` to `dev`** in the same turn
3. Mark progress → point them at live `/MartinOverdrive/dev/` Ryan tab → offer the **next**
   unchecked song

## Step 1 — Load

For song id `NN-slug`:

1. Ryan sheet if present: `src/data/sheets/<id>.ryan.txt` (else **copy band `.chords.txt` body
   as the starting spine** — do not invent a cleaned lyric layout)
2. Band lyrics: `src/data/sheets/<id>.chords.txt` (source of truth for UG splits / blanks)
3. Amp mapping: `src/data/amp-presets.json` + any mid-song `[Amp:]` in the sheets
4. Title/tuning from `src/data/setlist.json` if needed
5. Practice notes for that song in `practice-notes-worksheet.md` (fill research links, amp TODOs)
6. Existing scroll seed if any: `src/data/scrollSpeeds.json`
7. **Role card** (cut / role / end) — ask if unclear; ALLC-style “lead vocal, no fills,
   hard stop” changes the whole draft

If an existing `.ryan.txt` already has space-aligned chord rows or full-word lyrics where
the band sheet mid-splits, treat that as a bug: restore the band spine, re-apply Ryan layers.

Show a short **before** block:

```
Song: Tribute (07-tribute)
Ryan: yes · Sections: Intro, Fill^1, Fill^2, Fill^3, ROCK…
Amp: 4Amber → 5Amber
Fills: ^1 long · ^2 looked · ^3 men
Scroll: 10 px/s · leadInSec 11.6
Role: fills until ROCK, then chords
```

## Step 2 — Checklist

| Check | Typical fix |
|---|---|
| Missing Intro / follow-along sections | Add `[Intro - spoken, follow along]` (or similar) even if not playing |
| Lyrics incomplete or wrong order | Diff against band `.chords.txt` + recording; keep Ryan chord/tab *choices* |
| **UG spine intact** (mandatory) | Band mid-word splits and blank-line row breaks still present. **Never** “tidy” into space-aligned `Em          C` / full-word lyric lines. New sheets = band body + Ryan layers only (reference § Sheet format) |
| One-off fills not marked | Numbered cues: `^N` on its own line before the lyric fragment + `[Fill ^N]` on the FILL line (see [reference.md](reference.md)) — same UG line rules as chords. **Propose cue words; user ear-checks before lock.** Do not invent fills when role is chords-while-singing |
| Chord chips where only fills are played | Strip chord tokens in that stretch (Tribute: no chords before ROCK) |
| Vocal-only bar over a vamp / before a solo | Ghost chips: same chord names with `~` prefix (`~Am ~G ~D ~F`) so the beat is visible but don't play |
| **Between-line riffs** | If tab/recording puts hits in the **gaps** between lyric lines, write chord-only rows *between* lines — do not glue those chips onto syllables. Label the section (`[Pre - B5 A5 E5 A5 between lines]`). On-vocal sections stay on syllables. Same song can use both (Thunderstruck) |
| **Ringing / hold sections** | One chip + hold; strip other chips; lyrics stay. Prefer ringing hold over inventing muted chug when the user says “just ring” |
| **Section variants** | Early vs late occurrence of the “same” section can differ (ATS: early pre = ringing C5; post-interlude / last pre = full C-G-F-C). Duplicate headers with different instructions — don’t apply one treatment song-wide |
| **Instrumental / prepare gaps** | Time with no lyrics still needs rows (chords, ghosts, or one ×N cycle) or scroll lies. Ghost prepare before a learned riff; write the riff once + ×N (ATS interlude) |
| **Collapse ×N last** | Research form/order/count first; only then collapse pasted repeats to one cycle + header `xN` / `×N`. Collapsing wrong form multiplies pain |
| Amp chips wrong for what is actually played | Update `[Amp:]` + `amp-presets.json` notes; retune a slot in `amp-presets/generate_presets.py` only when nothing else needs the old tone |
| Stage noise (chords-used lists, full stitched Songsterr dumps) | Cut — kills set-and-forget autoscroll; full tab stays on Tabs. Incomplete “tab glances” that omit bars of a repeating riff are worse than no glance — write the full cycle once + ×N |
| **Hard stop / cut** | When role is single / hard stop, trim remix/fade tails and second bridges |
| Autoscroll | After content is stable, dial on `/dev/` **with chrome collapsed**, then commit to `src/data/scrollSpeeds.json` (see Dial-in). **Re-estimate/re-dial after every add/remove of rows** (ghost bars, fills, instrumental gaps, ×N collapse) |
| Default show zoom | Ryan opens at **0.75×** (min **0.6×**); don't fight that in the sheet |

**Ask** when band lyrics and recording disagree, when a fill cue word is uncertain
(propose + ear-check), when between-line vs on-vocal mapping is unclear, or when
ringing vs full section treatment is unknown.

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

**Estimating a starting seed (before device dial):** run the helper — do **not** hand-count
non-empty lines (that recipe shipped Dani at 17 and Dirtbag at 22; device locked ~half):

```bash
node .claude/skills/polish-ryan-sheet/scripts/estimate-scroll.mjs <songId> M:SS
# long sit-out: add --lead=SEC --sit-out
```

Full recipe + lead-in tree + peer anchors in [reference.md](reference.md) § Scroll seed
estimate. Short version:

1. **Metric** — blank-separated **rows** (not non-empty lines). Tribute ≈ **66** rows,
   `H_t ≈ 2964`. UG splits inflate line counts without inflating height.
2. **speed** — `round((H − V) / (studioSec − leadInSec))`, clamp 6–120. Soft-cap first
   seeds at **12** for studio ≥ 3:00 (locked chord sheets cluster 8–11). Prefer slightly
   slow — device feedback was almost always "too fast".
3. **leadInSec** — formula `96 / speed` unless the sheet top is sparse while music plays
   (sit-out → time to first *played* chips). Do **not** lengthen lead-in just because the
   recording has an intro if those chips are already on the sheet.
4. **Peer** — match a locked role peer when possible (Tribute / ATS / Dani / Welcome Home);
   see reference table.
5. **Landmark** — name a lyric ~¼–⅓ down the sheet in the ship note so device dial has a
   checkpoint (Dani: "Black bandana").
6. **History-pass / bulk seeds** that mention "non-empty" are untrusted — **re-estimate on
   polish** before asking the user to dial.
7. **Device correction** — if a mid-verse line is already past, first cut is ~half speed
   (17→9, 22→11), then −/+. Write `note: "Estimate …"` until the user locks.

Chrome while crawling (product, already wired in `Show`): keep × exit, compact title,
‹ n/N ›, Live chip, AutoScrollBar, home-fret scale chips (sheet views park them to the
right of the scroll controls so collapse does not hide them); hide artist eyebrow, view
bar + Pin, stage strip, Up next, zoom-reset. Crawl end pins to the true bottom after chrome
re-expands (collapsed max ≠ expanded max). Practice SheetPanel does not collapse yet.

## Step 3 — Settled Ryan syntax

Read [reference.md](reference.md) **before writing sheet text** (especially § Sheet format
and § Stage patterns). Short version:

- **UG mid-word-split format only** (band `.chords.txt` / Tribute ROCK) — never space-padded chord-over-lyric rewrites
- Parse with `frets: true` (fret chips + cues + ghosts)
- Fill cues: `^1` … `^99` on their own line before the lyric fragment; matching `[Fill ^1]` section header
- Section notes in the bracket title: `[Intro - spoken, follow along]`
- Amp: `[Amp: 4Amber]` section lines (same as band)
- Ghost / don't-play chips: prefix `~` (`~Am ~G ~D ~F`) — dashed strikethrough chip, keep the beat (same marker as cheat-card progressions)
- Bare `0`–`24` = A-string fret chips (The Middle); never enable frets on band lyrics sheets
- Power-chord Ryan songs: write `C5`/`G5`/… ; Ryan views pass `powerFingerings` so `*5`
  chips show horizontal 4-string EADG fingering always (see reference § Power-fingering chips)
- Between-line riffs, ringing holds, prepare-ghosts + ×N, hard-stop cuts — see reference § Stage patterns
- Cue triangles sit at the **top** of the above-slot (`align-items: flex-start`); never change `--chip-pull` to "fix" overlap (that moves lyric text)
- **New above-lyrics chip types:** follow reference § "New above-lyrics chip types" (fixed
  slot height, flex-start, kill `.chord-chip-wrap` line-height strut) — same bugs as fill
  cues and power chips, twice. Do not invent a new chip type in bulk draft
- Chip hints (`Am{Hold}`) — reserved; add when a song needs them
- App copy: no em-dashes

## Step 4 — Ship

Before validate: spot-check that chorded lyric stretches still mid-split like the band sheet
(if you “cleaned” wording for readability, undo that and re-layer).

```bash
npm run validate
# commit ryan sheet (+ scrollSpeeds.json / amp / docs / skill edits)
# then ALWAYS bare git push on dev — never stop after commit, never ask
git push
```

Point at `/MartinOverdrive/dev/` → song → Ryan tab (flag on). Hard-refresh if the SW looks stale.
When locking in: update [progress.md](progress.md), commit + push, then offer the next
unchecked song (prefer existing `.ryan.txt`, else setlist order).

## Out of scope / anti-patterns

- Batch-**locking** the whole setlist (bulk draft is fine; `[x]` without device pass is not)
- Changing band `.chords.txt` / cheat cards unless asked
- Loading amp hardware (tell the user to run the mustang loader when a `.fuse` changed)
- Stopping after a local commit without `git push` (or asking the user whether to push)
- **Rewriting lyrics into “pretty” full lines with space-aligned chords** — breaks
  `parseChordSheet` (Welcome Home regression 2026-07-22); always band spine + Ryan layers
- Gluing gap riffs onto lyric syllables (Thunderstruck) — use between-line chord rows
- One treatment for every occurrence of a section (ATS ringing vs full pre)
- Collapsing repeats to ×N before confirming form order/count
- Truncated tab glances that omit bars of a repeating riff
- Shipping a scroll seed without re-estimating after structural edits
- Estimating scroll from **non-empty line** ratios (Dani/Dirtbag regression) — use blank-separated rows / the helper
- Lengthening `leadInSec` for a studio intro when those chips are already written on the sheet
- Trusting history-pass / bulk `scrollSpeeds.json` Estimates without re-running the helper on polish
- Inventing `^N` fills when the role is chords-while-singing / no fills
