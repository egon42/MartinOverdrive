# Mustang I V2 — Set-List Preset Setup

Everything you need to program your **Fender Mustang I V2** (20 W, 1×8", USB) with
per-song presets for the 31-song Martin Overdrive set list.

**What's in this folder**

| File | Purpose |
|---|---|
| `AMP-SETUP.md` | This document |
| `fuse/*.fuse` (24 files) | Premade presets, one per amp memory slot, ready to load |
| `generate_presets.py` | Regenerates the `.fuse` files if you tweak the tone table |
| `load_presets.py` | Native Windows USB loader (Path A) — bulk-writes presets to the amp |
| `load_presets_gui.py` + `mustang-loader.bat` | Dead-simple click-to-run window for the loader |

---

## 1. The plan (read this first)

Your amp stores **24 presets** (PRESET knob, three color banks: AMBER 1–8,
GREEN 1–8, RED 1–8). The set has **31 songs**, and several need two tones
(quiet verse → big chorus), so a strict "preset 1 = song 1" mapping physically
can't fit. Working cover guitarists solve this with a small bank of shared core
tones — audiences don't notice per-song tone differences unless they're very
song-specific — so that's the design here:

- **AMBER 1–8 — cleans & low gain** (loaded via USB; this bank is software-only anyway)
- **GREEN 1–8 — the dirt palette** (crunch → high gain, lead, wah)
- **RED 1–8 — four adjacent quiet↔loud PAIRS** so the big dynamic songs
  (Zombie, Hunger Strike, Teenage Dirtbag, Pink Pony Club, The Pretender,
  Dream On…) switch tones with **one click of the PRESET knob** mid-song.

Each song maps to preset number(s) on the cheat sheet in §3 — print it and tape
it to the amp.

> **Numbering:** presets are numbered **1–24** everywhere in this document
> (Preset 1 = AMBER position 1, Preset 9 = GREEN 1, Preset 17 = RED 1). Each
> file's leading number is its preset number **minus one** (`00-*.fuse` →
> Preset 1, `13-*.fuse` → Preset 14) — and each preset's display name starts
> with its intended number ("01 BIG CLEAN" …), so after loading you can
> instantly verify everything landed where expected.

---

## 2. The 24 presets — exact settings

All knob values are on the amp's 0–10 dial scale. These are researched starting
points, not gospel — the single most useful tweak is each preset's **VOLUME**
(channel volume, stored in the preset) to level-match everything at rehearsal
volume. The physical **MASTER** knob stays your global "how loud is the room"
control and is not stored.

### AMBER bank — cleans & low gain

| # | Name | Amp model | Cab | Gain | Vol | Treb | Mid | Bass | Extras / FX |
|---|---|---|---|---|---|---|---|---|---|
| 1 | BIG CLEAN | '65 Twin Reverb | 2×12 Twin | 3 | 7 | 6 | 5.5 | 6 | Presence 5.5, Large Hall reverb (lvl 4, decay 5) |
| 2 | CHORUS CLEAN | '65 Twin Reverb | 2×12 Twin | 2.8 | 7 | 5.5 | 5 | 5.5 | Sine Chorus (lvl 5, rate 3, depth 5) + Small Hall (3.5) |
| 3 | FUNK DRY CLEAN | '65 Deluxe Reverb | 1×12 Deluxe | 3.5 | 7 | 6.5 | 4.5 | 4.5 | Bright ON, '65 Spring reverb (3) |
| 4 | ETHEREAL | '65 Twin Reverb | 2×12 Twin | 2.8 | 8 | 5.5 | 5 | 5.5 | Mono Delay (4.5/5/4) + Large Hall (5, decay 6) — Tribute intro fills (Red8 wetness, clean) |
| 5 | EDGE BREAKUP | '57 Deluxe (tweed) | 1×12 Tweed | 5 | 7 | 5.5 | 6 | 5 | '65 Spring reverb (2.5) |
| 6 | COUNTRY SNAP | '59 Bassman | 4×10 Bassman | 4 | 7 | 6.5 | 5.5 | 4.5 | Bright ON, Compressor (5) + '65 Spring (2) |
| 7 | TEXAS BLUES | '59 Bassman | 4×10 Bassman | 6.5 | 7.5 | 6 | 6.5 | 5.5 | '63 Spring reverb (3.5) |
| 8 | PURPLE RAIN | '65 Twin Reverb | 2×12 Twin | 3 | 7 | 5.5 | 5 | 6 | Compressor (4.5) + deep Sine Chorus (lvl 6, depth 7) + big Large Hall (5.5, decay 6.5) |

### GREEN bank — dirt palette

| # | Name | Amp model | Cab | Gain | Vol | Treb | Mid | Bass | Extras / FX |
|---|---|---|---|---|---|---|---|---|---|
| 9 | ACDC CRUNCH | British '80s (JCM800-ish) | 4×12 M | 4.5 | 6.5 | 6 | 6 | 5 | Presence 6, no FX — dry AC/DC crunch |
| 10 | CLASSIC ROCK | British '70s (Plexi-ish) | 4×12 G | 6 | 6.5 | 6 | 6.5 | 5.5 | Presence 6, Small Room reverb (2) |
| 11 | POP PUNK | British '80s | 4×12 M | 7 | 6 | 5.5 | 5.5 | 6.5 | Presence 5.5, noise gate low |
| 12 | GRUNGE BIG | American '90s | 4×12 V | 6 | 6 | 5.5 | 4.5 | 6.5 | Noise gate low, mids slightly scooped |
| 13 | MODERN HI GAIN | Metal 2000 | 4×12 M | 6.5 | 6 | 6 | 5 | 6 | Presence 6, noise gate medium |
| 14 | LEAD SOLO | British '70s | 4×12 G | 7.5 | 7 | 5.5 | **7** | 5 | Mono Delay (lvl 4, time 4.5, fdbk 3.5) + Small Hall (3) — mid-pushed so solos cut |
| 15 | VOODOO WAH | '59 Bassman | 4×10 Bassman | 7 | 7 | 6 | 6 | 5.5 | **Touch Wah** (mix 8, sens 6, heel 3, toe 7) + '63 Spring (3) |
| 16 | GLAM ROCK | British '80s | 4×12 M | 6 | 6.5 | 6.5 | 6 | 5 | Presence 6.5, Small Room (2) — bright Darkness-style crunch |

### RED bank — quiet↔loud pairs (one knob-click apart)

| # | Name | Based on | For |
|---|---|---|---|
| 17 | QUIET VERSE | #2 Chorus Clean (exact copy) | Zombie / Hunger Strike verses |
| 18 | BIG CHORUS | #12 Grunge Big (exact copy) | Zombie / Hunger Strike choruses |
| 19 | MUTED VERSE | drier variant of #3 (gain 3, treble 6, mid 5, bass 5, reverb 1.5) | Teenage Dirtbag / Pink Pony Club verses |
| 20 | PUNK CHORUS | #11 Pop Punk | Teenage Dirtbag / Pink Pony Club choruses |
| 21 | PRETNDR INTRO | #2 Chorus Clean | The Pretender intro |
| 22 | PRETNDR SLAM | #13 Modern Hi Gain | The Pretender heavy entrance |
| 23 | BALLAD CLEAN | #1 Big Clean | Dream On / WMGGW / Mama verses |
| 24 | LEAD BOOST | #14 Lead Solo | The solo one click up from 23 |

---

## 3. Song → preset cheat sheet (print me)

| Set # | Song | Preset(s) | Notes |
|---|---|---|---|
| 1 | Welcome Home | **13** | Heavy from bar 1 |
| 2 | All The Small Things | **11** | |
| 3 | A Little Less Conversation | **3** | Muted funk 16ths |
| 4 | I Believe in a Thing Called Love | **16** | Solo: jump 14 if you take it |
| 5 | Thunderstruck | **9** | |
| 6 | Don't Stop Believin' | **1** | |
| 7 | Tribute | **4 → 5** | Ethereal fills on 4, one click up for ROCK |
| 8 | While My Guitar Gently Weeps | **23 ↔ 24** | Rhythm on 23, fills/solo on 24 |
| 9 | Pride and Joy | **7** | |
| 10 | Zombie | **17 ↔ 18** | Verse 17, chorus 18 |
| 11 | Hunger Strike | **17 ↔ 18** | Same pair |
| 12 | S.O.B. | **3** | Muted stabs; barely play the intro |
| 13 | Save a Horse (Ride a Cowboy) | **6** | |
| 14 | Sweet Home Alabama | **5** | |
| 15 | Dani California | **10** | Verse: roll guitar volume down |
| 16 | Teenage Dirtbag | **19 ↔ 20** | Verse 19, chorus 20 |
| 17 | The Pretender | **22** | Slam only; sit-out quiet intro/interlude |
| 18 | Here It Goes Again | **11** | Verses: roll guitar volume |
| 19 | Purple Rain | **8** | Solo: stay on 8, dig in (it's a clean-ish solo) |
| 20 | When I Come Around | **11** | |
| 21 | The Middle | **11** | Solo: 14 if wanted |
| 22 | Dream On | **23 ↔ 24** | Arpeggios 23, outro screamer 24 |
| 23 | Lola Montez | **13** | |
| 24 | Mary Jane's Last Dance | **5** | |
| 25 | Valerie | **3** | |
| 26 | Voodoo Child (Slight Return) | **15** | Touch wah responds to pick attack |
| 27 | Fat Bottomed Girls | **10** | Vocal-only open; volume up on Intro D vamp |
| 28 | Mama, I'm Coming Home | **23 ↔ 24** | Verses 23, chorus/solo 24 |
| 29 | Ain't Goin' Down ('Til the Sun Comes Up) | **6** | Don't fall behind |
| 30 | Pink Pony Club | **19 ↔ 20** | Verse 19, chorus 20 |
| 31 | Banditos | **5** | Or 6 for more twang |

Turning the PRESET knob steps one preset at a time (…8 → 9 crosses AMBER→GREEN,
16 → 17 crosses GREEN→RED), so every ↔ pair above is a single click. Fender's
optional 1-button footswitch can also toggle between two assigned presets —
worth it if the knob reach gets annoying.

---

## 4. Loading the presets onto the amp

### 4.0 First: how risky is this, actually?

**Brick risk from loading presets: effectively zero.** Writing a preset over
USB touches only the preset memory — it is *not* a firmware flash. The two
operations live in completely different modes:

| Operation | What it writes | Worst realistic outcome |
|---|---|---|
| Saving a preset (USB or front panel) | One of the 24 preset slots | A garbled/unwanted preset in that slot — rewrite it, or factory-restore |
| **Firmware update mode** (hold SAVE while powering on, then run an updater) | The amp's operating firmware | A genuine brick if it fails mid-flash |

Nothing in this document enters firmware mode. The two rules that keep you
permanently safe:

1. **Never hold the SAVE button while powering the amp on.** That's the only
   way into firmware mode. If you ever land there by accident (SAVE blinking
   red at power-up), just power off without sending anything — the existing
   firmware is untouched and the amp boots normally.
2. **Never run FUSE's "Firmware Update" utility** (see §5). Plug has no
   firmware-flashing function at all, which makes it the safer tool by
   construction.

And the ultimate safety net: **Factory Restore** — power off, then hold
**EXIT** while powering on until the button light goes out. That erases all
user presets and returns the amp to showroom state (including the AMBER bank
and any FUSE-modified effect lists). You can always get back to stock.

### 4.1 Back up your existing presets (do this before any writing)

- **With Plug (Path B):** for each of the 24 slots — **File → Load from
  amplifier**, pick the slot, then **File → Save to file** into a
  `amp-presets/backup/` folder (name them `slot-01.fuse` … `slot-24.fuse`).
  Tedious but complete; ~10 minutes. Your current amp state is then fully
  restorable file-by-file the same way you load anything else.
- **With FUSE (Path C):** Utilities → **Backup** snapshots all 24 presets in
  one click, and **Restore** puts them back wholesale. (Fender's own manual
  warns that Restore overwrites the target presets — back up before restoring
  anything.)
- **Minimum viable backup:** if your amp is still on factory presets and
  you've never saved anything you care about, Factory Restore (above) *is*
  your backup — everything you'd be overwriting ships with the amp.

**Background on the software:** Fender's official editor (**Fender FUSE**) was
discontinued in March 2020 and is a dead Silverlight app that won't run on
Windows 11. The `.fuse` files here use the genuine FUSE XML format (verified
against the open-source editor's source code), and there are five working ways
to get the tones onto the amp. **Path A (our own native-Windows loader) is
recommended; Path E involves no computer at all.**

### Path A (recommended): native Windows loader — `load_presets.py`

`load_presets.py` (in this folder) writes all 24 presets straight to the amp
over USB with **no WSL2, no usbipd, no Plug**. The Mustang enumerates as a
USB-HID device, so it talks to it through **hidapi** using Windows' built-in
HID driver — driverless, no Zadig. The wire protocol is ported byte-for-byte
from [offa/plug](https://github.com/offa/plug) (`Packet.cpp`,
`PacketSerializer.cpp`, `Mustang.cpp`); it reads the same 24 presets defined in
`generate_presets.py`, so it can never drift from the `.fuse` files.

**Prefer clicking to typing?** After the one-time `pip install hidapi`,
double-click **`mustang-loader.bat`** (or run `python load_presets_gui.py`) for
a small window with Detect / Self-test / Write-all / Write-subset buttons and a
live log. It calls the exact same verified loader below. The rest of this
section is the command-line equivalent.

**One-time setup:**

```powershell
pip install hidapi        # bundles hidapi.dll on Windows
```

**Verify before touching the amp** (neither command needs the amp connected):

```powershell
python amp-presets\load_presets.py --self-test   # rebuilds every packet and
                                                 # diffs it vs the .fuse files
python amp-presets\load_presets.py --dry-run --only 2   # hex-dump a preset's packets
```

`--self-test` must report **0 mismatches** before you proceed.

**Load the presets** — amp powered ON, USB plugged in, no other app (FUSE/Plug)
holding the device, then:

```powershell
python amp-presets\load_presets.py --list        # confirm the amp is detected
python amp-presets\load_presets.py               # write ALL 24 presets (~1 min)
python amp-presets\load_presets.py --only 9-16    # or just a subset (1-based #s)
```

Then spin the PRESET knob and check the names march in order. If a write errors
out, see the flags: `--init1-type 03` (alternate init byte for some V2 units)
and `--ack-timeout`. Because writing only touches preset memory (never
firmware — see §4.0), a bad write is at worst a garbled slot you re-flash.

> **Status:** confirmed working end-to-end on the band's Mustang I V2 — all 24
> slots written over hidapi on Windows 11 with the default init byte (`0xc1`),
> no driver install. If it ever misbehaves on another unit, try
> `--init1-type 03` first; Path B (Plug) remains the cross-platform fallback.

### Path B: Plug via WSL2 (cross-platform fallback)

[Plug](https://github.com/offa/plug) is the actively maintained open-source
FUSE replacement (latest release Dec 2025). It supports the Mustang I V2
(USB ID `1ed8:0014`), opens `.fuse` files, and writes a preset **into any of
the 24 slots** over USB. It ships Linux-only, so on Windows 11 you run it
inside WSL2 and pass the amp's USB through with `usbipd-win`. This combination
is standard WSL practice, though not an officially documented Plug recipe.

**One-time setup** (PowerShell as Administrator for the `usbipd` parts):

```powershell
wsl --install -d Ubuntu        # reboot if prompted, create a Linux user
winget install usbipd          # dorssel/usbipd-win USB passthrough
```

Inside Ubuntu (`wsl` from any terminal):

```bash
sudo apt update
sudo apt install -y build-essential cmake pkg-config git qt6-base-dev libusb-1.0-0-dev
git clone https://github.com/offa/plug.git && cd plug
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j$(nproc)
sudo cmake --install build      # installs binary + udev USB-permission rules
sudo usermod -aG plugdev $USER  # then close and reopen the WSL terminal
```

**Connect the amp** — amp powered ON, USB cable plugged in, then in admin
PowerShell:

```powershell
usbipd list                     # find the device with ID 1ed8:0014
usbipd bind --busid <BUSID>     # one-time
usbipd attach --wsl --busid <BUSID>   # each time you plug in
```

In Ubuntu, `lsusb` should now show `1ed8:0014`. Launch `plug` (the GUI opens
via WSLg).

**Load the 24 presets** (about 10 minutes):

1. In Plug: **File → Open** and pick
   `/mnt/c/Users/egon4/MartinOverdrive/amp-presets/fuse/00-big-clean.fuse`.
   The tone is applied to the amp immediately so you can audition it.
2. **File → Save on amplifier**, and pick the position matching the preset
   number in the file's display name — file `00` ("01 BIG CLEAN") → Preset 1,
   file `13` ("14 LEAD SOLO") → Preset 14, etc. If Plug's list is 0-based,
   the file's leading number matches directly; the two-digit prefix in every
   preset name makes it unambiguous either way. Keep the name, confirm.
3. Repeat for the remaining 23 files. Then spin the PRESET knob and check the
   names march in order ("01 BIG CLEAN", "02 CHORUS CLEAN", …).

### Path C: original Fender FUSE in an offline Windows 10 VM

If you'd rather use Fender's own software: FUSE 2.7.1 installers are preserved
([archive.org](https://archive.org/details/fender-fuse-full-2.7.1), plus a
[community archive](https://guitarpedaldemos.com/fender-fuse-mustang-v2-archive/)
with manuals and ~10,000 community presets), and the community-documented way
to run it in 2026 is an **offline VirtualBox Windows 10 VM** with .NET 3.5 +
Silverlight — see the step-by-step
[Fender-Fuse-Win10-VM guide](https://github.com/robertgarcia01/Fender-Fuse-Win10-VM).
Pass the amp's USB into the VM, then:

1. Copy the 24 `.fuse` files into `Documents\Fender\FUSE\Presets` in the VM —
   FUSE auto-loads that folder into its Media Library on startup (no Fender
   server needed; only the dead community-sharing features required it).
2. Utilities → **Backup** (snapshot of the amp's current 24).
3. Media Library → Computer tab → right-click each preset → **Save Preset to
   Amp** → pick the slot per the numbering above.

### Path D: Remuda (Android) — zero-install-on-PC option

If you have an Android phone/tablet and a USB-OTG adapter: the **Remuda** app
(Triton Interactive, Play Store) edits Mustang V2 amps and uses the same
`.fuse` files — copy them to the device's `REMUDA > Music > Presets` folder and
save them to the amp from the app.

### Path E: front-panel programming — no computer, zero software risk

This is the **safest possible path** (nothing ever touches USB), and it's a
complete plan on its own — but it trades away fidelity. Know the hardware
limits first (all from the Mustang v.2 owner's manual):

**What the panel gives you**

- Programmable knobs: **GAIN, VOLUME, TREBLE, BASS** — every knob except
  MASTER and PRESET is stored in the preset. There is **no MID knob**; the
  mids stay at whatever the preset you started from had (mids are
  software-only).
- **MOD** knob: 12 canned modulation combos (A1 Chorus, A2 Chorus Deep,
  A3 Flanger, B1 Touch Wah, B2 Sine Tremolo, B3 Vintage Tremolo, C1/C2
  Vibratone, C3/D1 Pitch Shifter, D2 Phaser, D3 Step Filter). The three LEDs
  show position 1/2/3 within bands A–D.
- **DLY/REV** knob: 12 canned delay/reverb combos (A1–A3 tape/mono delays,
  B1 Small Room, B2 Plate, B3 Large Hall, C1 '65 Spring, C2 '63 Spring,
  C3 Tape Delay+Room, D1 Tape Delay+Large Hall, D2 Ducking Delay+Small Hall,
  D3 Echo Filter).
- **Effect level:** hold **EXIT** while rotating MOD or DLY/REV. **Delay
  time / mod rate:** tap the **TAP** button in rhythm (twice minimum).
- Not reachable at all from the panel: the Stompbox category (overdrive,
  compressor…), cabinet, noise gate, sag, bias, and 9 of the 17 amp models —
  the panel's eight amp types are **'57 Deluxe, '59 Bassman, '65 Twin Reverb,
  British '60s, British '80s, American '90s, Super-Sonic, and Metal 2000**
  (one label per PRESET-knob position).

**The two save rules**

- Only the **GREEN and RED banks (16 slots)** are panel-writable; AMBER is
  software-only.
- A panel save can only land in the green/red slot **of the amp-type row you
  started from** — so pick your starting preset by its printed amp type.

**The panel-only plan** (approximates the §2 palette; ~30–40 min):

| Amp-type row | GREEN slot | RED slot |
|---|---|---|
| '57 Deluxe | #5 EDGE BREAKUP (g5 v7 t5.5 b5, DLY/REV C1, level low) | — spare |
| '59 Bassman | #6 COUNTRY SNAP (g4 v7 t6.5 b4.5, C1 low) | #7 TEXAS BLUES (g6.5 v7.5 t6 b5.5, C2) |
| '65 Twin Reverb | #1/#2 BIG/CHORUS CLEAN (g3 v7 t6 b6, B3 low; add MOD A1 low for chorus) | #8 PURPLE RAIN (g3 v7 t5.5 b6, MOD A2, B3 generous) |
| British '60s | #10 CLASSIC ROCK stand-in (g6 v6.5 t6 b5.5) | #14 LEAD stand-in (g7.5 v7 t5.5 b5, DLY/REV **D1** = tape delay + large hall in one) |
| British '80s | #9 ACDC CRUNCH (g4.5 v6.5 t6 b5, no FX) | #11 POP PUNK (g7 v6 t5.5 b6.5) |
| American '90s | #12 GRUNGE BIG (g6 v6 t5.5 b6.5) | — spare |
| Metal 2000 | #13 MODERN HI GAIN (g6.5 v6 t6 b6) | — spare |
| Super-Sonic | #15 VOODOO stand-in (g7 v7 t6 b5.5, MOD **B1** Touch Wah, C2) | — spare |

Compromises vs. the file-based layout: British '70s tones (#10, #14) run on
British '60s instead; the '65 Deluxe cleans (#3, #19) and the acoustic sim
(#4) aren't buildable — use the factory AMBER Twin/Deluxe presets for those
songs; no compressors anywhere; mids are whatever the factory preset had. The
quiet↔loud pairs also can't sit adjacent (the row rule dictates placement), so
re-derive your cheat sheet from the table above.

**Save procedure per preset** (v.2 manual, exact):

1. Select the AMBER factory preset of the target amp-type row and turn
   GAIN/VOLUME/TREBLE/BASS (and MOD / DLY/REV) to the values above — the
   **SAVE button lights red** once you've modified anything.
2. Press **SAVE** — SAVE and EXIT flash rapidly (EXIT cancels).
3. Turn **PRESET** to the GREEN or RED slot of that same row.
4. **Press SAVE again to confirm.** Done — repeat for the next tone.

**Bonus — footswitch (optional Fender 1-button, P/N 0994049000):** with an
unmodified preset selected, press SAVE, tap the footswitch to pick its red or
green LED, press SAVE to confirm. Assign your two most-switched presets and
you get one hands-free toggle per gig.

---

## 5. Firmware — read before plugging into any updater

- The last firmware for the Mustang I **V2** is **2.2**; there will never be
  another. If the amp works, **don't update** — there's nothing to gain.
- Known hazard if you ever run FUSE's updater: it may silently install its
  *bundled older* firmware instead of 2.2 unless you manually point it at the
  2.2 file (still mirrored on
  [Softpedia](https://drivers.softpedia.com/get/audio-dj-gear/Fender/Fender-Mustang-I-V2-Amplifier-Firmware-22.shtml)).
- Firmware/recovery mode = hold **SAVE** while powering on until it blinks red.
  Don't enter it casually — this mode is the *only* place a brick is possible
  (see §4.0). If you get there by accident, power off without sending anything;
  the amp boots normally.

---

## 6. Dial it in at rehearsal (15 minutes well spent)

1. Set MASTER to gig level, play the loudest preset (#13) and the main cleans
   (#1, #3, #5) back to back; adjust each preset's **VOLUME** so nothing jumps
   out, then re-save. Dirty presets need lower channel volume than cleans.
2. The 8" speaker gets boomy when cranked — if mud creeps in, drop **bass**
   half a point on the high-gain presets (11–13) rather than adding treble.
3. Single coils vs. humbuckers matters: with humbuckers, drop gain ~1 point
   across the dirt bank; with single coils, add ~1 on #9/#10.
4. Tweaks can be made live from the panel knobs (gain/vol/EQ) — just re-save,
   or better, edit `generate_presets.py` and reload so the files stay the
   source of truth.

---

## 7. Regenerating the files

Tone table lives in `generate_presets.py` (`TONES` dict, 0–10 dial values).
After edits:

```powershell
python amp-presets\generate_presets.py
```

then reload the changed file(s) via any loading path (Path A–D).

---

### Sources

- Preset file format, model/effect IDs, slot-write capability: verified from
  [offa/plug source](https://github.com/offa/plug) (`src/ui/savetofile.cpp`,
  `loadfromfile.cpp`, `include/effects_enum.h`, `src/com/Mustang.cpp`)
- Bank/save/factory-restore behavior, panel controls, MOD & DLY/REV effect
  tables, footswitch assignment (read first-hand from the PDF):
  [Mustang v.2 Advanced Owner's Manual](https://guitarpedaldemos.com/wp-content/uploads/2020/04/MustangI-V_v.2_advanced_manual_revA_English.pdf)
  (official copy: [fmicassets](https://www.fmicassets.com/Damroot/Original/10001/om_2300100000_Mustang_V2_English.pdf))
- The eight panel amp-type labels:
  [Gear-Vault Mustang I/II review](https://gear-vault.com/fender-mustang-i-and-ii-guitar-amplifier-review/),
  [Killer Guitar Rigs Mustang I V2 review](https://killerguitarrigs.com/fender-mustang-i-v2-review/)
- FUSE Media Library / backup-restore / firmware procedure:
  [Fender FUSE 2.0 manual for Mustang I/II](https://guitarpedaldemos.com/wp-content/uploads/2025/06/Fender_FUSE_2.0_manual_for__Mustang_1-2_Rev-G_English.pdf)
- FUSE-on-modern-Windows situation: [Fender-Fuse-Win10-VM](https://github.com/robertgarcia01/Fender-Fuse-Win10-VM),
  [FUSE archive](https://guitarpedaldemos.com/fender-fuse-mustang-v2-archive/)
- USB passthrough to WSL2: [Microsoft Learn — Connect USB devices](https://learn.microsoft.com/en-us/windows/wsl/connect-usb)
- Core-tone-bank strategy for cover gigs: working-band threads on the Fractal
  forum (consolidate to a handful of shared tones; audiences don't hear
  per-song differences)
- Tone recipes: authored for this set list against the Mustang's model set
  (Fender's old per-song Tone/FUSE community pages are offline as of 2026);
  treat as starting points and trust your ears.
