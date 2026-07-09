// Guitar chord voicings for the clickable chord chips. A shape is six entries,
// low-E string (6th) → high-e string (1st): a number is an absolute fret (0 = open
// string), 'x' is a muted/unplayed string.
//
// Strategy: a small dictionary of friendly open-position voicings for the C/D/G/F
// families (where a barre would look needlessly hard), and a movable-shape generator
// for everything else. The generator picks between an E-shape barre (root on the 6th
// string) and an A-shape barre (root on the 5th string), choosing whichever sits at the
// lower fret — which is exactly how these chords are played in practice. A/E-rooted
// chords fall out of the generator as their natural open shapes (barre fret 0).

export type ChordShape = (number | 'x')[]

const NOTE: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, 'E#': 5, Fb: 4,
  F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11, 'B#': 0, Cb: 11,
}

// Movable shapes as fret offsets from the barre fret (the fret the root sits on).
// 'x' = muted. Two forms per quality: root on the 6th string (E-shape) or 5th (A-shape).
// `a` (the A-shape, root on the 5th string) is optional: a few qualities only have a
// reliable 6th-string form, so they omit it and the generator always uses `e`.
const QUALITY: Record<string, { e: ChordShape; a?: ChordShape }> = {
  maj: { e: [0, 2, 2, 1, 0, 0], a: ['x', 0, 2, 2, 2, 0] },
  min: { e: [0, 2, 2, 0, 0, 0], a: ['x', 0, 2, 2, 1, 0] },
  '7': { e: [0, 2, 0, 1, 0, 0], a: ['x', 0, 2, 0, 2, 0] },
  maj7: { e: [0, 2, 1, 1, 0, 0], a: ['x', 0, 2, 1, 2, 0] },
  m7: { e: [0, 2, 0, 0, 0, 0], a: ['x', 0, 2, 0, 1, 0] },
  '6': { e: [0, 2, 2, 1, 2, 0], a: ['x', 0, 2, 2, 2, 2] },
  m6: { e: [0, 2, 2, 0, 2, 0], a: ['x', 0, 2, 2, 1, 2] },
  sus2: { e: [0, 2, 4, 4, 0, 0], a: ['x', 0, 2, 2, 0, 0] },
  sus4: { e: [0, 2, 2, 2, 0, 0], a: ['x', 0, 2, 2, 3, 0] },
  add9: { e: [0, 2, 4, 1, 0, 0], a: ['x', 0, 2, 4, 2, 0] },
  madd9: { e: [0, 2, 4, 0, 0, 0], a: ['x', 0, 2, 4, 1, 0] },
  '7sus4': { e: [0, 2, 0, 2, 0, 0], a: ['x', 0, 2, 0, 3, 0] },
  '7#9': { e: [0, 2, 0, 1, 3, 3] }, // no clean 5th-string form; always the E-shape
  '5': { e: [0, 2, 2, 'x', 'x', 'x'], a: ['x', 0, 2, 2, 'x', 'x'] },
}

// Open-position voicings that read more naturally than the generated barre.
const OPEN: Record<string, ChordShape> = {
  C: ['x', 3, 2, 0, 1, 0], Cmaj7: ['x', 3, 2, 0, 0, 0], C7: ['x', 3, 2, 3, 1, 0], Cadd9: ['x', 3, 2, 0, 3, 0], C6: ['x', 3, 2, 2, 1, 0],
  D: ['x', 'x', 0, 2, 3, 2], Dm: ['x', 'x', 0, 2, 3, 1], D7: ['x', 'x', 0, 2, 1, 2], Dmaj7: ['x', 'x', 0, 2, 2, 2], Dm7: ['x', 'x', 0, 2, 1, 1],
  Dsus2: ['x', 'x', 0, 2, 3, 0], Dsus4: ['x', 'x', 0, 2, 3, 3], D5: ['x', 'x', 0, 2, 3, 'x'], D6: ['x', 'x', 0, 2, 0, 2], D7sus4: ['x', 'x', 0, 2, 1, 3],
  G: [3, 2, 0, 0, 0, 3], G7: [3, 2, 0, 0, 0, 1], Gmaj7: [3, 2, 0, 0, 0, 2], G6: [3, 2, 0, 0, 0, 0], Gadd9: [3, 2, 0, 2, 0, 3],
  F: [1, 3, 3, 2, 1, 1], Fmaj7: ['x', 'x', 3, 2, 1, 0],
  B7: ['x', 2, 1, 2, 0, 2],
}

// Chord suffix (everything after the root) → quality key. Order matters: the longest,
// most specific suffixes are matched first so "maj7" beats "m"/"7", "madd9" beats "m", etc.
const SUFFIX: [RegExp, string][] = [
  [/^(maj7|M7|Δ7?)$/, 'maj7'],
  [/^(madd9|m\(add9\)|min add9)$/i, 'madd9'],
  [/^(7sus4|7sus)$/i, '7sus4'],
  [/^(7#9|7\+9)$/, '7#9'],
  [/^(m6|min6)$/i, 'm6'],
  [/^(m7|min7|-7)$/i, 'm7'],
  [/^(sus2|2)$/i, 'sus2'],
  [/^(sus4|sus)$/i, 'sus4'],
  [/^add9$/i, 'add9'],
  [/^6$/, '6'],
  [/^7$/, '7'],
  [/^5$/, '5'],
  [/^(m|min|-)$/i, 'min'],
  [/^$/, 'maj'],
]

// Parse a chord token ("F#m7", "Cadd9", "G/B") into { root, quality }. Slash-bass is
// dropped — the diagram shows the chord shape, not the specific bass inversion.
function parseChord(name: string): { root: string; quality: string } | null {
  const match = name.trim().match(/^([A-G][#b]?)(.*)$/)
  if (!match) return null
  const root = match[1] // NOTE maps both sharp and flat spellings
  const rest = match[2].split('/')[0]
  const entry = SUFFIX.find(([re]) => re.test(rest))
  if (!entry) return null
  return { root, quality: entry[1] }
}

// Build a movable barre voicing from a quality shape, choosing the E-shape or A-shape
// form — whichever lands on the lower fret (the standard, most playable choice).
function generate(rootNote: number, quality: string): ChordShape | null {
  const shape = QUALITY[quality]
  if (!shape) return null
  const eFret = ((rootNote - 4) % 12 + 12) % 12 // barre fret with root on the 6th string
  const aFret = ((rootNote - 9) % 12 + 12) % 12 // barre fret with root on the 5th string
  const useE = !shape.a || eFret <= aFret
  const base = useE ? shape.e : shape.a!
  const fret = useE ? eFret : aFret
  return base.map((offset) => (offset === 'x' ? 'x' : offset + fret))
}

// Look up (or generate) the voicing for a chord name. Returns null when the chord can't
// be voiced (unknown quality like dim/aug, or an unparseable token) — the caller shows
// the name without a diagram in that case.
export function chordShape(name: string): ChordShape | null {
  const bare = name.trim().split('/')[0]
  if (OPEN[bare]) return OPEN[bare]
  const parsed = parseChord(name)
  if (!parsed) return null
  const rootNote = NOTE[parsed.root]
  if (rootNote === undefined) return null
  return generate(rootNote, parsed.quality)
}
