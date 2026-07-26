---
name: add-song
description: >-
  Add a new song to Martin Overdrive end-to-end the Free Bird way: setlist entry,
  amp/bpm/tab-links, chords + tabs, cheat card, and a lean Ryan draft. Use when the
  user says "add song", "new song", "add to the set", "add to this setlist", or wants
  another song wired like Free Bird — including future alternate setlists.
---

# Add a song

End-to-end intake for a **new** song. Gold standard density: **Free Bird**
(`32-free-bird`, 2026-07-26) — playable rhythm chart + cheat card + lean Ryan that
feels show-ready without a full lead transcription.

Work on **`dev`**. Ship validate → commit → bare `git push` → watch Pages (`verify`
skill). Do **not** wait to be asked to push.

## When to use this vs other skills

| Ask | Skill |
|---|---|
| **New song** into the app / a setlist | **This skill** |
| Update sheets on a song that already exists | `import-song-sheet` |
| Deep form research + version archive | `research-song-form` |
| Lock / dial an existing Ryan sheet | `polish-ryan-sheet` |
| Key/shape align across surfaces | `align-song-key` |

## Role card (state before editing)

```
Setlist: current main set | named alternate set (when those exist) | position?
Cut: studio / single / live
Role: rhythm only | chords-while-singing | sit-out until X | fills
End: hard stop | fade | ride vamp until band cues
Flags: normal set song | request/encore (skipTonight by default)
Scope: show-playable first pass — refuse full solo transcription unless asked
```

Ask only if placement or role is unclear. Default placement = **end of the active
setlist**. Default scope = Free Bird lean (rhythm + form + Ryan draft).

## Checklist

```
- [ ] 1. Id + setlist entry (placement)
- [ ] 2. Amp + bpm + tab-links
- [ ] 3. Chords sheet (UG spine, sections, Amp chips)
- [ ] 4. Tabs sheet (rhythm track — required by validator)
- [ ] 5. Cheat card (progressions.json)
- [ ] 6. Lean Ryan + Estimate scroll (default yes)
- [ ] 7. Docs touch-ups (AMP-SETUP, practice reference, ryan progress)
- [ ] 8. validate + build + commit + push + deploy watch
```

### 1. Id + setlist

- Song id: `NN-slug` where `NN` is `max existing numeric prefix + 1`
  (Free Bird = `32-free-bird`). Ids are stable forever; **order** is set position.
- Placement:
  - **Default:** append as last `order`, bump `meta.songCount`.
  - **Insert / alternate set:** put at the asked order and renumber neighbors only
    when the user asked for that position. Prefer XLSX + `npm run import-setlist`
    when the workbook is the source of truth; otherwise hand-edit `setlist.json`
    carefully and note a later re-import.
- Mirror a neighbor song object for required fields (tuning, role, scaleHint, etc.).
- If the song is request/encore-only, say so in `rehearsalNotes` (Tonight's set can
  skip it). Normal set songs do **not** need that flag.

### 2. Amp + bpm + tab-links

- **amp-presets.json**: required for every setlist song. Reuse existing slots;
  quiet→loud = `[cleanSlot, dirtSlot]` + `"joiner": "→"`. Sheet `[Amp:]` chips use
  **bank position + color** (`1Amber`, `2Green`), not raw slot numbers (slot 10 =
  GREEN pos 2 → `2Green`).
- **bpm.json**: seed + short note when sections disagree on feel.
- **tab-links.json**: Songsterr rhythm URL + UG chords URL when known.

### 3. Chords sheet

`src/data/sheets/<id>.chords.txt`

1. Starter import when available:

   ```bash
   node scripts/import-songsterr-chords.mjs "<…-chords-sNNNNN>" <songId>
   ```

2. **Always rewrite** — Songsterr chords pages are often one verse + junk. Hand-build
   full form: section headers, UG mid-word splits, blank-line rows. Never ship
   space-aligned `G          D` over full lyric lines.

3. Mid-song amp:

   ```
   [Amp: 1Amber]
   …
   [Amp: 2Green]
   ```

4. Long outros/solos: a **few** vamp rows + one cue line ("ride until band cues out").
   Do not paste nine minutes of lead into Lyrics.

### 4. Tabs sheet (required)

Validator requires `.tabs.txt` for every setlist song.

```bash
node scripts/import-songsterr-tab.mjs "<…-tab-sNNNNtM>" <songId>
```

Pick **rhythm / acoustic**, never lead/vocals/bass
(`https://www.songsterr.com/api/meta/<songId>`). Long rhythm dumps are fine on Tabs;
cheat + Ryan stay lean.

### 5. Cheat card

`src/data/progressions.json`:

- Sections for each playable cycle; `form` with ×N matching the chart.
- Optional `shapes`: exactly **6 chars** each (low-E → high-e). Frets 10+ = hex
  (`A`=10). Mutes = `-`. Count = written chord names (group once; `×N` does not
  multiply).
- New song → no snapshot yet. Powers/open shapes for what Ryan actually plays.

### 6. Lean Ryan (default)

Follow `polish-ryan-sheet` bulk-draft rules, Free Bird flavor:

1. Copy band `.chords.txt` as UG spine — do not tidy mid-word splits.
2. Ryan layers: ghost sit-outs (`~G ~D`), join cues, powers on the loud stretch,
   `[Amp:]` chips, enough vamp rows for scroll.
3. Estimate scroll:

   ```bash
   node .claude/skills/polish-ryan-sheet/scripts/estimate-scroll.mjs <songId> M:SS --lead=12
   node .claude/skills/polish-ryan-sheet/scripts/estimate-scroll.mjs <songId> M:SS --lead=12 --measure
   ```

   Pass the **sheet's** covered duration, not a longer album runtime the chart omits.
   `note` starts with `Estimate`. Mark ryan `progress.md` **drafted**, not `[x]`.

Skip Ryan only if the user says so.

### 7. Docs

- `amp-presets/AMP-SETUP.md` song table row.
- `.claude/skills/practice-session/reference.md` when the song is on the practice set.
- Ryan `progress.md` drafted line when Ryan shipped.

When alternate setlists exist as separate data, update **that** set's table too —
do not invent a multi-setlist schema here; follow whatever the repo uses at the time.

### 8. Ship

```bash
npm run validate
npm run build
git push   # bare; skip fill_page.html
gh run list --workflow deploy-pages.yml --limit 3
```

Point at `/MartinOverdrive/dev/` (Ryan needs Developer → Ryan sheets).

## Anti-patterns

- Songsterr chords import shipped unedited
- Full dual-lead on cheat/Ryan unless asked
- Scroll Estimate vs full album when the sheet ends earlier
- Amp chips like `10Green` instead of `2Green`
- Multi-digit frets in shapes (`8-10-10---`) — use `8AA---`
- Missing amp-presets or tabs (validator hard-fail)
- Locking Ryan `[x]` on first draft
- Using this skill to "update sheets" on an existing id — use `import-song-sheet`

## Reference

- Free Bird worked example: [reference.md](reference.md)
- UG + Ryan layers: `.claude/skills/polish-ryan-sheet/reference.md`
- Import scripts: `.claude/skills/import-song-sheet/SKILL.md`
