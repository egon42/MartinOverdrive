// Parses pasted tab/chord text (Ultimate Guitar copy/paste style) into lines of
// inline chord + lyric parts. In that format each chord sits on its own line,
// splitting the lyric it lands on ("You could've b / C / een all I wanted"),
// and lyric-line boundaries are blank or whitespace-only lines — so breaks are
// the only line delimiters and everything between them flows into one line.
export interface SheetPart { chord?: string; ghost?: boolean; text?: string }
export interface SheetLine { kind: 'lyric' | 'tab' | 'section'; parts: SheetPart[]; raw: string }
export interface ParsedSheet { meta: string[]; lines: SheetLine[] }
/** One equal-width play-along column: chord (optional) + the lyric that follows it. */
export interface MeasureSlot { chord?: string; ghost?: boolean; text: string }

/** Regroup UG mid-word parts into measure columns — lyrics follow each chord, not the reverse. */
export function measureSlots(parts: SheetPart[]): MeasureSlot[] {
  const slots: MeasureSlot[] = []
  for (const part of parts) {
    if (part.chord) {
      slots.push({ chord: part.chord, ghost: part.ghost, text: '' })
      continue
    }
    if (part.text == null) continue
    if (slots.length === 0) slots.push({ text: part.text })
    else slots[slots.length - 1].text += part.text
  }
  return slots.filter((slot) => slot.chord || !!slot.text.trim())
}

// A-G root, optional accidental, common qualities/extensions, optional slash bass.
// Known ambiguity, accepted: a lyric line that is entirely one chord-shaped word
// ("A", "Am", "Em") classifies as a chord — inherent to this format, rare in practice.
const CHORD_RE = /^[A-G][#b]?(?:maj|min|dim|aug|sus|add|m|M|\+|°)?\d*(?:(?:maj|min|sus|add|b|#)\d+)*(?:\/[A-G][#b]?)?$/
// String-label form (`E |…`, `E-|…`, `B-|5-…`) or dash-run form (`|--2--|`, `2---|`).
const TAB_RE = /\|-{2,}|-{2,}\||^\s*[eEBGDAd]\s*-?\|/
// Metadata must have its telltale shape ("Standard (…)", "Drop D", "Capo 3", "Key: G"),
// otherwise a lyric that merely opens with one of these words would be eaten as meta.
const META_RE = /^(?:standard\s*\(|drop\s+[a-g]\b|tuning\s*[:\-]|capo\s*[:\-]?\s*\d|key\s*[:\-]\s*[a-g]\b)/i

export const isChordToken = (token: string) => CHORD_RE.test(token)
// Bare fret numbers (0–24) for single-string cues — rendered as fret chips, not chord
// diagrams (see ChordChip). Opt-in per sheet (the ryan sheets): a band lyrics sheet can
// legitimately sing a bare number ("18" in Mary Jane), which must stay lyric text.
const FRET_RE = /^(?:[0-9]|1[0-9]|2[0-4])$/
export const isFretToken = (token: string) => FRET_RE.test(token)
// B/G dyad frets for high-low play-along (Dream On): `6/5` = B string 6, G string 5.
const DYAD_FRET_RE = /^((?:[0-9]|1[0-9]|2[0-4]))\/((?:[0-9]|1[0-9]|2[0-4]))$/
export const isDyadFretToken = (token: string) => DYAD_FRET_RE.test(token)
export const dyadFrets = (token: string): { b: string; g: string } | null => {
  const match = DYAD_FRET_RE.exec(token)
  return match ? { b: match[1], g: match[2] } : null
}
// Numbered fill/join cues (`^1`, `^2`, … `^99`) — triangle chips that link a lyric word to
// a matching fill block. Same ryan opt-in as frets (band sheets must not eat a caret).
const CUE_RE = /^\^([1-9][0-9]?)$/
export const isCueToken = (token: string) => CUE_RE.test(token)
export const cueNumber = (token: string): number | null => {
  const match = CUE_RE.exec(token)
  return match ? Number(match[1]) : null
}

/** Prefix `~` = ghost chip (shown for the beat, don't play) — same marker as cheat-card progressions. */
function splitGhostToken(token: string): { name: string, ghost: boolean } {
  if (token.startsWith('~')) return { name: token.slice(1), ghost: true }
  return { name: token, ghost: false }
}

function isRyanToken(token: string, frets: boolean) {
  const { name } = splitGhostToken(token)
  return isChordToken(name) || (frets && (isFretToken(name) || isDyadFretToken(name) || isCueToken(name)))
}

function isChordLine(trimmed: string, frets: boolean) {
  const tokens = trimmed.split(/\s+/)
  return tokens.length > 0 && tokens.every((token) => isRyanToken(token, frets))
}

export function parseChordSheet(text: string, { frets = false }: { frets?: boolean } = {}): ParsedSheet {
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
    if (isChordLine(trimmed, frets)) {
      sawChord = true
      for (const token of trimmed.split(/\s+/)) {
        const { name, ghost } = splitGhostToken(token)
        current.push(ghost ? { chord: name, ghost: true } : { chord: name })
      }
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
  // Instrumental runs often arrive as one chord per blank-separated "line"
  // (Songsterr imports, UG pastes). Merge consecutive *single-chord* chord-only
  // lines so chips sit on one row instead of wasting a full row per chord.
  // Do not merge authored multi-chord rows (`D C G` / `E B C#m A`) — those stay
  // as separate cycles so measure map does not 4-pack a 3-chord loop into DCGD|CG.
  // Consecutive ASCII-tab string rows become one block so a 6-string fill stays
  // tight in the Lyrics view (each row alone would get .sheet-tab's per-line margin).
  return { meta, lines: mergeTabRuns(mergeChordOnlyRuns(lines)) }
}

function isChordOnlyLine(line: SheetLine) {
  return line.kind === 'lyric' && line.parts.length > 0 && line.parts.every((part) => part.chord)
}

function mergeChordOnlyRuns(lines: SheetLine[]): SheetLine[] {
  const out: SheetLine[] = []
  for (const line of lines) {
    const prev = out[out.length - 1]
    if (
      isChordOnlyLine(line) &&
      prev &&
      isChordOnlyLine(prev) &&
      prev.parts.length === 1 &&
      line.parts.length === 1
    ) {
      prev.parts.push(...line.parts)
      continue
    }
    out.push(line)
  }
  return out
}

function mergeTabRuns(lines: SheetLine[]): SheetLine[] {
  const out: SheetLine[] = []
  for (const line of lines) {
    const prev = out[out.length - 1]
    if (line.kind === 'tab' && prev?.kind === 'tab') {
      prev.raw += `\n${line.raw}`
      continue
    }
    out.push(line)
  }
  return out
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
      if (/^amp\b/i.test(line.raw.trim()) || /^stomp\b/i.test(line.raw.trim())) continue // mid-song amp/FS cue, not a section
      open(line.raw.trim())
      continue
    }
    if (line.kind !== 'lyric') continue
    if (!current) open('')
    for (const part of line.parts) if (part.chord && !isCueToken(part.chord) && !isFretToken(part.chord) && !isDyadFretToken(part.chord)) current!.chords.push(part.chord)
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
