import { useState } from 'react'
import raw from './data/setlists.json'
import { songs } from './data'
import { tonightsSongs } from './setlist'
import type { PracticeEntry, Song } from './types'

// Premade practice setlists: hand-curated song runs in src/data/setlists.json (NOT
// importer output, unlike setlist.json). The pick is DEVICE-LOCAL by design — it lives
// in localStorage beside the other show keys, never in the synced practice blob — so
// choosing "Woodshed" on the couch can't reorder the band's stage set on another phone.
//
// Walk-list semantics (activeWalkSongs):
//   'full'      -> tonightsSongs(get): the master setlist with the /set page's
//                  skipTonight + setPosition overlay applied. Today's behavior.
//   premade id  -> exactly that list's curated order, IGNORING skipTonight and
//                  setPosition. These are fixed practice playlists; the Tonight's-set
//                  tools (In/Out, move arrows, reset) only ever apply to the Full set.
//
// A songId staged here before the song lands in setlist.json is dropped silently at
// resolve time so the app keeps walking; npm run validate is what catches it at CI time.
//
// The setlist.tsx import below is a cycle (setlist.tsx renders the picker from here),
// but every use on both sides is inside a function body, so module init never touches a
// half-built binding. Do NOT import pages.tsx here — that one is a real circular hazard.

export interface PremadeSetlist {
  id: string
  name: string
  description: string
  songs: Song[]
}

/** Stored value (and <select> value) meaning "the master setlist plus tonight's edits". */
export const FULL_SET_ID = 'full'

const songById = new Map(songs.map((song) => [song.id, song]))

// A list that resolved to nothing (every curated id still missing from the catalog) is
// dropped whole, not offered as an empty pick: that keeps the picker, the /set page, the
// print header and the walk list from disagreeing about what is active. A list claiming
// the reserved 'full' id is dropped too: it would shadow the real Full set everywhere.
export const premadeSetlists: PremadeSetlist[] = raw.setlists.map((entry) => ({
  id: entry.id,
  name: entry.name,
  description: entry.description,
  songs: entry.songIds.map((id) => songById.get(id)).filter((song): song is Song => Boolean(song))
})).filter((setlist) => setlist.songs.length > 0 && setlist.id !== FULL_SET_ID)

/** The premade list for an id, or undefined for 'full' / an unknown stored value. */
export const premadeSetlistById = (id: string): PremadeSetlist | undefined =>
  premadeSetlists.find((setlist) => setlist.id === id)

const KEY_SUFFIX = import.meta.env.BASE_URL.includes('/dev/') ? '-dev' : ''
const SETLIST_KEY = `overdrive-setlist${KEY_SUFFIX}`

const readActiveSetlist = (): string => {
  try {
    const stored = localStorage.getItem(SETLIST_KEY) || ''
    return premadeSetlistById(stored) ? stored : FULL_SET_ID
  } catch { return FULL_SET_ID }
}

/** Which setlist this device is practicing from. No cross-tab machinery on purpose:
 *  the picker is a deliberate one-tap choice, not something another tab changes mid-set. */
export function useActiveSetlist(): [string, (id: string) => void] {
  const [id, setId] = useState(readActiveSetlist)
  const choose = (next: string) => {
    const value = premadeSetlistById(next) ? next : FULL_SET_ID
    setId(value)
    try { localStorage.setItem(SETLIST_KEY, value) } catch { /* storage unavailable */ }
  }
  return [id, choose]
}

/** The songs show mode and the print page walk, for the active setlist. Every premade
 *  list here has at least one song (see the filter above), so this can never strand show
 *  mode with an empty walk list. */
export function activeWalkSongs(get: (id: string) => PracticeEntry, activeId: string): Song[] {
  return premadeSetlistById(activeId)?.songs ?? tonightsSongs(get)
}
