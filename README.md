# Overdrive Setlist Companion

A lightweight, local-first React app generated from `martin_overdrive_setlist_prep.xlsx`. It includes the full setlist, song prep cards, persistent practice state, jam practice, a phone-friendly show mode, backup/restore, and offline caching.

## Setup and run

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open the local address printed by Vite. To test from a phone on the same network, run `npm run dev -- --host` and open the network address shown.

## Update the setlist from XLSX

Keep the source sheet named `Set List Prep` and retain the existing column headers. Pass a workbook path after `--`:

```bash
npm run import-setlist -- "C:\path\to\martin_overdrive_setlist_prep.xlsx"
```

With no path, the script looks for `martin_overdrive_setlist_prep.xlsx` in the project root. It regenerates `src/data/setlist.json`; restart the dev server if needed. The importer preserves every original column under each song’s `source` object and leaves unsupported fields blank. Practice state is separate and is not overwritten.

## Production build and offline use

```bash
npm run build
npm run preview -- --host
```

The production build registers a service worker. After one successful visit, app assets and visited routes are cached for offline use. External backing track and Songsterr links still require internet. The included web manifest makes the app installable where the browser supports SVG PWA icons.

## Local practice data

Status, notes, priority, practice dates, session counts, and timer totals are saved in `localStorage` on the current browser. Use **Export backup** on the dashboard before clearing browser data or moving to another device, then **Restore backup** on the destination.

## Print

Open **Songs**, apply any filters, and use the browser’s Print command for a clean card-based setlist.
