// Curated per-song practice sheets, stored as plain editable text in the repo:
//   src/data/sheets/<songId>.chords.txt — UG-style chord/lyric text (parsed by chords.ts)
//   src/data/sheets/<songId>.tabs.txt   — ASCII tab, rendered verbatim in monospace
//   src/data/sheets/<songId>.ryan.txt   — optional personal sheet (chord-sheet format,
//                                         may embed tab blocks); only rendered on devices
//                                         with the hidden Ryan sheets flag enabled
// Save the file and the glob picks it up — no manifest to maintain. Raw source
// material (exports, screenshots) goes in TabsAndChords\ (gitignored) until it's
// been converted to text here.
const chordFiles = import.meta.glob('./data/sheets/*.chords.txt', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const tabFiles = import.meta.glob('./data/sheets/*.tabs.txt', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const ryanFiles = import.meta.glob('./data/sheets/*.ryan.txt', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

export interface SongSheets { chords?: string, tabs?: string, ryan?: string }

export function sheetsFor(songId: string): SongSheets {
  return {
    chords: chordFiles[`./data/sheets/${songId}.chords.txt`],
    tabs: tabFiles[`./data/sheets/${songId}.tabs.txt`],
    ryan: ryanFiles[`./data/sheets/${songId}.ryan.txt`],
  }
}
