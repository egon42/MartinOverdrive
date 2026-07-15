import data from './data/transpose.json'

// Curated per-song pitch-shift for playing along in standard E to the original recording.
// The band plays everything in standard E, but many originals were tracked below standard
// pitch (SRV, Green Day, Coheed, Volbeat all in Eb standard). To play along in standard, the YouTube
// backing track has to be pitched UP by `semitones` — done live with the Transpose browser
// extension — so the record's pitch lines up with the guitar. This is separate from
// `song.tuning` (the shape we actually play) and from `recordingNote` (free-text lore):
// it's the concrete number of steps to dial into Transpose. 0 / absent = no shift needed.
export interface SongTranspose {
  /** Semitones to shift the recording. Positive = pitch the video UP to reach standard E. */
  semitones: number
  /** The original recording's tuning, for the tooltip (e.g. "Eb standard"). */
  recordingTuning: string
}

const transposes = data as Record<string, SongTranspose>

export function transposeFor(songId: string): SongTranspose | null {
  const entry = transposes[songId]
  return entry && entry.semitones ? entry : null
}

// Signed label for a semitone count: 1 -> "+1", -2 -> "-2".
export function transposeLabel(semitones: number): string {
  return `${semitones > 0 ? '+' : ''}${semitones}`
}

// Human sentence for tooltips: "Original in Eb standard. Pitch the video up 1 semitone."
export function transposeHint({ semitones, recordingTuning }: SongTranspose): string {
  const dir = semitones > 0 ? 'up' : 'down'
  const n = Math.abs(semitones)
  const step = n === 1 ? 'semitone' : 'semitones'
  return `Original in ${recordingTuning}. Pitch the video ${dir} ${n} ${step} (Transpose ${transposeLabel(semitones)}) to match standard E.`
}
