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
  scrollSpeed: number // autoscroll px/s at 1× zoom; 0 = song seed (scrollSpeeds.json) else global default
  skipTonight: boolean // tonight's set: true = song sits out of show mode
  setPosition: number // tonight's set order override; 0 = use song.order
  bpm: number // metronome tempo override; 0 = use the researched default
  updatedAt: string
}

export type PracticeState = Record<string, PracticeEntry>
