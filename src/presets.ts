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
export const presetLabel = (slot: number) => `${presetPosition(slot)}${presetBank(slot)}`
