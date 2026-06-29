import raw from './data/setlist.json'
import type { Song } from './types'

export const songs = raw.songs as Song[]
export const importMeta = raw.meta
