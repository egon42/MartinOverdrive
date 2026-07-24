# Ryan sheet syntax (settled during Tribute polish, 2026-07-22)

Parsed only when `parseChordSheet(text, { frets: true })` — Ryan render sites only.
(`~` ghost chips also parse with `frets: false`, same as band sheets, but prefer them on Ryan.)

## Sheet format (do not "clean") — standing rule

**Standing agent rule:** never “improve readability” of chorded lyrics by joining mid-word
splits or padding spaces on a chord line. File prettiness ≠ on-screen alignment.

`parseChordSheet` (`src/chords.ts`) is **Ultimate Guitar paste style**, not classic
space-padded chord-over-lyric:

- Each chord is its **own line**, splitting the lyric it lands on
- **Blank lines** end a rendered lyric row
- Chord column spaces on a shared chord line are **ignored** (`Em          C` ≡ `Em C`)

```
Em
   You could've b
C
een all I wanted
```

→ chip Em over `You could've b`, chip C over `een…` (reads as "been"). Mid-word splits are
intentional alignment, not typos.

**Wrong** (looks tidy in the file, breaks on screen — Welcome Home Ryan 2026-07-22):

```
Em          C
You could've been all I wanted
```

→ parser emits orphan `[Em][C]` then one text part for the whole lyric → chips misaligned,
and hard-wrapped full-word fragments can lose/gain spaces when lines join.

**Workflow for every new/edited Ryan sheet:**

1. Copy band `src/data/sheets/<id>.chords.txt` chord/lyric body as the spine
2. Add only Ryan layers: `[Section]` / `[Amp:]`, sit-out intros, `^N` / `[Fill ^N]`, `~`
   ghosts, outro repeats, trim stage noise
3. If chord *names* change (user plays different shapes), keep the same split points /
   blank lines unless the user relocates a chord to a different syllable

Tribute’s ROCK block (`07-tribute.ryan.txt`) is the canonical chorded example — match that
shape, not a cleaned rewrite. Spoken/fill-only stretches may omit chords; when chords
return, they return in UG split form.

**Measure map (retap Ryan, 2026-07-24):** same `.ryan.txt` file. Retapping the Ryan tab
toggles equal-width play-along columns (`layout: 'measure'` via `measureSlots`) — chip at
bar start, lyric left under it; soft column rules; max 4 slots/row (phone wraps to 2).
Blank-line row breaks still define how many chords share a system. No second file format;
do not “prettify” the source to look measure-aligned.

## Fill cues

| In the `.ryan.txt` | Renders as |
|---|---|
| `^N` on its own chord line above a lyric split | Acid **triangle chip** with number N above the following word |
| `[Fill ^N]` section header | `FILL` label + matching triangle on the same line |

Example:

```
We was hitchhikin' down a 
^1
long and lonesome road.

[Fill ^1]
E-|-------|...
```

- Cue lines force the above-lyrics column layout for that line even if Settings prefer inline chords.
- Triangle sits at the **top** of the chord slot (`align-items: flex-start`) so it clears the lyric; do not change `--chip-pull` for cues (that moves the text).
- Numbers are 1–99.

## Ghost / don't-play chips

Prefix `~` (same as cheat-card progressions):

```
~Am

~G

~D

~F

Am

G

D

F
```

Renders dashed strikethrough chips ("don't play; keep the beat") then the normal played bar.
Use for a vocal-only measure that sits on the same vamp as the following solo/comping.

## Sections & amp

- `[Intro - spoken, follow along]` — follow-along even when not playing
- `[Amp: 4Amber]` / `[Amp: 5Amber]` — same amp-chip parsing as band sheets
- Mid-song amp changes stay as section markers

## Frets

Bare `0`–`24` on a chord line → bordered fret chip (A-string cues). Band lyrics sheets must **not** pass `frets: true` (Mary Jane's "18" stays lyric text).

## Power-fingering chips (Ryan)

Ryan render sites pass `powerFingerings` into `ChordSheetView`. For `*5` tokens (`C5`,
`G5`, `F5`, …) chips always show the **4-string** fingering horizontally (low E–A–D–G
left→right, e.g. C5 → `×355`) in the normal chord slot — no Shapes retap. Mute strings
use `×` in the **same color** as the frets (not grey). Above-slot alignment: see
**New above-lyrics chip types** below. Tap still opens the diagram. Write power-chord
Ryan songs as `C5`/`G5`/… so the shape generator hits quality `5`. Non-`*5` tokens on
Ryan stay name chips (Tribute, Welcome Home, etc.).

## New above-lyrics chip types (do not re-learn)

Fill cues (2026-07) and power chips (2026-07-22) both looked "too low" and shoved
lyrics. The fix lives in `src/styles.css` next to `.sheet-above-chord` — follow it for
every new chip kind:

1. **Fixed slot height** — `.sheet-above-chord { height: 1.35em }` stays fixed. Never
   `height: auto` to fit a taller chip (that pushes the lyric row down).
2. **Do not touch `--chip-pull`** to raise a chip — it shifts every lyric baseline.
3. **Name chips** stay `align-items: flex-end` (tucked to the lyric).
4. **Custom / tall chips** (cues, power, A-string frets, …): set
   `.sheet-above-col:has(.chord-chip--YOURTYPE) .sheet-above-chord { align-items: flex-start }`
   so overflow grows up into the pull gap.
5. **Kill the wrap strut** if the chip is inside `.chord-chip-wrap` (most are; cues are
   the exception — they return a bare `<b>`). Inherited sheet `line-height` makes the
   wrap taller than the chip and `vertical-align: middle` parks it mid-slot:
   ```css
   .sheet-above-chord .chord-chip-wrap:has(.chord-chip--YOURTYPE) {
     display: flex; align-items: flex-start; line-height: 0;
   }
   ```
6. Match above-mode **box metrics** to name chips where possible
   (`font-size: .7em; padding: .09em .5em; line-height: 1.2`) so the row rhythm
   matches.

## Trim rules (stage)

- Drop "Chords used" appendices and full Songsterr stitch dumps from Ryan sheets
- Keep only fills you glance at on stage; full tab lives on the Tabs tab
- If a stretch is fills-only, strip chord chips there (lyrics stay as plain follow-along)

## Show-mode defaults

- Ryan pinch zoom starts at **0.75×** (`useZoom` initialZoom; min **0.6×**); Reset restores 0.75×
- Autoscroll advances at `scrollSpeed * zoom` (1×-normalized dial)
- Polished defaults live in `src/data/scrollSpeeds.json` (`speed`, optional `leadInSec`;
  practice override wins when set; tap the acid px/s readout to clear an override)
- Dial with chrome collapsed; aim upper-middle on the section being played. Home-fret chips
  sit beside AutoScrollBar so they survive collapse. Crawl-end pins to true bottom after
  chrome re-expands.

## Scroll seed estimate (Tribute-calibrated — revised 2026-07-23)

Do **not** re-measure CSS line heights each song. Ratio against locked Tribute, then soft-cap
and device-dial. **Run the helper** instead of hand math when possible:

```bash
node .claude/skills/polish-ryan-sheet/scripts/estimate-scroll.mjs <songId> M:SS
node .claude/skills/polish-ryan-sheet/scripts/estimate-scroll.mjs 01-welcome-home 6:15 --lead=48 --sit-out
```

### Why the old recipe failed (half-set audit)

First-half device corrections were almost always **"crawl too fast"** — never too slow:

| Song | Non-empty formula | Locked / dialed | Miss |
|---|---|---|---|
| Dani California | **17** | **9** | ×1.9 too fast |
| Teenage Dirtbag | **22** | **11** | ×2 too fast |
| Here It Goes Again (history) | **24** | (re-estimate ~12–16) | bulk garbage |

**Root cause:** non-empty *line* count ≠ rendered height. UG mid-word splits create many
short lines per blank-separated **row**. Dani has ~1.8× Tribute non-empty lines but almost
the **same** scroll height (~64 vs 66 blank-separated rows). Counting lines doubles speed.

### Metric (use this)

Count **blank-separated rows** (a non-empty run ended by a blank line = one rendered row).
Tribute locked ≈ **66 rows**, `H_t ≈ 2964px`.

| Symbol | Meaning |
|---|---|
| `speed`, `leadInSec` | Values in `scrollSpeeds.json` (1×-normalized px/s) |
| `studioSec` | Studio / single cut length in seconds (hard-stop songs: the cut you play) |
| `V` | Collapsed show-mode viewport ≈ **600px** |
| `rows` | Blank-separated row groups in the `.ryan.txt` |
| `H` | `H_t × (rows_new / 66)` |

**Tribute anchor (locked):** `speed=10`, `leadInSec=11.6`, `studioSec=248` (4:08).

```
crawlSec_t  = 248 - 11.6                    ≈ 236.4
scrollDist_t = 10 * crawlSec_t              ≈ 2364px
H_t         = scrollDist_t + V              ≈ 2964px
Tribute rows ≈ 66
```

**New song:**

```
H         = 2964 * (rows_new / 66)
leadInSec = 96 / speedGuess   # then override — see lead-in tree below
speed     = round( (H - V) / (studioSec - leadInSec) )
speed     = clamp(speed, 6, 120)

# Soft prior (2026-07-23): locked chord-while-singing seeds cluster ~6–11.
# If studio ≥ 3:00 and not a long-sit-out song, cap the first seed at 12
# (and if raw > 12, try round(raw * 0.7) first). Prefer slightly slow.
```

### Lead-in decision tree

| Situation | `leadInSec` |
|---|---|
| Sheet chips start with the track (verse/power right away) | Formula `96 / speed` only |
| Recording has an intro **and the sheet already writes those chips** | Formula only — do **not** add sit-out lead-in (Dani mistake: lead 18 for studio intro while Intro×2 was on the sheet) |
| Long sit-out: music plays while sheet top is sparse / follow-along only, first *played* chips enter later | Time until first played entrance (Welcome Home **48**, Thunderstruck **50**, Pride **24.6**) |
| Sparse→dense (spoken/fill intro → dense ROCK) | Formula + a couple seconds (Tribute **11.6** ≈ `96/10 + 2`) |

### Peer anchors (prefer a role match over Tribute alone)

| Role shape | Locked peer | Seed |
|---|---|---|
| Fills then chords / sparse→dense | Tribute | 10 + 11.6 |
| Power `*5`, compact form | ATS | 11 + 8 |
| Chords while singing, even density | Dani / Hunger Strike | 9+6 / 10+12 |
| Long sit-out then play | Welcome Home | 6 + 48 |
| Ghost-heavy / sit-under | SOB | 10 + 18 |
| Short hard-stop single | ALLC | 14 + 10 |

Typical locked band for ~3–5 min chord sheets: **8–11**. Treat first seeds **≥14** on those lengths as suspicious until device-proven (ALLC is the short-song exception).

### Density / landmark check

End-align math fails when the sheet is sparse early and dense late (or the reverse). Bias
so the **first played section** sits upper-middle when crawl begins.

Before shipping an Estimate, pick a **landmark lyric ~¼–⅓ into the sheet** (e.g. Dani
"Black bandana"). Mentally: if end-aligned speed would already have scrolled past that
line when the vocal hits, **slow the seed** before the user has to.

### Device correction (when they say a line is already past)

```
newSpeed ≈ round(oldSpeed * 0.5 … 0.6)   # first correction when mid-verse is gone
```

Dani 17→9 and Dirtbag 22→11 were both ~half. Nudge with −/+ after that; don't keep
re-running the broken non-empty formula.

### Seed note template

`Estimate YYYY-MM-DD. Studio M:SS; R× Tribute rows (N). speed≈N. leadInSec=S because …. Dial on device.`

Worked examples:

- **Welcome Home:** studio 6:15, rows ~47 → raw low → **6** + lead-in **48** (sit-out).
- **Dani (row recipe):** studio 4:42, rows ~64 ≈ 1.0× Tribute → raw ~8–9 → locked **9** + **6**.
  Non-empty recipe wrongly said 17.

Zoom (0.75×) cancels in the ratio (scrollHeight and crawl rate both scale).

### Re-estimate triggers

Re-run the helper (or device-dial) after: adding/removing ghost bars, fills, instrumental
gaps, ×N collapse, intro cycles, or any edit that changes blank-separated row count.
**History-pass / bulk seeds that cite "non-empty" lines are untrusted** — re-estimate on
polish before asking the user to dial.

## Amp slot retunes

Before retuning a shared slot (e.g. 4Amber), grep sheets + `amp-presets.json` for other users. Tribute-only → safe to retune in `amp-presets/generate_presets.py` and regen `.fuse`. Tell the user to reload the amp.

## Stage patterns (learned 2026-07-22 multi-song polish)

Canonical shapes. Copy the *structure*; do not invent chord names without band/tab/user.

### 1. Between-line riffs (Thunderstruck pre / la-la)

Hits live in the **gap** between lyric lines — not on syllables:

```
[Pre-Chorus - B5 A5 E5 A5 between lines]
Sound of the drums

B5

A5

E5

A5
beatin' in my heart
```

On-vocal sections in the same song keep chips on the lyric splits (`[Chorus - … on vocal]`).
Never force one chip per syllable when the recording puts the cycle in the gaps.

### 2. Ringing hold vs full cycle (All the Small Things pre)

Early occurrence = one ringing chip; later occurrence = full progression:

```
[Pre-Chorus - ringing C5]
C5
Late night, come home work

…

[Pre-Chorus - full C G F C]
C5
…
G5
…
F5
…
C5
…
```

Same section *name*, different instructions — do not apply one treatment song-wide.

### 3. Prepare ghosts + ×N riff (ATS interlude)

Ghost the prepare strums, write the learned cycle once, collapse with ×N **after** the
count is verified:

```
~C5

~F5

~G5

~G5

[Interlude - muted octaves (C C C B) x3]
C5
…
C5
…
C5
…
B5
…
```

Incomplete “tab glances” that omit bars of the repeating riff are worse than no glance.

### 4. SOLO/OUTRO single-cycle collapse (Welcome Home)

When post-bridge is the same vamp forever, one written cycle + section note beats
pasting the form dump:

```
[SOLO/OUTRO - Em C D Em; Oh cue]
Em
…
C
…
D
…
Em
…
```

Re-estimate scroll after collapsing (row count drops).

### 5. Hard-stop single / lead vocal (A Little Less Conversation)

Role card: lead vocal, chords while singing, **no fills**, hard stop on the single cut.
Trim remix/fade tails and second bridges. Do not invent `^N`. Vocal entrance notes belong
in section headers (`[Intro - vamp, vocal after 3]`).

## Bulk draft boundaries

| Safe to bulk-auto (drafted) | Human-gated before lock |
|---|---|
| Copy band `.chords.txt` UG body verbatim | Sit-out vs join timing |
| Add `[Amp:]` from `amp-presets.json` | Between-line vs on-vocal mapping |
| Strip Chords-used / Songsterr stitch dumps | Ring vs full section variants |
| Convert obvious `*5` songs to power tokens | ×N counts without ear/tab proof |
| Draft sit-out intro headers (unplayed) | Fill cue **words** |
| Row-based scroll **estimate** via helper (not non-empty lines) | Final scroll lock on device |
| Ghost `~` only when notes say don’t-play | Hard-stop / ending form |
| Mark progress **drafted** (not `[x]`) | Shared amp slot retunes |
| Mechanical UG-spine gate | Any new above-lyrics chip type |

## Tribute reference (locked 2026-07-22)

- Fills ^1/^2/^3 on long / looked / men; no chord chips before ROCK
- Ghost `~Am ~G ~D ~F` then played Am G D F before "And the peculiar…"
- Amp 4Amber (ETHEREAL) → 5Amber; scroll seed `10` + `leadInSec: 11.6`
