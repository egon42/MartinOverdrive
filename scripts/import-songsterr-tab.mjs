// Fetch a track's tab data from Songsterr and convert it to ASCII tab text.
//
// Usage:
//   node scripts/import-songsterr-tab.mjs "https://www.songsterr.com/a/wsa/...-s319t3" 01-welcome-home
//
// The trailing sNNNtM in the Songsterr URL identifies the song (N) and part (M) —
// the same curated URLs stored in src/data/tab-links.json already point at the
// right track. Writes src/data/sheets/<songId>.tabs.txt for the app to pick up.
// Songsterr serves the tab as structured JSON (measures/beats/notes), so this is
// an exact conversion, not OCR or scraping of rendered pages.
import { writeFileSync, mkdirSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const MAX_WIDTH = 104
const UA = { 'User-Agent': 'Mozilla/5.0 (personal band practice importer)' }

const [url, outSongId] = process.argv.slice(2)
const match = url?.match(/-s(\d+)t(\d+)\b/)
if (!match || !outSongId) {
  console.error('Usage: node scripts/import-songsterr-tab.mjs <songsterr-url-ending-in-sNNNtM> <app-song-id>')
  process.exit(1)
}
const [songId, partId] = [Number(match[1]), Number(match[2])]

async function fetchJson(target) {
  const res = await fetch(target, { headers: UA })
  if (!res.ok) throw new Error(`${res.status} for ${target}`)
  const buf = Buffer.from(await res.arrayBuffer())
  try { return JSON.parse(buf.toString('utf8')) } catch { return JSON.parse(gunzipSync(buf).toString('utf8')) }
}

const meta = await fetchJson(`https://www.songsterr.com/api/meta/${songId}`)
const track = meta.tracks[partId]
if (!track) throw new Error(`Part ${partId} not found; tracks: ${meta.tracks.map((t, i) => `${i}=${t.name}`).join(', ')}`)
const part = await fetchJson(`https://dqsljvtekg760.cloudfront.net/${songId}/${meta.revisionId}/${meta.image}/${partId}.json`)

const tuning = part.tuning || track.tuning
const labels = tuning.map((midi) => NOTE_NAMES[midi % 12].padEnd(2, '-'))
const tempoAt = new Map()
for (const t of part.automations?.tempo ?? []) if (!tempoAt.has(t.measure)) tempoAt.set(t.measure, t.bpm)
let lastBpm = null

function noteToken(note) {
  if (note.rest || note.fret == null) return ''
  let token = note.harmonic ? `<${note.fret}>` : String(note.fret)
  if (note.dead) token = 'x'
  if (note.tie) token = `(${token})`
  if (note.bend) token += 'b'
  if (note.slide) token += '/'
  if (note.hp) token += 'h'
  if (note.vibrato) token += '~'
  return token
}

// Each measure becomes { header, pm, strings[6] } column blocks of equal width.
function renderMeasure(measure, index) {
  const strings = tuning.map(() => '')
  let pm = ''
  let header = ''
  const bpm = tempoAt.get(index)
  const notes = []
  if (measure.marker?.text) notes.push(`[${measure.marker.text}]`)
  if (bpm != null && bpm !== lastBpm) { notes.push(`(${bpm} bpm)`); lastBpm = bpm }
  header = notes.join(' ')

  for (const voice of measure.voices.slice(0, 1)) {
    for (const beat of voice.beats ?? []) {
      const tokens = tuning.map(() => '')
      for (const note of beat.notes ?? []) {
        if (note.string != null && note.string < tokens.length) tokens[note.string] = noteToken(note)
      }
      const width = Math.max(2, ...tokens.map((t) => t.length + 1), beat.palmMute ? 2 : 0)
      tokens.forEach((token, s) => { strings[s] += token.padEnd(width, '-') })
      pm += (beat.palmMute ? '.' : ' ').padEnd(width, ' ')
    }
  }
  const width = Math.max(...strings.map((s) => s.length))
  return {
    header,
    pm: pm.padEnd(width, ' ') + ' ',
    strings: strings.map((s) => s.padEnd(width, '-') + '|'),
    number: index + 1,
  }
}

// Paste text fragments onto a space canvas at fixed columns (later text may
// overflow to the right; a following fragment simply starts after it).
function renderHeader(items) {
  let canvas = ''
  for (const { col, text } of items) {
    if (!text) continue
    const at = Math.max(col, canvas.length ? canvas.length + 1 : col)
    canvas = canvas.padEnd(at, ' ') + text
  }
  return canvas
}

const blocks = part.measures.map(renderMeasure)
const lines = []
lines.push(`${meta.title} — ${meta.artist}`)
lines.push(`Track: ${part.name ?? track.name} (Songsterr s${songId}t${partId}, rev ${meta.revisionId})`)
lines.push(`Tuning (high→low): ${tuning.map((m) => NOTE_NAMES[m % 12]).join(' ')}${part.measures[0]?.signature ? ` — ${part.measures[0].signature.join('/')}` : ''}`)
lines.push(`Legend: x dead note · (n) tie · <n> harmonic · nb bend · n/ slide · nh hammer/pull · n~ vibrato · . palm mute`)
lines.push('')

let system = null
const flush = () => {
  if (!system) return
  const header = renderHeader(system.headerItems)
  if (header.trim()) lines.push(header)
  if (system.pm.trim()) lines.push(system.pm.trimEnd())
  system.strings.forEach((s) => lines.push(s))
  lines.push('')
  system = null
}
for (const block of blocks) {
  if (system && system.strings[0].length + block.strings[0].length > MAX_WIDTH) flush()
  if (!system) {
    system = {
      headerItems: [{ col: 0, text: `m${block.number}` }, { col: 4, text: block.header }],
      pm: ' '.repeat(3) + block.pm,
      strings: block.strings.map((s, i) => `${labels[i]}|${s}`),
    }
  } else {
    system.headerItems.push({ col: system.strings[0].length, text: block.header })
    system.pm += block.pm
    system.strings = system.strings.map((s, i) => s + block.strings[i])
  }
}
flush()

const outPath = join(ROOT, 'src', 'data', 'sheets', `${outSongId}.tabs.txt`)
mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, lines.join('\n') + '\n')
console.log(`${outSongId}: ${part.measures.length} measures -> src/data/sheets/${outSongId}.tabs.txt (${lines.length} lines)`)
