# Ryan sheet syntax (settled during Tribute polish, 2026-07-22)

Parsed only when `parseChordSheet(text, { frets: true })` — Ryan render sites only.

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
- Polished defaults live in `src/data/scrollSpeeds.json` (practice override wins when set;
  tap the acid px/s readout to clear an override and restore the seed)
- While autoscroll is playing (incl. lead-in), show mode adds `show-mode--crawling` and
  collapses artist / view tabs+Pin / stage strip / Up next / zoom-reset (short max-height
  fade). Home-fret scale chips sit in `.show-sheet-tools` next to AutoScrollBar on sheet
  views so they stay visible. Dial scrollSpeed with chrome collapsed so the viewport
  matches gig use.

## Amp slot retunes

Before retuning a shared slot (e.g. 4Amber), grep sheets + `amp-presets.json` for other users. Tribute-only → safe to retune in `amp-presets/generate_presets.py` and regen `.fuse`. Tell the user to reload the amp.
