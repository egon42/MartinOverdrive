export const statuses = ['Not Started', 'Learning', 'Rehearsal Ready', 'Show Ready'] as const
export type PracticeStatus = typeof statuses[number]

export interface Song {
  id: string
  order: number
  title: string
  artist: string
  difficulty: number | null
  tuning: string
  recordingNote: string
  role: string
  practiceStyle: string
  backingTrackUrl: string
  songsterrUrl: string
  ultimateGuitarUrl: string
  linkQuality: string
  scaleHint: string
  pentatonicBox: string
  pentatonicBoxStandard: string
  mustKnow: string
  fallback: string
  firstCue: string
  rehearsalNotes: string
  source: Record<string, string>
}

export type SectionConfidence = 'learned' | 'shaky'

export interface PracticeEntry {
  status: PracticeStatus
  notes: string
  lastPracticed: string
  sessions: number
  priority: number
  secondsPracticed: number
  savedSongsterrUrl: string
  savedUltimateGuitarUrl: string
  preferredSource: '' | 'songsterr' | 'ultimateGuitar' | 'chords' | 'tabs'
  // Per-section learning progress, keyed by section label ("Verse", "Chorus"). A
  // missing key means unset; only learned/shaky sections are stored.
  sections: Record<string, SectionConfidence>
  updatedAt: string
}

export type PracticeState = Record<string, PracticeEntry>
