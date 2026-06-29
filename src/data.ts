import raw from './data/setlist.json'
import tabLinks from './data/tab-links.json'
import type { Song } from './types'

// Curated direct tab links live in tab-links.json and are merged over the
// importer-generated setlist here, so they survive a re-import of the XLSX.
const links = tabLinks as Record<string, { songsterr?: string; ultimateGuitar?: string }>

export const songs: Song[] = raw.songs.map((song) => ({
  ...(song as Omit<Song, 'ultimateGuitarUrl'>),
  songsterrUrl: links[song.id]?.songsterr || song.songsterrUrl || '',
  ultimateGuitarUrl: links[song.id]?.ultimateGuitar || ''
}))

export const importMeta = raw.meta
