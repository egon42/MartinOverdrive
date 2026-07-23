#!/usr/bin/env node
/**
 * Ryan autoscroll seed estimate (Tribute-calibrated, row-based).
 *
 * Usage:
 *   node .claude/skills/polish-ryan-sheet/scripts/estimate-scroll.mjs <songId> [studioSec]
 *   node .claude/skills/polish-ryan-sheet/scripts/estimate-scroll.mjs 15-dani-california 282
 *   node .claude/skills/polish-ryan-sheet/scripts/estimate-scroll.mjs 15-dani-california 4:42
 *
 * Counts blank-separated rows (NOT non-empty lines). Non-empty line ratios overestimate
 * dense UG sheets (Dani 17→9, Dirtbag 22→11 on device). See reference.md § Scroll seed.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '../../../..')

const TRIBUTE_ID = '07-tribute'
const H_T = 2964 // locked: speed 10 * (248 - 11.6) + V600
const V = 600
const TRIBUTE_ROWS = 66 // blank-separated; re-count if Tribute sheet changes a lot
const SCROLL_MIN = 6
const SCROLL_MAX = 120
/** Soft prior: locked chord-while-singing seeds cluster ~6–11; first seeds >12 on ≥3:00 tracks were usually too fast. */
const SOFT_CAP_STUDIO_SEC = 180
const SOFT_CAP_SPEED = 12

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
    console.log(`Usage: node estimate-scroll.mjs <songId> [studioSec|M:SS] [--lead=SEC] [--sit-out]

Examples:
  node estimate-scroll.mjs 15-dani-california 4:42
  node estimate-scroll.mjs 01-welcome-home 6:15 --lead=48 --sit-out
`)
    process.exit(songId ? 0 : 1)
  }

  let studioArg = null
  let leadInSec = null
  let longSitOut = false
  for (const a of process.argv.slice(3)) {
    if (a === '--sit-out') longSitOut = true
    else if (a.startsWith('--lead=')) leadInSec = Number(a.slice('--lead='.length))
    else studioArg = a
  }

  const studioSec = parseStudio(studioArg)
  if (studioSec == null) {
    console.error('Studio length required (seconds or M:SS).')
    process.exit(1)
  }

  const text = readRyan(songId)
  const rows = countRows(text)
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

  console.log(`Song: ${songId}`)
  console.log(`Studio: ${studioSec}s`)
  console.log(`Rows (blank-separated): ${rows}  (Tribute ${tributeRows}; ratio ${est.ratio}×)`)
  console.log(`Non-empty (do NOT use): ${nonEmpty}  (Tribute ${tributeNE}; would guess speed≈${neSpeed} — often too fast)`)
  console.log(`H≈${est.H}px  raw≈${est.raw}`)
  console.log(`→ speed ${est.speed}  leadInSec ${est.leadInSec}`)
  console.log(
    `note: "Estimate ${new Date().toISOString().slice(0, 10)}. Studio ${studioArg ?? studioSec}s; ${est.ratio}× Tribute rows (${rows}). speed≈${est.speed}. leadInSec=${est.leadInSec}. Dial on device."`,
  )
  if (neSpeed >= est.speed + 4) {
    console.log(
      `(row-based is ${neSpeed - est.speed} slower than non-empty — prefer rows; device corrections were almost always "too fast")`,
    )
  }
}

main()
