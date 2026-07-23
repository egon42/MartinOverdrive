#!/usr/bin/env node
// Read-only consistency check for the song-data pipeline. Closes the "no automated
// verification that a song renders correctly" gap: it cross-checks the generated
// setlist against the curated sheets, cheat cards, and tab links, and — most
// valuably — guards the CHORD_RE regex that is DUPLICATED between src/chords.ts and
// scripts/ug-chords-to-sheet.mjs so the two copies can never silently drift apart.
//
// Usage:  npm run validate   (or: node scripts/validate-song-data.mjs)
// Exits 1 if any check fails; prints findings grouped by song. Never writes anything.
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const SETLIST = 'src/data/setlist.json'
const SHEETS_DIR = 'src/data/sheets'
const PROGRESSIONS = 'src/data/progressions.json'
const PROG_VERSIONS = 'src/data/progressionVersions.json'
const TAB_LINKS = 'src/data/tab-links.json'
const SCROLL_SPEEDS = 'src/data/scrollSpeeds.json'
const AMP_PRESETS = 'src/data/amp-presets.json'
const CHORDS_TS = 'src/chords.ts'
const UG_SCRIPT = 'scripts/ug-chords-to-sheet.mjs'

// Findings are keyed by a "scope" (a song id, or a global bucket) so output groups by song.
const findings = new Map()
const fail = (scope, detail) => {
  if (!findings.has(scope)) findings.set(scope, [])
  findings.get(scope).push(detail)
}

// A hard problem that stops the validator from verifying (missing file, unparseable
// JSON, a regex literal that couldn't be located) — distinct from a data finding, but
// still an exit-1 condition since we then can't vouch for the data.
const blockers = []
function readText(file) {
  try { return fs.readFileSync(file, 'utf8') }
  catch (error) { blockers.push(`Cannot read ${file}: ${error.message}`); return null }
}
function readJson(file) {
  const text = readText(file)
  if (text == null) return null
  try { return JSON.parse(text) }
  catch (error) { blockers.push(`Cannot parse ${file}: ${error.message}`); return null }
}

/** Count chord names as written (group contents once). Keep in sync with parseChordSpans in src/progressions.ts. */
function parseCheatChordWrittenCount(chords) {
  const src = String(chords).trim()
  if (!src) return 0
  const re = /\(([^)]*)\)|[×xX]\s*(\d+)|\||([^\s×xX|()]+)/gu
  let match
  let lastWasGroup = false
  let cursor = 0
  let count = 0
  while ((match = re.exec(src)) !== null) {
    const gap = src.slice(cursor, match.index).trim()
    if (gap) throw new Error(`unexpected "${gap}"`)
    cursor = match.index + match[0].length
    if (match[0] === '|') {
      lastWasGroup = false
      continue
    }
    if (match[1] !== undefined) {
      const groupChords = match[1].trim().split(/\s+/).filter(Boolean)
      if (!groupChords.length) throw new Error('empty chord group')
      count += groupChords.length
      lastWasGroup = true
      continue
    }
    if (match[2] !== undefined) {
      const times = Number(match[2])
      if (!Number.isFinite(times) || times < 2) throw new Error(`repeat must be ≥2`)
      if (!lastWasGroup) throw new Error(`×${times} must follow a (…) group`)
      lastWasGroup = false
      continue
    }
    count += 1
    lastWasGroup = false
  }
  const trailing = src.slice(cursor).trim()
  if (trailing) throw new Error(`unexpected "${trailing}"`)
  return count
}

// --- Regex sourcing -------------------------------------------------------------
// A .mjs script can't import types/consts from a .ts module without a loader, so we
// PORT the regexes by extracting their literals from src/chords.ts as text and
// rebuilding real RegExp objects. Extracting (rather than re-typing) is what makes the
// drift check below trustworthy: the validator and the app share one source of truth.
//
// Matches a JS regex literal `/…/flags`, honouring escaped chars and [char classes].
const LITERAL = String.raw`/(?:\\.|\[(?:\\.|[^\]])*\]|[^/\\\n])*/[a-z]*`
function extractLiteral(source, name) {
  const match = source.match(new RegExp(String.raw`const\s+${name}\s*=\s*(${LITERAL})`))
  return match ? match[1] : null
}
function toRegExp(literal) {
  const parsed = literal.match(new RegExp(String.raw`^/((?:\\.|\[(?:\\.|[^\]])*\]|[^/\\\n])*)/([a-z]*)$`))
  return new RegExp(parsed[1], parsed[2])
}

const chordsSource = readText(CHORDS_TS)
const ugSource = readText(UG_SCRIPT)

const chordLiteralTs = chordsSource && extractLiteral(chordsSource, 'CHORD_RE')
const chordLiteralUg = ugSource && extractLiteral(ugSource, 'CHORD_RE')
const metaLiteral = chordsSource && extractLiteral(chordsSource, 'META_RE')

if (chordsSource && !chordLiteralTs) blockers.push(`Could not locate CHORD_RE in ${CHORDS_TS}`)
if (ugSource && !chordLiteralUg) blockers.push(`Could not locate CHORD_RE in ${UG_SCRIPT}`)
if (chordsSource && !metaLiteral) blockers.push(`Could not locate META_RE in ${CHORDS_TS}`)

const META_RE = metaLiteral ? toRegExp(metaLiteral) : null

// --- Check 4 (most valuable): CHORD_RE drift between the two files ---------------
// The literals must be byte-identical. If they diverge, the UG converter and the app
// parser disagree on what counts as a chord — sheets convert one way and render another.
if (chordLiteralTs && chordLiteralUg && chordLiteralTs !== chordLiteralUg) {
  fail('CHORD_RE drift (chords.ts vs ug-chords-to-sheet.mjs)',
    `The duplicated CHORD_RE has drifted — the "keep in sync" copies no longer match.\n` +
    `    ${CHORDS_TS}:\n      ${chordLiteralTs}\n` +
    `    ${UG_SCRIPT}:\n      ${chordLiteralUg}`)
}

// --- Load data ------------------------------------------------------------------
const setlist = readJson(SETLIST)
const progressions = readJson(PROGRESSIONS)
const progressionVersions = readJson(PROG_VERSIONS)
const tabLinks = readJson(TAB_LINKS)
const scrollSpeeds = readJson(SCROLL_SPEEDS)
const ampPresets = readJson(AMP_PRESETS)

// If core inputs are missing/unparseable, report blockers and bail (exit 1).
if (blockers.length && (!setlist || !progressions || !tabLinks || !META_RE)) {
  for (const blocker of blockers) console.error(`BLOCKER: ${blocker}`)
  process.exit(1)
}

const songs = Array.isArray(setlist.songs) ? setlist.songs : []
const songIds = new Set(songs.map((song) => song.id))

// --- Check 1: every song has both sheet files; flag orphan sheet files -----------
let sheetEntries = []
try { sheetEntries = fs.readdirSync(SHEETS_DIR) }
catch (error) { blockers.push(`Cannot read ${SHEETS_DIR}: ${error.message}`) }

for (const song of songs) {
  const chordsFile = path.join(SHEETS_DIR, `${song.id}.chords.txt`)
  const tabsFile = path.join(SHEETS_DIR, `${song.id}.tabs.txt`)
  if (!fs.existsSync(chordsFile)) fail(song.id, `Missing chords sheet: ${chordsFile}`)
  if (!fs.existsSync(tabsFile)) fail(song.id, `Missing tabs sheet: ${tabsFile}`)
}

for (const entry of sheetEntries) {
  const match = entry.match(/^(.+)\.(chords|tabs|ryan)\.txt$/)
  if (!match) { fail('Orphan sheet files', `Unexpected file (not <songId>.chords/tabs/ryan.txt): ${entry}`); continue }
  if (!songIds.has(match[1])) fail('Orphan sheet files', `Sheet has no setlist entry: ${entry} (song id "${match[1]}")`)
}

// --- Check 3: chords-file meta lines that would be misclassified ------------------
// The parser only collects a leading line as meta if it matches META_RE; a meta-shaped
// line that fails META_RE (the classic bare "Standard" vs "Standard (EADGBE)" trap)
// renders as a spurious first lyric line. LOOSE_META picks lines that clearly intend to
// be tuning/capo/key metadata; if such a line fails the real META_RE, it's misclassified.
const LOOSE_META = /^(standard\b|drop\s+[a-g]\b|tuning\b|capo\b|key\s*[:-])/i
if (META_RE) {
  for (const song of songs) {
    const chordsFile = path.join(SHEETS_DIR, `${song.id}.chords.txt`)
    if (!fs.existsSync(chordsFile)) continue
    const text = readText(chordsFile)
    if (text == null) continue
    const firstLine = text.split(/\r?\n/).find((line) => line.trim() !== '')
    if (firstLine == null) { fail(song.id, `Chords sheet is empty: ${chordsFile}`); continue }
    const trimmed = firstLine.trim()
    if (LOOSE_META.test(trimmed) && !META_RE.test(trimmed)) {
      fail(song.id, `Chords sheet first line "${trimmed}" looks like tuning/meta but fails META_RE — ` +
        `it will render as a spurious first lyric line (e.g. use "Standard (EADGBE)").`)
    }
  }
}

// --- Check 2: cheat cards (progressions.json + archived progressionVersions.json) --
// Archived versions render through the exact same parser when picked in the dev
// version dropdown, so they must satisfy the same rules as the live cards.
function validateCard(songId, entry, where) {
  {
    const sections = entry && Array.isArray(entry.sections) ? entry.sections : null
    if (!sections) { fail(songId, `${where} entry has no "sections" array.`); return }
    sections.forEach((section, index) => {
      const label = `${where} section #${index + 1}`
      const sectionName = typeof section.section === 'string' ? section.section.trim() : ''
      const chords = typeof section.chords === 'string' ? section.chords.trim() : ''
      if (!sectionName) fail(songId, `${label}: empty "section".`)
      const hasTab = typeof section.tab === 'string' && section.tab.trim().length > 0
      const hasTabMore = typeof section.tabMore === 'string' && section.tabMore.trim().length > 0
      // Tab-only rows (usually "Fills") may omit chords — the ASCII tab is the content.
      if (!chords && !hasTab && !hasTabMore) fail(songId, `${label}: empty "chords".`)
      if (hasTabMore && !hasTab) fail(songId, `${label}: "tabMore" without primary "tab".`)
      // Chord notation may use grouped repeats: "(E A) ×3 (E G A) ×2". Shapes align
      // 1:1 with chord names as written (one pass per group), not the expanded count.
      let writtenChordCount = 0
      if (chords) {
        try {
          writtenChordCount = parseCheatChordWrittenCount(chords)
        } catch (err) {
          fail(songId, `${label}: bad chords notation — ${err instanceof Error ? err.message : err}`)
        }
      }
      if (section.shapes != null) {
        const shapeTokens = String(section.shapes).trim().split(/\s+/).filter(Boolean)
        if (shapeTokens.length !== writtenChordCount) {
          fail(songId, `${label}: ${shapeTokens.length} shapes for ${writtenChordCount} written chords — must be 1:1 with names as written (group contents once).`)
        }
        const badShapes = shapeTokens.filter((shape) => shape.length !== 6)
        if (badShapes.length) {
          fail(songId, `${label}: shapes must be exactly 6 chars — offending: ${badShapes.join(', ')}.`)
        }
      }
    })
    if (Array.isArray(entry.form)) {
      const names = new Set(sections.map((s) => s.section))
      entry.form.forEach((step, index) => {
        if (typeof step !== 'string' || !step.trim()) {
          fail(songId, `${where} form #${index + 1}: empty step.`)
          return
        }
        const base = step.replace(/\s*[×xX]\s*\d+\s*$/u, '').trim()
        if (!names.has(base) && !names.has(step.trim())) {
          fail(songId, `${where} form "${step}" has no matching sections entry (looked up "${base}").`)
        }
      })
    }
  }
}

if (progressions && typeof progressions === 'object') {
  for (const [songId, entry] of Object.entries(progressions)) {
    if (!songIds.has(songId)) fail(songId, `progressions.json entry keys to a song not in the setlist.`)
    validateCard(songId, entry, 'progressions.json')
  }
}

let archivedVersionCount = 0
if (progressionVersions && typeof progressionVersions === 'object') {
  for (const [songId, list] of Object.entries(progressionVersions)) {
    if (!songIds.has(songId)) fail(songId, `progressionVersions.json entry keys to a song not in the setlist.`)
    if (!Array.isArray(list)) { fail(songId, `progressionVersions.json entry is not an array of versions.`); continue }
    const labels = new Set()
    list.forEach((version, index) => {
      const label = typeof version?.label === 'string' ? version.label.trim() : ''
      if (!label) { fail(songId, `progressionVersions.json version #${index + 1}: empty "label".`); return }
      if (labels.has(label)) fail(songId, `progressionVersions.json duplicate version label "${label}".`)
      labels.add(label)
      archivedVersionCount += 1
      validateCard(songId, version, `progressionVersions.json "${label}"`)
    })
  }
}

// --- Check 5: tab-links.json entries key to real songs ---------------------------
if (tabLinks && typeof tabLinks === 'object') {
  for (const songId of Object.keys(tabLinks)) {
    if (!songIds.has(songId)) fail(songId, `tab-links.json entry keys to a song not in the setlist.`)
  }
}

// --- Check 6: scrollSpeeds.json (polished Ryan/show autoscroll defaults) ----------
const SCROLL_MIN = 6, SCROLL_MAX = 120
let scrollSpeedCount = 0
if (scrollSpeeds && typeof scrollSpeeds === 'object') {
  for (const [songId, entry] of Object.entries(scrollSpeeds)) {
    if (!songIds.has(songId)) fail(songId, `scrollSpeeds.json entry keys to a song not in the setlist.`)
    scrollSpeedCount += 1
    const speed = entry && typeof entry === 'object' ? entry.speed : null
    if (typeof speed !== 'number' || !Number.isFinite(speed) || speed < SCROLL_MIN || speed > SCROLL_MAX) {
      fail(songId, `scrollSpeeds.json "speed" must be a number ${SCROLL_MIN}–${SCROLL_MAX} (got ${JSON.stringify(speed)}).`)
    }
    if (entry && typeof entry === 'object' && 'leadInSec' in entry) {
      const lead = entry.leadInSec
      if (typeof lead !== 'number' || !Number.isFinite(lead) || lead < 0 || lead > 60) {
        fail(songId, `scrollSpeeds.json "leadInSec" must be 0–60 seconds (got ${JSON.stringify(lead)}).`)
      }
    }
  }
}

// --- Check 7: amp-presets.json (imported by tsc — broken JSON fails Pages build) ---
// Learned 2026-07-23: two Ryan polish pushes ate the next song's entry when editing
// "notes" via a too-short StrReplace; validate passed because it never read this file.
const AMP_JOINERS = new Set(['', '→', '↔'])
let ampPresetCount = 0
if (ampPresets && typeof ampPresets === 'object') {
  for (const songId of songIds) {
    if (!(songId in ampPresets)) fail(songId, `amp-presets.json missing entry for setlist song.`)
  }
  for (const [songId, entry] of Object.entries(ampPresets)) {
    if (!songIds.has(songId)) fail(songId, `amp-presets.json entry keys to a song not in the setlist.`)
    ampPresetCount += 1
    if (!entry || typeof entry !== 'object') {
      fail(songId, `amp-presets.json entry must be an object.`)
      continue
    }
    const { presets, joiner, notes } = entry
    if (!Array.isArray(presets) || !presets.length || !presets.every((n) => typeof n === 'number' && n >= 1 && n <= 24)) {
      fail(songId, `amp-presets.json "presets" must be a non-empty array of slots 1–24 (got ${JSON.stringify(presets)}).`)
    }
    if (!AMP_JOINERS.has(joiner)) {
      fail(songId, `amp-presets.json "joiner" must be "" | "→" | "↔" (got ${JSON.stringify(joiner)}).`)
    }
    if (typeof notes !== 'string') {
      fail(songId, `amp-presets.json "notes" must be a string (got ${JSON.stringify(notes)}).`)
    }
  }
}

// --- Report ---------------------------------------------------------------------
for (const blocker of blockers) console.error(`BLOCKER: ${blocker}`)

const songScopes = [...findings.keys()].filter((scope) => songIds.has(scope)).sort()
const globalScopes = [...findings.keys()].filter((scope) => !songIds.has(scope)).sort()

let issueCount = 0
const printGroup = (scope) => {
  const items = findings.get(scope)
  issueCount += items.length
  console.log(`\n${scope}`)
  for (const item of items) console.log(`  - ${item}`)
}

if (songScopes.length || globalScopes.length) {
  console.log('Song-data validation FAILED. Findings:')
  songScopes.forEach(printGroup)
  globalScopes.forEach(printGroup)
  console.log(`\n${issueCount} issue(s) across ${songScopes.length + globalScopes.length} group(s).`)
}

if (blockers.length || findings.size) {
  process.exit(1)
}

console.log(`Song-data validation passed: ${songs.length} songs, ${sheetEntries.length} sheet files, ` +
  `${Object.keys(progressions).length} cheat cards (+${archivedVersionCount} archived versions), ` +
  `${Object.keys(tabLinks).length} tab-link entries, ${scrollSpeedCount} scroll-speed seeds, ` +
  `${ampPresetCount} amp-preset entries. ` +
  `CHORD_RE in sync across ${CHORDS_TS} and ${UG_SCRIPT}.`)
