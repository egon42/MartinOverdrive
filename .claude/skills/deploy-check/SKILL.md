---
name: deploy-check
description: Answer "did this deploy?", "is it live?", "did this get redeployed?", "deploy status", or "why is the site stale" for Martin Overdrive. Use whenever the user asks whether a change made it to the live GitHub Pages site, or reports the site looks out of date.
---

# Deploy check

Martin Overdrive deploys to GitHub Pages only via `.github/workflows/deploy-pages.yml`
on push to `main` (repo `egon42/MartinOverdrive`). A green push is not the same as a
deployed site — check the workflow run. Do this in order and stop as soon as you have
the answer:

## 1. Is the change committed and pushed?

```bash
git status --short
git log --oneline @{u}..
```

- Uncommitted changes shown by `git status` → not deployed, nothing to deploy yet.
- Commits listed by `git log @{u}..` → committed but **not pushed**. That's the answer —
  tell the user and push with a bare `git push` (never `git push origin main`, see
  repo CLAUDE.md).

## 2. Did the workflow run for that commit, and did it succeed?

```bash
gh run list --workflow deploy-pages.yml --limit 3
```

Match the run's commit message/SHA to the change in question:
- `completed` / `success` → it deployed. Site should be live.
- `in_progress` / `queued` → still deploying. Watch it: `gh run watch <run-id>`.
- `completed` / `failure` → deploy failed. Get the reason:
  `gh run view <run-id> --log-failed`.

## 3. Run succeeded but the site still looks old?

This is browser/service-worker cache, not a failed deploy. The service worker already
uses **network-first caching for app updates** (fixed in commit `8904e94` after prior
stale-UI reports). Fix:
- Hard-refresh the page, or
- DevTools → Application → Service Workers → check "Update on reload", or
- DevTools → Network tab → "Disable cache" while open.

Do **not** modify the service worker / caching logic to "fix" this — it was already
fixed once; a stale view after a successful deploy is expected cache behavior, not a bug.
