import data from './data/progressions.json'

// Curated per-section chord progressions for the live cheat card, keyed by song id. The
// .chords.txt sheets are raw chord-over-lyric paste with no section markers, so a compact
// "Verse: Em C G D / Chorus: …" summary can't be derived from them — these are researched
// per song and stored here. `chords` is a space-separated one-cycle progression.
export interface ProgSection { section: string; chords: string }
export interface SongProgression { sections: ProgSection[]; capo?: string }

const progressions = data as Record<string, SongProgression>

export function progressionFor(songId: string): SongProgression | null {
  const entry = progressions[songId]
  return entry && entry.sections.length ? entry : null
}
