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

- Pushing to `main` **or `dev`** triggers `.github/workflows/deploy-pages.yml`.
  It builds both branches into one Pages artifact with **sibling** paths so each
  can be installed as its own phone app: `main` at `/MartinOverdrive/app/` (production)
  and `dev` at `/MartinOverdrive/dev/` (development). Root `/MartinOverdrive/` redirects
  to `/app/`. Nested installs under a root-scoped PWA blocked co-install — don't put
  them back. There is no other deploy path.
- **New features are developed on the `dev` branch** and used live at the /dev/ URL;
  porting a feature to production = merging `dev` → `main`. Keep the workflow file
  identical on both branches (push events use the pushed branch's copy).
- The **`ryan` branch / `/ryan/` deployment was retired 2026-07-22**. Its content lives
  on as the flag-gated Ryan tab (`.ryan.txt` sheets, see "Per-song tabs & chords") and
  the branch tip is preserved as the `ryan-archive` tag. Don't rebuild the third deploy.
- App / Dev home-screen installs use distinct manifest `id` / name / icon (see
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
- **App copy stays plain** — no em-dashes or other AI-tells in cheat-card hints, chord/tab
  header notes, or UI strings. The copy had a deliberate em-dash purge; keep it that way.

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

## Show-mode tabs (renamed 2026-07-16 — labels vs internals)

- Four tabs: **Cheat** (building-blocks card: each `progressions.json` section once, in
  stored order, incl. Fills — ignores `form`), **Chords** (full roadmap card: `form`
  order + ×N repeats, Fills excluded — this is what code/docs/skills call the "cheat
  card"), **Lyrics** (the `.chords.txt` chord-over-lyric sheet), **Tabs**.
- A fifth **Ryan** tab (added 2026-07-22) sits in front of Cheat, but only when the song
  has a `.ryan.txt` sheet AND the hidden device-local **Ryan sheets** flag is on (see
  "Hidden Developer settings"). View id `'ryan'` is purely additive — no view/pin
  storage-key bumps; with the flag off a stored/pinned `'ryan'` falls back to the
  roadmap card.
- Internal names deliberately did NOT move with the labels: CSS `cheat-*` classes, the
  `cheat`/`chords` fingering surfaces (`'cheat'` = both cards, `'chords'` = Lyrics
  sheet), `cheatRowsFor` (roadmap) / `basicRowsFor` (cheat tab), and `SheetKind
  'chords'` (lyrics text) all keep their old ids. Don't rename them piecemeal.
- View/pin storage keys were bumped (`overdrive-show-view2`, `overdrive-show-pins2`)
  because the old id `'chords'` changed meaning; legacy values migrate on first read
  (`'scale'`→`'chords'`, `'chords'`→`'lyrics'`). Don't reuse the old keys.

## Hidden Developer settings (added 2026-07-22)

- `AppSettings` (`src/settings.tsx`) has two device-local booleans that never sync and
  are not normally visible: **`devMode`** (shows the Card version dropdown) and
  **`ryanTab`** (shows the personal Ryan tab). Both default off on every install.
- Unlock: **tap the "Settings" heading 7 times** (Android style, 1.5s of no taps resets
  the count) on the `/settings` page — a "Developer" section appears with both
  checkboxes. Once either flag is on, the section stays visible so it can be turned off.
- The flags are per deployment install (`overdrive-settings` vs `overdrive-settings-dev`),
  so enable them once per device per install. Deployments are otherwise
  feature-identical — never gate a feature on `BASE_URL` again; add a flag here instead.

## Cheat-card versioning (dev-branch feature, added 2026-07-16)

- **Snapshot before rewriting any song's cheat card**: `node scripts/snapshot-progression.mjs
  <songId> "<label>"` archives the current `progressions.json` entry into
  `src/data/progressionVersions.json` (newest first; identical-content retry is a no-op).
  The **"Card version" dropdown** on the **Chords tab** (the roadmap card) A/Bs archived
  forms against the recording. Since 2026-07-22 it is gated by the hidden device-local
  **Dev mode** flag (see "Hidden Developer settings"), not by deployment — /dev/ and
  /app/ are feature-identical, and a device that never flips the flag always plays the
  live card. The local dev server (`import.meta.env.DEV`) always shows it. The Cheat tab
  always renders the current sections. `npm run validate` checks archived versions with
  the same rules.
- Standing user instruction (2026-07-16): because versions are always recoverable, apply
  recording-research corrections **without waiting for approval** — including to hand-vetted
  cards — but keep the user's played counts when research only weakly (med confidence)
  contradicts them, and never pick between two canonical recordings without asking.
- The research workflow itself is `.claude/skills/research-song-form` (subagent prompt
  template, no-lyrics rule, bars×BPM arithmetic check, tuning/key flag).

## Per-song tabs & chords (dev-branch feature)

- Curated **text** files, glob-loaded by `src/sheets.ts`:
  `src/data/sheets/<songId>.chords.txt` (UG-style chord/lyric text, parsed by
  `src/chords.ts`) and `src/data/sheets/<songId>.tabs.txt` (ASCII tab, rendered
  verbatim in monospace). Song ids match `src/data/setlist.json` (`01-welcome-home`).
- Optional `<songId>.ryan.txt` (added 2026-07-22, harvested from the retired `ryan`
  branch): personal per-song sheet in chord-sheet format (may embed ASCII-tab blocks),
  rendered by `ChordSheetView` only where the hidden **Ryan sheets** flag is on.
  Currently `07-tribute` (fills + follow-along through ROCK) and `21-the-middle`
  (A-string palm-mute fret chips). Bare numeric tokens 0–24 on chord lines render as
  bordered **fret chips** (`isFretToken`); numbered fill cues use `^N` / `[Fill ^N]`
  (`isCueToken`) — both are **opt-in per sheet** (`parseChordSheet`'s `frets` option,
  passed only at the ryan render sites): a band lyrics sheet can legitimately sing a
  bare number (Mary Jane's "18"), which must stay lyric text. Polish song-by-song with
  `.claude/skills/polish-ryan-sheet/`. Ryan sheets are optional per song; the validator
  only checks their songId.
- The user hands over source material (text, exports, screenshots); convert it to
  those text files — **no paste UI, no images in the app** (deliberate: text is
  editable and diff-able). `TabsAndChords/` (gitignored) is the raw-material drop
  folder. Note: XPS/OXPS print exports are usually rasterized page images with no
  extractable text — ask for a text source instead of transcribing pictures.
- The practice (song page) sheet panel mirrors show mode's four tabs (2026-07-20):
  Cheat / Chords / Lyrics / Tabs. `SheetKind` grew ids `'cheat'` and `'roadmap'`
  (labels Cheat/Chords — `'chords'` still means the lyric sheet). `CheatCard` +
  version-picker constants now live in `src/components.tsx` (shared; show mode passes
  `innerRef` for one-screen auto-fit, practice renders natural height with
  `withMore={false}`), and autoscroll lives in `src/autoscroll.tsx`
  (`useAutoScroll` moved verbatim — read `docs/autoscroll-spec.md` before touching;
  both surfaces share the per-song synced `scrollSpeed`). Show mode auto-shrinks
  (lyrics fit by height, tabs by width); the practice sheets scroll in a capped
  `.practice-sheet` viewport instead.
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
- **No practice-session logging** — built and removed at the user's request (2026-07);
  status/priority/notes are the only per-song practice data the user wants to maintain.
  `lastPracticed`/`sessions`/`secondsPracticed` are deliberately dead fields; don't
  resurrect them without being asked. The **metronome was removed in the same pass but
  explicitly re-requested 2026-07-20** as a play-along click for practicing without the
  backing track: `src/metronome.tsx` (Web Audio lookahead scheduler — keep the
  background-tab clamp and iOS-resume nudge), seeded from researched `src/data/bpm.json`
  tempos with the user's own tapped/stepped tempo persisted per song
  (`PracticeEntry.bpm`). It also has a **Drums sound** (added same day): synthesized
  kick/snare/hat on a subdivision grid (straight 8ths / shuffle triplets / 6/8), with
  optional per-song `timeSig`/`feel` seeds in `bpm.json` (absent = 4/4 straight; only
  high-confidence research values get written — currently just Pride and Joy's Texas
  shuffle).
- **Jam page removed** (2026-07, user request) — it grouped songs by pentatonic key.
  Don't re-propose it.

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
- Channels are deploy-namespaced: `/dev/` uses a `show-dev-` prefix and stays isolated
  from prod. (The retired /ryan/ deploy used to share App's channel; that special case
  is gone.)

## Layout notes

- `src/data/setlist.json` is generated — change the importer or the XLSX, not the JSON.
- `overdrive-performance-notes.json` (repo root) is **orphaned** — nothing in the app or
  scripts reads it (verified 2026-07-11). It's hand-written per-song prep notes, likely
  raw material from before the practice-log removal. Editing it has zero effect on the
  app; ask the user before wiring it in or deleting it.
- `dist/`, `*.tsbuildinfo`, `work/` are gitignored build artifacts.
