---
name: add-encore-song
description: >-
  Add a lean request/encore (bonus) song to Martin Overdrive the Free Bird way:
  last on the setlist, playable rhythm chart + cheat card + optional Ryan sheet,
  not a full lead transcription. Use when the user says "add encore", "bonus song",
  "request song", "add Free Bird style", or wants a new last-on-list optional song.
---

# Add an encore / request song (lean)

Gold standard: **Free Bird** (`32-free-bird`, shipped 2026-07-26). User liked that
pass — match its density and role, not a full setlist-song polish.

Work on **`dev`**. Ship validate → commit → bare `git push` → watch Pages (see
`verify` skill). Do **not** wait to be asked to push.

## When to use this vs other skills

| Ask | Skill |
|---|---|
| Encore / bonus / request / "like Free Bird" | **This skill** |
| Full setlist song sheets from Songsterr/UG | `import-song-sheet` |
| Deep form research + version archive | `research-song-form` |
| Lock / dial an existing Ryan sheet | `polish-ryan-sheet` |

Encore = **playable tonight if called**. Not dual-lead, not every fill, not locked Ryan.

## Role card (state before editing)

```
Cut: studio / single / live (pick one)
Role: rhythm only | chords-while-singing | sit-out until X
End: hard stop | fade | ride vamp until band cues
Scope: lean encore (default) — refuse full solo transcription unless asked
```

## Checklist

Copy and tick:

```
- [ ] 1. Id + setlist append (order last)
- [ ] 2. Amp + bpm + tab-links
- [ ] 3. Chords sheet (UG spine, sections, Amp chips)
- [ ] 4. Tabs sheet (rhythm track — required by validator)
- [ ] 5. Cheat card (progressions.json)
- [ ] 6. Lean Ryan + Estimate scroll (default yes)
- [ ] 7. Docs: AMP-SETUP + practice-session reference + ryan progress
- [ ] 8. validate + build + commit + push + deploy watch
```

### 1. Id + setlist

- Next id: `NN-slug` where `NN` is `max existing numeric prefix + 1` (Free Bird = `32-free-bird`).
- `order` = last (`songs.length + 1` after append). Bump `meta.songCount`.
- Prefer XLSX + `npm run import-setlist` when the workbook is available; otherwise
  **hand-append** one song object mirroring a neighbor (e.g. Banditos), then note
  re-import later.
- `rehearsalNotes` **must** say request/encore — skip by default in Tonight's set
  unless called. Example:

  > Request/encore bonus — skip by default in Tonight's set unless called. Lean rhythm chart; not a full dual-lead transcription.

### 2. Amp + bpm + tab-links

- **amp-presets.json**: every setlist song needs an entry. Reuse existing slots;
  quiet→loud = `[cleanSlot, dirtSlot]` with `"joiner": "→"`. Amp chip labels are
  **bank position + color** (`1Amber`, `2Green`), not raw slot numbers — slot 10
  GREEN pos 2 → `2Green`.
- **bpm.json**: seed tempo + short note if ballad≠outro feel.
- **tab-links.json**: Songsterr rhythm URL + UG chords URL when known.

### 3. Chords sheet (lean but complete enough)

Path: `src/data/sheets/<id>.chords.txt`

1. Try Songsterr chords import first:

   ```bash
   node scripts/import-songsterr-chords.mjs "<…-chords-sNNNNN>" <songId>
   ```

2. **Always rewrite** — Songsterr chords pages are often one verse + instructional junk.
   Hand-build full form with section headers, UG mid-word splits, blank-line rows.
   Never ship space-aligned `G          D` over full lyric lines.

3. Mid-song amp:

   ```
   [Amp: 1Amber]
   …
   [Amp: 2Green]
   ```

4. Outro/vamp: write a **few** cycle rows + a one-line cue ("ride until band cues out").
   Do not paste nine minutes of solo lyrics.

### 4. Tabs sheet (required)

Validator requires `.tabs.txt` for every setlist song.

```bash
node scripts/import-songsterr-tab.mjs "<…-tab-sNNNNtM>" <songId>
```

Pick **rhythm / acoustic**, never lead/vocals/bass. Find tracks via
`https://www.songsterr.com/api/meta/<songId>`. A long acoustic dump is fine for Tabs;
the **cheat/Ryan** stay lean.

### 5. Cheat card

`src/data/progressions.json` entry:

- Sections for each playable cycle (Intro / Verse / Refrain / Break / Outro…).
- `form` with ×N counts that match the lean chart.
- Optional `shapes`: space-separated **exactly 6 chars** each (low-E → high-e).
  Frets 10+ = hex (`A`=10 …). Mutes = `-`. Shape count = written chord names
  (group contents once; `×N` does not multiply).
- Outro powers as `G5 Bb5 C5` (or song-appropriate), not a solo roadmap.
- Snapshot is N/A for brand-new songs (nothing to archive yet).

### 6. Lean Ryan (default — this is what landed well)

Follow `polish-ryan-sheet` **bulk draft** rules, Free Bird flavor:

1. **Copy band `.chords.txt` body** as UG spine — do not tidy mid-word splits.
2. Ryan layers only:
   - Sit-out ghosts on sparse intros (`~G ~D ~Em`) then join
   - Power/`*5` (or `G5`) on the loud/outro stretch when that is the show part
   - Keep `[Amp:]` chips
   - Extra vamp rows so scroll has material; stop before pretending full dual-lead
3. Scroll seed via:

   ```bash
   node .claude/skills/polish-ryan-sheet/scripts/estimate-scroll.mjs <songId> M:SS --lead=12
   node .claude/skills/polish-ryan-sheet/scripts/estimate-scroll.mjs <songId> M:SS --lead=12 --measure
   ```

   If the sheet covers only ballad + vamp **start**, pass that duration (not full album
   length). Soft-cap lands ~6–12. `note` must start with `Estimate`. Mark
   `.claude/skills/polish-ryan-sheet/progress.md` as **drafted**, never `[x]` without
   a device lock.

Skip Ryan only if the user says so.

### 7. Small docs

- `amp-presets/AMP-SETUP.md` §3 table: add the new row.
- `.claude/skills/practice-session/reference.md` set table: last row, **encore/request**.
- Ryan `progress.md` drafted line (if Ryan shipped).

### 8. Ship

```bash
npm run validate
npm run build
# commit relevant files only (never fill_page.html)
git push   # bare
gh run list --workflow deploy-pages.yml --limit 3
# watch the new run to green
```

Point the user at `/MartinOverdrive/dev/` (Ryan needs Developer → Ryan sheets).

## Anti-patterns (learned on Free Bird)

- Shipping Songsterr chords import **unedited**
- Full dual-lead / every Songsterr lead track on the cheat or Ryan
- Scroll Estimate against full album runtime when the sheet ends at vamp start
- Amp markers like `10Green` (wrong) instead of bank-position `2Green`
- Shapes with multi-digit frets (`8-10-10---`) — use `8AA---`
- Forgetting amp-presets / tabs (validator hard-fails)
- Marking Ryan `[x]` locked on first draft
- Moving an existing mid-set song to "encore" without asking (encore = **new last**, or explicit move)

## Reference

- Worked example paths and role card: [reference.md](reference.md)
- Sheet UG format + Ryan layers: `.claude/skills/polish-ryan-sheet/reference.md`
- Import scripts: `.claude/skills/import-song-sheet/SKILL.md`
