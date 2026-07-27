# Fat Bottomed Girls stage-card mock

Song: `27-fat-bottomed-girls`  
Updated 2026-07-27 (second pass): full stage reorg — Ryan couldn't follow the
non-Verse/Chorus sections. Bar counts and ghosts moved INTO the chips so the Cheat tab
shows them (the three lone-D sections looked identical); chorus split into its three
sung rows; lyric anchors added everywhere. Old cards in version dropdown.

Correctness fixes this pass:

- Interlude was "G G D D A A G" with form ×2 = 14 chords; the sheets play
  (G G D D A A) twice then ONE G landing "Hey listen here" = 13. Final G is now a +G tag.
- Intro is 7 sit-out bars then join on "Hey!" (old card showed a plain played D,
  hint said "volume up" which contradicted the Ryan sheet's sit-out).
- Chorus hint claimed the doubled hook was (G D A D); only the (D A D)
  "Fat bottomed girls" row doubles.

## Cheat tab (building blocks — each section once)

Third pass (same day): double hook shown as its own BLUE row — `(*+G *D *A *D)`, a G
tag pickup then D A D, all alternate-blue = played only on the passes the hint names
(mid/final). NEW GRAMMAR: distinct markers now stack on one chip (`*+G` = blue
alternate tag); parser/chip/CSS shipped with this card, duplicates still throw.

```
CHORUS
(D C G/B D C A) | (D G) | (D A D) | (*+G *D *A *D)
hint: Opening: sit out, single hook. Blue row: mid/final double hook

INTRO
(~D) ×7 D
hint: Sit out the vamp, join on "Hey!" into V1

VERSE
(D A D) G (D A D)
hint: Big open, space for fills; "skinny lad" / "my band" / "mortgages"

STOPS
G F D
hint: Stop hits on "Hey hey!" after V1 only, into the Break

BREAK
(D) ×10
hint: Long riff vamp; "I've been singing" starts V2

INTERLUDE
(G G D D A A) ×2 +G
hint: "Hey listen here" on the last G, into V3

OUTRO
(D) ×4
hint: After "BIKES AND RIDE!"; ad-lib vamp, cold end
```

## Chords tab (roadmap)

```
Chorus
Intro
Verse
Stops
Break
Verse
Chorus
Interlude
Verse
Chorus
Outro
```

(×N counts now live in the section chips, not the form — the Cheat tab ignores form,
and Ryan reads the Cheat on stage.)
