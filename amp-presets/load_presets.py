#!/usr/bin/env python3
"""Native Windows USB loader for the Fender Mustang I/II V2.

Bulk-writes the 24 presets defined in generate_presets.py straight onto the amp
over USB, with NO WSL2 / usbipd / Plug. The Mustang enumerates as a USB-HID
device, so this talks to it through hidapi using the built-in Windows HID
driver -- driverless, no Zadig.

    pip install hidapi        # one-time (bundles hidapi.dll on Windows)

    python load_presets.py --self-test     # verify packets vs the .fuse files (no amp)
    python load_presets.py --dry-run       # build + hex-dump packets (no amp)
    python load_presets.py --list          # detect the amp over USB
    python load_presets.py                  # write ALL 24 presets
    python load_presets.py --only 9-16      # write a subset (1-based preset numbers)
    python load_presets.py --only 9,17-18   # mix ranges and singles

The wire protocol is ported byte-for-byte from offa/plug (GPLv3):
Packet.cpp (frame offsets), PacketSerializer.cpp (per-amp/effect constants),
Mustang.cpp (save sequence), UsbComm.cpp (endpoints). The model/effect ids on
the wire are the same integers as in the .fuse XML, so they come straight from
generate_presets.py's tables.
"""

import argparse
import os
import sys
import xml.etree.ElementTree as ET

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import generate_presets as gp

AMPS = gp.AMPS
FX = gp.FX
CABINETS = gp.CABINETS
AMP_MAGIC = gp.AMP_MAGIC
PRESETS = gp.PRESETS
dial = gp.dial

VID = 0x1ed8
PID = 0x0014
PACKET_SIZE = 64

# --- header byte values (Packet.cpp) ------------------------------------------
STAGE_INIT0, STAGE_INIT1, STAGE_READY, STAGE_LOAD = 0x00, 0x1a, 0x1c, 0xff
TYPE_OP, TYPE_DATA, TYPE_INIT0 = 0x01, 0x03, 0xc3
# plug uses 0xc1 for init1 ("0x03 in the original implementation but seems to
# work on v2 devices too"); the original Plug / snhirsch use 0x03. Both are
# reported to work on the V2. Overridable with --init1-type.
TYPE_INIT1_DEFAULT = 0xc1
DSP_NONE, DSP_AMP, DSP_USBGAIN = 0x00, 0x05, 0x0d
DSP_FX0 = 0x06  # effect DSP = 0x05 + category(1..4) -> 0x06/0x07/0x08/0x09
DSP_OPSAVE, DSP_OPSELECT = 0x03, 0x01

# --- per-effect "unknown" payload triple (PacketSerializer.cpp) ---------------
_UNK_DEFAULT = (0x00, 0x08, 0x01)
_UNK_MOD = (0x01, 0x01, 0x01)
_UNK_DELAY = (0x02, 0x01, 0x01)
_UNK_WAHLIKE = (0x01, 0x08, 0x01)
EFFECT_UNKNOWN = {
    "WAH": _UNK_WAHLIKE, "TOUCH_WAH": _UNK_WAHLIKE,
    "SIMPLE_COMP": (0x08, 0x08, 0x01),
    "SINE_CHORUS": _UNK_MOD, "TRIANGLE_CHORUS": _UNK_MOD,
    "SINE_FLANGER": _UNK_MOD, "TRIANGLE_FLANGER": _UNK_MOD,
    "VIBRATONE": _UNK_MOD, "VINTAGE_TREMOLO": _UNK_MOD,
    "SINE_TREMOLO": _UNK_MOD, "STEP_FILTER": _UNK_MOD, "PHASER": _UNK_MOD,
    "RING_MODULATOR": _UNK_WAHLIKE, "PITCH_SHIFTER": _UNK_WAHLIKE,
    "MONO_DELAY": _UNK_DELAY, "MONO_ECHO_FILTER": _UNK_DELAY,
    "STEREO_ECHO_FILTER": _UNK_DELAY, "MULTITAP_DELAY": _UNK_DELAY,
    "PING_PONG_DELAY": _UNK_DELAY, "DUCKING_DELAY": _UNK_DELAY,
    "REVERSE_DELAY": _UNK_DELAY, "TAPE_DELAY": _UNK_DELAY,
    "STEREO_TAPE_DELAY": _UNK_DELAY,
    "WAH_MOD": _UNK_WAHLIKE, "TOUCH_WAH_MOD": _UNK_WAHLIKE,
    "DIATONIC_PITCH_SHIFTER": _UNK_DEFAULT,
}
EXTRA_KNOB = {"MONO_ECHO_FILTER", "STEREO_ECHO_FILTER",
              "TAPE_DELAY", "STEREO_TAPE_DELAY"}

DEFAULT_POS = {1: 0, 2: 1, 3: 4, 4: 5}  # matches generate_presets default_pos


def _clamp(v, lo, hi):
    return max(lo, min(hi, v))


# --- payload builders (offsets are payload-relative; +16 = absolute) ----------

def _amp_payload(spec):
    k = spec["knobs"]
    ng = _clamp(spec.get("noise_gate", 0), 0, 5)
    p = bytearray(48)
    p[0] = AMPS[spec["amp"]] & 0xff              # model
    p[16] = dial(k["volume"])
    p[17] = dial(k["gain"])
    p[18] = dial(k.get("gain2", 0))
    p[19] = dial(k.get("master", k["volume"]))
    p[20] = dial(k["treble"])
    p[21] = dial(k["middle"])
    p[22] = dial(k["bass"])
    p[23] = dial(k.get("presence", 5))
    p[26] = dial(k.get("bias", 5))
    p[31] = ng
    if ng == 5:
        p[32] = _clamp(spec.get("threshold", 0), 0, 9)
        p[25] = dial(k.get("depth", 5))
    else:
        p[25] = 0x80                              # depth forced 0x80 (plug)
    p[33] = CABINETS[spec["cabinet"]]
    p[35] = _clamp(spec.get("sag", 1), 0, 2)
    p[36] = 1 if spec.get("bright", False) else 0
    # amp "unknown" triple: default 0x80/0x80/0x01; '65 Deluxe Reverb overrides
    u0, u1, u2 = (0x00, 0x00, 0x01) if spec["amp"] == "65_DELUXE_REVERB" \
        else (0x80, 0x80, 0x01)
    p[24], p[27], p[37] = u0, u1, u2
    # amp-specific magic: (m0,m0,m0,m0,m1) where (m0,m1)=first two AMP_MAGIC vals
    m0, m1 = AMP_MAGIC[spec["amp"]][0], AMP_MAGIC[spec["amp"]][1]
    p[28] = p[29] = p[30] = p[34] = m0
    p[38] = m1
    return p


def _effect_payload(name, knobs, pos):
    model = FX[name][0]
    p = bytearray(48)
    p[0] = model & 0xff
    p[1] = (model >> 8) & 0xff
    p[2] = pos
    ks = [0, 0, 0, 0, 0, 0]
    if name == "SIMPLE_COMP":                     # knob1 is a raw 0-3 enum
        ks[0] = _clamp(int(knobs[0]) if knobs else 0, 0, 3)
        unk = EFFECT_UNKNOWN[name]
    else:
        for i in range(min(5, len(knobs))):
            ks[i] = dial(knobs[i])
        if name in EXTRA_KNOB and len(knobs) > 5:
            ks[5] = dial(knobs[5])
        if name == "RING_MODULATOR":
            ks[3] = _clamp(ks[3], 0, 1)
        elif name == "PHASER":
            ks[4] = _clamp(ks[4], 0, 1)
        elif name == "MULTITAP_DELAY":
            ks[4] = _clamp(ks[4], 0, 3)
        unk = EFFECT_UNKNOWN.get(name, _UNK_DEFAULT)
    p[3], p[4], p[5] = unk
    p[16], p[17], p[18], p[19], p[20], p[21] = ks
    return p


def _packet(stage, typ, dsp, payload=None, slot=0, unk=(0, 0, 0)):
    h = bytearray(16)
    h[0], h[1], h[2] = stage, typ, dsp
    h[3], h[4] = unk[0], slot
    h[6], h[7] = unk[1], unk[2]
    body = bytes(payload) if payload is not None else bytes(48)
    pkt = bytes(h) + body
    assert len(pkt) == PACKET_SIZE, len(pkt)
    return pkt


# --- command packets ----------------------------------------------------------

def init_packets(init1_type):
    return [
        ("init0", _packet(STAGE_INIT0, TYPE_INIT0, DSP_NONE)),
        ("init1", _packet(STAGE_INIT1, init1_type, DSP_NONE)),
    ]


def _apply():
    return _packet(STAGE_READY, TYPE_DATA, DSP_NONE)


def preset_packets(slot, spec):
    """Full send sequence for one preset. Returns [(label, packet, mode)]."""
    seq = []
    seq.append(("amp", _packet(STAGE_READY, TYPE_DATA, DSP_AMP,
                               _amp_payload(spec), unk=(0, 1, 1)), "ack"))
    seq.append(("apply", _apply(), "ack"))
    ug = bytearray(48)  # usb-gain payload byte0 = 0 (matches <UsbGain>0</UsbGain>)
    seq.append(("usbgain", _packet(STAGE_READY, TYPE_DATA, DSP_USBGAIN,
                                   ug, unk=(0, 1, 1)), "ack"))
    seq.append(("apply", _apply(), "ack"))

    fx_by_cat = {FX[f["type"]][1]: f for f in spec.get("fx", [])}
    for cat in (1, 2, 3, 4):
        dsp = DSP_FX0 + (cat - 1)
        clear = bytearray(48)
        clear[3], clear[4], clear[5] = _UNK_DEFAULT
        seq.append(("clear%d" % cat,
                    _packet(STAGE_READY, TYPE_DATA, dsp, clear, unk=(0, 1, 1)),
                    "ack"))
        seq.append(("apply", _apply(), "ack"))
        f = fx_by_cat.get(cat)
        if f:
            pos = f.get("pos", DEFAULT_POS[cat])
            seq.append(("fx%d:%s" % (cat, f["type"]),
                        _packet(STAGE_READY, TYPE_DATA, dsp,
                                _effect_payload(f["type"], f["knobs"], pos),
                                unk=(0, 1, 1)), "ack"))
            seq.append(("apply", _apply(), "ack"))

    name_pl = bytearray(48)
    enc = spec["name"].encode("ascii", "replace")[:32]
    name_pl[0:len(enc)] = enc
    seq.append(("save->slot%d" % slot,
                _packet(STAGE_READY, TYPE_OP, DSP_OPSAVE, name_pl,
                        slot=slot, unk=(0, 1, 1)), "ack"))
    seq.append(("loadbank",
                _packet(STAGE_READY, TYPE_OP, DSP_OPSELECT, slot=slot,
                        unk=(0, 1, 0)), "drain"))
    return seq


# --- slot selection -----------------------------------------------------------

def parse_selection(text):
    """'9-16', '9,17-18' -> sorted 0-based slot indices (input is 1-based)."""
    slots = set()
    for part in text.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            a, b = part.split("-", 1)
            for n in range(int(a), int(b) + 1):
                slots.add(n - 1)
        else:
            slots.add(int(part) - 1)
    bad = [s + 1 for s in slots if s < 0 or s >= len(PRESETS)]
    if bad:
        raise SystemExit("preset number(s) out of range 1-%d: %s"
                         % (len(PRESETS), bad))
    return sorted(slots)


# --- self-test: rebuild packets and diff against the committed .fuse files ----

def _fuse_path(slot, spec):
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), "fuse",
                        "%02d-%s.fuse" % (slot, spec["file"]))


def _parse_fuse(path):
    root = ET.parse(path).getroot()
    amp_mod = root.find("Amplifier/Module")
    amp_id = int(amp_mod.get("ID"))
    amp_params = {int(p.get("ControlIndex")): int(p.text)
                  for p in amp_mod.findall("Param")}
    fx = {}
    for tag, cat in (("Stompbox", 1), ("Modulation", 2),
                     ("Delay", 3), ("Reverb", 4)):
        mod = root.find("FX/%s/Module" % tag)
        params = {int(p.get("ControlIndex")): int(p.text)
                  for p in mod.findall("Param")}
        fx[cat] = (int(mod.get("ID")), int(mod.get("POS")), params)
    name = root.find("FUSE/Info").get("name")
    return amp_id, amp_params, fx, name


def self_test(slots):
    total = 0
    for slot in slots:
        spec = PRESETS[slot]
        path = _fuse_path(slot, spec)
        amp_id, ap, fxf, fname = _parse_fuse(path)
        p = _amp_payload(spec)
        mism = []

        # amp: high byte of each 16-bit .fuse Param == the wire byte
        for off, ci in [(0, None), (16, 0), (17, 1), (18, 2), (19, 3),
                        (20, 4), (21, 5), (22, 6), (23, 7), (25, 9), (26, 10)]:
            if off == 0:
                if p[0] != (amp_id & 0xff):
                    mism.append("model %d != %d" % (p[0], amp_id))
                continue
            want = ap[ci] >> 8
            if p[off] != want:
                mism.append("amp p[%d]=%d != CI%d>>8=%d" % (off, p[off], ci, want))
        # amp: raw enum params
        for off, ci in [(31, 15), (32, 16), (33, 17), (35, 19), (36, 20)]:
            if p[off] != ap[ci]:
                mism.append("amp p[%d]=%d != CI%d=%d" % (off, p[off], ci, ap[ci]))
        # amp-specific magic
        for off, ci in [(28, 12), (29, 13), (30, 14), (34, 18)]:
            if p[off] != ap[ci]:
                mism.append("magic p[%d]=%d != CI%d=%d" % (off, p[off], ci, ap[ci]))
        if p[38] != (ap[22] >> 8):
            mism.append("magic p[38]=%d != CI22>>8=%d" % (p[38], ap[22] >> 8))

        # effects
        fx_by_cat = {FX[f["type"]][1]: f for f in spec.get("fx", [])}
        for cat in (1, 2, 3, 4):
            fid, fpos, fparams = fxf[cat]
            f = fx_by_cat.get(cat)
            if f is None:
                if fid != 0:
                    mism.append("cat%d .fuse has model %d but spec empty"
                                % (cat, fid))
                continue
            ep = _effect_payload(f["type"], f["knobs"], f.get("pos", DEFAULT_POS[cat]))
            wire_model = ep[0] | (ep[1] << 8)
            if wire_model != fid:
                mism.append("cat%d model %d != .fuse %d" % (cat, wire_model, fid))
            if ep[2] != fpos:
                mism.append("cat%d pos %d != .fuse %d" % (cat, ep[2], fpos))
            if f["type"] != "SIMPLE_COMP":
                for i in range(5):
                    if i in fparams:
                        want = fparams[i] >> 8
                        if ep[16 + i] != want:
                            mism.append("cat%d knob%d=%d != .fuse=%d"
                                        % (cat, i + 1, ep[16 + i], want))
        # name
        enc = spec["name"].encode("ascii", "replace")[:32].decode("ascii")
        if enc != fname:
            mism.append("name %r != .fuse %r" % (enc, fname))

        status = "OK" if not mism else "MISMATCH"
        print("  slot %2d  %-18s %s" % (slot + 1, spec["name"], status))
        for m in mism:
            print("            - " + m)
        total += len(mism)
    print("\nself-test: %d mismatch(es) across %d preset(s)."
          % (total, len(slots)))
    return total == 0


# --- dry run: hex dump of the send sequence -----------------------------------

def dry_run(slots, init1_type):
    for label, pkt in init_packets(init1_type):
        print("[init]     %-14s %s" % (label, pkt.hex()))
    for slot in slots:
        spec = PRESETS[slot]
        print("\n=== slot %d  %s ===" % (slot + 1, spec["name"]))
        for label, pkt, mode in preset_packets(slot, spec):
            print("  %-16s (%-5s) %s" % (label, mode, pkt.hex()))


# --- USB I/O ------------------------------------------------------------------

def _import_hid():
    try:
        import hid
    except ImportError:
        raise SystemExit(
            "The 'hidapi' package is not installed.\n"
            "  pip install hidapi\n"
            "(bundles hidapi.dll on Windows; uses the built-in HID driver -- "
            "no Zadig, no WSL).")
    return hid


class Amp:
    def __init__(self, ack_timeout=1000):
        self.hid = _import_hid()
        self.dev = self.hid.device()
        try:
            self.dev.open(VID, PID)
        except (OSError, IOError) as e:
            raise SystemExit(
                "Could not open the Mustang (%04x:%04x): %s\n"
                "Check: amp powered ON, USB cable connected, and no other app "
                "(FUSE/Plug) is holding the device." % (VID, PID, e))
        self.ack_timeout = ack_timeout

    def send(self, pkt, mode="ack"):
        # HID report id 0 -> prepend 0x00, so the write is 65 bytes.
        self.dev.write(b"\x00" + pkt)
        if mode == "ack":
            self.dev.read(PACKET_SIZE, timeout_ms=self.ack_timeout)
        elif mode == "drain":
            for _ in range(12):
                if not self.dev.read(PACKET_SIZE, timeout_ms=500):
                    break

    def close(self):
        try:
            self.dev.close()
        except Exception:
            pass


def list_devices():
    hid = _import_hid()
    found = hid.enumerate(VID, PID)
    if not found:
        print("No Mustang (%04x:%04x) found. Amp on? USB connected?" % (VID, PID))
        return False
    for d in found:
        print("Found: %s %s  path=%s" % (
            d.get("manufacturer_string") or "?",
            d.get("product_string") or "?",
            d.get("path")))
    return True


def write_presets(slots, init1_type, ack_timeout):
    amp = Amp(ack_timeout=ack_timeout)
    try:
        for label, pkt in init_packets(init1_type):
            amp.send(pkt, "ack")
        print("initialized. writing %d preset(s)..." % len(slots))
        for slot in slots:
            spec = PRESETS[slot]
            for _label, pkt, mode in preset_packets(slot, spec):
                amp.send(pkt, mode)
            print("  slot %2d  %-18s written" % (slot + 1, spec["name"]))
    finally:
        amp.close()
    print("done. Spin the PRESET knob to confirm the names/tones landed.")


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--only", metavar="SPEC",
                    help="subset of 1-based preset numbers, e.g. '9-16' or '9,17-18'")
    ap.add_argument("--dry-run", action="store_true",
                    help="build + hex-dump packets, don't touch USB")
    ap.add_argument("--self-test", action="store_true",
                    help="verify built packets against the .fuse files, no USB")
    ap.add_argument("--list", action="store_true",
                    help="detect the amp over USB and exit")
    ap.add_argument("--init1-type", choices=["c1", "03"], default="c1",
                    help="init packet 2 type byte (default c1 = plug; 03 = original)")
    ap.add_argument("--ack-timeout", type=int, default=1000,
                    help="ms to wait for each ACK read (default 1000)")
    args = ap.parse_args()

    init1_type = 0xc1 if args.init1_type == "c1" else 0x03
    slots = parse_selection(args.only) if args.only else list(range(len(PRESETS)))

    if args.list:
        raise SystemExit(0 if list_devices() else 1)
    if args.self_test:
        raise SystemExit(0 if self_test(slots) else 1)
    if args.dry_run:
        dry_run(slots, init1_type)
        return
    write_presets(slots, init1_type, args.ack_timeout)


if __name__ == "__main__":
    main()
