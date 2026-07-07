import rawPresets from './data/amp-presets.json'

// Song → Mustang I V2 preset assignments, extracted from amp-presets/AMP-SETUP.md §3.
// The amp's PRESET knob has 8 positions across three color banks, so slot 1–24
// is spoken as position + bank: 1–8 = Amber, 9–16 = Green, 17–24 = Red
// (slot 10 → "2Green").
export interface AmpAssignment { presets: number[], joiner: '' | '→' | '↔', notes: string }

export const ampPresets = rawPresets as Record<string, AmpAssignment>

export type PresetBank = 'Amber' | 'Green' | 'Red'
const banks: PresetBank[] = ['Amber', 'Green', 'Red']

export const presetBank = (slot: number): PresetBank => banks[Math.min(2, Math.max(0, Math.floor((slot - 1) / 8)))]
export const presetPosition = (slot: number) => ((slot - 1) % 8) + 1
export const presetLabel = (slot: number) => String(presetPosition(slot))

// Reverse of the old "<position><bank>" label (e.g. "7Red", "2Green") back into a
// slot number 1-24 — used to parse mid-song amp markers like [Amp: 7Red] authored
// in a song's chords/tabs sheet text.
export function parsePresetLabel(label: string): number | null {
  const match = label.trim().match(/^(\d+)\s*([A-Za-z]+)$/)
  if (!match) return null
  const position = Number(match[1])
  if (position < 1 || position > 8) return null
  const bankIndex = banks.findIndex((bank) => bank.toLowerCase() === match[2].toLowerCase())
  if (bankIndex < 0) return null
  return bankIndex * 8 + position
}
