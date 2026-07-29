# Banditos stage-card mock (edit me)

Edit this file to show how you want the **show-mode card** to look. I’ll translate your layout into `progressions.json`.

Song: `31-banditos`  
Baseline restored: Fair-Tag end form from `bd7e624` (pre this-thread chorus experiments).

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
| a blank line or `---` between chord lines | “put these on separate rows” (`|` in data)  |
| `hint: …`                                 | italic cue under that section               |
| `×2` on a **form** step (`Verse ×2`)      | whole section twice in the roadmap          |
| leave a section out of **Roadmap**        | still OK on the Cheat (building-blocks) tab |


Don’t worry about shapes / fingerings here unless you care.

---



## Cheat tab (building blocks — each section once)

This is what show mode’s **Cheat** tab shows today after the revert. Edit freely.

```
INTRO
E D A E
hint: Cold open: hook riff over the verse cycle

VERSE
E D A E
hint: Palm-muted E5 chug under the vocal

CHORUS
(E A E B)
(A B E C#m A B)
(+E +A) ×3
(A B E C#m A B)
hint: "Give your I.D. card"; A rows land on "Everybody knows"; last runs into "that seems fair"

SOLO
E D A E
hint: Verse changes under the solo

OUTRO
E D A E
hint: Straight in after "pistol / pesos": first-pass D lands on "that seems fair"; solo riff rides out, cold end

FILLS
(ASCII fills live on Cheat only — ignore unless you want them changed)
```





### Your Chorus rewrite (scratch below)

Paste / rearrange until the Chorus block looks right. Notes from talk (for your reference, not gospel):

- Chorus plays through **twice** (not two unrelated halves)
- Pass 1 opens on **E** (ID / border) → **A** (Picard) …
- After first pass: little **E–A** rhythm
- Pass 2: **A** on “Everybody”, **B** on “knows”, then pistols / fair

```
CHORUS
<<< replace this whole block >>>
```

---



## Chords tab (roadmap — song order)

Show mode’s **Chords** tab walks this form and looks up chords by section name.
Edit order / repeats if the live map should change. Section names must match the Cheat blocks above.

```
Intro
Verse ×2
Chorus
Verse
Chorus
Solo ×2
Chorus
Outro ×3
```

If you split Chorus into two named parts (e.g. `Chorus` + `Everybody`), list both here wherever they happen.

---



## Done?

Say "use the mock" when this matches what you want on the phone.

Applied 2026-07-26 (`18f0c18`): three-line Chorus with combined hint.
Applied 2026-07-29: one Chorus section, four rows: (E A E B) / (A B E C#m A B) / (+E +A) ×3 shuffle as tag chips / (A B E C#m A B); A-rows end on B. Single combined hint (Ryan ditched the section split + per-row hints).
Applied 2026-07-29 (later): Fair-Tag section deleted. Ryan's insight: chorus-final E + the D A E tag = one E D A E vamp pass, so the last chorus drops straight back into the outro cycle. Outro ×2 → ×3 with the "that seems fair" landmark in its hint. Durations pass still pending. Further edits here → say use the mock again.

Skill for other songs: `.claude/skills/stage-cheat-card/` ("stage pass" / "next stage card").