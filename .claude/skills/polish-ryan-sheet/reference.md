# Ryan sheet syntax (settled during Tribute polish, 2026-07-22)

Parsed only when `parseChordSheet(text, { frets: true })` — Ryan render sites only.
(`~` ghost chips also parse with `frets: false`, same as band sheets, but prefer them on Ryan.)

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

## Amp slot retunes

Before retuning a shared slot (e.g. 4Amber), grep sheets + `amp-presets.json` for other users. Tribute-only → safe to retune in `amp-presets/generate_presets.py` and regen `.fuse`. Tell the user to reload the amp.

## Tribute reference (locked 2026-07-22)

- Fills ^1/^2/^3 on long / looked / men; no chord chips before ROCK
- Ghost `~Am ~G ~D ~F` then played Am G D F before "And the peculiar…"
- Amp 4Amber (ETHEREAL) → 5Amber; scroll seed `10` + `leadInSec: 11.6`
