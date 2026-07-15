import { Link } from 'react-router-dom'
import { songs } from './data'
import { usePractice } from './storage'
import type { PracticeEntry, Song } from './types'

// Tonight's set lives in per-song practice state (skipTonight + setPosition), so it syncs
// across devices through the normal per-song merge — no new sync machinery. setPosition 0
// means "use the setlist order"; a reorder swaps the two songs' effective positions, which
// only ever permutes the original order values, so effective positions stay unique.

const effectivePosition = (song: Song, entry: PracticeEntry) => entry.setPosition || song.order

export function setOrdered(get: (id: string) => PracticeEntry): Song[] {
  return [...songs].sort((a, b) => (effectivePosition(a, get(a.id)) - effectivePosition(b, get(b.id))) || a.order - b.order)
}

/** The songs show mode walks, in tonight's order. If every song is skipped (misconfig),
 * fall back to the full set rather than stranding show mode with nothing. */
export function tonightsSongs(get: (id: string) => PracticeEntry): Song[] {
  const ordered = setOrdered(get)
  const active = ordered.filter((song) => !get(song.id).skipTonight)
  return active.length ? active : ordered
}

export function SetlistPage() {
  const { get, patch } = usePractice()
  const ordered = setOrdered(get)
  const active = ordered.filter((song) => !get(song.id).skipTonight)
  const customized = ordered.some((song) => { const entry = get(song.id); return entry.setPosition !== 0 || entry.skipTonight })
  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir
    if (target < 0 || target >= ordered.length) return
    const a = ordered[index], b = ordered[target]
    const posA = effectivePosition(a, get(a.id)), posB = effectivePosition(b, get(b.id))
    // Two devices swapping concurrently can merge into duplicate positions (whole-entry
    // latest-wins sync); a plain swap of equal values would leave these buttons dead
    // forever. Nudge past the neighbor instead — the sort only compares, so fractional
    // positions are fine and the duplicate resolves in one press.
    if (posA === posB) { patch(a.id, { setPosition: posB + dir * 0.5 }); return }
    patch(a.id, { setPosition: posB })
    patch(b.id, { setPosition: posA })
  }
  const reset = () => { for (const song of ordered) { const entry = get(song.id); if (entry.setPosition !== 0 || entry.skipTonight) patch(song.id, { setPosition: 0, skipTonight: false }) } }
  // Show-mode sequence numbers count active songs only, so the list mirrors what the
  // 1/N counter on stage will say.
  let liveIndex = 0
  return <>
    <header className="page-title compact"><h1>Tonight’s set</h1></header>
    <div className="sort-row"><span>{active.length ? `${active.length} of ${songs.length} songs in the set` : 'Every song is skipped. Show mode will use the full set.'}</span><div className="actions">
      {customized && <button className="secondary" onClick={reset}>Reset to full set order</button>}
      <button className="secondary" onClick={() => window.print()}>Print set list</button>
      <Link className="button" to="/show">Show mode</Link>
    </div></div>
    <div className="setlist-rows">
      {ordered.map((song, index) => {
        const entry = get(song.id)
        const skipped = entry.skipTonight
        const seat = skipped ? '—' : String(++liveIndex).padStart(2, '0')
        return <div className={`setlist-row${skipped ? ' skipped' : ''}`} key={song.id}>
          <span className="setlist-seat">{seat}</span>
          <div className="setlist-main"><Link to={`/song/${song.id}`}><h3>{song.title}</h3></Link><p>{song.artist}{song.tuning !== 'Standard' ? ` · ${song.tuning}` : ''}</p></div>
          <label className="setlist-play"><input type="checkbox" checked={!skipped} onChange={(e) => patch(song.id, { skipTonight: !e.target.checked })} /><span>{skipped ? 'Out' : 'In'}</span></label>
          <div className="setlist-move">
            <button type="button" aria-label={`Move ${song.title} earlier`} disabled={index === 0} onClick={() => move(index, -1)}>↑</button>
            <button type="button" aria-label={`Move ${song.title} later`} disabled={index === ordered.length - 1} onClick={() => move(index, 1)}>↓</button>
          </div>
        </div>
      })}
    </div>
  </>
}
