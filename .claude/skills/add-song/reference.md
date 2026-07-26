# Add song — Free Bird reference

Canonical first-pass example: `32-free-bird` (Lynyrd Skynyrd), 2026-07-26.
User feedback: lean Ryan + rhythm chart "came out really good" — that density is
the default for **any** new song, not only encores.

## Role card (what we chose)

| | |
|---|---|
| Placement | End of main set (order 32); flagged request/encore |
| Cut | Studio form, lean |
| Role | Ballad open chords; outro power vamp |
| End | Ride G–Bb–C until band cues out |
| Scope | No dual-lead transcription |

Request/encore was a **flag** on that song, not the skill's only mode. Same pipeline
applies when adding a normal set song or (later) a song on an alternate setlist.

## Files touched

| File | What |
|---|---|
| `src/data/setlist.json` | New id + order; `songCount` bump |
| `src/data/amp-presets.json` | `presets: [1, 10]`, `joiner: "→"` |
| `src/data/bpm.json` | 74 ballad + outro note |
| `src/data/tab-links.json` | Songsterr acoustic + UG chords |
| `src/data/sheets/32-free-bird.chords.txt` | Hand UG spine; Amp chips |
| `src/data/sheets/32-free-bird.tabs.txt` | Rhythm import |
| `src/data/sheets/32-free-bird.ryan.txt` | Sit intro; powers on outro |
| `src/data/progressions.json` | Sections + form |
| `src/data/scrollSpeeds.json` | Estimate 6 / leadIn 12 |
| `amp-presets/AMP-SETUP.md` | Table row |
| practice-session + ryan `progress.md` | Set row / drafted |

## Tricks that made Ryan feel good

1. **Ghost then join** on intro — beat visible without playing the pad.
2. **Same UG spine** as chords (mid-word splits intact).
3. **Powers only where the show part is**; open shapes elsewhere.
4. **Enough vamp rows** for crawl + honest Estimate duration.
5. **Amp chip** at the boundary the player must not miss.

## Songsterr track pick (Free Bird)

| Index | Track | Use? |
|---:|---|---|
| 1 | Allen Collins Acoustic | Yes — Tabs |
| 0 | Vocals | No |
| 3–6 | Lead solos | No for first pass |

Chords page was a starter only; final chords/Ryan were hand-built.
