---
name: align-song-key
description: Keep a Martin Overdrive song's key consistent across all four surfaces — chords sheet, tab, cheat-card progression, and setlist key hints — and align/refresh the cheat card in progressions.json. Use when the user says the cheat card/tab is wrong or stale, asks to "align the cheat card/tab," transposes a song to a new key, or when a song's chords, tab, and cheat card have drifted into different keys.
---

# Align a song's key & cheat card

A song carries its key/chords on **four surfaces** that must all agree. When one changes
(new chord import, a transpose, the band re-keys a song), sync the rest. This skill owns
the **cheat card** and the cross-surface key check; the chords/tab files themselves are
imported via the **import-song-sheet** skill.

| Surface | File | Owned by |
|---|---|---|
| Chords / lyrics | `src/data/sheets/<songId>.chords.txt` | import-song-sheet skill |
| Tab | `src/data/sheets/<songId>.tabs.txt` | import-song-sheet skill |
| **Cheat card** | `src/data/progressions.json` (loaded by `src/progressions.ts`) | **this skill** |
| Key hints | `src/data/setlist.json` `scaleHint` / `pentatonicBox` / `tuning` | generated — cross-check only |

Song ids match `src/data/setlist.json` (e.g. `29-ain-t-goin-down-til-the-sun-comes-up`).
The cheat card is what show mode renders as the live "Cheat" view.

## Step 1 — Audit the key across all four surfaces

Before changing anything, read all four and note the key each implies:

- **chords.txt** — the chord names (e.g. `G C D` → G major).
- **tabs.txt** — check the header for a `Note: transposed up/down a Nth from the
  Songsterr source (…)` line. **That note is a red flag** — the tab was hand-transposed
  away from its native key and is the surface most likely to be out of sync.
- **progressions.json** — the cheat card entry's `chords`.
- **setlist.json** — `scaleHint` / `pentatonicBox` name a key. This file is **generated**
  from the XLSX — don't hand-edit it; treat it as a cross-check and flag conflicts.

**If the surfaces disagree on the key, STOP and ask which key the band actually plays in —
don't silently transpose.** A common trap: the chords/tab are in the record key while the
cheat card is in an old band-arrangement key (or vice-versa). The user's answer ("I switched
to these chords so it matches the recording") tells you the target key.

**If the surfaces already agree on the key,** there's no transpose to do — the job is just
to refresh the chords sheet from the new source and rebuild the cheat card to match it
(Step 2). Still do it: a stale cheat card can carry chords the real song doesn't (e.g. a
phantom chorus `D` that a bare-stub cheat had but the actual chart doesn't).

## Step 2 — The cheat card (`progressions.json`)

Structure, keyed by songId (see `src/progressions.ts` for the full contract):
```json
"29-ain-t-goin-down-til-the-sun-comes-up": {
  "form": ["Verse ×2", "Chorus", "Verse", "Chorus ×2"],
  "sections": [
    { "section": "Verse",  "chords": "G C G D G",     "shapes": "320003 -32010 320003 --0232 320003" },
    { "section": "Chorus", "chords": "C Bb G Bb C G", "shapes": "-32010 -13331 320003 -13331 -32010 320003" }
  ]
}
```
- `form` (optional) — linear song roadmap with repeats (`×N` or `xN`). The cheat card
  renders rows in this order; each label's base name looks up chords in `sections`.
  Prefer `form` whenever section order is easy to lose on stage.
- `chords` — space-separated **one-cycle** progression for the section (collapse repeats).
- `shapes` (optional) — space-separated 6-char guitar fingerings, **aligned 1:1** with
  `chords`. Order **low-E → high-e**; digit = fret, `-` = string not played.
- `hint` (optional) — one-line how-to-play cue (signature riff, strum feel), for
  riff-driven songs where a bare chord list isn't enough to play cold.
- `tab` (optional) — compact ASCII tablature block (high-e on top, same convention as
  `.tabs.txt`), rendered monospace on the cheat card. Used for **Fills** sections so
  the stage view shows what to play. Empty `chords` is fine when the section is tab-only.
- `tabMore` (optional) — extra ASCII fills behind a collapsed "More fills" disclosure;
  requires a primary `tab`. Opening it re-fits the cheat card height.
- `capo` (optional, on the song object) — capo note.

Derive each section's progression from `chords.txt` (its `[Section]` markers), collapsing
the section to its distinct chord cycle — **rebuild from the current sheet, don't trust the
old cheat entry**, which may be a stub with wrong or phantom chords. `src/chords.ts`
`chordProgression()` auto-derives a rough version from a sheet, but `progressions.json` is
**curated** — cleaner cycles plus shapes/hints the raw sheet can't give.

**Open-chord shape reference** (low-E → high-e; `-` = unplayed):
```
G 320003    C -32010    D --0232    A -02220    E 022100    Em 022000
Am -02210   Dm --0231    F 133211    Bb -13331   Bm -24432    Cadd9 -32033
```
Barre chords move a shape up the neck: the E-shape at fret n and the A-shape (`-13331`
pattern) at fret n cover the rest.

## Step 3 — Transposing a song to a new key

- **Chords sheet** — re-import in the target key (Songsterr, or a UG paste run through
  `scripts/ug-chords-to-sheet.mjs`) or transpose the chord names. See the
  **import-song-sheet** skill for the file format and the UG-paste converter.
- **Tab** — `scripts/import-songsterr-tab.mjs` has **no transpose flag**. If the current
  tab carries the "transposed … from the Songsterr source" note, it was hand-transposed —
  just **re-import** it. Songsterr's source is the native key, so re-running the importer
  produces that key directly (no hand-math). Verify the fret shift matches the interval:
  **down a 4th = every fret −5** (e.g. a C tab re-importing to G drops `E-6/A-8` → `E-1/A-3`).
- **Cheat card** — rewrite `chords` and `shapes` in the new key (Step 2).
- **setlist.json** — generated; if its `scaleHint`/`pentatonicBox` is now wrong, tell the
  user to fix the XLSX and re-run `npm run import-setlist` — don't hand-edit the JSON.

After a transpose, all four surfaces should name the same key. Consider a `project` memory
note when a song's key was a deliberate, non-obvious choice (so a future session doesn't
"fix" it back).

## Step 4 — Verify + ship

Validate the cheat card entry — every section prints `True`. `shapes` are **optional**; a
section with none is fine. When present, `shapes` count must equal `chords` count and each
shape is 6 chars:
```bash
python -c "import json; e=json.load(open('src/data/progressions.json'))['<songId>']; \
[print(s['section'], (not s.get('shapes')) or (len(s['chords'].split())==len(s['shapes'].split()) and all(len(x)==6 for x in s['shapes'].split()))) for s in e['sections']]"
```
Also confirm the JSON still parses (the same load succeeds). If `chords.txt` changed, spot-
check the parse per the import-song-sheet skill. Then `npm run build`, commit on `dev`,
bare `git push`, and confirm the deploy went green (**deploy-check** skill). Live at
https://egon42.github.io/MartinOverdrive/dev/ — hard-refresh if the Cheat view looks stale
(service-worker cache, not a failed deploy).
