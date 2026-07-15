import data from './data/progressions.json'

// Curated per-section chord progressions for the live cheat card, keyed by song id. The
// .chords.txt sheets are raw chord-over-lyric paste with no section markers, so a compact
// "Verse: Em C G D / Chorus: …" summary can't be derived from them — these are researched
// per song and stored here. `chords` is a space-separated progression, optionally with
// parenthesized repeat groups: "(E A) ×3 (E G A) ×2". Plain tokens stay valid
// ("Em C G D"). `shapes`, when present, is space-separated 6-char fingerings (low-E →
// high-e; digit = fret, '-' = unplayed) aligned 1:1 with chord names as written — one
// pass of each group, not the expanded play-through. `hint` is a one-line how-to-play
// cue. `tab` / `tabMore` are ASCII fills (tabMore behind a "More fills" disclosure).
// Empty `chords` is fine when a section is tab-only.
//
// `form`, when present, is the linear song roadmap (order + repeats), e.g.
// ["Intro", "Verse ×4", "Chorus", "Verse ×2", "Outro"]. The cheat card renders rows in
// that order; each label's base name (strip " ×N" / " xN") looks up chords in `sections`.
// Fills stay at the end. Without `form`, `sections` order is used as before.
//
// Prefer grouped repeats for tiled cycles ("(E A) ×3 …") over writing the tile out.
// Form ×N is the roadmap (how many times that section appears); group ×N is inside the
// section's chord row.
export interface ProgSection { section: string; chords: string; shapes?: string; hint?: string; tab?: string; tabMore?: string }
export interface SongProgression { sections: ProgSection[]; form?: string[]; capo?: string }

/** One display unit on the cheat chord row: chord chips, optionally with a ×N badge. */
export interface CheatChordSpan {
  chords: string[]
  shapes: string[]
  times: number
}

export interface CheatRow {
  label: string
  spans: CheatChordSpan[]
  hint?: string
  tab?: string
  tabMore?: string
}

const progressions = data as Record<string, SongProgression>

export function progressionFor(songId: string): SongProgression | null {
  const entry = progressions[songId]
  return entry && entry.sections.length ? entry : null
}

/** "Verse ×4" / "Verse x2" → "Verse"; unchanged if no repeat suffix. */
export function formStepBase(label: string): string {
  return label.replace(/\s*[×xX]\s*\d+\s*$/u, '').trim()
}

/**
 * Parse cheat-card chord notation into display spans.
 * - "Em C G D" → one span per chord (times 1), or keep as singles
 * - "(E A) ×3 (E G A) ×2" → two grouped spans
 * - Bare chords may mix with groups: "Am (E A) ×2 G"
 * Throws on unbalanced parens, empty groups, or ×N not attached to a group.
 */
export function parseChordSpans(chords: string, shapes = ''): CheatChordSpan[] {
  const shapeTokens = shapes.trim() ? shapes.trim().split(/\s+/).filter(Boolean) : []
  const spans: { chords: string[]; times: number }[] = []
  const src = chords.trim()
  if (!src) return []

  // Tokenize: "(...)", "×N"/"xN", or a bare chord-ish token
  const re = /\(([^)]*)\)|[×xX]\s*(\d+)|([^\s×xX()]+)/gu
  let match: RegExpExecArray | null
  let lastWasGroup = false
  let cursor = 0

  while ((match = re.exec(src)) !== null) {
    const gap = src.slice(cursor, match.index).trim()
    if (gap) throw new Error(`unexpected "${gap}" in "${chords}"`)
    cursor = match.index + match[0].length

    if (match[1] !== undefined) {
      const groupChords = match[1].trim().split(/\s+/).filter(Boolean)
      if (!groupChords.length) throw new Error(`empty chord group in "${chords}"`)
      spans.push({ chords: groupChords, times: 1 })
      lastWasGroup = true
      continue
    }
    if (match[2] !== undefined) {
      const times = Number(match[2])
      if (!Number.isFinite(times) || times < 2) throw new Error(`repeat must be ≥2 in "${chords}"`)
      if (!lastWasGroup || !spans.length) throw new Error(`×${times} must follow a (…) group in "${chords}"`)
      spans[spans.length - 1].times = times
      lastWasGroup = false
      continue
    }
    spans.push({ chords: [match[3]], times: 1 })
    lastWasGroup = false
  }
  const trailing = src.slice(cursor).trim()
  if (trailing) throw new Error(`unexpected "${trailing}" in "${chords}"`)

  let shapeAt = 0
  return spans.map((span) => {
    const slice = shapeTokens.slice(shapeAt, shapeAt + span.chords.length)
    shapeAt += span.chords.length
    return { chords: span.chords, times: span.times, shapes: slice }
  })
}

/** Flatten spans to the sounded chord list (groups expanded by times). */
export function expandChordSpans(spans: CheatChordSpan[]): string[] {
  const out: string[] = []
  for (const span of spans) {
    for (let i = 0; i < span.times; i++) out.push(...span.chords)
  }
  return out
}

function sectionToRow(label: string, section: ProgSection | undefined): CheatRow {
  const chords = section?.chords ?? ''
  const shapes = section?.shapes ?? ''
  let spans: CheatChordSpan[] = []
  try {
    spans = chords ? parseChordSpans(chords, shapes) : []
  } catch {
    // Fall back to naive split so a bad curated string still shows something on stage
    const shapeTokens = shapes.trim() ? shapes.trim().split(/\s+/).filter(Boolean) : []
    spans = chords.trim()
      ? chords.trim().split(/\s+/).filter(Boolean).map((c, i) => ({
          chords: [c],
          times: 1,
          shapes: shapeTokens[i] ? [shapeTokens[i]] : [],
        }))
      : []
  }
  return {
    label,
    spans,
    hint: section?.hint,
    tab: section?.tab,
    tabMore: section?.tabMore,
  }
}

/** Rows for the cheat card: form order when set, else sections order. Fills always last. */
export function cheatRowsFor(prog: SongProgression): CheatRow[] {
  const fills = prog.sections.filter((s) => /^fills$/i.test(s.section))
  const bank = prog.sections.filter((s) => !/^fills$/i.test(s.section))
  const byName = new Map(bank.map((s) => [s.section, s]))

  if (prog.form?.length) {
    const seenHints = new Set<string>()
    const rows = prog.form.map((label) => {
      const base = formStepBase(label)
      const section = byName.get(base) ?? byName.get(label)
      const row = sectionToRow(label, section)
      if (row.hint) {
        if (seenHints.has(base)) row.hint = undefined
        else seenHints.add(base)
      }
      return row
    })
    for (const fill of fills) rows.push(sectionToRow(fill.section, fill))
    return rows
  }

  return prog.sections.map((s) => sectionToRow(s.section, s))
}
