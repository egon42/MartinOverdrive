import type { Song } from './types'

export type FretboardVersion = 'standard' | 'original'

export interface ResolvedFretboards {
  standard: string
  original: string
  hasToggle: boolean
}

export function shiftFrets(pattern: string, amount: number) {
  return pattern.replace(/\d+/g, (match) => String(Number(match) + amount))
}

// Shared with ScalePattern (components.tsx): a fretboard value string is
// "<name>: <fret pattern>[, or <alt pattern>]" — this is just the name half.
export function scaleName(value: string) {
  const colon = value.indexOf(':')
  return colon < 0 ? value.trim() : value.slice(0, colon).trim()
}

// A movable minor-pentatonic "box 1" shape repeats identically 12 frets higher
// (e.g. "box 1 at 5th" also works as "box 1 at 17th"). Only offered for box-1 shapes,
// and only when every shifted fret stays within reach of a typical 22-fret neck.
export function octaveUpVariant(value: string): { fret: number, value: string } | null {
  const colon = value.indexOf(':')
  if (colon < 0) return null
  const name = value.slice(0, colon).trim()
  if (!/minor box 1/i.test(name)) return null
  const rest = value.slice(colon + 1)
  const firstPattern = rest.split(/,\s*or\s+/i)[0]
  const frets = [...firstPattern.matchAll(/\d+/g)].map((match) => Number(match[0]))
  if (!frets.length) return null
  const minFret = Math.min(...frets)
  const maxFret = Math.max(...frets)
  if (maxFret + 12 > 22) return null
  const fret = minFret + 12
  const baseName = name.match(/^(.*box 1)\b/i)?.[1] || name
  return { fret, value: `${baseName} at ${fret}th: ${shiftFrets(firstPattern, 12)}` }
}

export function ebMinor11ToEMinorOpen(value: string) {
  const colon = value.indexOf(':')
  if (colon < 0) return value
  const pattern = value.slice(colon + 1).split(/,\s*or\s+/i)[0]
  return `E minor box 1 open/12th: ${shiftFrets(pattern, -11)}`
}

export function eMinor12ToEbMinor11(value: string) {
  const colon = value.indexOf(':')
  if (colon < 0) return value
  const pattern = value.slice(colon + 1).split(/,\s*or\s+/i)[0]
  return `Eb minor box 1 at 11th: ${shiftFrets(pattern, -1)}`
}

export function needsFretboardToggle(song: Pick<Song, 'recordingNote' | 'pentatonicBoxStandard' | 'pentatonicBox'>) {
  if (song.pentatonicBoxStandard && song.pentatonicBoxStandard !== song.pentatonicBox) return true
  return /eb|original|depending band\/tab/i.test(song.recordingNote || '')
}

export function resolveFretboards(song: Pick<Song, 'pentatonicBox' | 'pentatonicBoxStandard' | 'recordingNote'>): ResolvedFretboards {
  const imported = song.pentatonicBox
  const explicitStandard = song.pentatonicBoxStandard?.trim()

  if (explicitStandard && explicitStandard !== imported) {
    return { standard: explicitStandard, original: imported, hasToggle: true }
  }

  if (needsFretboardToggle(song)) {
    if (/Eb minor/i.test(imported)) {
      const standard = ebMinor11ToEMinorOpen(imported)
      return { standard, original: imported, hasToggle: standard !== imported }
    }
    if (/E minor/i.test(imported) && /\b12(?:th)?\b/.test(imported)) {
      const original = eMinor12ToEbMinor11(imported)
      return { standard: imported, original, hasToggle: original !== imported }
    }
  }

  return { standard: imported, original: imported, hasToggle: false }
}

export function fretboardForVersion(song: Pick<Song, 'pentatonicBox' | 'pentatonicBoxStandard' | 'recordingNote'>, version: FretboardVersion) {
  const resolved = resolveFretboards(song)
  return version === 'original' ? resolved.original : resolved.standard
}

// Stage "home row" frets for box-1 scales — the fret where the shape starts (and its
// +12 twin when it fits on the neck). Used as hollow chips next to the amp presets.
// When the scale name already lists multiple homes ("open/12th", "1st/13th", "or … at 5th"),
// those win; otherwise it's primary pattern fret + optional octave-up.
export function homeFretsFor(song: Pick<Song, 'pentatonicBox' | 'pentatonicBoxStandard' | 'recordingNote'>): number[] {
  const value = fretboardForVersion(song, 'standard')
  if (!value?.trim()) return []
  const name = scaleName(value)
  const named = new Set<number>()
  if (/\bopen\b/i.test(name)) named.add(0)
  for (const match of name.matchAll(/\b(\d+)(?:st|nd|rd|th)\b/gi)) named.add(Number(match[1]))

  if (named.size >= 2) return [...named].sort((a, b) => a - b)

  const colon = value.indexOf(':')
  const pattern = (colon < 0 ? value : value.slice(colon + 1)).split(/,\s*or\s+/i)[0]
  const patternFrets = [...pattern.matchAll(/\d+/g)].map((match) => Number(match[0]))
  const frets = new Set<number>(named)
  if (patternFrets.length) frets.add(Math.min(...patternFrets))
  const up = octaveUpVariant(value)
  if (up) frets.add(up.fret)
  return [...frets].sort((a, b) => a - b)
}
