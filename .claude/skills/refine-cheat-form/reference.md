# Cheat form notation & examples

Contract details also live in `src/progressions.ts` (parseChordSpans / form / cheatRowsFor).

## Form vs chord ×N

| Situation | Put ×N on | Example |
|---|---|---|
| Whole section is N repeats of one cycle | **Form label** | `"Chorus ×2"` + `"F Am C"` → shows **Chorus ×2** then chips F Am C |
| One section contains different repeated tiles | **Chord string** | `"(E A) ×3 (E G A) ×2"` → chips E A **×3** · E G A **×2** |
| Same section appears ×2 early and ×1 later | **Form only** | Don't put ×2 on shared section chords |
| Forced line break between phrase groups | **`\|` in chords** | `"(…) \| (…)"` — parentheses alone do not stack lines |

Do **not** write a uniform cycle as chip `(Em C D) ×2` when the whole section is that cycle — put ×N on the form label instead.

## Chord string grammar

- Plain: `Em C D`
- Group + repeat (mixed tiles only): `(E A) ×3` (parens required; `×`/`x`/`X`; N≥2)
- Phrase groups without repeat (times 1): `(E A B A B) (E A B A E)` — same row; wrap only if narrow
- Forced line break: `(C G Bb F Am G C) | (C G Bb F Am G Ab)` — `|` starts the next span on a new row
- Mixed: `Am (E A) ×2 G` or `(E Am) ×2 G`
- Ghost (show for beat, don't play): `~A` — e.g. `F# ~A B E B A`

Shapes: one token per **written** chord name (group contents once; include ghosts), not the expanded play-through.

## Welcome Home (worked example)

Recording-driven pass produced:

```json
"01-welcome-home": {
  "sections": [
    { "section": "Intro", "chords": "Em" },
    { "section": "Verse", "chords": "Em C D" },
    { "section": "Chorus", "chords": "F Am C" },
    { "section": "Bridge", "chords": "F Am G F" },
    { "section": "Outro", "chords": "Em C D", "hint": "Verse pattern under the solo / oh’s" }
  ],
  "form": [
    "Intro",
    "Verse ×4",
    "Chorus ×2",
    "Verse ×4",
    "Chorus ×2",
    "Bridge ×2",
    "Outro"
  ]
}
```

Lessons:

- First verse is **four** Em–C–D cycles → `Verse ×4`, not chord-chip ×2
- Chorus is two F–Am–C cycles → `Chorus ×2` + chords `F Am C` (not chip `(F Am C) ×2`)
- Ending is Bridge twice, then verse-pattern outro — **not** back to Chorus
- Intro is a held Em before the verse cycles

## Save A Horse (mixed tiles)

```text
Chorus chords: "(E A) ×3 (E G A) ×2"   ← chip ×N stays (two different tiles)
Intro/Verse/Solo/Bridge: "E A" with form Intro ×4, Verse ×4, …
```

Uniform E–A sections put the cycle count on the form. Chorus keeps chip ×N because the tiles differ.

## Checklist when stuck

1. Count cycles on the recording (or ask the user for the count)
2. Name sections the way they'll shout them on stage (Outro vs Solo / Outro)
3. Prefer fewer, clearer rows over writing every chord hit
4. Run `npm run validate` after every edit
