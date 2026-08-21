# Floydian set — night-noodling presets

A second full 24-slot bank for the meditative jams in `night-noodling.md`
(Gilmour/Floyd territory: compressed cleans, slow modulation, fuzz leads,
big halls). The gig set is untouched; this is a wholesale alternate load.
Files live in `fuse-floydian/`, tones in `generate_presets.py`
(`PRESETS_FLOYDIAN`, `F_*` keys in `TONES`).

**Load it:** pick "Floydian (night noodling)" in the loader GUI
(`mustang-loader.bat`), or:

```powershell
python amp-presets\load_presets.py --set floydian --self-test   # 0 mismatches first
python amp-presets\load_presets.py --set floydian               # write all 24
```

**Back to the band set:** same thing with the "Gig (band)" radio button, or
`python amp-presets\load_presets.py` (gig is the default). Nothing is lost —
both sets regenerate from `generate_presets.py`.

## The 24 presets

Same bank logic as the gig set: AMBER cleans/atmospheres, GREEN dirt and
leads, RED adjacent quiet↔loud pairs so a jam goes comping → lead with one
click of the PRESET knob.

| # | Name | Recipe | For |
|---|---|---|---|
| 1 | BREATHE | Twin + light comp + large hall | DSOTM rhythm; lush compressed clean |
| 2 | SHINE ON VIB | Twin + slow Vibratone (rotary) + '63 spring | Shine On comping |
| 3 | US AND THEM | Deluxe Reverb, dark, big soft hall | Slow ballad comping |
| 4 | ETHEREAL DEEP | Your 4Amber go-to with more delay + bigger hall | The default noodling clean |
| 5 | ECHOES | Twin + long bright repeats | Echoes; delay-forward clean |
| 6 | ANY COLOUR | Deluxe + slow deep phaser + delay | Any Colour You Like; Uni-Vibe-ish jam clean |
| 7 | WISH BREAKUP | Tweed light breakup + spring | Strummed comping (WYWH/Fearless energy) |
| 8 | MISTRESS | Twin + slow flanger (Electric Mistress) + hall | Animals/Wall clean arpeggios |
| 9 | TIME SOLO | Fuzz Face into low-gain Brit stack + delay | Time solo; dynamic fuzz lead |
| 10 | MONEY | Brit '70s crunch, dry-ish | Money/Have a Cigar riffing |
| 11 | DOGS FLANGE | Flanged Brit crunch | Dogs/Pigs dirt |
| 12 | NUMB STUDIO | Bigger fuzz + delay + hall, mids up | Comfortably Numb studio solo |
| 13 | SORROW | Heavy fuzz into scooped '90s stack + hall, gated | Sorrow intro roar |
| 14 | RUN LIKE HELL | Bright comp'd Twin + loud ~dotted-8th repeats | Run Like Hell rhythm |
| 15 | BIG MUFF TRY | **Experiment** — Big Fuzz (Big Muff model) lead | See below |
| 16 | HIWATT TRY | **Experiment** — British Watts (Hiwatt model) edge | See below |
| 17 | NUMB VERSE | = 1 BREATHE | Pair with 18 |
| 18 | NUMB PULSE | Cranked fuzz + delay + big hall | The PULSE Comfortably Numb lead — the anchor-track pair |
| 19 | SHINE VERSE | = 2 SHINE ON VIB | Pair with 20 |
| 20 | SHINE LEAD | Bassman + low overdrive + delay + hall | Smooth bluesy Shine On solo |
| 21 | DARK VERSE | = 6 ANY COLOUR | Pair with 22 |
| 22 | TIME LEAD | = 9 TIME SOLO | DSOTM-style jam pair |
| 23 | JAM CLEAN | = 4 ETHEREAL DEEP | Pair with 24 |
| 24 | JAM LEAD | Your 24Red go-to with a big hall swapped in | Familiar fallback lead |

(9–16 are GREEN, 17–24 are RED; the table runs straight through.)

## Jam pairing (night-noodling.md)

- Comfortably Numb / B-minor atmospherics → **17 ↔ 18**
- Shine On / slow minor blues (Thrill Is Gone, Old Love) → **19 ↔ 20**
- One-chord space jams (Machine Gun, Cortez, Maggot Brain) → **21 ↔ 22** or **17 ↔ 18**
- Anything else / don't-think mode → **23 ↔ 24** (your Amber4/Red8 habit, one click apart)

## The two experiment slots (15, 16)

Big Fuzz (Big Muff) and British Watts (Hiwatt) are V2 *extended-firmware*
models — present in the tone tables but never yet written to this amp. If
either slot lands silent/garbled, the firmware doesn't have that model:
worst case is that one garbled slot (see AMP-SETUP.md §4.0), just rewrite it.
If they DO work, they're the most authentically Gilmour sounds on the amp and
worth folding into future revisions.

## Folding favorites back into the gig set

Each Floydian preset is a `TONES` entry. To promote one, add a `tone(...)`
line for it in the gig `PRESETS` list (or copy its knobs into an existing gig
tone), regenerate, and reload the gig set.
