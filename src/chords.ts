// Parses pasted tab/chord text (Ultimate Guitar copy/paste style) into lines of
// inline chord + lyric parts. In that format each chord sits on its own line,
// splitting the lyric it lands on ("You could've b / C / een all I wanted"),
// and lyric-line boundaries are blank or whitespace-only lines — so breaks are
// the only line delimiters and everything between them flows into one line.
export interface SheetPart { chord?: string; text?: string }
export interface SheetLine { kind: 'lyric' | 'tab' | 'section'; parts: SheetPart[]; raw: string }
export interface ParsedSheet { meta: string[]; lines: SheetLine[] }

// A-G root, optional accidental, common qualities/extensions, optional slash bass.
// Known ambiguity, accepted: a lyric line that is entirely one chord-shaped word
// ("A", "Am", "Em") classifies as a chord — inherent to this format, rare in practice.
const CHORD_RE = /^[A-G][#b]?(?:maj|min|dim|aug|sus|add|m|M|\+|°)?\d*(?:(?:maj|min|sus|add|b|#)\d+)*(?:\/[A-G][#b]?)?$/
const TAB_RE = /\|-{2,}|-{2,}\||^\s*[eEBGDAd]\s*\|-/
// Metadata must have its telltale shape ("Standard (…)", "Drop D", "Capo 3", "Key: G"),
// otherwise a lyric that merely opens with one of these words would be eaten as meta.
const META_RE = /^(?:standard\s*\(|drop\s+[a-g]\b|tuning\s*[:\-]|capo\s*[:\-]?\s*\d|key\s*[:\-]\s*[a-g]\b)/i

export const isChordToken = (token: string) => CHORD_RE.test(token)

function isChordLine(trimmed: string) {
  const tokens = trimmed.split(/\s+/)
  return tokens.length > 0 && tokens.every(isChordToken)
}

export function parseChordSheet(text: string): ParsedSheet {
  const meta: string[] = []
  const lines: SheetLine[] = []
  let current: SheetPart[] = []
  let sawChord = false

  const flush = () => {
    const last = current[current.length - 1]
    if (last?.text) last.text = last.text.replace(/\s+$/, '')
    if (current.some((part) => part.chord || part.text?.trim())) lines.push({ kind: 'lyric', parts: current.filter((part) => part.chord || part.text), raw: '' })
    current = []
  }

  for (const rawLine of text.split(/\r?\n/)) {
    const trimmed = rawLine.trim()
    if (!trimmed) { flush(); continue }
    if (TAB_RE.test(rawLine)) { flush(); lines.push({ kind: 'tab', parts: [], raw: rawLine.replace(/\s+$/, '') }); sawChord = true; continue }
    if (/^\[.+\]$/.test(trimmed)) { flush(); lines.push({ kind: 'section', parts: [], raw: trimmed.slice(1, -1) }); continue }
    if (!sawChord && current.length === 0 && META_RE.test(trimmed)) { meta.push(trimmed); continue }
    if (isChordLine(trimmed)) {
      sawChord = true
      for (const token of trimmed.split(/\s+/)) current.push({ chord: token })
      continue
    }
    // Trailing space is meaningful mid-line ("But ␣" before a chord that lands on
    // the next word) — only the line start/end get trimmed (start here, end in flush).
    // Two text fragments meeting without a chord between them is a hard-wrapped
    // lyric line, not a mid-word chord split — keep the words apart.
    const prev = current[current.length - 1]
    if (prev?.text !== undefined && !/\s$/.test(prev.text)) prev.text += ' '
    current.push({ text: current.length === 0 ? rawLine.replace(/^\s+/, '') : rawLine })
  }
  flush()
  return { meta, lines }
}

// --- Show-mode cheat sheet helpers -----------------------------------------

// Collapse consecutive duplicate chords: [Em, Em, C, C, G] -> [Em, C, G].
function dedupeChords(chords: string[]): string[] {
  const out: string[] = []
  for (const chord of chords) if (chord !== out[out.length - 1]) out.push(chord)
  return out
}

// A song with no [Section] markers reads as one long run of its repeating loop
// (Em C G D Em C G D …). If the run is an exact tiling of a shorter cycle, show one
// cycle; otherwise leave it as-is (a real through-progression, or an imperfect loop).
function collapseCycle(chords: string[]): string[] {
  const n = chords.length
  for (let period = 1; period <= n / 2; period++) {
    if (n % period !== 0) continue
    let tiles = true
    for (let i = period; i < n && tiles; i++) if (chords[i] !== chords[i % period]) tiles = false
    if (tiles) return chords.slice(0, period)
  }
  return chords
}

// A compact chord progression for the live cheat card: one row per distinct chord
// sequence, labelled with the section(s) that use it. When every section shares the
// same sequence (the "Em C G D the whole song" case) it collapses to a single
// "Whole song" row. Chords before the first [Section] header fall under a blank label.
// Returns null when the sheet has no detectable chords.
export interface ProgressionRow { label: string; chords: string[] }

export function chordProgression(text: string): ProgressionRow[] | null {
  const sheet = parseChordSheet(text)
  const sections: { label: string; chords: string[] }[] = []
  let current: { label: string; chords: string[] } | null = null
  const open = (label: string) => { current = { label, chords: [] }; sections.push(current) }
  for (const line of sheet.lines) {
    if (line.kind === 'section') {
      if (/^amp\b/i.test(line.raw.trim())) continue // mid-song amp marker, not a section
      open(line.raw.trim())
      continue
    }
    if (line.kind !== 'lyric') continue
    if (!current) open('')
    for (const part of line.parts) if (part.chord) current!.chords.push(part.chord)
  }
  // Group by identical (deduped) chord sequence, preserving first-seen order.
  const groups: { seq: string; labels: string[]; chords: string[] }[] = []
  for (const section of sections) {
    const chords = collapseCycle(dedupeChords(section.chords))
    if (!chords.length) continue
    const seq = chords.join(' ')
    const existing = groups.find((group) => group.seq === seq)
    if (existing) { if (section.label && !existing.labels.includes(section.label)) existing.labels.push(section.label) }
    else groups.push({ seq, labels: section.label ? [section.label] : [], chords })
  }
  if (!groups.length) return null
  // Most chord sheets are raw UG paste with no [Section] markers, so the whole song is
  // one group. If it collapses to a short loop, show that progression; otherwise the run
  // is a full arrangement (verse≠chorus, bridges) that's useless as a one-screen cheat —
  // fall back to the distinct chords used, in first-appearance order ("Chords: Em C D G").
  const MAX = 8
  const display = (chords: string[]): { label: string; chords: string[] } =>
    chords.length <= MAX ? { label: 'progression', chords } : { label: 'chords', chords: [...new Set(chords)] }
  if (groups.length === 1) {
    const shown = display(groups[0].chords)
    return [{ label: shown.label === 'progression' ? 'Whole song' : 'Chords used', chords: shown.chords }]
  }
  return groups.map((group) => ({ label: group.labels.join(' / ') || 'Section', chords: display(group.chords).chords }))
}

// Canonical section names, matched by prefix. Longer/qualified forms (Pre-Chorus,
// Post-Chorus) come before the bare form so they win. A bracket label is kept only if it
// starts with one of these — that drops incidental asides ("[x2]", "[play 6 times]") and
// Songsterr rehearsal letters ("[A]".."[P]"), and collapses variants ("Chorus 2",
// "Chorus A3 (Clean)", "solo") to the canonical chip so the checklist stays clean.
const SECTIONS = ['Intro', 'Verse', 'Pre-Chorus', 'Post-Chorus', 'Chorus', 'Bridge', 'Solo', 'Interlude', 'Instrumental', 'Breakdown', 'Break', 'Refrain', 'Hook', 'Outro', 'Ending', 'Coda', 'Riff', 'Tag', 'Vamp', 'Build', 'Drop', 'Chant', 'Theme', 'Head', 'Turnaround', 'Part', 'Section']
const unify = (value: string) => value.toLowerCase().replace(/[\s-]+/g, ' ')

// Ordered, de-duplicated canonical section labels for the learning checklist. Works on a
// chord sheet or verbatim tab text (both use "[Intro]" / "[Chorus 1]" markers, and tab
// exports sometimes nest a rehearsal mark as "[[A] Chorus 1]").
export function sectionLabels(text: string): string[] {
  const normalized = text.replace(/\[\s*\[[^\]\n]*\]\s*/g, '[') // "[[A] Chorus 1]" -> "[Chorus 1]"
  const out: string[] = []
  for (const match of normalized.matchAll(/\[([^\][\n]+)\]/g)) {
    const key = unify(match[1])
    const canon = SECTIONS.find((section) => key.startsWith(unify(section)))
    if (canon && !out.includes(canon)) out.push(canon)
  }
  return out
}

// Compact form for show mode: chord sequence + a short lyric cue per line.
export interface CompactLine { kind: 'lyric' | 'tab' | 'section'; chords: string[]; cue: string }

export function compactSheet(sheet: ParsedSheet, cueLength = 30): CompactLine[] {
  return sheet.lines.map((line) => {
    if (line.kind !== 'lyric') return { kind: line.kind, chords: [], cue: line.raw }
    const chords = line.parts.filter((part) => part.chord).map((part) => part.chord!)
    const words = line.parts.map((part) => part.text || '').join('').replace(/\s+/g, ' ').trim()
    const cue = words.length > cueLength ? `${words.slice(0, cueLength).replace(/\s+\S*$/, '')}…` : words
    return { kind: 'lyric', chords, cue }
  })
}
