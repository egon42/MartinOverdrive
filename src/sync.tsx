import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import QRCode from 'qrcode'
import type { PracticeState } from './types'
import { usePractice } from './storage'
import { SUPABASE_URL, isBackendConfigured, sbHeaders } from './syncBackend'

// The /dev/ deployment shares this origin with production but keeps a separate practice
// store (see storage.tsx). Give sync its own per-deployment key so a code connected on /dev/
// and one on prod point at different rows instead of cross-contaminating.
const CONFIG_KEY = import.meta.env.BASE_URL.includes('/dev/') ? 'overdrive-sync-dev-v2' : 'overdrive-sync-v2'
const PUSH_DEBOUNCE_MS = 4000
const REPULL_INTERVAL_MS = 30000

export interface SyncConfig { code: string }

type SyncPhase = 'off' | 'idle' | 'syncing' | 'error'
export interface SyncStatus { phase: SyncPhase; detail: string; lastSyncedAt: string }

interface SyncContextValue {
  status: SyncStatus
  config: SyncConfig | null
  connect: (code?: string) => Promise<void>
  disconnect: () => void
  syncNow: () => Promise<void>
}

// ---- merge -----------------------------------------------------------

/** Union of song ids; per id the entry with the newer updatedAt wins (missing/empty
 * counts as oldest; exact ties prefer local). */
export function mergePractice(local: PracticeState, remote: PracticeState): PracticeState {
  const ids = new Set([...Object.keys(local), ...Object.keys(remote)])
  const merged: PracticeState = {}
  for (const id of ids) {
    const l = local[id]; const r = remote[id]
    if (l && !r) { merged[id] = l; continue }
    if (r && !l) { merged[id] = r; continue }
    if (!l || !r) continue
    merged[id] = (r.updatedAt || '') > (l.updatedAt || '') ? r : l
  }
  return merged
}

// ---- sync codes --------------------------------------------------------

// Crockford base32 (no I, L, O, U — reduces transcription ambiguity).
const BASE32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

/** Strip formatting and uppercase, so 'k7f2-9xqz' / 'K7F29XQZ' hit the same row. Must match
 * the server-side normalization in upsert_practice/hash_code (SYNC-SETUP.md). */
export function normalizeCode(code: string): string {
  return code.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
}

/** 128 bits of randomness → 26 base32 chars, grouped in fours for readability. */
function generateSyncCode(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  let bits = 0, value = 0, out = ''
  for (const byte of bytes) {
    value = (value << 8) | byte; bits += 8
    while (bits >= 5) { out += BASE32[(value >>> (bits - 5)) & 31]; bits -= 5 }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31]
  return (out.match(/.{1,4}/g) ?? [out]).join('-')
}

// ---- supabase API ------------------------------------------------------

function buildEnvelope(practice: PracticeState) {
  return { version: 1, updatedAt: new Date().toISOString(), practice }
}

async function httpError(res: Response): Promise<Error> {
  if (res.status === 401) return new Error('Sync backend rejected the app key. See SYNC-SETUP.md.')
  try { const body = await res.json() as { message?: string; msg?: string }; const msg = body?.message || body?.msg; return new Error(`Sync error ${res.status}${msg ? `: ${msg}` : ''}`) }
  catch { return new Error(`Sync error ${res.status}`) }
}

async function readRemote(code: string): Promise<PracticeState> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_practice`, {
    method: 'POST', headers: sbHeaders(), body: JSON.stringify({ p_code: normalizeCode(code) }),
  })
  if (!res.ok) throw await httpError(res)
  // get_practice returns the stored envelope, or JSON `null` for a code with no row yet.
  const body = await res.json() as { practice?: unknown } | null
  return body && typeof body.practice === 'object' && body.practice ? body.practice as PracticeState : {}
}

async function writeRemote(code: string, practice: PracticeState): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/upsert_practice`, {
    method: 'POST', headers: sbHeaders(), body: JSON.stringify({ p_code: normalizeCode(code), p_data: buildEnvelope(practice) }),
  })
  if (!res.ok) throw await httpError(res)
}

/** Mint a fresh code and seed it with the current practice state. Upsert IS create, so
 * there's no separate create call — we just pick the code client-side. */
async function createRemote(practice: PracticeState): Promise<string> {
  const code = generateSyncCode()
  await writeRemote(code, practice)
  return code
}

// ---- config persistence ------------------------------------------------

// Reads the v2 { code } config. An old v1 { token, gistId } gist config lives under a
// different key and is simply ignored — the user reconnects once with a fresh code, and
// their untouched local practice state pushes up on that first connect.
function loadConfig(): SyncConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<SyncConfig>
    return parsed && typeof parsed.code === 'string' && parsed.code ? { code: parsed.code } : null
  } catch { return null }
}

function saveConfig(config: SyncConfig | null) {
  if (config) localStorage.setItem(CONFIG_KEY, JSON.stringify(config))
  else localStorage.removeItem(CONFIG_KEY)
}

// ---- provider -----------------------------------------------------------

const SyncContext = createContext<SyncContextValue | null>(null)

export function SyncProvider({ children }: { children: ReactNode }) {
  const { state, replaceState } = usePractice()
  const [config, setConfig] = useState<SyncConfig | null>(() => loadConfig())
  const [status, setStatus] = useState<SyncStatus>(() => ({ phase: loadConfig() ? 'idle' : 'off', detail: '', lastSyncedAt: '' }))

  // Refs mirror the latest props/state so async callbacks (debounced push, event
  // listeners, in-flight fetches) never read a stale closure.
  const configRef = useRef(config); useEffect(() => { configRef.current = config }, [config])
  const stateRef = useRef(state); useEffect(() => { stateRef.current = state }, [state])
  const replaceStateRef = useRef(replaceState); useEffect(() => { replaceStateRef.current = replaceState }, [replaceState])

  const syncingRef = useRef(false)
  const initialPullDoneRef = useRef(false)
  const lastSyncedSerializationRef = useRef<string | null>(null)
  const lastSyncTimeRef = useRef(0)
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Generation counter bumped by disconnect/connect to invalidate in-flight sync
  // operations. Each async routine snapshots it at start and re-checks after every
  // await; on mismatch it abandons its results instead of writing to the remote (or
  // local state) the user just walked away from.
  const epochRef = useRef(0)

  // Pull the remote, merge with local, replace local if the merge changed it, and
  // push the merge back if it differs from what's remote. Guarded so only one
  // sync routine ever runs at a time.
  const pullMergeMaybePush = useCallback(async (cfg: SyncConfig): Promise<void> => {
    if (syncingRef.current) return
    const epoch = epochRef.current
    syncingRef.current = true
    setStatus((old) => ({ ...old, phase: 'syncing', detail: 'Pulling…' }))
    try {
      const remote = await readRemote(cfg.code)
      if (epochRef.current !== epoch) return
      const local = stateRef.current
      const merged = mergePractice(local, remote)
      const mergedJson = JSON.stringify(merged)
      if (mergedJson !== JSON.stringify(local)) replaceStateRef.current(merged)
      if (mergedJson !== JSON.stringify(remote)) await writeRemote(cfg.code, merged)
      if (epochRef.current !== epoch) return
      lastSyncedSerializationRef.current = mergedJson
      lastSyncTimeRef.current = Date.now()
      initialPullDoneRef.current = true
      setStatus({ phase: 'idle', detail: 'Synced', lastSyncedAt: new Date().toISOString() })
    } catch (error) {
      if (epochRef.current !== epoch) return
      initialPullDoneRef.current = true
      setStatus((old) => ({ phase: 'error', detail: error instanceof Error ? error.message : 'Sync failed', lastSyncedAt: old.lastSyncedAt }))
    } finally {
      if (epochRef.current === epoch) syncingRef.current = false
    }
  }, [])

  // Initial pull, once, on mount — only if a config was already persisted. Skipped when a
  // ?sync=CODE deep link is present; the effect below handles that case by connecting.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('sync')) return
    const cfg = configRef.current
    if (!cfg) { initialPullDoneRef.current = true; return }
    pullMergeMaybePush(cfg)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Deep link from a scanned QR code: ?sync=CODE connects this device to that code, then
  // strips the param so the code doesn't linger in the address bar or browser history.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('sync')
    if (!code) return
    // If this device was already syncing, mark the initial pull done up front so a failed
    // connect to the scanned code doesn't strand its existing config's debounced pushes.
    if (configRef.current) initialPullDoneRef.current = true
    params.delete('sync')
    const qs = params.toString()
    window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash)
    connect(code).catch(() => { /* surfaced via status */ })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Debounced push: 4s of quiet after a local state change, skipped while
  // unconfigured, mid-initial-pull, or already in sync with what we last pushed/pulled.
  // The debounced path runs the full pull→merge→push routine (not a blind overwrite) so a
  // concurrently-edited device gets merged instead of transiently overwritten, and it
  // reschedules instead of dropping when another sync is already in flight.
  useEffect(() => {
    if (!config) return
    if (!initialPullDoneRef.current) return
    const json = JSON.stringify(state)
    if (json === lastSyncedSerializationRef.current) return
    if (pushTimerRef.current) clearTimeout(pushTimerRef.current)
    const fire = () => {
      pushTimerRef.current = null
      const cfg = configRef.current
      if (!cfg) return
      if (syncingRef.current) { pushTimerRef.current = setTimeout(fire, 1000); return }
      pullMergeMaybePush(cfg)
    }
    pushTimerRef.current = setTimeout(fire, PUSH_DEBOUNCE_MS)
    return () => { if (pushTimerRef.current) { clearTimeout(pushTimerRef.current); pushTimerRef.current = null } }
  }, [state, config, pullMergeMaybePush])

  // Re-pull on focus / becoming visible, so a long-open tab picks up changes
  // made from another device — throttled to at most once per 30s.
  useEffect(() => {
    const maybeRepull = () => {
      const cfg = configRef.current
      if (!cfg) return
      if (Date.now() - lastSyncTimeRef.current < REPULL_INTERVAL_MS) return
      pullMergeMaybePush(cfg)
    }
    const onVisibility = () => { if (document.visibilityState === 'visible') maybeRepull() }
    window.addEventListener('focus', maybeRepull)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('focus', maybeRepull)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [pullMergeMaybePush])

  // No code → mint a fresh one and seed it with local state. A pasted code → pull it, merge
  // with local, and reconcile both sides. Either way we end connected to a { code }.
  const connect = useCallback(async (code?: string): Promise<void> => {
    if (syncingRef.current) return
    if (!isBackendConfigured()) { setStatus({ phase: 'error', detail: "Sync isn't set up yet. See SYNC-SETUP.md.", lastSyncedAt: '' }); throw new Error('Sync backend not configured') }
    epochRef.current += 1 // invalidate any lingering operation from a previous config
    const epoch = epochRef.current
    syncingRef.current = true
    const existing = code?.trim() || ''
    setStatus({ phase: 'syncing', detail: existing ? 'Connecting…' : 'Creating sync code…', lastSyncedAt: '' })
    try {
      let activeCode = existing
      let merged: PracticeState
      if (!activeCode) {
        merged = stateRef.current
        activeCode = await createRemote(merged)
        if (epochRef.current !== epoch) return
      } else {
        const remote = await readRemote(activeCode)
        if (epochRef.current !== epoch) return
        merged = mergePractice(stateRef.current, remote)
        const mergedJson = JSON.stringify(merged)
        if (mergedJson !== JSON.stringify(stateRef.current)) replaceStateRef.current(merged)
        if (mergedJson !== JSON.stringify(remote)) await writeRemote(activeCode, merged)
        if (epochRef.current !== epoch) return
      }
      const nextConfig: SyncConfig = { code: activeCode }
      saveConfig(nextConfig)
      lastSyncedSerializationRef.current = JSON.stringify(merged)
      lastSyncTimeRef.current = Date.now()
      initialPullDoneRef.current = true
      setConfig(nextConfig)
      setStatus({ phase: 'idle', detail: 'Connected', lastSyncedAt: new Date().toISOString() })
    } catch (error) {
      if (epochRef.current === epoch) setStatus({ phase: 'error', detail: error instanceof Error ? error.message : 'Could not connect', lastSyncedAt: '' })
      throw error
    } finally {
      if (epochRef.current === epoch) syncingRef.current = false
    }
  }, [])

  const disconnect = useCallback(() => {
    epochRef.current += 1 // abandon any in-flight pull/push against the old config
    syncingRef.current = false
    saveConfig(null)
    initialPullDoneRef.current = false
    lastSyncedSerializationRef.current = null
    lastSyncTimeRef.current = 0
    if (pushTimerRef.current) { clearTimeout(pushTimerRef.current); pushTimerRef.current = null }
    setConfig(null)
    setStatus({ phase: 'off', detail: '', lastSyncedAt: '' })
  }, [])

  const syncNow = useCallback(async (): Promise<void> => {
    const cfg = configRef.current
    if (!cfg) return
    await pullMergeMaybePush(cfg)
  }, [pullMergeMaybePush])

  const value = useMemo<SyncContextValue>(() => ({ status, config, connect, disconnect, syncNow }), [status, config, connect, disconnect, syncNow])
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>
}

export function useSync(): SyncContextValue {
  const value = useContext(SyncContext)
  if (!value) throw new Error('SyncProvider is missing')
  return value
}

// ---- panel -----------------------------------------------------------

function formatStatusLine(status: SyncStatus): string {
  const phaseLabel = status.phase === 'syncing' ? 'Syncing' : status.phase === 'error' ? 'Error' : status.phase === 'off' ? 'Off' : 'Idle'
  const parts = [phaseLabel]
  if (status.detail) parts.push(status.detail)
  if (status.lastSyncedAt) parts.push(`last synced ${new Date(status.lastSyncedAt).toLocaleString()}`)
  return parts.join(' · ')
}

export function SyncPanel() {
  const { status, config, connect, disconnect, syncNow } = useSync()
  const [code, setCode] = useState('')
  const [localError, setLocalError] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState('')
  const busy = status.phase === 'syncing'
  const configured = isBackendConfigured()

  // A deep link that carries the code, so scanning it on a phone opens the app already
  // connecting to this code (handled by the ?sync= effect in SyncProvider).
  const syncUrl = config ? `${window.location.origin}${import.meta.env.BASE_URL}?sync=${encodeURIComponent(config.code)}` : ''
  useEffect(() => {
    if (!syncUrl) { setQrDataUrl(''); return }
    let alive = true
    QRCode.toDataURL(syncUrl, { margin: 1, width: 220 }).then((d) => { if (alive) setQrDataUrl(d) }).catch(() => { if (alive) setQrDataUrl('') })
    return () => { alive = false }
  }, [syncUrl])

  const handleStart = async () => {
    setLocalError('')
    try { await connect() } catch { /* surfaced via status.detail */ }
  }

  const handleJoin = async () => {
    if (!code.trim()) { setLocalError('Paste a code first.'); return }
    setLocalError('')
    try { await connect(code.trim()); setCode('') }
    catch { /* surfaced via status.detail */ }
  }

  const copyCode = () => { navigator.clipboard?.writeText(config?.code ?? '').catch(() => {}) }

  if (!config) {
    return <section className="panel sync-panel">
      <span className="eyebrow">Cross-device sync</span>
      <h2>Sync practice data</h2>
      {!configured && <p className="sync-error">Sync isn't set up on this build yet. See SYNC-SETUP.md.</p>}
      <div className="actions"><button disabled={busy || !configured} onClick={handleStart}>{busy ? 'Working…' : 'Turn on sync'}</button></div>
      <label><span>Have a code from another device?</span><input value={code} onChange={(e) => setCode(e.target.value)} placeholder="k7f2-9xqz-…" autoComplete="off" /></label>
      {(localError || status.phase === 'error') && <p className="sync-error">{localError || status.detail}</p>}
      <div className="actions"><button className="secondary" disabled={busy || !configured} onClick={handleJoin}>Connect with a code</button></div>
    </section>
  }

  return <section className="panel sync-panel">
    <span className="eyebrow">Cross-device sync</span>
    <h2>Sync is on</h2>
    <p className="sync-status">{formatStatusLine(status)}</p>
    <p>Your sync code: <code onClick={copyCode} title="Click to copy" style={{ cursor: 'pointer' }}>{config.code}</code></p>
    {qrDataUrl && <div className="sync-qr">
      <img src={qrDataUrl} alt="QR code that connects a phone to this sync code" width={220} height={220} />
      <p>Scan with your phone to join this sync code. On another computer, type the code.</p>
    </div>}
    <p><strong>This code is the only key to your data. Save it somewhere. Anyone who has it can read your practice progress.</strong></p>
    <div className="actions">
      <button disabled={busy} onClick={() => syncNow()}>Sync now</button>
      <button className="secondary" disabled={busy} onClick={disconnect}>Disconnect</button>
    </div>
  </section>
}
