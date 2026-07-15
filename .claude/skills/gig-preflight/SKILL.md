---
name: gig-preflight
description: Pre-show checklist runbook for Martin Overdrive. Use when the user says "gig tonight", "preflight for the show", "pre-show check", "show tonight", "get ready for the gig", "soundcheck prep", or otherwise asks to verify the app/amp/setlist are ready for a live performance. Run it the afternoon before the show — some failure modes (broken deploy, paused sync backend) need lead time to fix.
---

# Gig preflight

Work through the checks in order and keep a running PASS/FAIL tally; finish with a
go/no-go summary. Checks 1–5 run on this machine; 6–7 the user does on the show phone
(give them the exact taps and ask what they see). The whole pass is read-only except
the deliberate resets in check 5 — **do not modify anything under `amp-presets/`**.

## 0. Which deployment does the show phone use?

Ask if unknown. Show mode, Tonight's set, and sync are dev-branch features, so the band
normally performs from **`https://egon42.github.io/MartinOverdrive/dev/`** (production
is `https://egon42.github.io/MartinOverdrive/app/`; bare `/MartinOverdrive/` redirects
there). This matters because every store is
keyed per deployment — a green prod check proves nothing about /dev/:

| Data | prod key | /dev/ key |
|---|---|---|
| Practice store (statuses, notes, tonight's set) | `overdrive-practice-v1` | `overdrive-practice-dev-v1` |
| Sync config | `overdrive-sync-v2` | `overdrive-sync-dev-v2` |
| Show-mode position (current song id) | `overdrive-show-index` | `overdrive-show-index-dev` |

All checks below apply to the deployment the phone actually uses.

## 1. Deploy freshness — is what's on the phone what's in git?

A green push is **not** a deploy. Verify the workflow run:

```bash
git status --short && git log --oneline @{u}..   # anything unpushed?
gh run list --workflow deploy-pages.yml --limit 3
```

- **Expect:** clean tree, no unpushed commits on the branch the phone uses (`dev` for
  /dev/, `main` for prod), and the newest `deploy-pages.yml` run for that branch shows
  `completed success` on the expected commit.
- **On failure:** `in_progress`/`queued` → `gh run watch <run-id>` until green.
  `failure` → `gh run view <run-id> --log-failed`, fix, push (bare `git push` only),
  re-verify. Deeper triage: use the `deploy-check` skill.
- **Site looks old after a green run:** that's browser/service-worker cache, not the
  deploy — hard-refresh the phone (or DevTools → Application → Service Workers →
  Update on reload). The SW is network-first for the app shell; do NOT touch
  `public/sw.js`.
- **Offline behavior is a feature, not a bug:** navigations give the network at most
  2.5s (`NAV_TIMEOUT_MS`, `public/sw.js`) before the cached shell is served; an
  outright-dead connection fails fast and serves cache immediately. So on bad venue
  Wi-Fi the app still opens — as long as the phone loaded the current build once
  beforehand, which is exactly what check 7 guarantees.

## 2. Sync health — or a deliberate offline call

The Supabase free tier **auto-pauses after ~7 days idle** (SYNC-SETUP.md), so a quiet
month can silently kill sync; the first sync after a pause cold-starts (tens of
seconds) or errors once.

- **Tap (any synced device):** Dashboard → sync panel → **Sync now**.
- **Expect:** status line goes `Syncing · Pulling…` → `Idle · Synced · last synced
  <just now>`.
- **On error:** wait ~60s (cold start) and press **Sync now** again. Still failing →
  make the call explicit: the gig runs **offline-only**. That is fine — all data is
  local — but then every soundcheck edit (set order, skips, notes) must be made **on
  the show phone itself**, since nothing will propagate to it.
- If two devices are in play (e.g. laptop for soundcheck edits, phone on stage),
  verify propagation once: change something trivial on one, refocus the app on the
  other (focus triggers a re-pull, throttled to 30s), confirm it appears, change it
  back. Remember prod and /dev/ use separate sync codes — they never see each other.

## 3. Tonight's set — `/set` page

Per-song `skipTonight` + `setPosition` live in the synced practice state
(`src/setlist.tsx`), so check this on a synced device or the show phone.

- **Tap:** open `/set`.
- **Expect:** the header line reads "N of M songs in the set" with tonight's intended
  N; songs marked **Out** are the intended skips; the numbered order (01, 02, …)
  matches the planned running order — those numbers are exactly what the n/N counter
  will say on stage.
- **On failure:** toggle In/Out checkboxes and use the ↑/↓ buttons; **Reset to full
  set order** wipes all customization. If the header warns "Every song is skipped —
  show mode will fall back to the full set", that's the misconfig fallback — un-skip
  the real set.
- Optionally **Print set list** for a paper backup.

## 4. Data safety — backup and validate

- **Tap:** Dashboard → **Export backup** on the device with the freshest edits.
  **Expect:** a `overdrive-practice-YYYY-MM-DD.json` download. Keep it off the phone
  (this is also the safety net if the paused Supabase project ever gets deleted).
- **Run:** `npm run validate` — the read-only song-data consistency check
  (`scripts/validate-song-data.mjs`), exit 0 expected.
- **On validate failure:** findings are grouped per song. Only a song whose sheet/
  cheat-card is actually broken matters tonight; worst case, mark that song **Out** on
  `/set` rather than hot-fixing data on gig day.

## 5. Show-mode resume position

`overdrive-show-index[-dev]` stores the **current song id** so a mid-set browser kill
resumes in place (if that song was skipped at soundcheck, it resumes at the next
active song). Correct behavior mid-show — but stale before the show: last rehearsal's
position would open tonight's show on song 7.

- **Tap (show phone):** open `/show`, tap the **n / N counter**, pick song 1 in the
  jump overlay. This both resets the saved position and exercises the overlay.
- **Expect:** counter reads `1 / N` and the first song of tonight's set is on screen.

## 6. Amp presets — verify, don't edit

Everything here is read-only; the runbooks are `amp-presets/AMP-SETUP.md` (preset
design, loading, brick-risk rules) and `amp-presets/VOLUME-BALANCING.md`
(level-matching pass). Ask the user:

- Have any presets been tweaked on the front panel since the last bulk load? If yes,
  reload from source of truth: double-click `amp-presets/mustang-loader.bat` (or
  `python amp-presets/load_presets_gui.py`), or CLI
  `python amp-presets/load_presets.py --list` to confirm the amp is detected, then run
  it plain to write all 24 presets (~1 min), `--only N-M` for a subset.
- **Amber-save warning (repeat it verbatim to the user):** the amp's front-panel
  **amber** (edited/unsaved) state cannot be saved reliably from the front panel — the
  amber→green indicator is easy to misread and risks silently saving to the wrong
  preset slot. Bulk-write with the loader tools instead of manual front-panel saves.
- **Never hold SAVE while powering the amp on** — that enters firmware mode and is the
  brick risk.
- Suggest bringing the printed `amp-presets/cheat-sheet.html` (song → preset map).

## 7. On-phone smoke test — 2 minutes, on the show phone

Have the user open the deployment URL from check 0 and run down this list in `/show`:

1. **Fresh build loaded:** hard-refresh once on venue-independent network (home
   Wi-Fi/LTE) so the SW caches tonight's build.
2. **Pedal:** press the page-turner pedal (sends PageDown/PageUp) — next/previous
   song, even while a chords/tabs sheet is showing. No pedal? ArrowRight/ArrowLeft on
   any paired keyboard does the same.
3. **Swipe:** in the **Cheat** view, swipe left/right — song changes. Switch to
   Chords or Tabs and swipe — the song must NOT change (swipes there are for
   scrolling; this is deliberate, not a bug).
4. **Jump overlay:** tap the **n / N counter** — song list opens centered on the
   current song; tap a song to jump, tap outside to dismiss.
5. **Up next footer:** bottom of every song except the last shows "Up next" with the
   next title, tuning chip (when not Standard), and amp-preset badges — that's the
   changeover info; confirm it matches the printed set.
6. **Screen stays awake:** leave show mode on for a couple of minutes — the screen
   must not dim (wake lock re-acquires automatically when the app returns to the
   foreground).
7. **Offline resilience:** airplane mode → kill the browser → reopen the app →
   `/show` comes back from cache (instantly, or after at most ~2.5s if the network
   hangs rather than fails) at the song it was on. Airplane mode off afterwards.

Finish by jumping back to song 1 (re-run check 5) if the smoke test moved the
position.

## Go/no-go summary

Report each check as PASS / FIXED / FAIL with one line of detail. Any FAIL on checks
1, 3, or 7 is a real problem — say plainly what the band should do about it tonight
(e.g. "sync is down: make all soundcheck edits on the show phone"). Sync being down
is degraded, not no-go; the app is local-first by design.
