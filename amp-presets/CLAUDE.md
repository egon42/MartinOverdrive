# amp-presets/ — real-world hardware side-project

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
