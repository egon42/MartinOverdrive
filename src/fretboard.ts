import type { Song } from './types'

export type FretboardVersion = 'standard' | 'original'

export interface ResolvedFretboards {
  standard: string
  original: string
  hasToggle: boolean
}

function shiftFrets(pattern: string, amount: number) {
  return pattern.replace(/\d+/g, (match) => String(Number(match) + amount))
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
