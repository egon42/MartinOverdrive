# Stage cheat card — reference

## Cheat vs Chords (show mode)

| Tab label | Internal | Data |
|---|---|---|
| **Cheat** | `variant: 'cheat'` → `basicRowsFor` | Each `sections[]` entry once (incl. Fills); ignores `form` |
| **Chords** | `variant: 'chords'` → `cheatRowsFor` | Walks `form[]`; looks up base name in `sections`; no Fills |

Stage play usually leans on **Cheat** for building blocks, **Chords** when the
roadmap order/repeats matter mid-set. Polish both when you touch `form`.

Hints on the roadmap show on the **first** occurrence of each section base name only.

## Mock file template

Path: `practice-sessions/<songId>-stage-card-mock.md`

Seed from the live card, then let the user edit the fenced Cheat block.

```markdown
# <Title> stage-card mock (edit me)

Song: `<songId>`

## Cheat tab (building blocks — each section once)

```
INTRO
<chords>
hint: <optional>

VERSE
<chords>

CHORUS
<line 1 chords>
<line 2 chords>
hint: <optional lyric cue>

…
```

## Chords tab (roadmap — song order)

```
Intro
Verse ×2
Chorus
…
```

## Done?

Say "use the mock" when this matches what you want on the phone.
```

### Mock → JSON mapping

| Mock | `progressions.json` |
|---|---|
| `SECTION` heading | `"section": "Section"` (title case; match form bases) |
| Chord line | span group(s); multiple groups on one line = same row |
| Blank line or `---` between chord lines | insert `\|` before the next span |
| `hint: …` | `"hint": "…"` (one per section; last/combined if several written) |
| Roadmap lines | `"form": ["Intro", "Verse ×2", …]` |
| `(A E) ×3` | same in `chords` |
| Fills block | leave existing `tab` / `tabMore` unless user edits |

## Banditos worked example (pilot)

User mock (intent):

```
CHORUS
(E A E B A B) (E C#m A B E)
hint: "Well give your I.D. card"
(A E A E A E)
(A B E C#m A B E)
hint: "Everybody knows"
```

Applied (one section, one hint — app limit):

```json
{
  "section": "Chorus",
  "chords": "(E A E B A B) (E C#m A B E) | (A E A E A E) | (A B E C#m A B E)",
  "hint": "Well give your I.D. card; after vamp: Everybody knows"
}
```

Lessons:

- Do **not** invent a "second half" that isn't how they feel the form
- Double pass + vamp between = stack with `|`, keep one Chorus name unless they split labels
- Two mock hints under one section → combine, or split into `Chorus` + `Everybody` and update `form`
- Revert + mock beat arguing when the layout isn't jiving

## Notation (cheat card)

Same grammar as `src/progressions.ts` header comments:

- `(E A) ×3 (E G A) ×2` — grouped repeats
- `Verse ×4` on **form** when the whole section repeats
- `|` — force line break before next span
- `~Chord` — ghost / don't-play chip
- `shapes` — 6-char tokens aligned 1:1 with chord **names as written** (one pass per group)

## Density vs auto-fit

Show mode height-fits `.cheat-fit` (floor ~0.7). Extra rows shrink every chip.
For stage: fewer rows / shorter hints first. Do not disable auto-fit unless the
user asks after seeing full-size overflow.

## Snapshot + ship

```bash
node scripts/snapshot-progression.mjs <songId> "pre stage card <label> YYYY-MM-DD"
npm run validate
# commit + bare git push on dev
```
