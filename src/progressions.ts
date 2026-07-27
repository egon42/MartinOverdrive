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
// Prefix a chord with + for a short tag hit, not a full measure ("E F +G").
// Prefix a chord with * for an alternate chip ("G A D *F#m"): rendered in the hint blue,
// meaning play it instead of its neighbor on the pass the section hint names.
// Distinct markers stack on one chip ("*+G" = blue alternate tag; "*~Am" = skip-marked:
// normal filled chip with a dashed blue border, played normally but skipped on the pass
// the section hint names).
// Use `|` to force a line break before the next span ("(C G Bb F Am G C) | (C G Bb F Am G Ab)").
// Parentheses alone do NOT stack lines — only `|` (or natural wrap) does.
export interface ProgSection {
  /** Unique id within the song; `form` entries reference it. Not shown when `pattern` is set. */
  section: string
  chords: string
  shapes?: string
  hint?: string
  tab?: string
  tabMore?: string
  /** Omit from Cheat (building-blocks) tab; still available on Chords roadmap via form. */
  cheatHide?: boolean
  /**
   * Display label: the name of the chord PATTERN this spot plays, shared with the
   * `@Name` chips on the Lyrics sheet so both surfaces use one vocabulary. Several
   * spots can name the same pattern (Thunderstruck plays a bare B5 in five of them);
   * the Cheat tab then shows that pattern once, while the Chords roadmap still walks
   * every spot and keeps its own hint, so verse 1 and verse 2 stay tellable apart.
   * `section` stays unique and stays the `form` key.
   */
  pattern?: string
  /**
   * Opt in to sharing a `pattern` with a spot that plays it DIFFERENTLY (Thunderstruck's
   * solo is the Knees figure entered on E5 instead of A5). Without this the validator
   * rejects same-pattern sections whose chords disagree, so a merge can't quietly hide a
   * different figure behind a shared name. The Cheat card still collapses to one row and
   * tap-to-play still strums the first spelling — the roadmap is where the variant shows.
   */
  patternVariant?: boolean
  /**
   * Beats per chord for tap-to-play, aligned 1:1 with `chords` as written (one pass of
   * each group, same rule as `shapes`). Omitted chords get DEFAULT_PATTERN_BEATS.
   */
  beats?: number[]
}
export interface SongProgression { sections: ProgSection[]; form?: string[]; capo?: string }

/** One display unit on the cheat chord row: chord chips, optionally with a ×N badge. */
export interface CheatChordSpan {
  chords: string[]
  /** Parallel to `chords`: true = show chip for beat, don't play. */
  ghosts: boolean[]
  /** Parallel to `chords`: true = short tag hit, not a full measure. */
  tags: boolean[]
  /** Parallel to `chords`: true = alternate (blue) chip, played instead on the pass the hint names. */
  alts: boolean[]
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

/** First curated 6-char fingering per chord name from the song's cheat card (section order). */
const curatedShapeCache = new Map<string, Map<string, string>>()

export function curatedShapesForSong(songId: string): Map<string, string> {
  const cached = curatedShapeCache.get(songId)
  if (cached) return cached
  const map = new Map<string, string>()
  const prog = progressionFor(songId)
  if (prog) {
    for (const section of prog.sections) {
      if (!section.chords?.trim() || !section.shapes?.trim()) continue
      try {
        for (const span of parseChordSpans(section.chords, section.shapes)) {
          for (let i = 0; i < span.chords.length; i++) {
            const shape = span.shapes[i]
            if (shape && !map.has(span.chords[i])) map.set(span.chords[i], shape)
          }
        }
      } catch {
        const names = section.chords.trim().split(/\s+/).filter(Boolean)
        const shapes = section.shapes.trim().split(/\s+/).filter(Boolean)
        names.forEach((raw, i) => {
          const name = raw.replace(/^[~+*]+/u, '')
          if (name && shapes[i] && !map.has(name)) map.set(name, shapes[i])
        })
      }
    }
  }
  curatedShapeCache.set(songId, map)
  return map
}

export function curatedShapeForChord(songId: string, chord: string): string | undefined {
  return curatedShapesForSong(songId).get(chord)
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

const REPEAT_SUFFIX_RE = /\s*[×xX]\s*\d+\s*$/u

/** "Verse ×4" / "Verse x2" → "Verse"; unchanged if no repeat suffix. */
export function formStepBase(label: string): string {
  return label.replace(REPEAT_SUFFIX_RE, '').trim()
}

/** What a row is labelled on the cards: the pattern name when set, else the section id. */
export function sectionLabel(section: ProgSection | undefined, formLabel?: string): string {
  const fallback = formLabel ?? section?.section ?? ''
  if (!section?.pattern) return fallback
  // Keep the roadmap's repeat badge: "Chorus ×2" under pattern "Hook" reads "Hook ×2".
  return section.pattern + (fallback.match(REPEAT_SUFFIX_RE)?.[0] ?? '')
}

/** Beats a pattern chord gets when the card doesn't say — half a bar of 4/4. */
export const DEFAULT_PATTERN_BEATS = 2

/** A pattern's sounded chords with their curated shapes and beat lengths, for tap-to-play. */
export interface PatternPlayback { chords: string[]; shapes: (string | undefined)[]; beats: number[] }

/**
 * Look a Lyrics-sheet `@Name` chip up against the song's cheat card. Matches the pattern
 * label first, then the raw section id, so a sheet can chip a song whose card has no
 * pattern names yet. Ghost chords are dropped: the chip means "don't play" there too.
 */
export function patternPlaybackFor(songId: string, name: string): PatternPlayback | null {
  const prog = progressionFor(songId)
  if (!prog) return null
  const wanted = name.trim().toLowerCase()
  const section = prog.sections.find((s) => (s.pattern ?? '').toLowerCase() === wanted)
    ?? prog.sections.find((s) => s.section.toLowerCase() === wanted)
  if (!section?.chords?.trim()) return null
  let spans: CheatChordSpan[]
  try { spans = parseChordSpans(section.chords, section.shapes ?? '') } catch { return null }
  const out: PatternPlayback = { chords: [], shapes: [], beats: [] }
  let written = 0 // index into `beats`, which follows the written chords, not the expansion
  for (const span of spans) {
    for (let t = 0; t < span.times; t++) {
      for (let j = 0; j < span.chords.length; j++) {
        if (span.ghosts[j]) continue
        out.chords.push(span.chords[j])
        out.shapes.push(span.shapes[j])
        out.beats.push(section.beats?.[written + j] ?? DEFAULT_PATTERN_BEATS)
      }
    }
    written += span.chords.length
  }
  return out.chords.length ? out : null
}

/**
 * Parse cheat-card chord notation into display spans.
 * - "Em C G D" → one span per chord (times 1), or keep as singles
 * - "(E A) ×3 (E G A) ×2" → two grouped spans (same row; wrap only if narrow)
 * - "A B | C D" → line break before the span after `|`
 * - Bare chords may mix with groups: "Am (E A) ×2 G"
 * - "~A" / "(E ~A)" → ghost chip (shown for beat, don't play)
 * - "+G" / "(E F +G)" → tag chip (short hit, not a full measure)
 * - "*F#m" / "(G A D *F#m)" → alternate chip (hint blue; played instead on the pass the hint names)
 * - Distinct markers stack on one chip (duplicates throw): "*+G" = blue alternate tag;
 *   "*~Am" = skip-marked chip (normal fill, dashed blue border: played normally,
 *   skipped on the pass the hint names)
 * Throws on unbalanced parens, empty groups, or ×N not attached to a group.
 */
export function parseChordSpans(chords: string, shapes = ''): CheatChordSpan[] {
  const shapeTokens = shapes.trim() ? shapes.trim().split(/\s+/).filter(Boolean) : []
  const spans: { chords: string[]; ghosts: boolean[]; tags: boolean[]; alts: boolean[]; times: number; breakBefore?: boolean }[] = []
  const src = chords.trim()
  if (!src) return []

  const splitTokens = (raw: string) => {
    const chordsOut: string[] = []
    const ghostsOut: boolean[] = []
    const tagsOut: boolean[] = []
    const altsOut: boolean[] = []
    const markerNames: Record<string, string> = { '~': 'ghost', '+': 'tag', '*': 'alternate' }
    for (const token of raw.trim().split(/\s+/).filter(Boolean)) {
      let name = token
      const seen: string[] = []
      while (name && markerNames[name[0]]) {
        if (seen.includes(name[0])) throw new Error(`duplicate ${markerNames[name[0]]} marker in "${token}"`)
        seen.push(name[0])
        name = name.slice(1)
      }
      if (seen.length && !name) throw new Error(`empty ${markerNames[seen[0]]} chord in "${chords}"`)
      chordsOut.push(name)
      ghostsOut.push(seen.includes('~'))
      tagsOut.push(seen.includes('+'))
      altsOut.push(seen.includes('*'))
    }
    return { chords: chordsOut, ghosts: ghostsOut, tags: tagsOut, alts: altsOut }
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
      tags: span.tags,
      alts: span.alts,
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
          const tag = !ghost && c.startsWith('+')
          const alt = !ghost && !tag && c.startsWith('*')
          const name = ghost || tag || alt ? c.slice(1) : c
          return {
            chords: [name || c],
            ghosts: [ghost && !!name],
            tags: [tag && !!name],
            alts: [alt && !!name],
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
      const row = sectionToRow(sectionLabel(section, label), section)
      if (row.hint) {
        if (seenHints.has(base)) row.hint = undefined
        else seenHints.add(base)
      }
      return row
    })
  }

  return bank.map((s) => sectionToRow(sectionLabel(s), s))
}

/** Rows for the Cheat card: the song's building blocks only — each section once, in
 * stored order, with its cycle, hint, and fills. The `form` roadmap is deliberately
 * ignored: this view trusts the player to know the song's shape. Sections that name the
 * same `pattern` collapse to one row here (five bare-B5 spots are one building block);
 * sections without a pattern always keep their own row, their ids being unique already. */
export function basicRowsFor(prog: SongProgression): CheatRow[] {
  const seenPatterns = new Set<string>()
  const rows: CheatRow[] = []
  for (const s of prog.sections) {
    if (s.cheatHide) continue
    if (s.pattern) {
      // Case-folded, so "Chug"/"chug" can't render two rows yet resolve to one playback.
      const key = s.pattern.toLowerCase()
      // Never collapse away an ASCII fill: the Chords roadmap drops tabs entirely, so a
      // deduped tab-carrying section would be unreachable on every surface.
      if (seenPatterns.has(key) && !s.tab && !s.tabMore) continue
      seenPatterns.add(key)
    }
    rows.push(sectionToRow(sectionLabel(s), s))
  }
  return rows
}
