import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { PracticeState } from './types'
import { usePractice } from './storage'

const CONFIG_KEY = 'overdrive-sync-v1'
const GIST_FILENAME = 'overdrive-practice.json'
const API = 'https://api.github.com'
const PUSH_DEBOUNCE_MS = 4000
const REPULL_INTERVAL_MS = 30000

export interface SyncConfig { token: string; gistId: string }

type SyncPhase = 'off' | 'idle' | 'syncing' | 'error'
export interface SyncStatus { phase: SyncPhase; detail: string; lastSyncedAt: string }

interface SyncContextValue {
  status: SyncStatus
  config: SyncConfig | null
  connect: (token: string, gistId?: string) => Promise<void>
  disconnect: () => void
  syncNow: () => Promise<void>
}

interface GistFile { content?: string; truncated?: boolean; raw_url?: string }
interface GistResponse { id: string; files: Record<string, GistFile | undefined> }

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

// ---- gist API ----------------------------------------------------------

function authHeaders(token: string, withContentType = false): HeadersInit {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (withContentType) headers['Content-Type'] = 'application/json'
  return headers
}

async function httpError(res: Response): Promise<Error> {
  if (res.status === 401) return new Error('Token was rejected. Check it has the gist scope.')
  try { const body = await res.json() as { message?: string }; return new Error(`GitHub API error ${res.status}${body?.message ? `: ${body.message}` : ''}`) }
  catch { return new Error(`GitHub API error ${res.status}`) }
}

function buildFileContent(practice: PracticeState): string {
  return JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), practice }, null, 2)
}

async function createGist(token: string, practice: PracticeState): Promise<string> {
  const res = await fetch(`${API}/gists`, {
    method: 'POST',
    headers: authHeaders(token, true),
    body: JSON.stringify({ description: 'Overdrive Setlist practice sync', public: false, files: { [GIST_FILENAME]: { content: buildFileContent(practice) } } }),
  })
  if (!res.ok) throw await httpError(res)
  const data = await res.json() as GistResponse
  return data.id
}

async function readGist(token: string, gistId: string): Promise<PracticeState> {
  const res = await fetch(`${API}/gists/${gistId}`, { headers: authHeaders(token) })
  if (!res.ok) throw await httpError(res)
  const data = await res.json() as GistResponse
  const file = data.files[GIST_FILENAME]
  if (!file) return {}
  let text = file.content
  if (file.truncated && file.raw_url) {
    const rawRes = await fetch(file.raw_url, { headers: { Authorization: `Bearer ${token}` } })
    if (!rawRes.ok) throw await httpError(rawRes)
    text = await rawRes.text()
  }
  if (!text) return {}
  try {
    const parsed = JSON.parse(text) as { practice?: unknown }
    return parsed && typeof parsed.practice === 'object' && parsed.practice ? parsed.practice as PracticeState : {}
  } catch { return {} }
}

async function updateGist(token: string, gistId: string, practice: PracticeState): Promise<void> {
  const res = await fetch(`${API}/gists/${gistId}`, {
    method: 'PATCH',
    headers: authHeaders(token, true),
    body: JSON.stringify({ files: { [GIST_FILENAME]: { content: buildFileContent(practice) } } }),
  })
  if (!res.ok) throw await httpError(res)
}

// ---- config persistence ------------------------------------------------

function loadConfig(): SyncConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<SyncConfig>
    return parsed && typeof parsed.token === 'string' && parsed.token && typeof parsed.gistId === 'string' && parsed.gistId
      ? { token: parsed.token, gistId: parsed.gistId }
      : null
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
  // await; on mismatch it abandons its results instead of writing to a gist (or
  // local state) the user just walked away from.
  const epochRef = useRef(0)

  // Pull the gist, merge with local, replace local if the merge changed it, and
  // push the merge back if it differs from what's remote. Guarded so only one
  // sync routine ever runs at a time.
  const pullMergeMaybePush = useCallback(async (cfg: SyncConfig): Promise<void> => {
    if (syncingRef.current) return
    const epoch = epochRef.current
    syncingRef.current = true
    setStatus((old) => ({ ...old, phase: 'syncing', detail: 'Pulling…' }))
    try {
      const remote = await readGist(cfg.token, cfg.gistId)
      if (epochRef.current !== epoch) return
      const local = stateRef.current
      const merged = mergePractice(local, remote)
      const mergedJson = JSON.stringify(merged)
      if (mergedJson !== JSON.stringify(local)) replaceStateRef.current(merged)
      if (mergedJson !== JSON.stringify(remote)) await updateGist(cfg.token, cfg.gistId, merged)
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

  // Initial pull, once, on mount — only if a config was already persisted.
  useEffect(() => {
    const cfg = configRef.current
    if (!cfg) { initialPullDoneRef.current = true; return }
    pullMergeMaybePush(cfg)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Debounced push: 4s of quiet after a local state change, skipped while
  // unconfigured, mid-initial-pull, or already in sync with what we last pushed/pulled.
  // The debounced path runs the full pull→merge→push routine (not a blind PATCH) so a
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

  const connect = useCallback(async (token: string, gistId?: string): Promise<void> => {
    if (syncingRef.current) return
    epochRef.current += 1 // invalidate any lingering operation from a previous config
    const epoch = epochRef.current
    syncingRef.current = true
    const trimmedId = gistId?.trim() || ''
    setStatus({ phase: 'syncing', detail: trimmedId ? 'Connecting…' : 'Creating gist…', lastSyncedAt: '' })
    try {
      let id = trimmedId
      let merged: PracticeState
      if (!id) {
        merged = stateRef.current
        id = await createGist(token, merged)
        if (epochRef.current !== epoch) return
      } else {
        const remote = await readGist(token, id)
        if (epochRef.current !== epoch) return
        merged = mergePractice(stateRef.current, remote)
        const mergedJson = JSON.stringify(merged)
        if (mergedJson !== JSON.stringify(stateRef.current)) replaceStateRef.current(merged)
        if (mergedJson !== JSON.stringify(remote)) await updateGist(token, id, merged)
        if (epochRef.current !== epoch) return
      }
      const nextConfig: SyncConfig = { token, gistId: id }
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
  const [token, setToken] = useState('')
  const [gistId, setGistId] = useState('')
  const [localError, setLocalError] = useState('')
  const busy = status.phase === 'syncing'

  const handleConnect = async () => {
    if (!token.trim()) { setLocalError('Paste a token first.'); return }
    setLocalError('')
    try { await connect(token.trim(), gistId.trim() || undefined); setToken(''); setGistId('') }
    catch { /* surfaced via status.detail */ }
  }

  const copyGistId = () => { navigator.clipboard?.writeText(config?.gistId ?? '').catch(() => {}) }

  if (!config) {
    return <section className="panel sync-panel">
      <span className="eyebrow">Cross-device sync</span>
      <h2>Sync practice data across devices</h2>
      <p>Stores your practice status and notes in a private GitHub Gist. Create a <strong>classic</strong> personal access token with only the <code>gist</code> scope (fine-grained tokens can't access the Gist API) and paste that same token on every device. On a second device, also paste the Gist ID shown on the first device so both point at the same gist.</p>
      <label><span>Personal access token</span><input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="ghp_…" autoComplete="off" /></label>
      <label><span>Existing Gist ID (optional)</span><input value={gistId} onChange={(e) => setGistId(e.target.value)} placeholder="Leave blank to create a new one" /></label>
      {(localError || status.phase === 'error') && <p className="sync-error">{localError || status.detail}</p>}
      <div className="actions"><button disabled={busy} onClick={handleConnect}>{busy ? 'Connecting…' : 'Connect & sync'}</button></div>
    </section>
  }

  return <section className="panel sync-panel">
    <span className="eyebrow">Cross-device sync</span>
    <h2>Synced via GitHub Gist</h2>
    <p className="sync-status">{formatStatusLine(status)}</p>
    <p>Gist ID: <code onClick={copyGistId} title="Click to copy" style={{ cursor: 'pointer' }}>{config.gistId}</code></p>
    <div className="actions">
      <button disabled={busy} onClick={() => syncNow()}>Sync now</button>
      <button className="secondary" disabled={busy} onClick={disconnect}>Disconnect</button>
    </div>
  </section>
}
