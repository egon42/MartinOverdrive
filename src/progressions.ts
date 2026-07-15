import data from './data/progressions.json'

// Curated per-section chord progressions for the live cheat card, keyed by song id. The
// .chords.txt sheets are raw chord-over-lyric paste with no section markers, so a compact
// "Verse: Em C G D / Chorus: …" summary can't be derived from them — these are researched
// per song and stored here. `chords` is a space-separated one-cycle progression.
// `shapes`, when present, is a space-separated list aligned 1:1 with `chords` — each a
// 6-char guitar fingering (low-E → high-e; digit = fret, '-' = string not played) curated
// to match the song's tab, so a power-chord riff shows its shapes (355--- -577-- …) under
// the chord names on the cheat card. `hint`, when present, is a one-line how-to-play cue
// (signature riff, strum feel, voicing trick) rendered under the section's chord row —
// for riff-driven songs where a bare chord list isn't enough to play along cold.
// `tab`, when present, is a compact ASCII tablature block (high-e on top, same as the
// .tabs.txt sheets) rendered in monospace under the row — used for Fills sections so the
// cheat card shows what to play, not a prose paraphrase. `tabMore`, when present, holds
// extra fills behind a collapsed "More fills" disclosure so the primary tabs stay
// stage-readable. Empty `chords` is fine when a section is tab-only (no ChordChips).
//
// `form`, when present, is the linear song roadmap (order + repeats), e.g.
// ["Intro", "Verse ×4", "Chorus", "Verse ×2", "Outro"]. The cheat card renders rows in
// that order; each label's base name (strip " ×N" / " xN") looks up chords in `sections`.
// Fills stay at the end. Without `form`, `sections` order is used as before.
export interface ProgSection { section: string; chords: string; shapes?: string; hint?: string; tab?: string; tabMore?: string }
export interface SongProgression { sections: ProgSection[]; form?: string[]; capo?: string }

export interface CheatRow {
  label: string
  chords: string[]
  shapes: string[]
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

function sectionToRow(label: string, section: ProgSection | undefined): CheatRow {
  return {
    label,
    chords: section?.chords ? section.chords.split(/\s+/).filter(Boolean) : [],
    shapes: section?.shapes ? section.shapes.split(/\s+/).filter(Boolean) : [],
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
