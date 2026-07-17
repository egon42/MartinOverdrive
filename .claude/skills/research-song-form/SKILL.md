---
name: research-song-form
description: >-
  Research a Martin Overdrive song's true structure (section order + cycle counts)
  against the studio recording using a web-research subagent, then apply it to the cheat
  card as a NEW VERSION (old card archived to the dev version dropdown). Use when the
  user says "research this song's form", "verify the card against the recording",
  "research pass", asks whether a cheat card matches the record, or right after
  import-song-sheet adds a NEW song that needs a trustworthy form without a live pass.
---

# Research song form (recording-accurate cheat cards)

Verify/correct a song's cheat-card **form + section cycles** against the actual studio
recording via ONE web-research subagent per song, then apply with versioning so nothing
is lost. Built from the 2026-07-16 research pass that covered the whole setlist
(results + per-song confidence live in `../refine-cheat-form/progress.md`).

Owns: research → new card version. Does **not** own key/transpose (**align-song-key**),
sheet imports (**import-song-sheet**), or live/manual counting (**refine-cheat-form**).

## Authority order (settled)

1. **User's ears + the recording** — a count or chord the user played against the record
   beats any tab site. Never silently overwrite a user-stated fact; version it and flag.
2. Research consensus (≥2 independent sources agreeing).
3. Single-source claims — apply only when they fill a gap (missing section) rather than
   contradict a hand-vetted detail; mark confidence in the progress note.

## Per song, in order

### 1. Snapshot the current card (ALWAYS, before any edit)

```bash
node scripts/snapshot-progression.mjs <songId> "<label>"   # e.g. "Jul 15 hand pass"
```

Re-running with identical content is a safe no-op. The archived version becomes
selectable in the **dev cheat-card "Card version" dropdown** (prod never shows it), so
research changes are always reversible — this is what lets research apply WITHOUT
waiting for the user, per their standing instruction (2026-07-16).

### 2. Launch ONE research subagent (Sonnet tier)

`Agent` with `subagent_type: general-purpose`, `model: sonnet`. **Max ~5 concurrent**
subagents (project CLAUDE.md cap); for a batch, top up the pool as each finishes rather
than launching waves and idling. Budget: a song costs roughly 40–85k subagent tokens.

The prompt template that works (fill the CAPS):

```
Research the exact song structure (section order + repeat counts) of the STUDIO
recording of "TITLE" by ARTIST (ALBUM, YEAR, ~LENGTH) so a rhythm guitarist can play
along 1:1 with the record.

CURRENT CARD (provenance: user-made tab / hand-vetted — say which). Section chord
units (one cycle each) — TUNING/KEY of card:
- <section>: <chords>   (one line per section, with any hints that matter)
Form: <current form steps>.

YOUR JOB:
1. Verify or correct the FORM: <name this song's 3-5 trouble spots: intro length,
   per-block cycle counts, solo placement/length, what the ending really is, any
   section possibly missing entirely>. Also verify chord ORDER within each section's
   cycle — wrong-order chords (e.g. C G F C vs C F G C) are a known failure mode.
2. TUNING/KEY: the band plays in E standard. Report the recording's tuning
   (E/Eb standard, Drop D, capo) and sounding key; flag any offset in one line.
3. Use multiple independent sources: high-rated Ultimate Guitar tabs (section markers
   + repeats), Songsterr, MuseScore, Hooktheory/TheoryTab, musicology blogs/analyses.
   Cross-check at least two. (Beware: many "different" tab sites mirror ONE
   transcription — check for genuine independence.)
4. Arithmetic check: BPM and track length; total bars × seconds-per-bar ≈ length.
   2-3 lines of math. (This catches under/over-counted blocks better than any tab.)
5. Section-boundary timestamps (mm:ss) if available; say when they're derived, not
   sourced — never fabricate.

RETURN (compact, ≤400 words, no page dumps):
- CONFIRMED FORM: ordered list, `Section ×N` against the units above (if the true
  cycle unit differs, say so explicitly).
- CHANGES vs card: bullets + confidence (high/med/low) + source.
- TUNING/KEY: one line.
- TIMESTAMPS: section → mm:ss.
- UNCERTAIN: disagreements.

RULES: Do NOT quote song lyrics (not even one full line). Structure only. Token-efficient.
```

Gotchas (all hit for real):
- **Lyric quotes kill the agent** (`400 content filtering`). The no-lyrics rule is
  mandatory; refer to sections by number/timestamp. If an agent dies anyway, relaunch
  with the stronger rule block used for Purple Rain (see session `progress.md` note).
- UG/Songsterr are JS-rendered — agents often can't scrape them; drum charts, bass
  tabs, musicology blogs (Pollack for Beatles), and lesson PDFs are good fallbacks.
- Auto key-detector sites (Tunebat/SongBPM) routinely mislabel key and double/halve
  BPM — trust chord-shape + tuning consensus over algorithms.
- Ambiguous canon (1968 vs remix, original vs famous cover): identify BOTH, report
  which matches the card, and ASK the user rather than picking (e.g. 03, 26).

### 3. Apply as the new current card

- Edit only that song in `src/data/progressions.json`, following the notation contract
  in `../refine-cheat-form/reference.md` (×N on form label vs chord chips, `|` line
  breaks, ghost `~`, shapes 1:1 with written chord names).
- Apply high-confidence structure fixes and gap-fills. For med-confidence
  contradictions of a HAND-VETTED detail, keep the user's value and note the dispute.
  Tuning/key offsets are notes, not card edits.
- If research fully confirms the card: no edit, just the progress note.

### 4. Validate → commit → push (standing rule, no asking)

```bash
npm run validate   # checks live cards AND archived versions
```

One song per commit when practical; bare `git push` to `dev`. Update
`../refine-cheat-form/progress.md` (mark the song, one-line note: what changed, what
confidence, what still needs a live confirm). Point the user at
`https://egon42.github.io/MartinOverdrive/dev/` and the version dropdown to A/B.

## New-song flow

For a song just added via **import-song-sheet**: build a first-draft card from the
sheet's `[Section]` markers (that's refine-cheat-form's job), then run this skill on it
before the user ever plays it — snapshot label `"sheet first pass"`.

## Out of scope

- Choosing which recording is canon when versions differ in key/length — user call.
- Key changes / shape regeneration → **align-song-key**.
- The deliberately-simple whole-song cards (09, 10, 12, 14, 21) — only on request.
