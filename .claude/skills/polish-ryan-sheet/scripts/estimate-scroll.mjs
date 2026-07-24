#!/usr/bin/env node
/**
 * Ryan autoscroll seed estimate (Tribute-calibrated, row-based).
 *
 * Usage:
 *   node .claude/skills/polish-ryan-sheet/scripts/estimate-scroll.mjs <songId> [studioSec]
 *   node .claude/skills/polish-ryan-sheet/scripts/estimate-scroll.mjs 15-dani-california 282
 *   node .claude/skills/polish-ryan-sheet/scripts/estimate-scroll.mjs 15-dani-california 4:42
 *   node .claude/skills/polish-ryan-sheet/scripts/estimate-scroll.mjs 02-all-the-small-things 2:48 --measure
 *
 * Counts blank-separated rows (NOT non-empty lines). Non-empty line ratios overestimate
 * dense UG sheets (Dani 17→9, Dirtbag 22→11 on device). See reference.md § Scroll seed.
 *
 * `--measure`: count rendered measure-map rows (chunk chords every 4 per blank group,
 * matching MEASURE_COLS_PER_ROW / chunkMeasureSlots). Prints measureSpeed /
 * measureLeadInSec for scrollSpeeds.json.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '../../../..')
const isMain = process.argv[1] != null
  && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1])

const TRIBUTE_ID = '07-tribute'
const H_T = 2964 // locked: speed 10 * (248 - 11.6) + V600
const V = 600
const TRIBUTE_ROWS = 66 // blank-separated; re-count if Tribute sheet changes a lot
const SCROLL_MIN = 6
const SCROLL_MAX = 120
/** Soft prior: locked chord-while-singing seeds cluster ~6–11; first seeds >12 on ≥3:00 tracks were usually too fast. */
const SOFT_CAP_STUDIO_SEC = 180
const SOFT_CAP_SPEED = 12
/** Same as MEASURE_COLS_PER_ROW in src/components.tsx. */
const MEASURE_COLS = 4

// Keep in sync with src/chords.ts chord / fret / cue token rules (ryan frets opt-in).
const CHORD_RE = /^[A-G][#b]?(?:maj|min|dim|aug|sus|add|m|M|\+|°)?\d*(?:(?:maj|min|sus|add|b|#)\d+)*(?:\/[A-G][#b]?)?$/
const FRET_RE = /^(?:[0-9]|1[0-9]|2[0-4])$/
const DYAD_FRET_RE = /^(?:[0-9]|1[0-9]|2[0-4])\/(?:[0-9]|1[0-9]|2[0-4])$/
const CUE_RE = /^\^([1-9][0-9]?)$/

function parseStudio(arg) {
  if (arg == null || arg === '') return null
  if (/^\d+:\d{1,2}$/.test(arg)) {
    const [m, s] = arg.split(':').map(Number)
    return m * 60 + s
  }
  const n = Number(arg)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Blank-line-separated row groups (one rendered lyric/chip row each). */
export function countRows(text) {
  let rows = 0
  let inRow = false
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() !== '') {
      if (!inRow) {
        rows++
        inRow = true
      }
    } else {
      inRow = false
    }
  }
  return rows
}

export function countNonEmpty(text) {
  return text.split(/\r?\n/).filter((l) => l.trim() !== '').length
}

function isMeasureChordToken(trimmed) {
  const name = trimmed.startsWith('~') ? trimmed.slice(1) : trimmed
  return CHORD_RE.test(name) || FRET_RE.test(name) || DYAD_FRET_RE.test(name) || CUE_RE.test(name)
}

/**
 * Rendered measure-map rows: each blank-separated group becomes
 * max(1, ceil(chordOrFretOrCueCount / 4)), matching chunkMeasureSlots.
 */
export function countMeasureRows(text) {
  let total = 0
  let chordCount = 0
  let groupHasContent = false

  const flush = () => {
    if (!groupHasContent) return
    total += Math.max(1, Math.ceil(chordCount / MEASURE_COLS))
  }

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (trimmed === '') {
      flush()
      chordCount = 0
      groupHasContent = false
      continue
    }
    groupHasContent = true
    // Whole-line chord / fret / dyad / cue tokens (UG spine); section headers add 0.
    const tokens = trimmed.split(/\s+/)
    if (tokens.every((token) => isMeasureChordToken(token))) chordCount += tokens.length
  }
  flush()
  return total
}

/**
 * @param {object} opts
 * @param {number} opts.rows
 * @param {number} opts.studioSec
 * @param {number} [opts.leadInSec] fixed lead-in (sit-out); else formula after speed pick
 * @param {boolean} [opts.longSitOut] if true, do not soft-cap (Welcome Home–style)
 */
export function estimateScroll({ rows, studioSec, leadInSec, longSitOut = false }) {
  const H = H_T * (rows / TRIBUTE_ROWS)
  const formulaLead = (speed) => 96 / Math.max(speed, 1)

  // First pass with provisional lead-in
  let lead = leadInSec ?? formulaLead(10)
  let raw = (H - V) / Math.max(studioSec - lead, 1)
  let speed = Math.round(raw)

  // Soft-cap: dense UG row counts still run ahead of the track on device
  if (!longSitOut && studioSec >= SOFT_CAP_STUDIO_SEC && speed > SOFT_CAP_SPEED) {
    speed = Math.round(speed * 0.7)
    if (speed > SOFT_CAP_SPEED) speed = SOFT_CAP_SPEED
  }

  speed = Math.max(SCROLL_MIN, Math.min(SCROLL_MAX, speed))

  if (leadInSec == null) {
    lead = Math.round(formulaLead(speed) * 10) / 10
  } else {
    lead = leadInSec
    // Recompute speed with the real sit-out lead-in
    raw = (H - V) / Math.max(studioSec - lead, 1)
    speed = Math.max(SCROLL_MIN, Math.min(SCROLL_MAX, Math.round(raw)))
    if (!longSitOut && studioSec >= SOFT_CAP_STUDIO_SEC && speed > SOFT_CAP_SPEED) {
      speed = Math.min(SOFT_CAP_SPEED, Math.max(SCROLL_MIN, Math.round(speed * 0.7)))
    }
  }

  return {
    rows,
    H: Math.round(H),
    raw: Math.round(raw * 10) / 10,
    speed,
    leadInSec: lead,
    ratio: Math.round((rows / TRIBUTE_ROWS) * 100) / 100,
  }
}

function readRyan(songId) {
  const p = path.join(root, 'src/data/sheets', `${songId}.ryan.txt`)
  if (!fs.existsSync(p)) {
    console.error(`Missing ${p}`)
    process.exit(1)
  }
  return fs.readFileSync(p, 'utf8')
}

function main() {
  const songId = process.argv[2]
  if (!songId || songId === '-h' || songId === '--help') {
    console.log(`Usage: node estimate-scroll.mjs <songId> [studioSec|M:SS] [--lead=SEC] [--sit-out] [--measure]

Examples:
  node estimate-scroll.mjs 15-dani-california 4:42
  node estimate-scroll.mjs 01-welcome-home 6:15 --lead=48 --sit-out
  node estimate-scroll.mjs 02-all-the-small-things 2:48 --measure
`)
    process.exit(songId ? 0 : 1)
  }

  let studioArg = null
  let leadInSec = null
  let longSitOut = false
  let measure = false
  for (const a of process.argv.slice(3)) {
    if (a === '--sit-out') longSitOut = true
    else if (a === '--measure') measure = true
    else if (a.startsWith('--lead=')) leadInSec = Number(a.slice('--lead='.length))
    else studioArg = a
  }

  const studioSec = parseStudio(studioArg)
  if (studioSec == null) {
    console.error('Studio length required (seconds or M:SS).')
    process.exit(1)
  }

  const text = readRyan(songId)
  const lyricRows = countRows(text)
  const measureRows = countMeasureRows(text)
  const rows = measure ? measureRows : lyricRows
  const nonEmpty = countNonEmpty(text)
  const tributeText = readRyan(TRIBUTE_ID)
  const tributeRows = countRows(tributeText)
  const tributeNE = countNonEmpty(tributeText)

  const est = estimateScroll({ rows, studioSec, leadInSec, longSitOut })

  // Warn if someone is still thinking in non-empty lines
  const neRatio = nonEmpty / tributeNE
  const neH = H_T * neRatio
  const neSpeed = Math.max(
    SCROLL_MIN,
    Math.round((neH - V) / Math.max(studioSec - (leadInSec ?? 9.6), 1)),
  )

  console.log(`Song: ${songId}${measure ? ' (measure map)' : ''}`)
  console.log(`Studio: ${studioSec}s`)
  console.log(`Lyric rows (blank-separated): ${lyricRows}`)
  console.log(`Measure rows (ceil chords/4 per group): ${measureRows}`)
  console.log(`Using: ${rows}  (Tribute lyric ${tributeRows}; ratio ${est.ratio}×)`)
  console.log(`Non-empty (do NOT use): ${nonEmpty}  (Tribute ${tributeNE}; would guess speed≈${neSpeed} — often too fast)`)
  console.log(`H≈${est.H}px  raw≈${est.raw}`)
  if (measure) {
    console.log(`→ measureSpeed ${est.speed}  measureLeadInSec ${est.leadInSec}`)
    console.log(
      `note: "Estimate ${new Date().toISOString().slice(0, 10)} measure. Studio ${studioArg ?? studioSec}s; ${est.ratio}× Tribute rows (${rows} measure). measureSpeed≈${est.speed}. measureLeadInSec=${est.leadInSec}. Dial on device at Ryan 0.75×."`,
    )
  } else {
    console.log(`→ speed ${est.speed}  leadInSec ${est.leadInSec}`)
    console.log(
      `note: "Estimate ${new Date().toISOString().slice(0, 10)}. Studio ${studioArg ?? studioSec}s; ${est.ratio}× Tribute rows (${rows}). speed≈${est.speed}. leadInSec=${est.leadInSec}. Dial on device."`,
    )
  }
  if (neSpeed >= est.speed + 4) {
    console.log(
      `(row-based is ${neSpeed - est.speed} slower than non-empty — prefer rows; device corrections were almost always "too fast")`,
    )
  }
}

if (isMain) main()
