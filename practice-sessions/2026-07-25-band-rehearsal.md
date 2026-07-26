# Band rehearsal backlog — 2026-07-25

- Rehearsal: most-of-band practice (dictated 2026-07-26)
- Show: 2026-08-01
- Branch: `dev` → live `/MartinOverdrive/dev/`
- Status: **in progress** (6 app items done; next = Banditos)

Say **"next backlog item"** or name a song. App fixes first, then practice-only.

---

## Work queue

### 1. #30 — Pink Pony Club (`30-pink-pony-club`) — APP
- [x] **DONE 2026-07-26** (`4eeaf54`)
- Rehearsal note: first chord 2+4 should be 3+5; whole song up one fret. Suspected missing bridge.
- Shipped: band **G** (powers `G5 A5 E5 C5`, frets 3+5); F# card archived; **Bridge ×2** = `C5 D5 E5 A5` (not verse loop), labeled on Chords/Ryan.
- Done when: phone matches band / bridge cued correctly.

### 2. #3 — A Little Less Conversation (`03-a-little-less-conversation`) — APP
- [x] **DONE 2026-07-26** (`fe6575f`)
- Rehearsal note: switch back to original tuning/key.
- Shipped: restored **A7–D7** (was band E); E card archived as `band key E (pre A restore 2026-07-26)`; tab reimported native A.
- Done when: sings/plays in A with the band.

### 3. #6 — Voodoo Child (`26-voodoo-child-slight-return`) — APP
- [x] **DONE 2026-07-26**
- Rehearsal note: was going to sit out; now play simple **E–G** through the song + **C–D** on pre-chorus and "I'm a voodoo child" chorus.
- Shipped: lean card **E G** body; **C D E G** on pre-chorus + chorus (C-D under those lyrics); outro E G. Full Hendrix card archived as `pre batch polish research 2026-07-23`.
- Done when: show card matches the simple band chart.
- Session notes: first pass wrongly put C-D only on outro; corrected to chorus, then pre-chorus too.

### 4. #18 — Zombie (`10-zombie`) — APP
- [x] **DONE 2026-07-26** (`d254c93`)
- Rehearsal note: “Em C section missing.”
- Shipped: real roadmap (was whole-song loop); **Hang Em C ×4** before Solo; Outro Em C cold on Em. Whole-song card archived as `whole-song Em C G D loop (pre Em-C hang 2026-07-26)`. Ryan/chords labeled.
- Done when: pre-solo Em–C is on the card and sheet.
- Session notes: research med-high; hang/outro ×N softest — ear-check if counts feel off.

### 5. #11 — Dream On (`22-dream-on`) — BOTH
- [x] **DONE 2026-07-26** (`210b3eb`)
- Rehearsal note: dyads not working → sit out until “I know / nobody knows”, then chords; learn walk-up `5 3 3 3 / 5 5 5 5 / 5 6 6 6 / 5 8 8 8`; lyrics/shape may be wrong.
- Shipped: band-role card **Sit → Enter (nobody-knows) → …**; Walk-up as **Fill ^1** ×3 after each Climax chord set (not a roadmap section); Ryan capo-1 chords.
- Done when: show role matches sit-out → chords + walk-up is learnable from the app.
- Session notes: fill placement on Climax ×3 — correct if those are the three spots; say if they sit elsewhere.

### 6. #31 — Banditos (`31-banditos`) — APP — **NEXT**
- [ ] Status: not started
- Rehearsal note: structure/lyrics near the end may be wrong.
- Research: local already has Solo×2 → fair-tag D–A–E → Outro×2. Likely lyric/count mismatch, not wrong progression. Verify vs recording/band before rewrite.
- Proposed: listen-pass last 45s; adjust repeats/lines only where they diverge.
- Done when: end matches what the band plays.
- Session notes:

### 7. #23 — While My Guitar Gently Weeps (`08-while-my-guitar-gently-weeps`) — BOTH
- [ ] Status: not started
- Rehearsal note: “hold the last E.”
- Research: verse ends `(Am G D E)` — single E slot; likely cutting E short.
- Proposed: card hint and/or double E; practice the hold.
- Done when: E rings through before next Am.
- Session notes:

### 8. Free Bird (`32-free-bird`) — APP
- [x] **DONE 2026-07-26** (`dcaa80d` + Ryan `d9d8fe7`)
- Rehearsal note: add as bonus/request, last on list (not Sweet Home).
- Shipped: order 32 encore; lean chords/tabs/card; Ryan drafted; amp 1→10; scroll Estimate 6/12. Skill extracted: `add-song`.
- Done when: usable if requested (already).

### 9. #4 — Valerie (`25-valerie`) — PRACTICE
- [ ] Status: not started
- Rehearsal note: practice section transitions.
- Proposed: personal practice / next `/practice` slice; no known data bug.
- Session notes:

### 10. #8 — Mama, I'm Coming Home (`28-mama-i-m-coming-home`) — PRACTICE
- [ ] Status: not started
- Rehearsal note: work on chord progressions.
- Proposed: personal practice; Mama still parked for guitar on ryan progress.
- Session notes:

### 11. #24 — Thunderstruck (`05-thunderstruck`) — PRACTICE
- [ ] Status: not started
- Rehearsal note: know the chords; lock the couple of patterns and when to use each.
- Proposed: personal practice / pattern cues on card only if still confusing after play.
- Session notes:

---

## Also shipped this session (context)

- **`add-song` skill** (`.claude/skills/add-song/`) — Free Bird–quality new-song intake (not encore-only).
- Commits of note: Free Bird, ALLC A restore, PPC +1/Bridge ×2.

## Raw capture (dictation)

1. #4 Valerie — practice transitions between sections.
2. #6 Voodoo Child — simple E–G + C–D end (was sit-out).
3. #8 Mama — work chord progressions.
4. #11 Dream On — no dyads until nobody-knows; then chords + walk-up riff; shape/lyrics suspect.
5. #18 Zombie — Em C section missing.
6. #23 Gently Weeps — hold the last E.
7. #24 Thunderstruck — patterns / when to use them.
8. #30 Pink Pony Club — up one fret (2+4 → 3+5).
9. #31 Banditos — end structure/lyrics maybe wrong.
10. Free Bird — add as last, request/encore (dictated as Sweet Home by mistake).
11. #3 A Little Less Conversation — restore original key/tuning (A).

---

## Handoff — next session

1. Start at **queue #6 Banditos** unless user picks another.
2. Stay on **`dev`**; validate → commit → bare `git push` → watch Pages.
3. Snapshot before rewriting cheat cards (`node scripts/snapshot-progression.mjs <id> "<label>"`).
4. Practice-only items (9–11) can fold into `/practice` or `/coach` rather than app edits.
5. Dream On walk-up placement may need an ear-check tweak after phone test.
