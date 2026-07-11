#!/usr/bin/env node
// Convert an Ultimate-Guitar "chord-over-lyric" paste into this app's own-line
// sheet format (chord on its own line, splitting the lyric where it lands), which
// src/chords.ts parses with correct chord positions.
//
// Why this exists: UG's positioned format does NOT survive a verbatim save — the
// app parser treats a chord-only line as chords bunched at the START of the next
// lyric, so a line like "C ... Bb" over "…sun comes up" loses the Bb's position.
// This script reads each chord's real column and rebuilds the lyric split there,
// and inserts the blank-line delimiters the parser needs between logical lines.
//
// Usage:  node scripts/ug-chords-to-sheet.mjs <input.txt> <songId> [--tuning "Drop D"]
// Writes: src/data/sheets/<songId>.chords.txt   (default meta line: "Standard")
//
// It trims UG page chrome (nav/footer) by capturing from the first [Section]
// header to the first end marker ("X" alone, "Last update:", "Rating", …). Always
// spot-check the output against the source — N.C., odd spacing, and non-standard
// section labels are passed through as-is, not interpreted.
import fs from 'node:fs'

// Same chord grammar as src/chords.ts isChordToken (keep in sync).
const CHORD_RE = /^[A-G][#b]?(?:maj|min|dim|aug|sus|add|m|M|\+|°)?\d*(?:(?:maj|min|sus|add|b|#)\d+)*(?:\/[A-G][#b]?)?$/
const isChord = (t) => CHORD_RE.test(t)
const isChordLine = (s) => { const t = s.trim().split(/\s+/); return t[0] !== '' && t.every(isChord) }
const isSection = (s) => /^\[.+\]$/.test(s.trim())
const isBlank = (s) => s.trim() === ''

const argv = process.argv.slice(2)
const tuningIdx = argv.indexOf('--tuning')
// Default must match src/chords.ts META_RE — a bare "Standard" fails it and renders as
// a spurious first lyric line; the paren form "Standard (EADGBE)" is what the parser wants.
const tuning = tuningIdx >= 0 ? argv.splice(tuningIdx, 2)[1] : 'Standard (EADGBE)'
const [inPath, songId] = argv
if (!inPath || !songId) {
  console.error('usage: node scripts/ug-chords-to-sheet.mjs <input.txt> <songId> [--tuning "Drop D"]')
  process.exit(1)
}

const raw = fs.readFileSync(inPath, 'utf8').replace(/\r\n?/g, '\n').split('\n')

// Content region: first [Section] header (fallback: first line) → first end marker.
// UG chord pastes reliably end with a lone "X" then "Last update: <date>"; the other
// labels are chrome that only ever appears as its own whole line. Match the whole trimmed
// line (no substring stripping) so lyrics ending in "." or ":" can't false-truncate.
const END_LINE = /^(x|rating|welcome offer|play next|get effects|related tabs|more versions)$/i
let start = raw.findIndex(isSection)
if (start < 0) start = 0
let end = raw.length
for (let i = start + 1; i < raw.length; i++) {
  const t = raw[i].trim()
  if (END_LINE.test(t) || /^last update\s*:/i.test(t)) { end = i; break }
}
const lines = raw.slice(start, end)

const out = []
const push = (s) => out.push(s)
const emitChordSplit = (chordLine, lyric) => {
  const cols = []
  for (const m of chordLine.matchAll(/\S+/g)) cols.push([m.index, m[0]])
  const lead = lyric.slice(0, cols[0][0])
  if (lead.length) push(lead)            // lyric before the first chord (trailing space kept = word boundary)
  cols.forEach(([col, chord], i) => {
    push(chord)
    const seg = lyric.slice(col, i + 1 < cols.length ? cols[i + 1][0] : lyric.length)
    // A whitespace-only seg (≥2 spaces between two chords' columns) must NOT be emitted as
    // its own line — the parser treats a blank line as a delimiter and would split this one
    // logical line in two. Fold it onto the chord we just pushed (trailing spaces are
    // trimmed there) so the block stays contiguous.
    if (seg.length) { if (seg.trim() === '') out[out.length - 1] += seg; else push(seg) }
  })
}

for (let i = 0; i < lines.length; i++) {
  const line = lines[i]
  if (isBlank(line)) continue            // drop source blanks; we insert our own delimiters
  if (isSection(line)) { push(line.trim()); push(''); continue }
  if (isChordLine(line)) {
    let j = i + 1
    while (j < lines.length && isBlank(lines[j])) j++
    const next = j < lines.length ? lines[j] : ''
    if (next && !isChordLine(next) && !isSection(next)) { emitChordSplit(line, next); i = j } // chords over a lyric
    else push(line.trim().split(/\s+/).join(' '))                                             // standalone chord row
    push('')
    continue
  }
  push(line.replace(/\s+$/, ''))         // plain lyric line
  push('')
}

// Collapse repeated blanks, trim ends.
const cleaned = []
for (const l of out) { if (l === '' && cleaned[cleaned.length - 1] === '') continue; cleaned.push(l) }
while (cleaned[0] === '') cleaned.shift()
while (cleaned.at(-1) === '') cleaned.pop()

fs.writeFileSync(`src/data/sheets/${songId}.chords.txt`, `${tuning}\n\n${cleaned.join('\n')}\n`)
console.error(`${songId}: wrote ${cleaned.length} content lines -> src/data/sheets/${songId}.chords.txt`)
