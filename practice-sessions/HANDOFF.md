# HANDOFF — living bookmark (overwrite on pause)

- Updated: **2026-07-29 afternoon** (desk run-through through #19)
- Show: 2026-08-01 · Phase: **Harden**
- Week plan: [`final-week-2026-08-01.md`](final-week-2026-08-01.md)
- Skill: `/continue desk` · `/continue guitar` → `.claude/skills/continue-final-week/`
- **Song numbers = NEW set order** (setlist.json `order`), not file-id prefixes.

## Track

**desk** (set-order card run-through with Ryan half-listening from meetings)

## Last completed

Run-through #1–#18 (Ryan drives, corrections applied + pushed per song):

- #1 Middle fresh from morning riff-chip work · #2 ATS ✓ · #3 Conversation skip
  (sing-only) · #4 Valerie ✓ · #12 SHA ✓ · #13 FBG done this morning · #14 S.O.B.
  card ✓ · #16 Mary Jane ✓ · #18 Zombie card ✓
- #5 DSB: 2-row cycles, pre-chorus `(A E) ×3 (A B) | (+E +B +E +A)`, Chorus above Solo
- #6 Voodoo + #7 Pride and Joy: skipped, basic backing rhythm
- #8 Mama: MAJOR rework (see Next guitar verify list); 13 archived versions
- #9 Tribute: Fill ^3 cue "needless to say"; Rock ends `F]]`
- #10 Pretender: chorus `Am]] D/F# F *+D`; orange verse remind "don't jump early 1st pass"
- #11 Dream On: fill-only focus (ghost chorus, orange "Fill ^1: 2nd Sing with me; 4th
  on final chorus"), optional Bridge added, climax blue walk `*F#5 *G *A *B7b9`
- #15 Save a Horse: hook G tagged in chorus + outro
- #17 Dani: Dm/Bm back to plain, chorus G = `*~+G` (skip-marked tag) — **new marker
  combo**, render fix shipped in `components.tsx` (`tagShown`), Ryan should confirm
  the look on /dev/ after deploy
- #19 Darkness: **aligned to the Marty Music video** (Ryan's chosen practice source):
  bridge walk = A A# B (G dropped, low grips 113/224), bridge E/F#m real chords,
  chorus 2 rows + C#m/D grips 446/557, lyric landmarks added, Clap fully ghosted,
  new **Solo (big)** = E A F# B chords under the lead (Marty: chords not riff —
  deliberately overrides both sheets) incl. post-Clap step into Outro

## Next desk

1. ~~Dream On~~ — DONE 7/30: no extra chords after Fill ^1 (Ryan listened); Bridge/
   Chorus 2 rows each, reminds carry the cues. Signed off.
2. ~~Tribute~~ — DONE 7/30: fill tabs off the card, ^1/^2/^3 cues folded into Intro hint.
3. ~~Zombie~~ — DONE 7/30: Hang/Solo/Outro cheatHidden behind the main-look block;
   real Songsterr solo m85-101 (e+B two-string, 46-char max lines) replaces the
   hand-made hook/grow-on tabs. **Ryan vets at the guitar tonight.**
4. ~~#20 Dirtbag~~ — reviewed 7/30 desk, card stands; outro vet moved to tonight's
   guitar list. Resume set-order run-through at **#21 Lola Montez** (then #22 onward,
   minus skips).

Card freeze **Thu 7/30 evening**.

## Next guitar

**Tomorrow (priority):** dedicated **#19 Darkness** block — Marty Music tutorial × a few
passes; learn individual note pieces (not always full chords) on the hard spots;
Songsterr rhythm loops after for muscle memory. Always-play flash: **Lola** + Thunderstruck
(when/where). Body Pre/Post.

**Tonight (if continuing):** #10 Pretender catch-up (never-skip; missed Tue) →
guitar vets before the freeze: **#18 Zombie** new solo tab + **#20 Dirtbag** outro rows
(G#m stab / held 3rd E / slow walk-down) → Thunderstruck feel flash → changeovers /
ordered slice as energy allows. Body Post before sign-off.

Coach = one song at a time (instruct → play → report → log → next).

## Recommended desk

**Claude Fable 5** (stage-card judgment; run-through session is live in Fable)

## Recommended guitar

**Either** (chat at the guitar) — song-by-song coach, not plan dump

## Never skip

Darkness · **Lola Montez** · Thunderstruck (when/where) · ordered set slice · body Pre/Post  
(**Pretender off always-play 7/29** — still solid / optional. **Lola on** as of 7/29 — passable, needs the reps.)

## Card / UI TODOs

- **#11 Dream On**: desk — chords after first chorus Fill ^1? (flagged 7/29 guitar)
- **#18 Zombie**: Solo outro fill-first layout — finagle tomorrow desk (started 7/29)
- **#9 Tribute**: desk — trim/remove fills (flagged 7/29; intro bits strong)
- **#20 Dirtbag**: outro rows never got their guitar vet (tabled 7/27) — vet tonight
  before freeze
- **#17 Dani `*~+G` chip**: phone-confirm skip-marked-tag rendering on /dev/
- **#8 Mama**: signed off 7/10 tonight (skip-tags + Pre remind)
- #19 Darkness: Marty/note-piece focus tomorrow guitar; phone-check Marty-aligned card
- Run-through remaining: #20–#32 (minus Ryan's skips)
- Grammar proposals awaiting guitar vetting (`grammar-proposals-2026-07-28.md`)
- Ride-scan mediums + ambiguous `=` holds awaiting ear (`ride-scan-proposals-2026-07-29.md`)
- Welcome Home (#28): Em-cycle + chop-mute/turn cues confirmed guitar 7/29
- Open flags: Voodoo (#6) hard-stop vs ring (skipped today, low stakes); AGD (#29)
  held final chorus G
- Freeze after **Thu evening**

## Standing decisions

- Stage = **Cheat only**
- **Song numbers = new set order** (memory: new-setlist-order-numbers)
- Desk continue = app (not fingering coach); fingering = downtime only (`desk board` if wanted)
- Quoted lyric hints = blue; `+Chord` = tag; `~Chord` = ghost; `*Chord` = blue alternate;
  `=Chord` = strum once and let ring; `Chord]]` = ride, keep strumming N measures
  (one `]` each, min 2); `=`/`+` don't combine with `]]` (`~`/`*` do); `*~+X` =
  skip-marked tag (new 2026-07-29, Dani chorus G); section `remind` = orange text by
  the section name; `cheatHide` = omit from Cheat
- Auto commit + bare `git push` on `dev` for app/data (not `fill_page.html`)
- **Guitar coach = one song at a time**; worksheet is the log, not the script
