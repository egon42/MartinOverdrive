// Fetch a song's chords from Songsterr and convert them to this app's curated
// chord-sheet text format (chord on its own line, splitting the lyric it lands
// on — see src/chords.ts for the grammar).
//
// Usage:
//   node scripts/import-songsterr-chords.mjs "https://www.songsterr.com/a/wsa/...-chords-sNNNNN" 01-welcome-home
//
// The Songsterr chords page is plain HTML (no auth needed) that embeds the
// full chord/lyric data inline as JSON under a `"chordpro":{"current":[...]}`
// marker — not inside a __NEXT_DATA__ script tag. We locate that marker, brace-
// match the object, and JSON.parse it. Writes src/data/sheets/<songId>.chords.txt.
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const UA = { 'User-Agent': 'Mozilla/5.0 (personal band practice importer)' }

const [url, outSongId] = process.argv.slice(2)
const match = url?.match(/-s(\d+)(?:[/?#].*)?$/)
if (!match || !outSongId) {
  console.error('Usage: node scripts/import-songsterr-chords.mjs <songsterr-chords-page-url-ending-in-sNNNNN> <app-song-id>')
  process.exit(1)
}
const songId = Number(match[1])

const res = await fetch(url, { headers: UA })
if (!res.ok) throw new Error(`${res.status} for ${url}`)
const html = await res.text()

// Brace-match the object value that follows `"chordpro":`, tracking whether we're
// inside a JSON string (toggling on unescaped `"`) so quoted braces don't confuse
// the depth count.
function extractChordpro(text) {
  const KEY = '"chordpro":'
  const markerIdx = text.indexOf(`${KEY}{"current":`)
  if (markerIdx === -1) return null
  const objStart = markerIdx + KEY.length // index of the '{' that opens the chordpro object
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = objStart; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') { inString = true; continue }
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return text.slice(objStart, i + 1)
    }
  }
  return null
}

const chordproRaw = extractChordpro(html)
if (!chordproRaw) {
  console.error(`No chords found on page (no "chordpro":{"current":...} data): ${url}`)
  process.exit(1)
}
let chordpro
try {
  chordpro = JSON.parse(chordproRaw)
} catch (err) {
  console.error(`Failed to parse chordpro JSON: ${err.message}`)
  process.exit(1)
}

function chordName(token) {
  const chord = token.chord
  const base = chord?.baseNote?.name
  const suffix = chord?.chordType?.suffix ?? ''
  if (base) return `${base}${suffix}`
  if (token.text) return token.text
  console.warn(`Warning: chord token missing baseNote.name, falling back: ${JSON.stringify(token)}`)
  return '?'
}

// Walk one Songsterr `line` element's tokens, splitting accumulated lyric text
// around each chord — flush the buffer as its own line, emit the chord as its
// own line, then keep accumulating from there (no blank line inserted; that
// only happens between separate `line` elements, handled by the caller).
function renderLineTokens(tokens) {
  const outLines = []
  let buffer = ''
  let chordCount = 0
  for (const token of tokens) {
    if (token.type === 'chord') {
      if (buffer) { outLines.push(buffer); buffer = '' }
      outLines.push(chordName(token))
      chordCount++
    } else if (token.type === 'text' || token.type === 'noise') {
      buffer += token.text ?? ''
    } else if (token.text != null) {
      console.warn(`Warning: unrecognized line token type "${token.type}", treating as text`)
      buffer += token.text
    } else {
      console.warn(`Warning: unrecognized line token type "${token.type}" with no text, skipping`)
    }
  }
  if (buffer) outLines.push(buffer)
  return { outLines, chordCount }
}

let tuningText = null
const blocks = []
let totalChordCount = 0
for (const el of chordpro.current ?? []) {
  if (el.type === 'tuning') {
    tuningText = el.text
  } else if (el.type === 'line') {
    const { outLines, chordCount } = renderLineTokens(el.line ?? [])
    if (outLines.length) blocks.push(outLines)
    totalChordCount += chordCount
  } else {
    console.warn(`Warning: unrecognized chordpro element type "${el.type}", skipping`)
  }
}

const lines = []
if (tuningText) { lines.push(tuningText); lines.push('') }
blocks.forEach((block, i) => {
  if (i > 0) lines.push('')
  lines.push(...block)
})

const outPath = join(ROOT, 'src', 'data', 'sheets', `${outSongId}.chords.txt`)
mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, lines.join('\n') + '\n')
console.log(`${outSongId}: ${totalChordCount} chord lines -> src/data/sheets/${outSongId}.chords.txt`)
