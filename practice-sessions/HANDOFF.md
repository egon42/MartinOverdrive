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

**Resume the set-order run-through at #20 Dirtbag** (then #21 onward, minus Ryan's
skips). Lean on the Lyrics sheet as the trusted surface — but note #19 set a
precedent: when Ryan names a practice source (Marty video), that wins over the
sheets. Card freeze **Thu 7/30 evening**.

## Next guitar

Body Pre, then in order:

1. **#8 Mama card-verify** (Ryan not convinced it's 100%): verse `E]]` ride; pre-chorus
   cascades on E/B every pass with blue F#5 G#5 lift pres 2+3 only; hundred-times
   chorus present; blue C D B tag first chorus only; bridge `(G A E) ×3 +B` into solo;
   solo `+C# +B` tags; Outro = `(C D E) ×3`
2. **#14 S.O.B. chord-transition reps** (card fine, hands not)
3. **#18 Zombie outro solo fill**: learn it E-string only first, work the B string in
   later (Ryan's plan)
4. **#19 Darkness Songsterr loop reps** (Ryan asked 7/29): set up loops on the
   rhythm track and drill each card part for muscle memory —
   <https://www.songsterr.com/a/wsa/darkness-i-believe-in-a-thing-called-love-tab-s522t1>
   - verse riff `F# A B]] E B A` (ride the B, land the B A catch-up)
   - bridge `(E F#m) ×3 A A# B` (low grips x022 / 113 / 224)
   - chorus `(E A F# B) ×3 C#m]] D` (quick 3rd cycle; 446 / 557 tail)
   - Clap-section lead lick (C#m box @ 9, card Fills) if time
   This doubles as the Darkness never-skip maintenance for tonight
5. Wed changeover loop + #10 Pretender catch-up (never-skip trio) + ordered set
   slice as time allows

Coach = one song at a time (instruct → play → report → log → next).

## Recommended desk

**Claude Fable 5** (stage-card judgment; run-through session is live in Fable)

## Recommended guitar

**Either** (chat at the guitar) — song-by-song coach, not plan dump

## Never skip

Darkness · Pretender · Thunderstruck (when/where) · ordered set slice · body Pre/Post

## Card / UI TODOs

- **#17 Dani `*~+G` chip**: phone-confirm the new skip-marked-tag rendering on /dev/
- **#8 Mama**: guitar-verify tonight (list above)
- #19 Darkness: phone-check the Marty-aligned card on /dev/ (two-row chorus, ghost
  Clap row, bridge grips); practice vs the video will confirm Solo (big) chords
- Run-through remaining: #20–#32 (minus Ryan's skips)
- Grammar proposals awaiting guitar vetting (`grammar-proposals-2026-07-28.md`)
- Ride-scan mediums + ambiguous `=` holds awaiting ear (`ride-scan-proposals-2026-07-29.md`)
- Welcome Home (#28) Em-cycle: desk fixed; guitar confirm pending (comes up late in
  the run-through anyway)
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
