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
  both branches into one Pages artifact with **sibling** paths so each can be installed
  as its own phone app: `main` at `/MartinOverdrive/app/` (production) and `dev` at
  `/MartinOverdrive/dev/` (development). Root `/MartinOverdrive/` redirects to `/app/`.
  Nested `/dev/` under a root-scoped PWA blocked installing both — don't put them back.
  There is no other deploy path.
- **New features are developed on the `dev` branch** and used live at the /dev/ URL;
  porting a feature to production = merging `dev` → `main`. Keep the workflow file
  identical on both branches (push events use the pushed branch's copy).
- Prod and Dev home-screen installs use distinct manifest `id` / name / icon (see
  `vite.config.ts` `deployIdentity`). After the /app/ move, re-add the prod icon from
  `/MartinOverdrive/app/` if an old root-scoped install is still on the phone.
- **To verify a deploy actually went live:** check the workflow run
  (`gh run list --limit 3` / `gh run watch`), not just the push. A green push ≠ deployed.
- The service worker uses **network-first caching for app updates** (fixed in `8904e94`
  after stale-UI reports). If the live site still looks old after a green deploy, it's
  browser/SW cache — hard-refresh — not a failed deploy. Don't "fix" the caching again.
- Since the gig-hardening pass (2026-07): navigations give the network **2.5s** before
  falling back to the cached shell (still network-first — updates land on healthy
  networks); hashed `/assets/` are cache-first (content hashes make staleness
  impossible); fonts are precached; activate migrates same-namespace runtime cache
  entries across version bumps. Council-reviewed twice — read `public/sw.js` comments
  before changing any of this.

## Git

- **Use bare `git push`** (upstream tracking is set), never `git push origin main` — the
  auto-mode safety classifier blocks pushes that explicitly name the default branch.
  The user has standing approval to commit and push directly to `main` on this project.
- Don't try to add a `git push` allow rule to settings — permission self-modification is
  also blocked. Bare `git push` is the whole fix.
- **Promoting dev → main is a fast-forward, never a merge commit** (history is linear —
  zero merge commits in the repo; keep it that way):
  `git checkout main && git merge --ff-only dev && git push && git checkout dev`.
  If `--ff-only` refuses, main has diverged — stop and ask rather than creating a
  merge commit.

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

Hardware save gotcha (near-miss 2026-07): the amp's front-panel **amber** (edited/unsaved)
state **cannot be saved from the front panel** — the amber→green indicator is easy to
misread and risks silently saving to the wrong preset slot. Bulk-write presets with the
tools built for this (`load_presets.py` / `load_presets_gui.py` / `mustang-loader.bat`,
see `VOLUME-BALANCING.md`) instead of manual front-panel saves.

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
- `scripts/ug-chords-to-sheet.mjs` carries a **duplicated copy of `CHORD_RE`** from
  `src/chords.ts` ("keep in sync" comment) — if you edit the regex in either file,
  update both. `npm run validate` checks this drift plus cheat-card/sheet/setlist
  consistency — run it after any song-data change.

## Subagent gotchas (learned 2026-07, both cost real sessions)

- **Content filtering kills lyric-heavy subagents**: a subagent that reproduces a full
  song's lyrics verbatim can die with `400 Output blocked by content filtering policy`
  (happened ≥4 times). Chunk per-song work and keep lyric excerpts minimal; chord/
  section structure without full lyric lines passes fine.
- **Cap generation fan-outs at ~5 concurrent subagents**: a 30-song batch fan-out hit
  the monthly spend limit five agents in a row and stuck in a retry loop. Stage wide
  batches in waves with a checkpoint between waves.

## Show mode & practice tools (dev-branch features, added 2026-07)

- **Tonight's set** (`/set` page, `src/setlist.tsx`): per-song `skipTonight` +
  `setPosition` live in practice state so soundcheck edits sync. Show mode walks
  `tonightsSongs(get)` (full-set fallback when everything's skipped). Reorder = swap of
  effective positions; concurrent-sync position collisions are resolved by a fractional
  nudge in `move()` — don't "simplify" that guard away.
- **Show mode persistence**: current song id + view in localStorage
  (`overdrive-show-index[-dev]`), so a mid-set browser kill resumes in place; if the
  saved song was skipped at soundcheck it resumes at the next active song.
- **Show mode controls**: swipe (cheat view only), PageUp/PageDown (page-turner pedals),
  tap the n/N counter for the jump-to-song overlay, "Up next" footer shows the
  changeover info (next title/tuning/amp preset). A render crash inside the song view is
  caught by `ShowSongBoundary` — nav stays alive.
- **No metronome, no practice-session logging** — both were built and then removed at
  the user's request (2026-07): practice happens against the actual recordings, and
  status/priority/notes are the only per-song practice data the user wants to maintain.
  `lastPracticed`/`sessions`/`secondsPracticed` are deliberately dead fields; don't
  resurrect any of this without being asked.
- **Jam page removed** (2026-07, user request) — it grouped songs by pentatonic key.
  Like the metronome, don't re-propose it.

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

## Live show sync (dev-branch feature, experimental 2026-07)

- `src/live.tsx`: one phone **leads** a show; followers join with a 5-char code or QR and
  their show mode turns songs with the leader (each device keeps its own views/pins/
  settings). Transport is **Supabase Realtime broadcast + presence** on the same project —
  no tables, no SQL, ephemeral only; needs public (non-private) channels, the default.
- Protocol: leader broadcasts `{ songId }` on every song change, re-announces on a 10s
  heartbeat and on presence joins (late-join/reconnect catch-up). Followers snap only when
  the *received* songId changes (`LeaderSong.seq`), so a follower can page away to peek and
  isn't yanked back by heartbeats.
- While following, show mode walks `setOrdered(get)` (full set, skips ignored) instead of
  `tonightsSongs(get)` — the leader's song must always be findable locally.
- Session `{ role, code, at }` persists in `overdrive-live[-dev]` with a 20h expiry so a
  mid-set reload resumes but last week's session doesn't. `live.tsx` mirrors
  `SHOW_INDEX_KEY` from `pages.tsx` (import would be circular) — keep them in sync.

## Layout notes

- `src/data/setlist.json` is generated — change the importer or the XLSX, not the JSON.
- `overdrive-performance-notes.json` (repo root) is **orphaned** — nothing in the app or
  scripts reads it (verified 2026-07-11). It's hand-written per-song prep notes, likely
  raw material from before the practice-log removal. Editing it has zero effect on the
  app; ask the user before wiring it in or deleting it.
- `dist/`, `*.tsbuildinfo`, `work/` are gitignored build artifacts.
