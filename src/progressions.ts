import data from './data/progressions.json'
import versionsData from './data/progressionVersions.json'

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
// ["Intro", "Verse ×4", "Chorus", "Verse ×2", "Outro"]. Two stage cards render this
// data: the Chords card walks `form` (each label's base name — strip " ×N" / " xN" —
// looks up chords in `sections`; no Fills), and the Cheat card shows each section once
// in `sections` order with the fills, ignoring `form`. Without `form`, both show
// `sections` order.
//
// Prefer grouped repeats for mixed tiles inside one section ("(E A) ×3 (E G A) ×2").
// When the whole section is N plays of one cycle, put ×N on the form label instead
// ("Verse ×4" + chords "Em C D") — that reads clearer on stage than chord-chip ×N.
// Prefix a chord with ~ to keep the beat chip visible but mark it "don't play" ("F# ~A B").
// Use `|` to force a line break before the next span ("(C G Bb F Am G C) | (C G Bb F Am G Ab)").
// Parentheses alone do NOT stack lines — only `|` (or natural wrap) does.
export interface ProgSection { section: string; chords: string; shapes?: string; hint?: string; tab?: string; tabMore?: string }
export interface SongProgression { sections: ProgSection[]; form?: string[]; capo?: string }

/** One display unit on the cheat chord row: chord chips, optionally with a ×N badge. */
export interface CheatChordSpan {
  chords: string[]
  /** Parallel to `chords`: true = show chip for beat, don't play. */
  ghosts: boolean[]
  shapes: string[]
  times: number
  /** Force this span onto a new row (from `|` in the chord string). */
  breakBefore?: boolean
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

// Archived cheat-card versions (progressionVersions.json): every time a song's live
// entry gets rewritten (research pass, live correction), the previous entry is
// snapshotted there (scripts/snapshot-progression.mjs) so nothing right is lost.
// The dev deploy's cheat card offers a version dropdown to A/B them against the
// recording; the live progressions.json entry is always "Current".
export interface ProgressionVersion extends SongProgression { label: string }

const progressionVersions = versionsData as unknown as Record<string, ProgressionVersion[]>

/** Archived (non-current) versions for a song, newest first as stored. */
export function progressionVersionsFor(songId: string): ProgressionVersion[] {
  const list = progressionVersions[songId]
  if (!Array.isArray(list)) return []
  return list.filter((v) => v && typeof v.label === 'string' && v.label.trim() !== '' && Array.isArray(v.sections) && v.sections.length > 0)
}

/** "Verse ×4" / "Verse x2" → "Verse"; unchanged if no repeat suffix. */
export function formStepBase(label: string): string {
  return label.replace(/\s*[×xX]\s*\d+\s*$/u, '').trim()
}

/**
 * Parse cheat-card chord notation into display spans.
 * - "Em C G D" → one span per chord (times 1), or keep as singles
 * - "(E A) ×3 (E G A) ×2" → two grouped spans (same row; wrap only if narrow)
 * - "A B | C D" → line break before the span after `|`
 * - Bare chords may mix with groups: "Am (E A) ×2 G"
 * - "~A" / "(E ~A)" → ghost chip (shown for beat, don't play)
 * Throws on unbalanced parens, empty groups, or ×N not attached to a group.
 */
export function parseChordSpans(chords: string, shapes = ''): CheatChordSpan[] {
  const shapeTokens = shapes.trim() ? shapes.trim().split(/\s+/).filter(Boolean) : []
  const spans: { chords: string[]; ghosts: boolean[]; times: number; breakBefore?: boolean }[] = []
  const src = chords.trim()
  if (!src) return []

  const splitTokens = (raw: string) => {
    const chordsOut: string[] = []
    const ghostsOut: boolean[] = []
    for (const token of raw.trim().split(/\s+/).filter(Boolean)) {
      if (token.startsWith('~')) {
        const name = token.slice(1)
        if (!name) throw new Error(`empty ghost chord in "${chords}"`)
        chordsOut.push(name)
        ghostsOut.push(true)
      } else {
        chordsOut.push(token)
        ghostsOut.push(false)
      }
    }
    return { chords: chordsOut, ghosts: ghostsOut }
  }

  // Tokenize: "(...)", "×N"/"xN", "|", or a bare chord-ish token
  const re = /\(([^)]*)\)|[×xX]\s*(\d+)|\||([^\s×xX|()]+)/gu
  let match: RegExpExecArray | null
  let lastWasGroup = false
  let breakBeforeNext = false
  let cursor = 0

  while ((match = re.exec(src)) !== null) {
    const gap = src.slice(cursor, match.index).trim()
    if (gap) throw new Error(`unexpected "${gap}" in "${chords}"`)
    cursor = match.index + match[0].length

    if (match[0] === '|') {
      breakBeforeNext = true
      lastWasGroup = false
      continue
    }
    if (match[1] !== undefined) {
      const group = splitTokens(match[1])
      if (!group.chords.length) throw new Error(`empty chord group in "${chords}"`)
      spans.push({ ...group, times: 1, ...(breakBeforeNext ? { breakBefore: true } : {}) })
      breakBeforeNext = false
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
    const one = splitTokens(match[3])
    spans.push({ ...one, times: 1, ...(breakBeforeNext ? { breakBefore: true } : {}) })
    breakBeforeNext = false
    lastWasGroup = false
  }
  const trailing = src.slice(cursor).trim()
  if (trailing) throw new Error(`unexpected "${trailing}" in "${chords}"`)

  let shapeAt = 0
  return spans.map((span) => {
    const slice = shapeTokens.slice(shapeAt, shapeAt + span.chords.length)
    shapeAt += span.chords.length
    return {
      chords: span.chords,
      ghosts: span.ghosts,
      times: span.times,
      shapes: slice,
      ...(span.breakBefore ? { breakBefore: true } : {}),
    }
  })
}

/** Flatten spans to the sounded chord list (groups expanded by times; ghosts omitted). */
export function expandChordSpans(spans: CheatChordSpan[]): string[] {
  const out: string[] = []
  for (const span of spans) {
    for (let i = 0; i < span.times; i++) {
      for (let j = 0; j < span.chords.length; j++) {
        if (!span.ghosts[j]) out.push(span.chords[j])
      }
    }
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
      ? chords.trim().split(/\s+/).filter(Boolean).map((c, i) => {
          const ghost = c.startsWith('~')
          const name = ghost ? c.slice(1) : c
          return {
            chords: [name || c],
            ghosts: [ghost && !!name],
            times: 1,
            shapes: shapeTokens[i] ? [shapeTokens[i]] : [],
          }
        })
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

/** Rows for the Chords card (full song roadmap): form order when set, else sections
 * order. "Fills" pseudo-sections are excluded — fills live on the Cheat card. */
export function cheatRowsFor(prog: SongProgression): CheatRow[] {
  const bank = prog.sections.filter((s) => !/^fills$/i.test(s.section))
  const byName = new Map(bank.map((s) => [s.section, s]))

  if (prog.form?.length) {
    const seenHints = new Set<string>()
    return prog.form.map((label) => {
      const base = formStepBase(label)
      const section = byName.get(base) ?? byName.get(label)
      const row = sectionToRow(label, section)
      if (row.hint) {
        if (seenHints.has(base)) row.hint = undefined
        else seenHints.add(base)
      }
      return row
    })
  }

  return bank.map((s) => sectionToRow(s.section, s))
}

/** Rows for the Cheat card: the song's building blocks only — each section once, in
 * stored order, with its cycle, hint, and fills. The `form` roadmap is deliberately
 * ignored: this view trusts the player to know the song's shape. */
export function basicRowsFor(prog: SongProgression): CheatRow[] {
  return prog.sections.map((s) => sectionToRow(s.section, s))
}
