#!/usr/bin/env node
// Snapshot a song's CURRENT cheat card into progressionVersions.json before rewriting
// it in progressions.json, so the old form stays selectable in the dev cheat-card
// version dropdown (see progressionVersionsFor in src/progressions.ts).
//
// Usage:  node scripts/snapshot-progression.mjs <songId> "<label>"
// e.g.    node scripts/snapshot-progression.mjs 01-welcome-home "Jul 15 hand pass"
//
// Newest snapshot goes first. Refuses duplicate labels; skips (exit 0) when the
// current card is already archived byte-identical under another label.
import fs from 'node:fs'
import process from 'node:process'

const [songId, label] = process.argv.slice(2)
if (!songId || !label || !label.trim()) {
  console.error('Usage: node scripts/snapshot-progression.mjs <songId> "<label>"')
  process.exit(1)
}

const PROGRESSIONS = 'src/data/progressions.json'
const VERSIONS = 'src/data/progressionVersions.json'

const progressions = JSON.parse(fs.readFileSync(PROGRESSIONS, 'utf8'))
const entry = progressions[songId]
if (!entry) {
  console.error(`No progressions.json entry for "${songId}"`)
  process.exit(1)
}

const versions = fs.existsSync(VERSIONS) ? JSON.parse(fs.readFileSync(VERSIONS, 'utf8')) : {}
const list = Array.isArray(versions[songId]) ? versions[songId] : []

// Strip any stray `label` a restored-from-archive entry might carry, so the requested
// label always wins and the identical-content comparison isn't defeated by it.
const { label: _strayLabel, ...entryBody } = entry

// Content check FIRST: retrying the same snapshot (same or different label) is a no-op,
// not an error — only refuse a duplicate label when the content actually differs.
const body = JSON.stringify(entryBody)
const alreadyArchived = list.find((v) => {
  const { label: _label, ...rest } = v
  return JSON.stringify(rest) === body
})
if (alreadyArchived) {
  console.log(`"${songId}" current card is already archived as "${alreadyArchived.label}" — nothing to do`)
  process.exit(0)
}

if (list.some((v) => v.label === label.trim())) {
  console.error(`"${songId}" already has a version labeled "${label.trim()}" (with different content) — pick another label`)
  process.exit(1)
}

versions[songId] = [{ label: label.trim(), ...entryBody }, ...list]
fs.writeFileSync(VERSIONS, JSON.stringify(versions, null, 2) + '\n')
console.log(`Archived "${songId}" current card as "${label.trim()}" (${versions[songId].length} archived version(s))`)
