---
name: import-song-sheet
description: Add or update a song's in-app tabs/chords for Martin Overdrive. Use when the user provides chord text, asks to import a tab from Songsterr, hands over source material (files in TabsAndChords/, pasted text, print exports), or asks to batch-import sheets for setlist songs.
---

# Import a song's tabs/chords into the app

Sheets are curated **text files** under `src/data/sheets/`, glob-loaded by `src/sheets.ts`
(dev-branch feature — work on `dev`):

- `<songId>.chords.txt` — UG-style chord/lyric text, parsed by `src/chords.ts` into
  inline chord chips. Inline-format pastes (chord names on their own lines splitting
  lyrics mid-word, blank lines as delimiters) keep exact chord positions.
- `<songId>.tabs.txt` — ASCII tab, rendered verbatim in monospace.

Song ids match `src/data/setlist.json` (e.g. `01-welcome-home`). Both practice (song
page) and show mode pick the files up automatically — no registration step. Never add
a paste UI or images; text only (deliberate: editable + diff-able).

## Chords from Songsterr (preferred when available)

```bash
node scripts/import-songsterr-chords.mjs "<songsterr chords-page URL, e.g. …-chords-sNNNNN>" <songId>
```

Songsterr's chords page embeds the full chord data as JSON in the HTML (no auth, no
CDN lookup needed — just the page fetch). The script converts Songsterr's inline
chord positions into this app's own-line format (see below) automatically. If a song
has no chords page data, the script errors clearly instead of writing a bad file —
fall back to pasted text, or leave chords out for that song (see "Fallback" below).

## Chords from pasted text (fallback / no Songsterr chords)

Save the text verbatim as `src/data/sheets/<songId>.chords.txt`. Trailing spaces
mid-line are meaningful ("But ␣" before a chord line) — do not strip or reflow.
Sanity-check the parse if unsure: the format's rules live in `src/chords.ts`
(chord-token lines, `[Section]` headers, tab-ish lines, tuning/capo meta). The format
is **chord name on its own line, splitting the lyric it lands on** (not inline `[D]`
brackets):

```
Em
   You could've b
C
een all I wanted
```

## Fallback when no chords exist at all

If neither a Songsterr chords page nor pasted chord text is available, don't invent
chords from tab data — the tab's fret/string data carries no chord-name info, and
deriving names from frets is fragile. Leave `.chords.txt` absent for that song; the
app's chords/tabs switch (practice panel and show mode) simply shows whichever sheet
exists, so users fall back to the tabs view.

## Mid-song amp-setting changes

To mark an amp preset switch partway through a song (e.g. clean verse → overdriven
chorus), add a section-style marker matching the amp preset label shown elsewhere in
the app (position + bank, e.g. `7Red`, `2Green`):

```
[Amp: 7Red]
```

In chords, this is just a section line (`^\[.+\]$`, same rule `src/chords.ts` already
parses) whose text starts with `Amp:` — the app renders it as the same colored preset
chip used on the song/practice pages, not plain text. Multiple presets in one marker
are space-separated: `[Amp: 7Red 2Green]`.

In tabs, put the marker on its **own header/marker line** (the same line the
Songsterr importer already puts `[Section]` text on, above the six string rows) —
e.g. `m12  [Chorus] [Amp: 7Red]`. The chip isn't monospace-width, so a marker written
mid-string, with more fret numbers after it on the same line, will shift everything
after it out of column alignment with the other five strings.

## Tabs from Songsterr (preferred — exact data, no OCR)

```bash
node scripts/import-songsterr-tab.mjs "<songsterr URL ending in sNNNtM>" <songId>
```

The URL's `sNNNtM` suffix = songId N, track/part M. Curated URLs in
`src/data/tab-links.json` already point at the right track. The script fetches
Songsterr's structured JSON (via `/api/meta/{songId}` → revision + image hash → the
CDN part JSON) and renders ASCII tab with bar numbers, section markers, tempo changes,
palm-mute dots, and effect suffixes. Sleep ~2s between songs when batch-importing.

**No curated link yet?** Find one: `https://www.songsterr.com/api/songs?pattern=<title>`
(match title AND artist), then `/api/meta/<songId>` and pick the track index — prefer a
guitar named "rhythm", never vocals/bass/drums (see repo CLAUDE.md conventions). Add
the URL to `src/data/tab-links.json` (it also powers the app's Songsterr button), then
run the import. A wrong track is worse than none — report low-confidence picks to the
user instead of guessing.

## Other source material

`TabsAndChords/` (gitignored) is the drop folder. XPS/OXPS print exports are
rasterized page images with **no extractable text** — don't transcribe pictures; ask
for a text source or a browser **Save as PDF** (which preserves text). UG chord pages:
the user copy/pastes the text (UG blocks scraping).

## Verify + ship

1. Spot-check the generated/saved text (title header, tuning line vs the song's
   `tuning` in setlist.json — original-recording tunings like Eb are expected and
   worth mentioning to the user; no `undefined`/`NaN` artifacts).
2. `npm run build`, commit on `dev`, bare `git push`.
3. Confirm deploy per the deploy-check skill; the app is live at
   https://egon42.github.io/MartinOverdrive/dev/.
