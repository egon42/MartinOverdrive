import type { ChordShape } from './chordShapes'

// Plucked-string chord playback for the chord diagram popovers (Settings toggle
// "Play chord on tap"). Each string is a Karplus-Strong pluck rendered into an
// AudioBuffer, strummed low-E to high-e with a short stagger. Standard tuning only:
// the diagrams themselves assume standard tuning, so the audio matches what's drawn.
// `capoFret` shifts every sounding string up that many semitones (shapes are drawn
// relative to the capo, so a capoed song's chips play at the band's sounding pitch).

const OPEN_STRING_MIDI = [40, 45, 50, 55, 59, 64] // E2 A2 D3 G3 B3 E4, low-E to high-e
const STRUM_GAP_S = 0.045
const STRING_GAIN = 0.28

// One lazy context for the whole page, created inside the first tap so mobile
// autoplay policies see a user gesture. Never closed, but suspended shortly after
// each chord rings out — a running context holds the phone's audio session (ducking
// other apps' playback on iOS) and keeps the render thread hot between chords.
let ctx: AudioContext | null = null
let comp: DynamicsCompressorNode | null = null
let lastChord: GainNode | null = null
let suspendTimer: number | undefined

// Rendered plucks cached per MIDI note (one context, so one sample rate). The whole
// app uses a few dozen distinct notes; re-tapping a chord to hear it again is free.
const pluckCache = new Map<number, AudioBuffer>()

const midiToFreq = (midi: number) => 440 * 2 ** ((midi - 69) / 12)

// Low strings decay slowly (damping compounds once per period), so give them a
// longer buffer before the fade or an E chord audibly stops instead of ringing out.
const noteSeconds = (freq: number) => (freq < 160 ? 3 : 2)
const MAX_NOTE_SECONDS = 3

// Render one Karplus-Strong pluck: a delay line of noise, repeatedly averaged and
// damped as it recirculates. The averaging darkens the tone as it rings, which is
// what makes it read as a plucked string rather than a buzzer.
function pluckBuffer(audio: AudioContext, midi: number): AudioBuffer {
  const cached = pluckCache.get(midi)
  if (cached) return cached
  const freq = midiToFreq(midi)
  const sr = audio.sampleRate
  const period = Math.max(2, Math.round(sr / freq))
  const buffer = audio.createBuffer(1, Math.ceil(sr * noteSeconds(freq)), sr)
  const data = buffer.getChannelData(0)
  const delay = new Float32Array(period)
  for (let i = 0; i < period; i++) delay[i] = Math.random() * 2 - 1
  // Soften the attack with one extra averaging pass over the initial noise burst.
  for (let i = 0; i < period; i++) delay[i] = 0.5 * (delay[i] + delay[(i + 1) % period])
  for (let i = 0; i < data.length; i++) {
    const pos = i % period
    const sample = delay[pos]
    data[i] = sample
    delay[pos] = 0.996 * 0.5 * (sample + delay[(i + 1) % period])
  }
  // Fade the tail so a still-ringing string can't click at the buffer end.
  const fade = Math.min(data.length, Math.round(sr * 0.08))
  for (let i = 0; i < fade; i++) data[data.length - 1 - i] *= i / fade
  pluckCache.set(midi, buffer)
  return buffer
}

export function playChord(shape: ChordShape, capoFret = 0) {
  const audio = ctx ?? (ctx = new AudioContext())
  audio.resume().catch(() => {}) // also wakes iOS's non-standard 'interrupted' state
  window.clearTimeout(suspendTimer)
  // Duck whatever chord is still ringing so quick A/B taps don't pile up into mud.
  if (lastChord) {
    const gain = lastChord.gain
    gain.cancelScheduledValues(audio.currentTime)
    gain.setValueAtTime(gain.value, audio.currentTime)
    gain.linearRampToValueAtTime(0, audio.currentTime + 0.08)
    lastChord = null
  }
  // Mild compression tames the six-string sum without hand-balancing string gains.
  // One shared compressor: it's the priciest built-in node, so don't grow one per tap.
  if (!comp) {
    comp = audio.createDynamicsCompressor()
    comp.connect(audio.destination)
  }
  const master = audio.createGain()
  master.connect(comp)
  const start = audio.currentTime + 0.03
  const sources: AudioBufferSourceNode[] = []
  shape.forEach((fret, stringIndex) => {
    if (fret === 'x') return
    const src = audio.createBufferSource()
    src.buffer = pluckBuffer(audio, OPEN_STRING_MIDI[stringIndex] + fret + capoFret)
    const gain = audio.createGain()
    gain.gain.value = STRING_GAIN
    src.connect(gain).connect(master)
    src.start(start + sources.length * STRUM_GAP_S)
    sources.push(src)
  })
  if (!sources.length) return
  lastChord = master
  // Detach the chain once every string has rung out instead of leaving dead nodes
  // on the graph (onended still fires for a chord that was ducked to silence).
  let remaining = sources.length
  for (const src of sources) src.onended = () => { if (--remaining === 0) master.disconnect() }
  // Park the context once the tail is done; the resume() above wakes it next tap.
  // Only the newest chord holds the timer — clearTimeout above cancels older ones.
  const tailMs = (start - audio.currentTime + sources.length * STRUM_GAP_S + MAX_NOTE_SECONDS + 0.2) * 1000
  suspendTimer = window.setTimeout(() => { audio.suspend().catch(() => {}) }, tailMs)
}
