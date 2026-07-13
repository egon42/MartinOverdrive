---
name: verify
description: Prove a Martin Overdrive change actually works before calling it done. Use before committing any nontrivial change, or when asked to "verify", "prove it works", or "check this change". Walks the project's real verification chain — validate, build, deploy watch, live /dev/ URL, on-device test — and says which steps a given change needs.
---

# Verify a change in Martin Overdrive

Run the steps that match the change (table below), in order. Every step is
cheap except the last — never skip a matching step to save time. All commands
run from the repo root.

| Change touches…                                              | Required steps |
|--------------------------------------------------------------|----------------|
| Song data: `src/data/sheets/`, `src/data/setlist.json`, `src/data/progressions.json`, `src/data/tab-links.json`, `src/chords.ts`, `scripts/ug-chords-to-sheet.mjs` | 1, 2 |
| Any `.ts`/`.tsx` or other app source                          | 2 |
| Anything the live site must reflect                           | 2, 3 |
| Show-mode / touch / scroll / phone-facing UI behavior         | 2, 3, 4 |
| Sync behavior (`src/sync.tsx`, `src/syncBackend.ts`, practice-state merge) | 2, 3, 5 |

## Step 1 — `npm run validate` (song-data consistency)

Runs `scripts/validate-song-data.mjs` (see `package.json` scripts). Read-only;
exits 1 on failure. It cross-checks setlist ↔ sheets ↔ cheat cards ↔ tab links
(orphans, missing entries) and guards the `CHORD_RE` regex that is deliberately
duplicated between `src/chords.ts` and `scripts/ug-chords-to-sheet.mjs` — if you
edited that regex in either file, this is what catches drift. Required after
**any** song-data change, even "just adding a sheet file".

## Step 2 — `npm run build` (compile gate)

`tsc -b && vite build` — strict TypeScript project build plus the production
bundle. This is the only compile check in the repo (no test framework, by
design). A change that doesn't build is not done. Don't substitute
`npm run dev` (Vite dev server skips `tsc -b`).

## Step 3 — Deploy verification (a green push is NOT a deploy)

New work lives on the `dev` branch and deploys to the `/dev/` URL. Chain:

1. Commit, then push with a **bare `git push`** (never name the branch — see
   CLAUDE.md, Git section).
2. Confirm the workflow ran and succeeded for *your* commit:
   ```bash
   gh run list --workflow deploy-pages.yml --limit 3
   gh run watch <run-id>        # if in_progress/queued
   ```
   `.github/workflows/deploy-pages.yml` is the only deploy path. A successful
   push with no green run = not deployed.
3. Check the live page: `https://egon42.github.io/MartinOverdrive/dev/`
   (production is `/MartinOverdrive/` off `main`). The service worker is
   **network-first** — if the page looks stale after a green run, hard-refresh
   (or kill/reopen the installed PWA); do not touch the caching logic.

For the full "is it live / why is it stale" triage, use the existing
**deploy-check** skill (`.claude/skills/deploy-check/SKILL.md`) rather than
improvising.

## Step 4 — On-device test (code-proven ≠ device-verified)

Show-mode and phone-facing UI changes are only proven on the actual phone.
The cautionary tale is `docs/autoscroll-spec.md`: autoscroll passed strict
tsc, walked-through frame-by-frame math, and a two-lens council review —
and still shipped broken, because nobody watched it scroll on a device (see
its "What is verified and what is not" section). Its "5-minute phone test
script" is the model to copy: concrete steps, expected observable behavior,
explicit FAIL conditions, and a hard-refresh first so the SW can't serve a
stale bundle.

You cannot do this step yourself. Write a short numbered phone script in that
style, hand it to the user, and report the change as **"code-verified,
awaiting device test"** — never "verified" — until they confirm.

## Step 5 — Sync changes: mind the dev/prod key split

`/dev/` and production deliberately use **separate** sync stores —
`src/sync.tsx` picks `overdrive-sync-dev-v2` vs `overdrive-sync-v2` from
`BASE_URL` (line 10). Consequences when verifying:

- Testing on the `/dev/` URL exercises the dev key only; it proves nothing
  about prod sync state, and vice versa. Say which side you verified.
- Cross-device checks need **two devices on the same URL** (both `/dev/` or
  both prod) sharing a sync code.
- Promoting `dev` → `main` switches which key users hit; a sync-format change
  verified on dev still needs a prod-side sanity check after promotion.

## Reporting

State exactly which steps ran, their results, and which were skipped and why.
"It builds" is step 2 only — don't let it stand in for the rest of the chain.
