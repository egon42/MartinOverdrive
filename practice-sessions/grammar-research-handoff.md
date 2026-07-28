# Handoff — cheat-card grammar research pass (alt / held / tag / ghost)

- Prepared: 2026-07-28 (desk session, all 32 stage cards checked)
- Deadline: proposals to Ryan **before Thu 7/30 evening card freeze**; Wed is the
  realistic last apply day
- Requested by Ryan: sweep the rest of the setlist for places our chip grammar
  should be added, using appropriate model-level subagents
- Proposals only. **Ryan vetoes every marker before it lands** (same loop as the
  stage-card pass: propose → confirm → snapshot → apply → validate → commit →
  bare `git push`, one song per commit)

## The grammar (standing decisions, HANDOFF.md)

| Marker | Meaning | Signal to hunt for |
| --- | --- | --- |
| `=Chord` | Held: rings across measures (stacked-card echo) | Ties `(n)` in tabs.txt, single stab + ring, chord spanning 2× the other slots, "let ring"/"hold" notes, vamp sections |
| `+Chord` | Tag: short hit, not a full measure | End-of-bar accent/walk-up hits, pickup chords, quick passing chords between lines |
| `~Chord` | Ghost: don't play that beat | Sit-outs, band-only hits, stops |
| `*Chord` | Alternate (blue): played instead on the pass the hint names | Last-pass substitutions, alternate voicings on a cued pass |
| `*~Chord` | Skip-marked: normal fill, skipped only on the cued pass | Dani-style hangs |

Distinct markers stack (`*+G`). Shapes align 1:1 with chord names as written —
marked chips still get a shapes token.

## Current coverage (scanned 2026-07-28)

Priority 1 — cards with **no markers at all** (13 songs):

| Song | Known angle to check first |
| --- | --- |
| 03-a-little-less-conversation | Stops/hits in the groove; outro ending |
| 06-don-t-stop-believin | Final chord ring-out; any pre-chorus pushes |
| 08-while-my-guitar-gently-weeps | Walk-down ends; final chord; ring-outs on the outro |
| 10-zombie | The Em–C hangs; feedback outro ring |
| 11-hunger-strike | Ending; odd/even row pushes |
| 13-save-a-horse-ride-a-cowboy | Stops/chucks already in hints — are any chips actually ghosts/tags? All-stop last line |
| 14-sweet-home-alabama | The F C tag row — should F or C be `+`? Outro ending |
| 17-the-pretender | Quiet→heavy entrance; stops; final hit |
| 21-the-middle | Last chord; any held D on the outro |
| 24-mary-jane-s-last-dance | Outro fade; last chorus G ride-out |
| 26-voodoo-child-slight-return | Ending ring-out/feedback; intro wah vamp |
| 28-mama-i-m-coming-home | Final chord; bridge ring |
| 30-pink-pony-club | Bridge / final chorus ending |

Priority 2 — partial coverage, sweep for missed spots (already have some markers):
01-welcome-home, 02-all-the-small-things, 04-i-believe (ghosts only — clap-section
tags?), 05-thunderstruck, 07-tribute, 09-pride-and-joy, 12-s-o-b, 15-dani,
16-teenage-dirtbag, 18-here-it-goes-again, 19-purple-rain, 20-when-i-come-around,
22-dream-on, 23-lola-montez, 25-valerie, 27-fat-bottomed-girls, 31-banditos,
32-free-bird (encore: Free Bird ends on a big ring — check).

Skip: 29-ain-t-goin-down (done 2026-07-28). Open item there, needs only Ryan's
ear, no research: hold the final chorus G (`=G`) — tab shows it ringing into the
quiet re-entry.

## Method (per song)

Evidence sources, in authority order: Ryan's ear (he vetoes) > recording >
`src/data/sheets/<id>.ryan.txt` + `.chords.txt` (parenthetical notes, stop/hold
language, chords with no lyric under them) > `.tabs.txt` (ties `(n)`, single-hit
bars, end-of-bar walk chords, palm-mute dots) > current `progressions.json` card.

Worked example (Ain't Goin' Down, this session): verse first G covered two lyric
lines = 4 bars → `=G`; chorus Bbs appeared only as end-of-bar accent positions in
the rhythm tab → `+Bb`; "pickup truck" C chugged ~3 bars vs 2 → `=C`; outro final
chord = single stab hit together → `=G`.

## Subagent plan (model-tiered, orchestrate pattern)

- **Evidence extraction — cheap tier (Haiku / low effort).** One subagent per
  song: read that song's three sheet files + card entry, return a structured
  list of candidate spots (section, chord, signal seen, tab measure/line ref).
  No judgment, no lyric reproduction.
- **Proposal judgment — Fable, in the main loop** (not a subagent): turn
  candidates into concrete `chords` rewrites with confidence + one-line evidence
  each. This is stage-card taste; don't delegate it down-tier.
- **Optional verify — council-verifier on any proposal that changes what Ryan
  plays** (vs pure notation), before showing him.

Hard constraints (both cost real sessions — repo CLAUDE.md):

1. **≤5 concurrent subagents**; run the 31 songs in waves with a checkpoint
   between waves.
2. **Minimal lyric excerpts** in subagent prompts/outputs — full-lyric output
   gets killed by content filtering. Chord/section structure + short quoted
   landmarks only.

## Output format (for Ryan's veto)

One consolidated list, grouped by song, highest-confidence first:

```
NN-song-id · Section
  now:      C Bb G
  proposed: C +Bb G
  evidence: tab m47 Bb only as end-of-bar accent; chords.txt Bb has no lyric line
  confidence: high | med | low
```

Ryan replies per song (ok / veto / tweak); apply approved songs one commit each
with snapshot + validate. Low-confidence items: ask, never assume — and never
pick between two canonical recordings without asking.

## Don'ts

- No form/×N changes (that's refine-cheat-form; flag drift, don't fix it here)
- No hint rewrites except where a new `*` alt needs its cued-pass hint
- No auto-apply without Ryan's ok on that song
- No em-dashes in any hint text
- Don't commit mock files or this file's scratch outputs
