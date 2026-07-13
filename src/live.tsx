import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import QRCode from 'qrcode'
import { RealtimeClient, type RealtimeChannel } from '@supabase/realtime-js'
import { songs } from './data'
import { SUPABASE_ANON_KEY, SUPABASE_URL, isBackendConfigured } from './syncBackend'
import { normalizeCode } from './sync'

// Live show sync: the band leader's device broadcasts its current show-mode song over a
// Supabase Realtime channel; followers snap their own show mode to it. Pure websocket
// broadcast + presence — no tables, no SQL, nothing stored server-side, so it reuses the
// existing sync backend with zero setup. Access is gated the same way as practice sync:
// knowing the code IS the auth. Codes are short (5 chars) because a show session is
// ephemeral and the worst a guesser can do is see/flip song numbers for one night.

// Keyed per deployment like the practice/sync stores, so /dev/ and prod don't share a session.
const IS_DEV_DEPLOY = import.meta.env.BASE_URL.includes('/dev/')
const LIVE_KEY = IS_DEV_DEPLOY ? 'overdrive-live-dev' : 'overdrive-live'
// Mirrors SHOW_INDEX_KEY in pages.tsx (can't import it — pages imports this file). Seeds the
// leader's "current song" from the persisted show position, so a mid-set reload resumes
// broadcasting the right song even before show mode remounts.
const SHOW_INDEX_KEY = IS_DEV_DEPLOY ? 'overdrive-show-index-dev' : 'overdrive-show-index'
// Leader re-announces its song every 10s: late joiners and reconnecting followers resync
// without any server-side state. (Presence joins also trigger an immediate re-announce.)
const HEARTBEAT_MS = 10_000
// A persisted session older than this is stale (last night's show) — don't auto-resume it.
const SESSION_MAX_AGE_MS = 20 * 60 * 60 * 1000

export type LiveRole = 'lead' | 'follow'
export interface LiveConfig { role: LiveRole; code: string; at: number }
/** seq bumps only when the leader's song actually changes, so effects keyed on this object
 * re-fire per song change (including A→B→A) but not per heartbeat — a follower who paged
 * away to peek at another song isn't yanked back until the leader really moves. */
export interface LeaderSong { songId: string; seq: number }

interface LiveContextValue {
  config: LiveConfig | null
  connected: boolean
  followers: number
  leaderPresent: boolean
  leader: LeaderSong | null
  lead: () => void
  follow: (code: string) => void
  stop: () => void
  /** Show mode reports every song it displays; only a leading device broadcasts it. */
  reportSong: (songId: string) => void
}

// Same Crockford-style alphabet as sync codes (no I, L, O, U) — yellable across a stage.
const BASE32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
function generateShowCode(): string {
  const bytes = new Uint8Array(5)
  crypto.getRandomValues(bytes)
  return [...bytes].map((b) => BASE32[b & 31]).join('')
}

function loadLiveConfig(): LiveConfig | null {
  try {
    const raw = localStorage.getItem(LIVE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<LiveConfig>
    if (!parsed || (parsed.role !== 'lead' && parsed.role !== 'follow')) return null
    if (typeof parsed.code !== 'string' || !parsed.code) return null
    if (typeof parsed.at !== 'number' || Date.now() - parsed.at > SESSION_MAX_AGE_MS) return null
    return { role: parsed.role, code: parsed.code, at: parsed.at }
  } catch { return null }
}

function saveLiveConfig(config: LiveConfig | null) {
  if (config) localStorage.setItem(LIVE_KEY, JSON.stringify(config))
  else localStorage.removeItem(LIVE_KEY)
}

const LiveContext = createContext<LiveContextValue | null>(null)

export function LiveProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<LiveConfig | null>(loadLiveConfig)
  const [connected, setConnected] = useState(false)
  const [followers, setFollowers] = useState(0)
  const [leaderPresent, setLeaderPresent] = useState(false)
  const [leader, setLeader] = useState<LeaderSong | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  // Seed the leader's current song from the persisted show position, but only if it's a
  // real song id — a legacy numeric index or a removed song must not be broadcast.
  const songIdRef = useRef<string>((() => {
    const saved = localStorage.getItem(SHOW_INDEX_KEY) || ''
    return songs.some((s) => s.id === saved) ? saved : ''
  })())
  const configRef = useRef(config); useEffect(() => { configRef.current = config }, [config])

  const sendCurrent = useCallback(() => {
    const channel = channelRef.current
    if (!channel || configRef.current?.role !== 'lead' || !songIdRef.current) return
    channel.send({ type: 'broadcast', event: 'song', payload: { songId: songIdRef.current } }).catch(() => { /* dropped frames are healed by the heartbeat */ })
  }, [])

  // One channel per configured session. realtime-js reconnects the socket itself; on
  // rejoin the leader's presence-join handler + heartbeat put a follower back in sync.
  useEffect(() => {
    if (!config || !isBackendConfigured()) return
    const client = new RealtimeClient(`${SUPABASE_URL.replace(/^http/i, 'ws')}/realtime/v1`, { params: { apikey: SUPABASE_ANON_KEY } })
    // Deploy-namespaced like every other store: a /dev/ leader and a prod follower must
    // not share a channel — the two builds' song data can differ.
    const channel = client.channel(`show-${IS_DEV_DEPLOY ? 'dev-' : ''}${normalizeCode(config.code)}`, { config: { broadcast: { self: false } } })
    if (config.role === 'follow') {
      channel.on('broadcast', { event: 'song' }, ({ payload }) => {
        const songId = typeof payload?.songId === 'string' ? payload.songId : ''
        if (!songId) return
        setLeader((prev) => prev?.songId === songId ? prev : { songId, seq: (prev?.seq ?? 0) + 1 })
      })
    }
    // Presence listeners must be registered before subscribe() (that's what enables
    // presence on the join). Everyone tracks a role; the counts drive the status UI.
    channel.on('presence', { event: 'sync' }, () => {
      const everyone = Object.values(channel.presenceState<{ role?: string }>()).flat()
      setFollowers(everyone.filter((p) => p.role === 'follow').length)
      setLeaderPresent(everyone.some((p) => p.role === 'lead'))
    })
    if (config.role === 'lead') channel.on('presence', { event: 'join' }, () => sendCurrent())
    // Disposal flag: unsubscribe() arms a 10s leave timeout inside phoenix, and when it
    // fires the OLD channel's status callback gets CLOSED — after a stop/re-lead that
    // would stomp `connected` back to false while the new channel is healthy.
    let disposed = false
    channel.subscribe((status) => {
      if (disposed) return
      setConnected(status === 'SUBSCRIBED')
      if (status === 'SUBSCRIBED') {
        channel.track({ role: config.role }).catch(() => {})
        sendCurrent()
      }
    })
    channelRef.current = channel
    const heartbeat = config.role === 'lead' ? setInterval(sendCurrent, HEARTBEAT_MS) : null
    return () => {
      disposed = true
      if (heartbeat) clearInterval(heartbeat)
      channelRef.current = null
      setConnected(false); setFollowers(0); setLeaderPresent(false)
      channel.unsubscribe().catch(() => {})
      client.disconnect()
    }
  }, [config, sendCurrent])

  const apply = useCallback((next: LiveConfig | null) => {
    saveLiveConfig(next)
    setLeader(null)
    setConfig(next)
  }, [])

  // Deep link from the leader's QR code: ?follow=CODE joins as a follower, then strips the
  // param (same pattern as ?sync= in sync.tsx — the hash keeps routing to /show).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('follow')
    if (!code) return
    params.delete('follow')
    const qs = params.toString()
    window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash)
    apply({ role: 'follow', code: normalizeCode(code), at: Date.now() })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const lead = useCallback(() => apply({ role: 'lead', code: generateShowCode(), at: Date.now() }), [apply])
  const follow = useCallback((code: string) => { const c = normalizeCode(code); if (c) apply({ role: 'follow', code: c, at: Date.now() }) }, [apply])
  const stop = useCallback(() => apply(null), [apply])

  const reportSong = useCallback((songId: string) => {
    songIdRef.current = songId
    sendCurrent()
  }, [sendCurrent])

  const value = useMemo<LiveContextValue>(() => ({ config, connected, followers, leaderPresent, leader, lead, follow, stop, reportSong }),
    [config, connected, followers, leaderPresent, leader, lead, follow, stop, reportSong])
  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>
}

export function useLive(): LiveContextValue {
  const value = useContext(LiveContext)
  if (!value) throw new Error('LiveProvider is missing')
  return value
}

// ---- overlay (rendered by show mode) ------------------------------------

export function LiveOverlay({ onClose, onJump }: { onClose: () => void; onJump: (songId: string) => void }) {
  const { config, connected, followers, leaderPresent, leader, lead, follow, stop } = useLive()
  const [code, setCode] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState('')
  const configured = isBackendConfigured()

  const followUrl = config?.role === 'lead' ? `${window.location.origin}${import.meta.env.BASE_URL}?follow=${config.code}#/show` : ''
  useEffect(() => {
    if (!followUrl) { setQrDataUrl(''); return }
    let alive = true
    QRCode.toDataURL(followUrl, { margin: 1, width: 200 }).then((d) => { if (alive) setQrDataUrl(d) }).catch(() => { if (alive) setQrDataUrl('') })
    return () => { alive = false }
  }, [followUrl])

  const leaderSong = leader ? songs.find((s) => s.id === leader.songId) : undefined
  const handleFollow = () => { if (code.trim()) { follow(code); setCode('') } }

  return <div className="show-picker live-overlay" onClick={onClose}>
    <div className="live-panel" role="dialog" aria-label="Live show sync" onClick={(e) => e.stopPropagation()}>
      {!config && <>
        <div><span className="eyebrow">Live show sync</span><h2>Play in sync</h2></div>
        <p>One phone leads; the rest follow. When the leader turns to the next song, every connected device turns with it. Everyone keeps their own views, pins, and settings.</p>
        {!configured && <p className="live-status">Sync isn’t set up on this build yet — see SYNC-SETUP.md.</p>}
        <div className="live-actions"><button disabled={!configured} onClick={lead}>Lead tonight’s show</button></div>
        <div className="live-divider" />
        <label><span className="eyebrow">Got a code from the leader?</span>
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="K7F2X" autoComplete="off" autoCapitalize="characters"
            onKeyDown={(e) => { if (e.key === 'Enter') handleFollow() }} /></label>
        <div className="live-actions"><button className="secondary" disabled={!configured || !code.trim()} onClick={handleFollow}>Follow the leader</button></div>
      </>}
      {config?.role === 'lead' && <>
        <div><span className="eyebrow">Live show sync</span><h2>You’re leading</h2></div>
        <div className="live-code">{config.code}</div>
        {qrDataUrl && <div className="live-qr"><img src={qrDataUrl} alt="QR code that joins this live show as a follower" width={200} height={200} /></div>}
        <p>Bandmates: scan this, or open show mode → Live and type the code. Their devices will follow your song changes.</p>
        <p className="live-status">{connected
          ? <>Broadcasting · <b>{followers}</b> following</>
          : 'Connecting…'}</p>
        <div className="live-actions"><button className="secondary" onClick={stop}>Stop leading</button><button className="secondary" onClick={onClose}>Close</button></div>
      </>}
      {config?.role === 'follow' && <>
        <div><span className="eyebrow">Live show sync</span><h2>Following {config.code}</h2></div>
        <p className="live-status">{!connected ? 'Connecting…' : !leaderPresent ? 'Connected — waiting for the leader to come online.' : leaderSong ? <>Leader is on <b>{leaderSong.title}</b></> : 'Leader is live — waiting for their first song.'}</p>
        <p>Song changes follow the leader automatically. You can still page around to peek ahead — the next leader change snaps you back.</p>
        <div className="live-actions">
          {leaderSong && <button onClick={() => { onJump(leaderSong.id); onClose() }}>Go to leader’s song</button>}
          <button className="secondary" onClick={stop}>Stop following</button>
          <button className="secondary" onClick={onClose}>Close</button>
        </div>
      </>}
    </div>
  </div>
}
