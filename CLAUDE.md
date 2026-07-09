# Martin Overdrive — project guide for Claude Code

**Overdrive Setlist Companion**: a local-first React + TypeScript + Vite PWA for band
setlist prep, practice tracking, and phone-friendly show mode. Deps float on `"latest"`
(installed React is 19.x — don't assume React 18 APIs). Solo project, **no backend,
no server code** — all practice state lives in `localStorage` (export/restore backup on the
dashboard). Don't over-engineer: no auth, no database, no test framework unless asked.

## Commands (pnpm is the lockfile — install with pnpm; `npm run <script>` is fine against existing node_modules)

```bash
npm run dev                 # Vite dev server (add -- --host to test from a phone)
npm run build               # tsc -b && vite build
npm run preview             # serve the production build locally
npm run import-setlist -- "path\to\martin_overdrive_setlist_prep.xlsx"
                            # regenerates src/data/setlist.json (looks for a sheet named
                            # "Set List Prep", else falls back to the first sheet)
```

## Deploy — GitHub Pages via Actions

- Pushing to `main` **or `dev`** triggers `.github/workflows/deploy-pages.yml`. It builds
  both branches into one Pages artifact: `main` at `/MartinOverdrive/` (production) and
  `dev` at `/MartinOverdrive/dev/` (development). There is no other deploy path.
- **New features are developed on the `dev` branch** and used live at the /dev/ URL;
  porting a feature to production = merging `dev` → `main`. Keep the workflow file
  identical on both branches (push events use the pushed branch's copy).
- **To verify a deploy actually went live:** check the workflow run
  (`gh run list --limit 3` / `gh run watch`), not just the push. A green push ≠ deployed.
- The service worker uses **network-first caching for app updates** (fixed in `8904e94`
  after stale-UI reports). If the live site still looks old after a green deploy, it's
  browser/SW cache — hard-refresh — not a failed deploy. Don't "fix" the caching again.

## Git

- **Use bare `git push`** (upstream tracking is set), never `git push origin main` — the
  auto-mode safety classifier blocks pushes that explicitly name the default branch.
  The user has standing approval to commit and push directly to `main` on this project.
- Don't try to add a `git push` allow rule to settings — permission self-modification is
  also blocked. Bare `git push` is the whole fix.

## Domain conventions (settled — don't re-litigate)

- **Tunings** are normalized to `Standard` or `Drop D` only; fretboard diagrams default to
  the standard-tuning variant with a toggle for the original.
- **Fretboard diagrams: high string on top** (flipped deliberately in `19420cf`).
- **Tab links are curated** Songsterr/Ultimate Guitar URLs stored in data, not searched at
  runtime; **Songsterr links default to the rhythm-guitar track** when one exists.
- The XLSX importer preserves every original column under each song's `source` object;
  practice state is separate and must never be overwritten by an import.

## amp-presets/ — real-world hardware side-project

`amp-presets/` programs the band's **Fender Mustang I V2** amp with per-song presets.
**Read `amp-presets/AMP-SETUP.md` before touching anything here** — it is the full runbook:
preset design (24 slots, quiet↔loud pairs), the recommended **Plug-via-WSL2 + usbipd USB
passthrough** loading procedure, preset backup steps, and the firmware/brick-risk rules
(never hold SAVE at power-on; never run FUSE's firmware updater). Tone values live in
`generate_presets.py` (`TONES` dict) — edit that and regenerate rather than hand-editing
`.fuse` files, so the files stay the source of truth.

## Per-song tabs & chords (dev-branch feature)

- Curated **text** files, glob-loaded by `src/sheets.ts`:
  `src/data/sheets/<songId>.chords.txt` (UG-style chord/lyric text, parsed by
  `src/chords.ts`) and `src/data/sheets/<songId>.tabs.txt` (ASCII tab, rendered
  verbatim in monospace). Song ids match `src/data/setlist.json` (`01-welcome-home`).
- The user hands over source material (text, exports, screenshots); convert it to
  those text files — **no paste UI, no images in the app** (deliberate: text is
  editable and diff-able). `TabsAndChords/` (gitignored) is the raw-material drop
  folder. Note: XPS/OXPS print exports are usually rasterized page images with no
  extractable text — ask for a text source instead of transcribing pictures.
- Both practice (song page panel) and show mode offer a Chords/Tabs switch; show
  mode auto-shrinks (chords fit by height, tabs by width).

## Cross-device sync (dev-branch feature)

- `src/sync.tsx` syncs the practice blob across devices via a **Supabase** table, keyed by a
  client-generated **sync code** (no accounts, no GitHub PAT). The merge engine
  (`mergePractice`, debounced push, focus re-pull, epoch guards) is backend-agnostic — only
  the storage adapter (`readRemote`/`writeRemote`/`createRemote`) and `SyncConfig` (`{ code }`)
  are Supabase-specific.
- The committed `SUPABASE_URL` + anon key in `src/syncBackend.ts` are **public by design**
  (RLS + secret code do the gating). Never put the `service_role` key there.
- **`SYNC-SETUP.md`** is the one-time backend runbook (create project, run the SQL, paste
  URL + anon key). Enumeration safety = RLS-on + no-policy + two `security definer` RPCs;
  codes are hashed at rest. Free-tier projects auto-pause after ~7 days idle.
- `/dev/` and prod deliberately use **separate** sync keys (`overdrive-sync-dev-v2` vs
  `overdrive-sync-v2`), matching the practice-store split.

## Layout notes

- `src/data/setlist.json` is generated — change the importer or the XLSX, not the JSON.
- `overdrive-performance-notes.json` (repo root) holds performance/gig notes data.
- `dist/`, `*.tsbuildinfo`, `work/` are gitignored build artifacts.
