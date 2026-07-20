import { useEffect, useRef, useState } from 'react'
import { usePractice } from './storage'
import bpmData from './data/bpm.json'

// Practice metronome. Timing uses the standard Web Audio lookahead pattern: a coarse
// 25ms setInterval keeps a precise AudioContext-clock schedule topped up ~120ms ahead,
// so clicks are sample-accurate regardless of main-thread jank. The tempo is stored
// per song in practice state (PracticeEntry.bpm), so it syncs across devices.
const MIN_BPM = 40, MAX_BPM = 240, DEFAULT_BPM = 120
const LOOKAHEAD_S = 0.12, TICK_MS = 25

// Researched original-recording tempos (src/data/bpm.json) seed each song's default;
// the user's own tapped/stepped tempo (practice state) always wins once set.
const bpmDefaults = bpmData as Record<string, { bpm: number, note?: string, confidence?: string }>

export function Metronome({ songId }: { songId: string }) {
  const { get, patch } = usePractice()
  const seed = bpmDefaults[songId]
  const bpm = get(songId).bpm || seed?.bpm || DEFAULT_BPM
  const [running, setRunning] = useState(false)
  const [beatsPerBar, setBeatsPerBar] = useState(4)
  const [beatFlash, setBeatFlash] = useState(-1)
  const audioRef = useRef<AudioContext | null>(null)
  const bpmRef = useRef(bpm); bpmRef.current = bpm
  const beatsRef = useRef(beatsPerBar); beatsRef.current = beatsPerBar
  const tapsRef = useRef<number[]>([])

  const setBpm = (value: number) => patch(songId, { bpm: Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(value))) })

  // Average the intervals of the last few taps; a 2s pause starts a fresh measurement.
  const tap = () => {
    const now = performance.now()
    const taps = tapsRef.current
    if (taps.length && now - taps[taps.length - 1] > 2000) taps.length = 0
    taps.push(now)
    if (taps.length >= 2) {
      const recent = taps.slice(-5)
      setBpm(60000 / ((recent[recent.length - 1] - recent[0]) / (recent.length - 1)))
    }
  }

  useEffect(() => {
    if (!running) return
    const ctx = audioRef.current ?? (audioRef.current = new AudioContext())
    ctx.resume().catch(() => {})
    let nextTime = ctx.currentTime + 0.08
    let beat = 0
    const flashTimers: number[] = []
    const click = (time: number, accent: boolean) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = accent ? 1568 : 1047
      gain.gain.setValueAtTime(accent ? 0.5 : 0.28, time)
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05)
      osc.connect(gain).connect(ctx.destination)
      osc.start(time)
      osc.stop(time + 0.06)
    }
    const tick = () => {
      // Backgrounded tabs throttle setInterval to >=1s: without this clamp the loop
      // would schedule every missed beat in the past and they'd all fire at once.
      if (nextTime < ctx.currentTime) nextTime = ctx.currentTime + 0.05
      // iOS can move the context to 'interrupted'/'suspended' (call, lock screen)
      // without any event we handle — nudge it back while we're supposed to be running.
      if (ctx.state !== 'running') ctx.resume().catch(() => {})
      while (nextTime < ctx.currentTime + LOOKAHEAD_S) {
        const inBar = beat % beatsRef.current
        click(nextTime, inBar === 0)
        flashTimers.push(window.setTimeout(() => setBeatFlash(inBar), Math.max(0, (nextTime - ctx.currentTime) * 1000)))
        beat += 1
        nextTime += 60 / bpmRef.current
      }
    }
    tick()
    const interval = window.setInterval(tick, TICK_MS)
    return () => {
      window.clearInterval(interval)
      flashTimers.forEach((timer) => window.clearTimeout(timer))
      setBeatFlash(-1)
    }
  }, [running])

  // Release the audio device when the song page unmounts.
  useEffect(() => () => { audioRef.current?.close().catch(() => {}); audioRef.current = null }, [])

  return <div className="metronome">
    <button type="button" className={running ? 'metro-toggle active' : 'metro-toggle'} aria-pressed={running} onClick={() => setRunning((value) => !value)}>{running ? '■ Stop' : '▶ Start'}</button>
    <div className="metro-tempo">
      <button type="button" aria-label="Slower" disabled={bpm <= MIN_BPM} onClick={() => setBpm(bpm - (bpm > 120 ? 4 : 2))}>−</button>
      <span className="metro-bpm"><strong>{bpm}</strong><i>bpm</i></span>
      <button type="button" aria-label="Faster" disabled={bpm >= MAX_BPM} onClick={() => setBpm(bpm + (bpm >= 120 ? 4 : 2))}>+</button>
    </div>
    <button type="button" className="metro-tap" onClick={tap}>Tap tempo</button>
    <label className="metro-beats"><span>Beats</span><select value={beatsPerBar} onChange={(event) => setBeatsPerBar(Number(event.target.value))}>{[2, 3, 4, 6].map((n) => <option key={n} value={n}>{n}/4</option>)}</select></label>
    <span className="metro-dots" aria-hidden="true">{Array.from({ length: beatsPerBar }, (_, i) => <i key={i} className={running && beatFlash === i ? (i === 0 ? 'on accent' : 'on') : ''} />)}</span>
    {seed?.note && <p className="metro-note">{seed.note}</p>}
  </div>
}
