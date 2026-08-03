# While My Guitar Gently Weeps stage-card mock (edit me)

Edit this file to show how you want the **show-mode card** to look. I'll translate your layout into `progressions.json`.

Song: `08-while-my-guitar-gently-weeps`  
Seeded from live card 2026-07-26. Hold-last-E backlog item: user OK after play-through (no double E).

---

## How to mark it up

One block per section. Keep it simple:

```
SECTION LABEL
chords on one or more lines
hint: optional one-liner under the chords
```

Useful tricks the app already understands (optional):

| In this mock                              | Means in the app                            |
| ----------------------------------------- | ------------------------------------------- |
| `(E A) ×3`                                | grouped cycle, play 3×                      |
| a blank line or `---` between chord lines | "put these on separate rows" (`|` in data)  |
| `hint: …`                                 | italic cue under that section               |
| `×2` on a **form** step (`Verse ×2`)      | whole section twice in the roadmap          |
| leave a section out of **Roadmap**        | still OK on the Cheat (building-blocks) tab |

Don't worry about shapes / fingerings here unless you care.

---

## Cheat tab (building blocks — each section once)

This is what show mode's **Cheat** tab shows today. Edit freely.

```
INTRO
(Am Am/G F#m7b5 Fmaj7) (Am G D E)

VERSE
(Am Am/G F#m7b5 Fmaj7) (Am G D E)

VERSE (2ND ENDING)
(Am Am/G F#m7b5 Fmaj7) (Am G C E)

BRIDGE
A C#m F#m C#m Bm E Esus4 E

SOLO
(Am Am/G F#m7b5 Fmaj7) (Am G D E)
(Am Am/G F#m7b5 Fmaj7) (Am G C E)
hint: Clapton: one full verse pair under the lead

OUTRO
(Am Am/G F#m7b5 Fmaj7) (Am G D E)
hint: Lead + ad-lib vocal over verse changes, fade
```

### Scratch / ideas (optional)

Things that often help on stage for this song — rearrange above if any feel right:

- Stack the walk-down and the "gently weeps" turnaround on separate rows
- Short lyric cues so D-ending vs C-ending don't blur (`look at you` / `Still my guitar`)
- Bridge cue (`I don't know why`)
- Leaner Solo / Outro hints (or drop them if the chord rows already say it)

```
<<< paste rewritten sections here if you want a scratch pad >>>
```

---

## Chords tab (roadmap — song order)

Show mode's **Chords** tab walks this form and looks up chords by section name.
Edit order / repeats if the live map should change. Section names must match the Cheat blocks above.

```
Intro
Verse
Verse (2nd ending)
Bridge
Verse
Verse (2nd ending)
Solo
Bridge
Verse
Verse (2nd ending)
Outro ×4
```

---

## Done?

Say "use the mock" when this matches what you want on the phone.
