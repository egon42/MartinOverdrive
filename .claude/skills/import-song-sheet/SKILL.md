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

## Chords (user provides text)

Save the text verbatim as `src/data/sheets/<songId>.chords.txt`. Trailing spaces
mid-line are meaningful ("But ␣" before a chord line) — do not strip or reflow.
Sanity-check the parse if unsure: the format's rules live in `src/chords.ts`
(chord-token lines, `[Section]` headers, tab-ish lines, tuning/capo meta).

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
