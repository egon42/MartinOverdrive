# Cheat-grammar proposals — vet at the guitar (from 2026-07-28 research pass)

- Source: grammar research sweep of all 31 remaining cards (see
  [`grammar-research-handoff.md`](grammar-research-handoff.md)); evidence = ryan.txt /
  chords.txt / tabs.txt per song. Ain't Goin' Down already done.
- **Vet during the next `/continue guitar` session**: play the spot, mark each item
  `ok` / `veto` / `tweak` in this file (checkbox = ok).
- Apply loop for approved songs (desk, before **Thu 7/30 evening freeze**):
  snapshot → apply to `progressions.json` → `npm run validate` → commit → bare
  `git push`, **one song per commit**.
- Grammar: `=held` · `+tag` · `~ghost` · `*alt(blue)` · stacked `*+` / `*~` / `*=`.

## High confidence (Ryan's own sheets say so)

### 06-don-t-stop-believin · Intro
- [ ] now `E B C#m A` → proposed `~E ~B ~C#m ~A`
- evidence: ryan.txt marks the whole intro `~` "keys only; sit out"; tab silent until verse feel

### 25-valerie · Verse (quiet)
- [ ] now `E F#m` → proposed `~E ~F#m`
- evidence: ryan.txt ghosts the breakdown verse; only the final F#m re-entry unmarked (pre-chorus row handles it)

### 28-mama-i-m-coming-home · Intro
- [ ] now `E` → proposed `~E`
- evidence: ryan.txt marks the clean ~17s intro vamp as an explicit sit-out

### 28-mama-i-m-coming-home · Outro
- [ ] now `Asus2 Bsus4 C D E` → proposed `Asus2 Bsus4 C D =E`
- evidence: tab final E tied `0-(0)` with ritard to a stop; band ring-out

### 09-pride-and-joy · Shuffle + Outro
- [ ] Shuffle row end `E7` → `+E7` (hint already says "E7 tags at line ends")
- [ ] Outro `E B7 E` → `E B7 =E` (final E vibrato + tie in tab)

## Medium (real evidence, wants Ryan's ear)

### 11-hunger-strike · Bridge
- [ ] now `(D5 E5) ×2 Emadd9` → proposed `(D5 E5) ×2 =Emadd9`
- evidence: ryan.txt final bridge "cold end"; tab Emadd9 tied + vibrato ring-out
- note: `=` would show on every bridge pass, not just the last

### 17-the-pretender · Verse / Chorus
- [ ] Verse `Am D/F# F` → `Am D/F# F *+G` (hint already cues "later lines tag G")
- [ ] Chorus `Am D/F# F` → `Am D/F# F *+D` (hint already cues "last pass tags a D"; tab shows brief D stab before Bridge A5)
- FBG-style `*+` blue tags

### 23-lola-montez · Interlude
- [ ] now `D G A D` → proposed `D G A =D`
- evidence: ryan.txt "let ring 2nd" on interlude, mirroring the verse's =D5

### 18-here-it-goes-again · Outro close row
- [ ] now `(A G Ab Bb Eb)` → proposed `(A G Ab Bb =Eb)`
- evidence: final Eb tie marks decaying into silence, not a sharp cutoff

### 04-i-believe-in-a-thing-called-love · Outro
- [ ] now `(E A F# B) ×4 E` → proposed `(E A F# B) ×4 =E`
- evidence: tab sustains the final E across the last bars

### 05-thunderstruck · Chug
- [ ] now `B5` (hint: palm) → proposed `~B5 =B5`
- evidence: ryan.txt "first Thunder ghost; then B5 ringing" - CONTRADICTS the card's "palm B5" hint; Ryan decides which is the live arrangement

### 32-free-bird · Outro
- [ ] now `G5 Bb5 C5 C5` → proposed `G5 Bb5 C5 =C5`
- evidence: tab ending slows (~75 bpm) with tied final chord; ring until band cue

### 14-sweet-home-alabama · new Intro row
- [ ] proposed: add section `Intro: ~D ~C ~G`, hint "Sit the first 2 passes, join on the 3rd"
- evidence: ryan.txt "sit ×2, join on 3rd" with tildes on early passes
- note: adds a section to a card with no form array

### 30-pink-pony-club · Solo (final pass)
- [ ] proposed: last pass ends cold on a ringing G5 (chip option `… *=G5`, cue "last pass")
- evidence: ryan.txt "end cold, let ring ×4" (record key F#; +1 = G5); tab tie on final chord
- note: same row serves mid-song solos; exact chip shape is Ryan's call

## Low / open questions

- [ ] 14-sweet-home · F C tag → `+F +C`? Quick one-bar hits; section name may already say enough
- [ ] 05-thunderstruck · Outro: hint says "close on B5" but B5 is not in the outro row; append `=B5`? Stamp-row readability cost
- [ ] 28-mama · Chorus `*+C *+D *+B` (first chorus only) and Bridge `G A E +B`; hints already carry both
- [ ] 22-dream-on · final B7b9 is sung out held ("Ah------" in the chart); add "hold it" to the Climax hint? (climb lives in the hint, no chip to attach)
- [ ] 07-tribute · after Scat: ryan.txt ghosts the first chorus-loop pass (~Am ~G ~D ~F); card treats all loops the same. Real on stage?
- [ ] 02-all-the-small-things · Outro final C shows a ring tie; `C G =F =C`? (Interlude C stays plain per Ryan 7/28)
- FLAG 26-voodoo-child · ending: tab final chord tied/ringing vs card "hard stop". Band-ear question only
- ~~FLAG 01-welcome-home · cycle drift~~ **RESOLVED 2026-07-28 (desk, refine-cheat-form):** ryan.txt was right — tab shows the 4-bar cycle closing on a slide-down Em (adjacent Em bars at boundaries). Verse/Solo/Outro chips now `Em C D Em`; form ×N unchanged; pushed to dev

## No changes proposed

03 Elvis, 08 Gently Weeps (ring is the whole song's texture), 10 Zombie, 12 S.O.B.
(sit-out outro stays overridden), 13 Save a Horse, 15 Dani, 16 Dirtbag (chorus-3 mute
already in hint), 19 Purple Rain, 20 When I Come Around, 21 The Middle, 24 Mary Jane,
27 Fat Bottomed, 31 Banditos.
