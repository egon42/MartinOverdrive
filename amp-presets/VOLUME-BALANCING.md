# Mustang I V2 — Volume-Balancing Runbook

> **Status 2026-07-30:** the stored volumes now include a set-wide second pass.
> The SPL first pass got everything to ~72–73 dB, but the gig-tested Red 1/2 fix
> showed it under-corrects at stage volume (compressed tones read hotter than
> they meter): the clean needed **+0.5** and the hi-gain **−1.0** on top of the
> SPL values. That correction is applied to every preset, graded by compression
> (cleans +0.5, breakup/comp'd snap 0, dynamic crunch −0.5, compressed hi-gain
> −1.0). The next pass through this runbook is a **verification** sweep — expect
> presets to be close, and log residual nudges rather than big moves.

A 30–40 minute pass to **level-match all 24 presets** so nothing jumps out —
especially the songs that switch between two tones mid-song (the RED-bank pairs),
where one tone is currently drastically louder than the other.

> **The one knob that matters:** each preset stores its own **VOLUME** (channel
> volume). That is what you adjust and re-save here. The physical **MASTER** knob
> is your global "how loud is the room" control and is **not** stored — leave it
> at gig level the whole time and never touch it while balancing. Adjusting
> VOLUME per preset is exactly the level-match the `AMP-SETUP.md` §6 note points at.

---

## Why dirt sits so much lower than cleans

**Distortion is compressed**: a high-gain tone at VOLUME 6 *sounds* much louder
than a clean tone at VOLUME 7, even though the number is lower. Meters and ears
both confirm it — compressed signals have a higher average level for the same
peak. That's why the stored values now spread so wide (compressed dirt at
2.5–4, cleans at 8–10): two balancing passes' worth of that physics is already
baked in. Don't "fix" the spread by eye — the numbers being far apart is the
point.

Going through the sweep, expect:

- Most presets **already matched** — log residual nudges, not big moves.
- **Intentional "boost" presets** (14 LEAD SOLO, 24 LEAD BOOST) → keep them
  deliberately ~1 to 1.5 louder than the rhythm tone they replace, so solos cut.
  A/B **23 ↔ 24** first — the boost was trimmed on paper and needs an ear check
  that it still cuts.

---

## What you need

- The amp, at **gig/rehearsal MASTER volume** (balance at the level you'll play at —
  quiet-room balance doesn't hold up loud).
- **Consistent input:** play the *same* riff/strum at the *same* pick attack for
  every preset. A looper pedal or a phone playing one dry riff into your ears works
  even better than trying to replay identically.
- **Optional but great — a phone SPL meter** (e.g. "Decibel X", "Sound Meter").
  Set it to **A-weighting, Slow response**, put the phone in one fixed spot in
  front of the speaker, and match the *average* reading (not the peak) between
  presets. Matching average SPL tracks perceived loudness far better than peaks.
- This document + something to write your final numbers in (the worksheet below).

---

## Two gotchas before you start

1. **Soft-takeover knobs.** When you nudge the VOLUME knob, the amp jumps to the
   knob's *physical* position — it does **not** ease from the stored value. So the
   moment you touch VOLUME you've overwritten the level. That's fine (it's what we
   want), but it means: **decide your target, turn straight to it, judge, re-save.**
   The "Current VOL" column below tells you each preset's starting point so a jump
   isn't a surprise.
2. **Don't confuse this with firmware mode.** Saving a preset is harmless (see
   `AMP-SETUP.md` §4.0). Just never *hold* SAVE while powering the amp on. Normal
   in-session saving is press-and-release only.

---

## The method

1. **Back up first** (once). If you haven't already, snapshot your 24 slots per
   `AMP-SETUP.md` §4.1 so this pass is fully reversible.
2. **Pick an anchor preset** — the tone you consider "correct" gig loudness. A good
   choice is your main rhythm crunch, **13 MODERN HI GAIN** (also used as
   22 PRETNDR SLAM). Play it, set MASTER so it sits right in the room, then **don't
   touch MASTER again.**
3. **Match everything to the anchor.** For each preset: select it, play your
   reference riff, and turn its **VOLUME** until it sounds as loud as the anchor
   did (or reads the same average SPL). Then **re-save** (procedure below).
   - If a clean can't get loud enough even at VOLUME 10, it's not the clean that's
     wrong — your dirt is too loud. Lower the anchor and the other dirt presets
     instead, then come back.
4. **Do the pairs first** (next section) — that's where the problem is most
   audible — then sweep the rest.
5. **Re-check the pairs at the end** by clicking back and forth between each pair a
   few times. The switch should feel like a *tone* change, not a *volume* change.

### How to save each preset (front panel)

Per the Mustang v.2 manual (same steps as `AMP-SETUP.md` §4, saving **in place** to
the same slot):

1. With the preset selected, turn **VOLUME** to your new level. The **SAVE** button
   lights **red** (it's now modified).
2. Press **SAVE** — SAVE and EXIT flash. (Press EXIT any time to cancel.)
3. Leave the **PRESET** knob where it is (you're saving over the same slot).
4. Press **SAVE** again to confirm. Done — the light stops flashing.

---

## Priority 1 — the four RED-bank pairs (biggest offenders)

These are the mid-song switches where a volume jump is most exposed. Balance each
pair against *itself* first — the two tones in a pair should feel equally loud —
then against the anchor.

| Pair | Quiet tone | Loud tone | Status after the 2026-07-30 pass | If it still jumps |
|---|---|---|---|---|
| **Zombie / Hunger Strike** | 17 QUIET VERSE (clean, VOL 10) | 18 BIG CHORUS (grunge, VOL 2.5) | **Gig-tuned reference pair** — these exact levels were dialed by ear at stage volume | Shouldn't — if it does, the room changed; re-anchor before touching anything |
| **Teenage Dirtbag / Pink Pony Club** | 19 MUTED VERSE (clean, VOL 7.5) | 20 PUNK CHORUS (pop-punk, VOL 3.5) | Same correction applied on paper, not yet gig-proven | A/B a few times; nudge **20** first |
| **The Pretender** | 21 PRETNDR INTRO (clean, VOL 10) | 22 PRETNDR SLAM (hi-gain, VOL 2.5) | Mirrors the reference pair (same source tones as 2/13) | Slam should be punchy, not painful — it's played slam-only anyway |
| **WMGGW / Dream On / Mama** | 23 BALLAD CLEAN (clean, VOL 10) | 24 LEAD BOOST (lead, VOL 4.5) | Boost trimmed to ~+1 perceived over 23 (was the worst offender) | Keep **24 ~1–1.5 louder** than 23 by ear; drop it if it's overpowering |

Note **22** and **24** are copies of **13 MODERN HI GAIN** and **14 LEAD SOLO** —
if you change the source presets' feel, keep the pair copies consistent (or just
tune all four independently by ear; they're separate slots).

---

## Priority 2 — full worksheet (all 24)

"Current VOL" is each preset's stored starting value (from `generate_presets.py`).
"Tendency" is which way it usually needs to move for perceived-loudness balance.
Fill in **New VOL** as you go, then (optionally) hand these numbers back to me to
bake into the preset files permanently.

### AMBER — cleans & low gain

| # | Name | Gain | Current VOL | Class (correction applied) | New VOL |
|---|---|---|---|---|---|
| 1 | BIG CLEAN | 3 | 10 | Clean (+0.5) — at the ceiling | ___ |
| 2 | CHORUS CLEAN | 2.8 | 10 | Clean (+0.5) — at the ceiling | ___ |
| 3 | FUNK DRY CLEAN | 3.5 | 8 | Clean (+0.5) | ___ |
| 4 | ETHEREAL | 2.8 | 8.5 | Clean (+0.5) — check vs Red8 wetness | ___ |
| 5 | EDGE BREAKUP | 5 | 7.5 | Breakup (0) | ___ |
| 6 | COUNTRY SNAP | 4 | 6.5 | Comp'd snap (0 — comp already lifts average) | ___ |
| 7 | TEXAS BLUES | 6.5 | 5.5 | Dynamic mid-gain (−0.5) | ___ |
| 8 | PURPLE RAIN | 3 | 8.5 | Comp'd clean (0 — comp already lifts average) | ___ |

### GREEN — dirt palette

| # | Name | Gain | Current VOL | Class (correction applied) | New VOL |
|---|---|---|---|---|---|
| 9 | ACDC CRUNCH | 4.5 | 5.5 | Crunch (−0.5) | ___ |
| 10 | CLASSIC ROCK | 6 | 5 | Crunch (−0.5) | ___ |
| 11 | POP PUNK | 7 | 4 | Compressed hi-gain (−1) | ___ |
| 12 | GRUNGE BIG | 6 | 2.5 | Compressed hi-gain (−1) — gig-proven via Red 2 | ___ |
| 13 | MODERN HI GAIN | 6.5 | 2.5 | **Anchor** (−1) — set room here | ___ |
| 14 | LEAD SOLO | 7.5 | 5.5 | Boost (−1) — still sits **above** rhythm | ___ |
| 15 | VOODOO WAH | 7 | 6.5 | Ungated dynamic hi-gain (−0.5) — judge at the sweep peak | ___ |
| 16 | GLAM ROCK | 6 | 4 | Crunch (−0.5) | ___ |

### RED — quiet↔loud pairs

| # | Name | Gain | Current VOL | Class (correction applied) | New VOL |
|---|---|---|---|---|---|
| 17 | QUIET VERSE | 2.8 | 10 | Gig-tuned (= #2 base) | ___ |
| 18 | BIG CHORUS | 6 | 2.5 | Gig-tuned (= #12 base) | ___ |
| 19 | MUTED VERSE | 3 | 7.5 | Clean (+0.5) | ___ |
| 20 | PUNK CHORUS | 7 | 3.5 | Hi-gain (−1, keeps −0.5 vs #11) | ___ |
| 21 | PRETNDR INTRO | 2.8 | 10 | Clean (= #2) | ___ |
| 22 | PRETNDR SLAM | 6.5 | 2.5 | Hi-gain (= #13 anchor) | ___ |
| 23 | BALLAD CLEAN | 3 | 10 | Clean (= #1) | ___ |
| 24 | LEAD BOOST | 7.5 | 4.5 | Boost (−1, keeps −1 vs #14) | ___ |

The "Class" column records which correction each preset already carries — **trust
the meter and your ears**, they override the table.

---

## Make it permanent (recommended)

Front-panel saves live only on the amp, so a factory restore or a reload from
`fuse/*.fuse` would wipe them. To keep the files as the source of truth (project
convention), once you've dialed in the **New VOL** numbers:

- **Easiest:** send me the filled-in worksheet and I'll update the `"volume"`
  values in `generate_presets.py`, regenerate the 24 `.fuse` files, and you're set
  to re-flash a matched set any time.
- **DIY:** edit each preset's `"volume": N` in the `TONES` dict in
  `generate_presets.py`, then `python amp-presets\generate_presets.py`, then reload
  the changed files per `AMP-SETUP.md` §4.

---

## Quick recap

1. MASTER at gig level — then hands off MASTER.
2. Anchor = **13 MODERN HI GAIN**. Match everything to it.
3. Same riff, same attack, every time. Meter on **A-weighting / Slow**, match the
   average.
4. **Dirt comes down, cleans stay up, leads stay a hair above rhythm.**
5. Adjust VOLUME → SAVE → SAVE (in place).
6. Do the 4 RED pairs first, then the sweep, then A/B every pair to confirm the
   switch is tone-only.
7. Write the final numbers back into `generate_presets.py` so they survive.
