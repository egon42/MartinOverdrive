# Cheat form notation & examples

Contract details also live in `src/progressions.ts` (parseChordSpans / form / cheatRowsFor).

## Form vs chord ×N

| Situation | Put ×N on | Example |
|---|---|---|
| Whole section is N repeats of one cycle | **Form label** | `"Verse ×4"` + `"Em C D"` → shows **Verse ×4** then chips Em C D |
| One section contains different repeated tiles | **Chord string** | `"(E A) ×3 (E G A) ×2"` → chips E A **×3** · E G A **×2** |
| Same section appears ×2 early and ×1 later | **Form only** | Don't put ×2 on shared section chords |

Do **not** move a uniform form `Verse ×2` into chords `(Em C D) ×2` just to "use the feature" — stage reading prefers the label.

## Chord string grammar

- Plain: `Em C D`
- Group + repeat: `(E A) ×3` (parens required; `×`/`x`/`X`; N≥2)
- Phrase groups without repeat (times 1): `(E A B A B) (E A B A E)`
- Mixed: `Am (E A) ×2 G`
- Ghost (show for beat, don't play): `~A` — e.g. `F# ~A B E B A`

Shapes: one token per **written** chord name (group contents once; include ghosts), not the expanded play-through.

## Welcome Home (worked example)

Recording-driven pass produced:

```json
"01-welcome-home": {
  "sections": [
    { "section": "Intro", "chords": "Em" },
    { "section": "Verse", "chords": "Em C D" },
    { "section": "Chorus", "chords": "(F Am C) ×2" },
    { "section": "Bridge", "chords": "F Am G F" },
    { "section": "Outro", "chords": "Em C D", "hint": "Verse pattern under the solo / oh’s" }
  ],
  "form": [
    "Intro",
    "Verse ×4",
    "Chorus",
    "Verse ×4",
    "Chorus",
    "Bridge ×2",
    "Outro"
  ]
}
```

Lessons:

- First verse is **four** Em–C–D cycles → `Verse ×4`, not chord-chip ×2
- Ending is Bridge twice, then verse-pattern outro — **not** back to Chorus
- Intro is a held Em before the verse cycles
- Chorus keeps chip-level `(F Am C) ×2` because that is the internal shape of one chorus

## Save A Horse (mixed tiles)

```text
Chorus chords: "(E A) ×3 (E G A) ×2"
Form: Intro ×2 → Verse ×2 → Chorus → … → Bridge ×4 → Chorus
```

Verse unit is `(E A) ×2` with form `Verse ×2` for a full verse (four E–A pairs). Form and chord ×N **multiply** here on purpose.

## Checklist when stuck

1. Count cycles on the recording (or ask the user for the count)
2. Name sections the way they'll shout them on stage (Outro vs Solo / Outro)
3. Prefer fewer, clearer rows over writing every chord hit
4. Run `npm run validate` after every edit
