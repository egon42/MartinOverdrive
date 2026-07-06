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
