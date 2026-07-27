import { useEffect, useRef, useState } from 'react'
import { usePractice } from './storage'
import bpmData from './data/bpm.json'

// Practice metronome. Timing uses the standard Web Audio lookahead pattern: a coarse
// 25ms setInterval keeps a precise AudioContext-clock schedule topped up ~120ms ahead,
// so clicks are sample-accurate regardless of main-thread jank. The tempo is stored
// per song in practice state (PracticeEntry.bpm), so it syncs across devices.
//
// Two sounds: 'click' (the plain accented tick) and 'drums' (a synthesized kick/snare/
// hat loop on a subdivision grid — straight 8ths, shuffle triplets, or 6/8). The drum
// pattern is picked by beats-per-bar + feel; per-song groove defaults (timeSig/feel)
// ride along in bpm.json next to the researched tempos.
const MIN_BPM = 40, MAX_BPM = 240, DEFAULT_BPM = 120
const LOOKAHEAD_S = 0.12, TICK_MS = 25

// Researched original-recording tempos (src/data/bpm.json) seed each song's default;
// the user's own tapped/stepped tempo (practice state) always wins once set. timeSig
// (2/3/6; absent = 4) and feel ('shuffle'; absent = straight) seed the drum grid.
const bpmDefaults = bpmData as Record<string, { bpm: number, note?: string, confidence?: string, timeSig?: number, feel?: string }>

// Last-used sound is a per-device UI preference (not band data) — plain localStorage,
// keyed per deployment like the other UI prefs.
const SOUND_KEY = `overdrive-metro-sound${import.meta.env.BASE_URL.includes('/dev/') ? '-dev' : ''}`
type MetroSound = 'click' | 'drums'
const readSound = (): MetroSound => { try { return localStorage.getItem(SOUND_KEY) === 'drums' ? 'drums' : 'click' } catch { return 'click' } }

// Kick/snare placement per beats-per-bar, in beat indexes (for 6 = 6/8, in 8th-note
// steps — compound meter counts the 8ths directly).
const PATTERNS: Record<number, { kick: number[], snare: number[] }> = {
  2: { kick: [0], snare: [1] },
  3: { kick: [0], snare: [2] },
  4: { kick: [0, 2], snare: [1, 3] },
  6: { kick: [0], snare: [3] },
}

export function Metronome({ songId }: { songId: string }) {
  const { get, patch } = usePractice()
  const seed = bpmDefaults[songId]
  const bpm = get(songId).bpm || seed?.bpm || DEFAULT_BPM
  const [running, setRunning] = useState(false)
  const [sound, setSoundState] = useState<MetroSound>(readSound)
  const [beatsPerBar, setBeatsPerBar] = useState(seed?.timeSig === 2 || seed?.timeSig === 3 || seed?.timeSig === 6 ? seed.timeSig : 4)
  const [feel, setFeel] = useState<'straight' | 'shuffle'>(seed?.feel === 'shuffle' ? 'shuffle' : 'straight')
  const [beatFlash, setBeatFlash] = useState(-1)
  const audioRef = useRef<AudioContext | null>(null)
  const noiseBufRef = useRef<AudioBuffer | null>(null)
  const bpmRef = useRef(bpm); bpmRef.current = bpm
  const beatsRef = useRef(beatsPerBar); beatsRef.current = beatsPerBar
  const feelRef = useRef(feel); feelRef.current = feel
  const tapsRef = useRef<number[]>([])

  const setSound = (value: MetroSound) => {
    setSoundState(value)
    try { localStorage.setItem(SOUND_KEY, value) } catch { /* per-device nicety only */ }
  }
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

  // `sound` is an effect dep (unlike bpm/beats/feel, which adjust the running grid in
  // place via refs): switching click↔drums restarts the schedule so the bar restarts
  // on a clean grid instead of joining mid-bar on a different subdivision count.
  useEffect(() => {
    if (!running) return
    const ctx = audioRef.current ?? (audioRef.current = new AudioContext())
    ctx.resume().catch(() => {})
    let nextTime = ctx.currentTime + 0.08
    let step = 0
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
    // One second of shared white noise for the snare/hat bursts. An AudioBuffer is
    // context-independent (sample-rate-bound only), so it survives effect restarts.
    const noise = () => {
      if (!noiseBufRef.current || noiseBufRef.current.sampleRate !== ctx.sampleRate) {
        const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
        const data = buf.getChannelData(0)
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
        noiseBufRef.current = buf
      }
      const src = ctx.createBufferSource()
      src.buffer = noiseBufRef.current
      return src
    }
    const kick = (time: number) => {
      // Sine drop 120→45Hz — the classic synth kick thump.
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.setValueAtTime(120, time)
      osc.frequency.exponentialRampToValueAtTime(45, time + 0.09)
      gain.gain.setValueAtTime(0.9, time)
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.13)
      osc.connect(gain).connect(ctx.destination)
      osc.start(time)
      osc.stop(time + 0.14)
    }
    const snare = (time: number) => {
      // Highpassed noise crack over a short 185Hz body tone.
      const src = noise()
      const filter = ctx.createBiquadFilter()
      filter.type = 'highpass'
      filter.frequency.value = 1800
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.5, time)
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.11)
      src.connect(filter).connect(gain).connect(ctx.destination)
      src.start(time)
      src.stop(time + 0.12)
      const osc = ctx.createOscillator()
      const body = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.value = 185
      body.gain.setValueAtTime(0.25, time)
      body.gain.exponentialRampToValueAtTime(0.001, time + 0.08)
      osc.connect(body).connect(ctx.destination)
      osc.start(time)
      osc.stop(time + 0.09)
    }
    const hat = (time: number, level: 0 | 1 | 2) => {
      // level: 0 off-beat tick, 1 beat start, 2 bar start.
      const src = noise()
      const filter = ctx.createBiquadFilter()
      filter.type = 'highpass'
      filter.frequency.value = 7500
      const gain = ctx.createGain()
      gain.gain.setValueAtTime([0.14, 0.2, 0.3][level], time)
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.045)
      src.connect(filter).connect(gain).connect(ctx.destination)
      src.start(time)
      src.stop(time + 0.05)
    }
    const flash = (inBar: number, time: number) => {
      flashTimers.push(window.setTimeout(() => setBeatFlash(inBar), Math.max(0, (time - ctx.currentTime) * 1000)))
    }
    const tick = () => {
      // Backgrounded tabs throttle setInterval to >=1s: without this clamp the loop
      // would schedule every missed beat in the past and they'd all fire at once.
      if (nextTime < ctx.currentTime) nextTime = ctx.currentTime + 0.05
      // iOS can move the context to 'interrupted'/'suspended' (call, lock screen)
      // without any event we handle — nudge it back while we're supposed to be running.
      if (ctx.state !== 'running') ctx.resume().catch(() => {})
      while (nextTime < ctx.currentTime + LOOKAHEAD_S) {
        const beats = beatsRef.current
        const secondsPerBeat = 60 / bpmRef.current
        if (sound === 'click') {
          const inBar = step % beats
          click(nextTime, inBar === 0)
          flash(inBar, nextTime)
          step += 1
          nextTime += secondsPerBeat
        } else {
          // Drum grid: subdivisions per beat — straight 8ths (2), shuffle triplets (3),
          // or 6/8 (1: each selected "beat" is already an 8th, hats ride them directly).
          // Shuffle only where its select is visible (2/4 & 4/4) — a hidden control
          // must not keep steering the grid (council finding, 2026-07-20).
          const subdiv = beats === 6 ? 1 : (beats === 2 || beats === 4) && feelRef.current === 'shuffle' ? 3 : 2
          const inBar = step % (beats * subdiv)
          const beatIndex = Math.floor(inBar / subdiv)
          const sub = inBar % subdiv
          // Shuffle keeps the classic gap on the middle triplet; everything else rides
          // every step. Hat volume marks bar start > beat start > off-beat.
          if (subdiv !== 3 || sub !== 1) hat(nextTime, sub !== 0 ? 0 : inBar === 0 ? 2 : 1)
          if (sub === 0) {
            const pattern = PATTERNS[beats] ?? PATTERNS[4]
            if (pattern.kick.includes(beatIndex)) kick(nextTime)
            if (pattern.snare.includes(beatIndex)) snare(nextTime)
            flash(beatIndex, nextTime)
          }
          step += 1
          nextTime += secondsPerBeat / subdiv
        }
      }
    }
    tick()
    const interval = window.setInterval(tick, TICK_MS)
    return () => {
      window.clearInterval(interval)
      flashTimers.forEach((timer) => window.clearTimeout(timer))
      setBeatFlash(-1)
    }
  }, [running, sound])

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
    <label className="metro-beats"><span>Sound</span><select value={sound} onChange={(event) => setSound(event.target.value as MetroSound)}><option value="click">Click</option><option value="drums">Drums</option></select></label>
    <label className="metro-beats"><span>Beats</span><select value={beatsPerBar} onChange={(event) => setBeatsPerBar(Number(event.target.value))}>{[2, 3, 4, 6].map((n) => <option key={n} value={n}>{n === 6 ? '6/8' : `${n}/4`}</option>)}</select></label>
    {sound === 'drums' && (beatsPerBar === 2 || beatsPerBar === 4) && <label className="metro-beats"><span>Feel</span><select value={feel} onChange={(event) => setFeel(event.target.value as 'straight' | 'shuffle')}><option value="straight">Straight</option><option value="shuffle">Shuffle</option></select></label>}
    <span className="metro-dots" aria-hidden="true">{Array.from({ length: beatsPerBar }, (_, i) => <i key={i} className={running && beatFlash === i ? (i === 0 ? 'on accent' : 'on') : ''} />)}</span>
    {seed?.note && <p className="metro-note">{seed.note}</p>}
  </div>
}
