# Add encore song — Free Bird reference

Canonical example: `32-free-bird` (Lynyrd Skynyrd), drafted 2026-07-26. User
feedback: the lean Ryan + rhythm chart "came out really good" — keep that density.

## Role card (what we chose)

| | |
|---|---|
| Cut | Studio form, lean |
| Role | Ballad open chords; outro power vamp |
| End | Ride G–Bb–C until band cues out |
| Scope | No dual-lead transcription |

## Files touched

| File | What |
|---|---|
| `src/data/setlist.json` | Append order 32; `songCount` 32; encore rehearsalNotes |
| `src/data/amp-presets.json` | `presets: [1, 10]`, `joiner: "→"` |
| `src/data/bpm.json` | 74 ballad + note about ~148 outro |
| `src/data/tab-links.json` | Songsterr `s21t1` acoustic + UG chords |
| `src/data/sheets/32-free-bird.chords.txt` | Hand UG spine; Amp 1Amber → 2Green |
| `src/data/sheets/32-free-bird.tabs.txt` | Songsterr acoustic rhythm import |
| `src/data/sheets/32-free-bird.ryan.txt` | Sit intro ×1; powers on outro ×8 |
| `src/data/progressions.json` | Intro/Verse/Refrain/Break/Outro + form |
| `src/data/scrollSpeeds.json` | Estimate 6 / leadIn 12 (ballad-length sheet) |
| `amp-presets/AMP-SETUP.md` | Row 32 |
| `.claude/skills/practice-session/reference.md` | Encore row |
| `.claude/skills/polish-ryan-sheet/progress.md` | drafted |

## Tricks that made Ryan feel good

1. **Ghost then join** on intro — beat visible without playing the organ pad.
2. **Same UG spine** as chords for verses (mid-word splits intact).
3. **Powers only where the show part is** (outro), open shapes for the ballad.
4. **Enough vamp rows** for crawl, with an honest Estimate note that the sheet
   does not cover the full dual-lead runtime.
5. **Amp chip at the section boundary** the player must not miss.

## Songsterr track pick (Free Bird)

| Index | Track | Use? |
|---:|---|---|
| 1 | Allen Collins Acoustic | Yes — Tabs |
| 0 | Vocals | No |
| 3–6 | Lead solos | No for lean encore |

Chords page `…-chords-s21` was only a starter; final chords/Ryan were hand-built.
