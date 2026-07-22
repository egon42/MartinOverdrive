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
`G5`, `F5`, …) chips always show the **4-string** fingering (low E–A–D–G only, high
string on top among those four) in the normal chord slot — no Shapes retap. Tap still
opens the diagram. Write power-chord Ryan songs as `C5`/`G5`/… so the shape generator
hits quality `5` (`-355--`, `355---`, `133---`, …). Non-`*5` tokens on Ryan stay name
chips (Tribute, Welcome Home, etc.).

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

## Scroll seed estimate (Tribute-calibrated, 2026-07-22)

Do **not** re-measure CSS line heights each song. Ratio against locked Tribute, then clamp
and device-dial.

| Symbol | Meaning |
|---|---|
| `speed`, `leadInSec` | Values in `scrollSpeeds.json` (1×-normalized px/s) |
| `studioSec` | Studio cut length in seconds |
| `V` | Collapsed show-mode viewport ≈ **600px** (good enough for seeds) |
| `H` | Approximate Ryan sheet scroll height |

**Tribute anchor (locked):** `speed=10`, `leadInSec=11.6`, `studioSec=248` (4:08).

```
crawlSec_t  = 248 - 11.6                    ≈ 236.4
scrollDist_t = 10 * crawlSec_t              ≈ 2364px
H_t         = scrollDist_t + V              ≈ 2964px
```

**New song:**

```
# Prefer non-empty line counts of the .ryan.txt files
H       = H_t * (nonEmpty_new / nonEmpty_tribute)

# lead-in: formula first, then override if sit-out is long
leadInSec ≈ 96 / speedGuess   # or longer — see below
speed     = round( (H - V) / (studioSec - leadInSec) )
speed     = clamp(speed, 6, 120)   # validate-song-data.mjs SCROLL_MIN/MAX
```

**When to lengthen `leadInSec`:** first *played* chips come after a long instrumental /
spoken sit-out while the sheet is still nearly empty at the top (Welcome Home sit-out
riff → ringing Em: **48s**). Formula `96/speed` alone will start crawling too early and
leave the played entrance low on screen.

**Density caveat:** end-align math fails when the sheet is sparse early and dense late
(or the reverse). Bias the seed so the **first played section** sits upper-middle when
crawl begins; fix the rest on device with −/+.

**Seed note template:**
`Estimate YYYY-MM-DD. Studio M:SS; ~R× Tribute non-empty lines. speed≈N (clamped?). leadInSec=S because …. Dial on device.`

Worked example — **01-welcome-home** (pre-dial): studio 6:15 (375s), ~0.78× Tribute
non-empty → raw speed ≈5 → stored **6** + `leadInSec` **48**.

Zoom (0.75×) cancels in the ratio (scrollHeight and crawl rate both scale), so line-count
ratios at 1× are enough for the first seed.

## Amp slot retunes

Before retuning a shared slot (e.g. 4Amber), grep sheets + `amp-presets.json` for other users. Tribute-only → safe to retune in `amp-presets/generate_presets.py` and regen `.fuse`. Tell the user to reload the amp.

## Tribute reference (locked 2026-07-22)

- Fills ^1/^2/^3 on long / looked / men; no chord chips before ROCK
- Ghost `~Am ~G ~D ~F` then played Am G D F before "And the peculiar…"
- Amp 4Amber (ETHEREAL) → 5Amber; scroll seed `10` + `leadInSec: 11.6`
