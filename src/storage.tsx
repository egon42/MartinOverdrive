import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { PracticeEntry, PracticeState, PracticeStatus } from './types'

// The /dev/ deployment shares this origin with production, so it gets its own
// storage key (seeded from production data on first visit).
const PROD_KEY = 'overdrive-practice-v1'
const KEY = import.meta.env.BASE_URL.includes('/dev/') ? 'overdrive-practice-dev-v1' : PROD_KEY
const emptyEntry: PracticeEntry = { status: 'Not Started', notes: '', lastPracticed: '', sessions: 0, priority: 0, secondsPracticed: 0, savedSongsterrUrl: '', savedUltimateGuitarUrl: '', preferredSource: '', chordSheet: '', updatedAt: '' }

interface Store {
  state: PracticeState
  get: (id: string) => PracticeEntry
  patch: (id: string, update: Partial<PracticeEntry>) => void
  replaceState: (next: PracticeState) => void
  exportBackup: () => void
  importBackup: (file: File) => Promise<void>
}

const PracticeContext = createContext<Store | null>(null)

export function PracticeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PracticeState>(() => {
    try { return JSON.parse(localStorage.getItem(KEY) || localStorage.getItem(PROD_KEY) || '{}') } catch { return {} }
  })
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(state)) }, [state])
  const get = (id: string) => ({ ...emptyEntry, ...state[id] })
  const patch = (id: string, update: Partial<PracticeEntry>) => setState((old) => ({ ...old, [id]: { ...emptyEntry, ...old[id], ...update, updatedAt: new Date().toISOString() } }))
  const replaceState = (next: PracticeState) => setState(next)
  const exportBackup = () => {
    const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), practice: state }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a')
    a.href = url; a.download = `overdrive-practice-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(url)
  }
  const importBackup = async (file: File) => {
    const parsed = JSON.parse(await file.text())
    if (!parsed || parsed.version !== 1 || typeof parsed.practice !== 'object') throw new Error('That is not an Overdrive practice backup.')
    // Stamp restored entries so a later sync merge doesn't treat them as ancient.
    const now = new Date().toISOString()
    setState(Object.fromEntries(Object.entries(parsed.practice as PracticeState).map(([id, entry]) => [id, { ...emptyEntry, ...entry, updatedAt: now }])))
  }
  const value = useMemo(() => ({ state, get, patch, replaceState, exportBackup, importBackup }), [state])
  return <PracticeContext.Provider value={value}>{children}</PracticeContext.Provider>
}

export function usePractice() {
  const value = useContext(PracticeContext)
  if (!value) throw new Error('PracticeProvider is missing')
  return value
}

export function isStatus(value: string): value is PracticeStatus {
  return ['Not Started', 'Learning', 'Rehearsal Ready', 'Show Ready'].includes(value)
}
