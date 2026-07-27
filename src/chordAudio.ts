import type { ChordShape } from './chordShapes'

// Plucked-string chord playback for the chord diagram popovers (Settings toggle
// "Play chord on tap"). Each string is a Karplus-Strong pluck rendered into an
// AudioBuffer, strummed low-E to high-e with a short stagger. Standard tuning only:
// the diagrams themselves assume standard tuning, so the audio matches what's drawn.

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

/** One chord in a progression: what to strum, and how long until the next one. */
export interface SequenceStep { shape: ChordShape; seconds: number }

// Sources still scheduled or ringing for the current tap. A pattern tap can schedule
// seconds of audio ahead of the clock, so a second tap has to cancel the pending ones —
// ducking the gain only silences what is already sounding.
let activeSources: AudioBufferSourceNode[] = []

// Which sequence is sounding right now, as a token the UI can compare against. The engine
// is a singleton but pattern chips are many, so a chip can't track "am I playing?" in its
// own state — tapping a second chip kills the first one's audio and its highlight has to
// go out with it. 0 = nothing playing.
let playToken = 0
let tokenSeq = 0
const listeners = new Set<() => void>()
const notify = () => { for (const fn of [...listeners]) fn() }

export function getSequenceToken() { return playToken }
export function subscribeSequence(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn) } }
/** Clear the highlight for a sequence that ran to its end, unless something newer started. */
export function endSequence(token: number) { if (token && token === playToken) { playToken = 0; notify() } }

const DUCK_S = 0.08
// Chords inside a progression overlap slightly instead of hard-cutting: a re-strum on a
// real guitar leaves the previous chord ringing under the new one for a moment.
const CHORD_OVERLAP_S = 0.16

/** Strum one shape into `out` at `at`; returns how many strings sounded. */
function scheduleStrum(audio: AudioContext, out: GainNode, shape: ChordShape, at: number): number {
  let sounded = 0
  shape.forEach((fret, stringIndex) => {
    if (fret === 'x') return
    const src = audio.createBufferSource()
    src.buffer = pluckBuffer(audio, OPEN_STRING_MIDI[stringIndex] + fret)
    const gain = audio.createGain()
    gain.gain.value = STRING_GAIN
    src.connect(gain).connect(out)
    src.start(at + sounded * STRUM_GAP_S)
    activeSources.push(src)
    sounded++
  })
  return sounded
}

export function playChord(shape: ChordShape) {
  playSequence([{ shape, seconds: 0 }])
}

/**
 * Duck what's ringing and cancel what's merely scheduled. A pattern tap can queue ~7s of
 * chords plus a 3s ring-out, so leaving show mode or turning to the next song has to kill
 * it — otherwise the last song's progression strums over the new one.
 */
function silence(audio: AudioContext) {
  const now = audio.currentTime
  window.clearTimeout(suspendTimer)
  if (lastChord) {
    const gain = lastChord.gain
    gain.cancelScheduledValues(now)
    gain.setValueAtTime(gain.value, now)
    gain.linearRampToValueAtTime(0, now + DUCK_S)
    lastChord = null
  }
  for (const src of activeSources) { try { src.stop(now + DUCK_S) } catch { /* already ended */ } }
  activeSources = []
  return now
}

/** Stop playback now (component unmount, leaving the sheet). Safe before any audio exists. */
export function stopSequence() {
  if (!ctx) { if (playToken) { playToken = 0; notify() } return }
  const audio = ctx
  silence(audio)
  // silence() cleared the suspend timer; re-arm it so the context still parks itself.
  suspendTimer = window.setTimeout(() => { audio.suspend().catch(() => {}) }, (DUCK_S + 0.2) * 1000)
  if (playToken) { playToken = 0; notify() }
}

/**
 * Strum a progression on the audio clock. Scheduling every chord up front (rather than a
 * chain of setTimeouts) keeps the timing sample-accurate through main-thread jank and
 * background-tab throttling — the same reason the metronome schedules ahead.
 */
export function playSequence(steps: SequenceStep[]): number {
  if (!steps.length) return 0
  const audio = ctx ?? (ctx = new AudioContext())
  audio.resume().catch(() => {}) // also wakes iOS's non-standard 'interrupted' state
  silence(audio)
  // Mild compression tames the six-string sum without hand-balancing string gains.
  // One shared compressor: it's the priciest built-in node, so don't grow one per tap.
  if (!comp) {
    comp = audio.createDynamicsCompressor()
    comp.connect(audio.destination)
  }
  const master = audio.createGain()
  master.connect(comp)
  const now = audio.currentTime
  const start = now + 0.03
  let at = start
  let sounded = 0
  let lastStringAt = start // when the final chord's last string is plucked
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    // A step always consumes its beats, sounding or not — computing `next` before the
    // guard keeps a fully-muted shape from collapsing onto the following chord's onset.
    const next = at + Math.max(0, step.seconds)
    // Each chord gets its own gain so the one before it can be faded under it.
    const voice = audio.createGain()
    voice.connect(master)
    const strings = scheduleStrum(audio, voice, step.shape, at)
    if (!strings) { voice.disconnect(); at = next; continue }
    sounded++
    lastStringAt = at + (strings - 1) * STRUM_GAP_S
    if (i < steps.length - 1 && step.seconds > 0) {
      voice.gain.setValueAtTime(1, next)
      voice.gain.linearRampToValueAtTime(0, next + CHORD_OVERLAP_S)
    }
    at = next
  }
  if (!sounded) {
    // Nothing to hear, but the context is running — park it rather than hold the phone's
    // audio session open forever (the caller's clearTimeout already killed the old timer).
    master.disconnect()
    suspendTimer = window.setTimeout(() => { audio.suspend().catch(() => {}) }, (DUCK_S + 0.2) * 1000)
    return 0
  }
  lastChord = master
  playToken = ++tokenSeq
  notify()
  // Detach the chain once every string has rung out instead of leaving dead nodes on the
  // graph (onended still fires for a source that was ducked or stopped early).
  const owned = activeSources.slice()
  let remaining = owned.length
  for (const src of owned) src.onended = () => { if (--remaining === 0) master.disconnect() }
  // Park the context once the tail is done; the resume() above wakes it next tap.
  // Only the newest tap holds the timer — clearTimeout above cancels older ones.
  const tailMs = (lastStringAt - now + MAX_NOTE_SECONDS + 0.2) * 1000
  suspendTimer = window.setTimeout(() => { audio.suspend().catch(() => {}) }, tailMs)
  return playToken
}
