import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import XLSX from 'xlsx'

const suppliedPath = process.argv.slice(2).find((argument) => argument !== '--')
const input = path.resolve(suppliedPath || process.env.SETLIST_XLSX || 'martin_overdrive_setlist_prep.xlsx')
const output = path.resolve('src/data/setlist.json')

if (!fs.existsSync(input)) {
  console.error(`Workbook not found: ${input}`)
  console.error('Usage: npm run import-setlist -- path/to/martin_overdrive_setlist_prep.xlsx')
  process.exit(1)
}

const workbook = XLSX.readFile(input, { cellDates: true })
const sheetName = workbook.SheetNames.includes('Set List Prep') ? 'Set List Prep' : workbook.SheetNames[0]
const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '', raw: false })

const text = (value) => value == null ? '' : String(value).trim()
const slug = (value) => text(value).toLowerCase().normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

const songs = rows.filter((row) => text(row.Track)).map((row, index) => ({
  id: `${String(index + 1).padStart(2, '0')}-${slug(row.Track)}`,
  order: index + 1,
  title: text(row.Track),
  artist: text(row.Artist),
  difficulty: Number(row.Difficulty) || null,
  tuning: text(row.Tuning),
  role: text(row.Role),
  practiceStyle: text(row['Practice Bucket']),
  backingTrackUrl: text(row['Backing Track URL']),
  songsterrUrl: '',
  linkQuality: text(row['Link Quality']),
  scaleHint: text(row['Scale Hint']),
  pentatonicBox: text(row['Pentatonic Box']),
  mustKnow: text(row['Must Know']),
  fallback: text(row.Fallback),
  firstCue: '',
  rehearsalNotes: text(row['Rehearsal Question']),
  source: Object.fromEntries(Object.entries(row).map(([key, value]) => [key, text(value)]))
}))

const references = workbook.SheetNames.includes('Sources and Songsterr')
  ? XLSX.utils.sheet_to_json(workbook.Sheets['Sources and Songsterr'], { defval: '' })
  : []

const payload = {
  meta: { sourceFile: path.basename(input), sourceSheet: sheetName, importedAt: new Date().toISOString(), songCount: songs.length },
  songs,
  references
}

fs.mkdirSync(path.dirname(output), { recursive: true })
fs.writeFileSync(output, `${JSON.stringify(payload, null, 2)}\n`)
console.log(`Imported ${songs.length} songs from "${sheetName}" to ${output}`)
