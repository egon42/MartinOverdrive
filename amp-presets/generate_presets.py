#!/usr/bin/env python3
"""Generate Fender FUSE-compatible .fuse preset files for a Fender Mustang I V2.

The XML schema, amp/effect model IDs, ControlIndex maps, and value encodings
were extracted from the offa/plug source (https://github.com/offa/plug),
which reads/writes genuine Fender FUSE files.

Knob values in PRESETS below are given on the amp's 0-10 dial scale and
converted to the 0-255 wire scale here. Files are written to ./fuse/.
"""

import os
import xml.sax.saxutils as sx

# --- Amp model IDs (decimal, from offa/plug effects_enum.h / IdLookup.h) ---
AMPS = {
    "57_DELUXE": 103,
    "59_BASSMAN": 100,
    "57_CHAMP": 124,
    "65_DELUXE_REVERB": 83,
    "65_PRINCETON": 106,
    "65_TWIN_REVERB": 117,
    "SUPER_SONIC": 114,
    "BRITISH_60S": 97,
    "BRITISH_70S": 121,
    "BRITISH_80S": 94,
    "AMERICAN_90S": 93,
    "METAL_2000": 109,
    "STUDIO_PREAMP": 241,
    "57_TWIN": 246,
    "60S_THRIFT": 249,
    "BRITISH_COLOUR": 252,
    "BRITISH_WATTS": 255,
}

# Amp-specific magic values written at ControlIndex 12/13/14/18 and 22
# (ignored by plug's loader but present in genuine FUSE files).
AMP_MAGIC = {  # amp: (something, something2, something3)
    "57_DELUXE": (0x01, 0x53, 128),
    "59_BASSMAN": (0x02, 0x67, 128),
    "57_CHAMP": (0x0C, 0x00, 128),
    "65_DELUXE_REVERB": (0x03, 0x6A, 0),
    "65_PRINCETON": (0x04, 0x61, 128),
    "65_TWIN_REVERB": (0x05, 0x72, 128),
    "SUPER_SONIC": (0x06, 0x79, 128),
    "BRITISH_60S": (0x07, 0x5E, 128),
    "BRITISH_70S": (0x0B, 0x7C, 128),
    "BRITISH_80S": (0x09, 0x5D, 128),
    "AMERICAN_90S": (0x0A, 0x6D, 128),
    "METAL_2000": (0x08, 0x75, 128),
    "STUDIO_PREAMP": (0x0D, 0xF6, 128),
    "57_TWIN": (0x0E, 0xF9, 128),
    "60S_THRIFT": (0x0F, 0xFC, 128),
    "BRITISH_COLOUR": (0x10, 0xFF, 128),
    "BRITISH_WATTS": (0x11, 0x00, 128),
}

CABINETS = {
    "OFF": 0, "57DLX": 1, "BSSMN": 2, "65DLX": 3, "65PRN": 4, "CHAMP": 5,
    "4x12M": 6, "2x12C": 7, "4x12G": 8, "65TWN": 9, "4x12V": 10,
    "SS212": 11, "SS112": 12,
}

# Effect model IDs (decimal) and their FX category element.
FX = {
    # Stompbox (category 1)
    "OVERDRIVE": (60, 1), "WAH": (73, 1), "TOUCH_WAH": (74, 1),
    "FUZZ": (26, 1), "FUZZ_TOUCH_WAH": (28, 1), "SIMPLE_COMP": (136, 1),
    "COMPRESSOR": (7, 1), "RANGER_BOOST": (259, 1), "GREENBOX": (186, 1),
    "ORANGEBOX": (272, 1), "BLACKBOX": (273, 1), "BIG_FUZZ": (271, 1),
    # Modulation (category 2)
    "SINE_CHORUS": (18, 2), "TRIANGLE_CHORUS": (19, 2),
    "SINE_FLANGER": (24, 2), "TRIANGLE_FLANGER": (25, 2),
    "VIBRATONE": (45, 2), "VINTAGE_TREMOLO": (64, 2), "SINE_TREMOLO": (65, 2),
    "RING_MODULATOR": (34, 2), "STEP_FILTER": (41, 2), "PHASER": (79, 2),
    "PITCH_SHIFTER": (31, 2), "WAH_MOD": (244, 2), "TOUCH_WAH_MOD": (245, 2),
    "DIATONIC_PITCH_SHIFTER": (287, 2),
    # Delay (category 3)
    "MONO_DELAY": (22, 3), "MONO_ECHO_FILTER": (67, 3),
    "STEREO_ECHO_FILTER": (72, 3), "MULTITAP_DELAY": (68, 3),
    "PING_PONG_DELAY": (69, 3), "DUCKING_DELAY": (21, 3),
    "REVERSE_DELAY": (70, 3), "TAPE_DELAY": (43, 3),
    "STEREO_TAPE_DELAY": (42, 3),
    # Reverb (category 4)
    "SMALL_HALL": (36, 4), "LARGE_HALL": (58, 4), "SMALL_ROOM": (38, 4),
    "LARGE_ROOM": (59, 4), "SMALL_PLATE": (78, 4), "LARGE_PLATE": (75, 4),
    "AMBIENT": (76, 4), "ARENA": (77, 4), "63_SPRING": (33, 4),
    "65_SPRING": (11, 4),
}

SIX_KNOB_FX = {"MONO_ECHO_FILTER", "STEREO_ECHO_FILTER", "TAPE_DELAY",
               "STEREO_TAPE_DELAY"}

CATEGORY_ELEMENTS = {1: "Stompbox", 2: "Modulation", 3: "Delay", 4: "Reverb"}


def dial(v):
    """0-10 dial value -> 0-255 wire value."""
    return max(0, min(255, round(v / 10.0 * 255)))


def dup16(v255):
    """Continuous params are stored duplicated: (v<<8)|v."""
    return (v255 << 8) | v255


def amp_params(spec):
    """Build the 23 amp <Param> values (ControlIndex 0-22)."""
    a = spec["amp"]
    magic, magic2, magic3 = AMP_MAGIC[a]
    knobs = spec["knobs"]  # dial-scale dict
    g2 = dial(knobs.get("gain2", 0))
    pres = dial(knobs.get("presence", 5))
    depth = dial(knobs.get("depth", 5))
    bias = dial(knobs.get("bias", 5))
    vals = {
        0: dup16(dial(knobs["volume"])),
        1: dup16(dial(knobs["gain"])),
        2: dup16(g2),
        3: dup16(dial(knobs.get("master", knobs["volume"]))),
        4: dup16(dial(knobs["treble"])),
        5: dup16(dial(knobs["middle"])),
        6: dup16(dial(knobs["bass"])),
        7: dup16(pres),
        8: dup16(magic3),
        9: dup16(depth),
        10: dup16(bias),
        11: dup16(magic3),
        12: magic, 13: magic, 14: magic,
        15: spec.get("noise_gate", 0),
        16: spec.get("threshold", 0),
        17: CABINETS[spec["cabinet"]],
        18: magic,
        19: spec.get("sag", 1),
        20: 1 if spec.get("bright", False) else 0,
        21: 1,
        22: dup16(magic2),
    }
    return vals


def fx_module_xml(name, knobs_dial, pos):
    """One FX <Module>. knobs_dial: list of dial-scale knob values."""
    if name is None:
        return f'   <Module ID="0" POS="0" BypassState="1"></Module>\n'
    fx_id, _cat = FX[name]
    n = 6 if name in SIX_KNOB_FX else (1 if name == "SIMPLE_COMP" else 5)
    lines = [f'   <Module ID="{fx_id}" POS="{pos}" BypassState="1">\n']
    for i in range(n):
        v = knobs_dial[i] if i < len(knobs_dial) else 0
        # SIMPLE_COMP knob1 is a raw type enum (0-3), still bit-duplicated
        val = dup16(int(v)) if name == "SIMPLE_COMP" else dup16(dial(v))
        lines.append(f'    <Param ControlIndex="{i}">{val}</Param>\n')
    lines.append('   </Module>\n')
    return "".join(lines)


def preset_xml(spec):
    amp_id = AMPS[spec["amp"]]
    p = [f'<?xml version="1.0" encoding="UTF-8"?>\n',
         f'<Preset amplifier="Mustang I/II" ProductId="1">\n',
         f' <Amplifier>\n',
         f'  <Module ID="{amp_id}" POS="0" BypassState="1">\n']
    for idx, val in sorted(amp_params(spec).items()):
        p.append(f'   <Param ControlIndex="{idx}">{val}</Param>\n')
    p.append('  </Module>\n </Amplifier>\n <FX>\n')

    # exactly one Module per category, in fixed order. Default DSP position:
    # stompbox/modulation in front of the amp (0,1), delay/reverb post (4,5).
    default_pos = {1: 0, 2: 1, 3: 4, 4: 5}
    by_cat = {1: None, 2: None, 3: None, 4: None}
    for fx in spec.get("fx", []):
        name = fx["type"]
        _fx_id, cat = FX[name]
        if by_cat[cat] is not None:
            raise ValueError(
                f"{spec['name']}: two effects in category "
                f"{CATEGORY_ELEMENTS[cat]} ({by_cat[cat][0]} and {name}) — "
                f"the amp allows one per category")
        by_cat[cat] = (name, fx.get("knobs", []), fx.get("pos", default_pos[cat]))
    for cat in (1, 2, 3, 4):
        el = CATEGORY_ELEMENTS[cat]
        p.append(f'  <{el} ID="{cat}">\n')
        if by_cat[cat] is None:
            p.append(fx_module_xml(None, [], 0))
        else:
            name, knobs, pos = by_cat[cat]
            p.append(fx_module_xml(name, knobs, pos))
        p.append(f'  </{el}>\n')

    name = sx.escape(spec["name"][:32], {'"': "&quot;"})
    p.append(' </FX>\n <FUSE>\n')
    p.append(f'  <Info name="{name}" author="MartinOverdrive" rating="0" '
             f'genre1="-1" genre2="-1" genre3="-1" tags="" fenderid="0"></Info>\n')
    p.append(' </FUSE>\n <UsbGain>0</UsbGain>\n</Preset>\n')
    return "".join(p)


# ---------------------------------------------------------------------------
# PRESETS: one entry per amp memory slot 0-23 (= amp preset 1-24:
# AMBER 1-8, GREEN 1-8, RED 1-8). knobs are 0-10 dial values.
# fx knobs likewise 0-10 (SIMPLE_COMP knob1 is a raw type enum 0-3).
# ---------------------------------------------------------------------------

# Volumes: first-pass level-match from phone SPL (dB-A Slow) + ear check.
# Target ~72–73 dB rhythm; leads a hair above by ear. Dirt down, cleans up.
# Second pass 2026-07-30: the gig-tested Red 1/2 fix showed the SPL pass
# under-corrects at stage volume (compressed tones read hotter than they meter):
# clean needed +0.5, compressed hi-gain -1.0 on top of the SPL values. Applied
# set-wide, graded by compression: true cleans +0.5, breakup/comp'd cleans 0
# (their compressor already lifts the average), dynamic crunch and ungated
# high-gain -0.5, compressed hi-gain (gates on / wall of sound) -1.0.
TONES = {
    "BIG_CLEAN": {
        "amp": "65_TWIN_REVERB", "cabinet": "65TWN",
        "knobs": {"volume": 10, "gain": 3, "treble": 6, "middle": 5.5,
                  "bass": 6, "presence": 5.5},
        "fx": [{"type": "LARGE_HALL", "knobs": [4, 5, 4, 6, 5]}],
    },
    "CHORUS_CLEAN": {
        "amp": "65_TWIN_REVERB", "cabinet": "65TWN",
        "knobs": {"volume": 10, "gain": 2.8, "treble": 5.5, "middle": 5,
                  "bass": 5.5},
        "fx": [{"type": "SINE_CHORUS", "knobs": [5, 3, 5, 4, 5]},
               {"type": "SMALL_HALL", "knobs": [3.5, 4.5, 4, 6, 5]}],
    },
    "FUNK_DRY_CLEAN": {
        "amp": "65_DELUXE_REVERB", "cabinet": "65DLX", "bright": True,
        "knobs": {"volume": 7, "gain": 3.5, "treble": 6.5, "middle": 4.5,
                  "bass": 4.5},
        "fx": [{"type": "65_SPRING", "knobs": [3, 4, 4, 5, 5.5]}],
    },
    # Tribute intro fills — clean/wet, Red8 (LEAD BOOST) delay+hall character without
    # the high-gain British stack. Replaces the old ACOUSTIC SIM; nothing else cues 4Amber.
    "ETHEREAL": {
        "amp": "65_TWIN_REVERB", "cabinet": "65TWN",
        "knobs": {"volume": 8.5, "gain": 2.8, "treble": 5.5, "middle": 5,
                  "bass": 5.5, "presence": 5},
        "fx": [{"type": "MONO_DELAY", "knobs": [4.5, 5, 4, 5, 5]},
               {"type": "LARGE_HALL", "knobs": [5, 6, 4, 6, 5]}],
    },
    "EDGE_BREAKUP": {
        "amp": "57_DELUXE", "cabinet": "57DLX",
        "knobs": {"volume": 7.5, "gain": 5, "treble": 5.5, "middle": 6,
                  "bass": 5},
        "fx": [{"type": "65_SPRING", "knobs": [2.5, 4, 4, 5, 5]}],
    },
    "COUNTRY_SNAP": {
        "amp": "59_BASSMAN", "cabinet": "BSSMN", "bright": True,
        "knobs": {"volume": 5.5, "gain": 4, "treble": 6.5, "middle": 5.5,
                  "bass": 4.5},
        "fx": [{"type": "COMPRESSOR", "knobs": [5, 4.5, 4, 6, 5]},
               {"type": "65_SPRING", "knobs": [2, 3.5, 4, 5, 5.5]}],
    },
    "TEXAS_BLUES": {
        "amp": "59_BASSMAN", "cabinet": "BSSMN",
        "knobs": {"volume": 5.5, "gain": 6.5, "treble": 6, "middle": 6.5,
                  "bass": 5.5},
        "fx": [{"type": "63_SPRING", "knobs": [3.5, 4, 4.5, 5, 5]}],
    },
    "PURPLE_RAIN": {
        "amp": "65_TWIN_REVERB", "cabinet": "65TWN",
        "knobs": {"volume": 8.5, "gain": 3, "treble": 5.5, "middle": 5,
                  "bass": 6},
        "fx": [{"type": "COMPRESSOR", "knobs": [4.5, 4, 3.5, 5, 5]},
               {"type": "SINE_CHORUS", "knobs": [6, 2.5, 7, 4.5, 5]},
               {"type": "LARGE_HALL", "knobs": [5.5, 6.5, 4, 6, 5]}],
    },
    "ACDC_CRUNCH": {
        "amp": "BRITISH_80S", "cabinet": "4x12M",
        "knobs": {"volume": 5.5, "gain": 4.5, "treble": 6, "middle": 6,
                  "bass": 5, "presence": 6},
        "fx": [],
    },
    "CLASSIC_ROCK": {
        "amp": "BRITISH_70S", "cabinet": "4x12G",
        "knobs": {"volume": 5, "gain": 6, "treble": 6, "middle": 6.5,
                  "bass": 5.5, "presence": 6},
        "fx": [{"type": "SMALL_ROOM", "knobs": [2, 4, 4, 5, 5]}],
    },
    "POP_PUNK": {
        "amp": "BRITISH_80S", "cabinet": "4x12M", "noise_gate": 1,
        "knobs": {"volume": 4, "gain": 7, "treble": 5.5, "middle": 5.5,
                  "bass": 6.5, "presence": 5.5},
        "fx": [],
    },
    "GRUNGE_BIG": {
        "amp": "AMERICAN_90S", "cabinet": "4x12V", "noise_gate": 1,
        "knobs": {"volume": 2.5, "gain": 6, "treble": 5.5, "middle": 4.5,
                  "bass": 6.5},
        "fx": [],
    },
    "MODERN_HI_GAIN": {
        "amp": "METAL_2000", "cabinet": "4x12M", "noise_gate": 2,
        "knobs": {"volume": 2.5, "gain": 6.5, "treble": 6, "middle": 5,
                  "bass": 6, "presence": 6},
        "fx": [],
    },
    "LEAD_SOLO": {
        "amp": "BRITISH_70S", "cabinet": "4x12G",
        "knobs": {"volume": 4.5, "gain": 7.5, "treble": 5.5, "middle": 7,
                  "bass": 5},
        "fx": [{"type": "MONO_DELAY", "knobs": [4, 4.5, 3.5, 5, 5]},
               {"type": "SMALL_HALL", "knobs": [3, 4.5, 4, 6, 5]}],
    },
    "VOODOO_WAH": {
        "amp": "59_BASSMAN", "cabinet": "BSSMN",
        "knobs": {"volume": 6.5, "gain": 7, "treble": 6, "middle": 6,
                  "bass": 5.5},
        "fx": [{"type": "TOUCH_WAH", "knobs": [8, 6, 3, 7, 4]},
               {"type": "63_SPRING", "knobs": [3, 4, 4.5, 5, 5]}],
    },
    "GLAM_ROCK": {
        "amp": "BRITISH_80S", "cabinet": "4x12M",
        "knobs": {"volume": 4, "gain": 6, "treble": 6.5, "middle": 6,
                  "bass": 5, "presence": 6.5},
        "fx": [{"type": "SMALL_ROOM", "knobs": [2, 4, 4, 5, 5]}],
    },
    "MUTED_DRY_CLEAN": {
        "amp": "65_DELUXE_REVERB", "cabinet": "65DLX",
        "knobs": {"volume": 7, "gain": 3, "treble": 6, "middle": 5,
                  "bass": 5},
        "fx": [{"type": "65_SPRING", "knobs": [1.5, 3, 3, 5, 5]}],
    },

    # --- Floydian set (night-noodling jams; see FLOYDIAN-SET.md) -----------
    # Effect knob orders verified against plug src/ui/effect.cpp:
    #   FUZZ [level,gain,octave,low,high]  OVERDRIVE [level,gain,low,mid,high]
    #   SINE_FLANGER/VIBRATONE/PHASER [level,rate|rotor,depth,feedback,phase|shape]
    #   MONO_DELAY [level,time,feedback,bright,atten]  BIG_FUZZ [level,tone,sustain]
    # PHASER shape must stay 0 (loader clamps the wire byte to 0/1).
    "F_BREATHE": {
        "amp": "65_TWIN_REVERB", "cabinet": "65TWN",
        "knobs": {"volume": 8.5, "gain": 3, "treble": 5.5, "middle": 5.5,
                  "bass": 6, "presence": 5},
        "fx": [{"type": "COMPRESSOR", "knobs": [4.5, 4, 3.5, 5, 5]},
               {"type": "LARGE_HALL", "knobs": [4.5, 5.5, 4, 6, 5]}],
    },
    "F_SHINE_VIB": {
        "amp": "65_TWIN_REVERB", "cabinet": "65TWN",
        "knobs": {"volume": 9, "gain": 3, "treble": 5.5, "middle": 5,
                  "bass": 5.5},
        "fx": [{"type": "VIBRATONE", "knobs": [6, 3.5, 6, 4, 5]},
               {"type": "63_SPRING", "knobs": [3, 4, 4.5, 5, 5]}],
    },
    # 65DLX volumes graded against the gig SPL match (65DLX at 7 ~ Twin at 10),
    # not the raw true-clean 8.5-10 band.
    "F_US_AND_THEM": {
        "amp": "65_DELUXE_REVERB", "cabinet": "65DLX",
        "knobs": {"volume": 7.5, "gain": 3, "treble": 5, "middle": 5,
                  "bass": 5.5},
        "fx": [{"type": "LARGE_HALL", "knobs": [5.5, 6.5, 4, 6, 4.5]}],
    },
    # The go-to 4Amber (ETHEREAL) with more delay level/time/feedback and a
    # bigger hall. Same amp, same gain.
    "F_ETHEREAL_DEEP": {
        "amp": "65_TWIN_REVERB", "cabinet": "65TWN",
        "knobs": {"volume": 8.5, "gain": 2.8, "treble": 5.5, "middle": 5,
                  "bass": 5.5, "presence": 5},
        "fx": [{"type": "MONO_DELAY", "knobs": [5, 5.5, 4.5, 5, 5]},
               {"type": "LARGE_HALL", "knobs": [5.5, 6.5, 4, 6, 5]}],
    },
    "F_ECHOES": {
        "amp": "65_TWIN_REVERB", "cabinet": "65TWN",
        "knobs": {"volume": 9, "gain": 3, "treble": 6, "middle": 5,
                  "bass": 5},
        "fx": [{"type": "MONO_DELAY", "knobs": [6, 6, 5.5, 6, 5]},
               {"type": "SMALL_HALL", "knobs": [3.5, 4.5, 4, 6, 5]}],
    },
    "F_ANY_COLOUR": {
        "amp": "65_DELUXE_REVERB", "cabinet": "65DLX",
        "knobs": {"volume": 7, "gain": 3.5, "treble": 5.5, "middle": 5,
                  "bass": 5},
        "fx": [{"type": "PHASER", "knobs": [6, 3, 6.5, 4.5, 0]},
               {"type": "MONO_DELAY", "knobs": [4, 4.5, 3.5, 5, 5]}],
    },
    "F_WISH_BREAKUP": {
        "amp": "57_DELUXE", "cabinet": "57DLX",
        "knobs": {"volume": 7.5, "gain": 4.5, "treble": 5.5, "middle": 6,
                  "bass": 5},
        "fx": [{"type": "65_SPRING", "knobs": [3, 4, 4, 5, 5]}],
    },
    "F_MISTRESS": {
        "amp": "65_TWIN_REVERB", "cabinet": "65TWN",
        "knobs": {"volume": 9, "gain": 3, "treble": 5.5, "middle": 5,
                  "bass": 5.5},
        "fx": [{"type": "SINE_FLANGER", "knobs": [5.5, 2.5, 6, 4, 5]},
               {"type": "SMALL_HALL", "knobs": [3.5, 4.5, 4, 6, 5]}],
    },
    "F_TIME_SOLO": {
        "amp": "BRITISH_70S", "cabinet": "4x12G",
        "knobs": {"volume": 4.5, "gain": 4, "treble": 5.5, "middle": 6.5,
                  "bass": 5},
        "fx": [{"type": "FUZZ", "knobs": [6.5, 6.5, 0, 5, 5.5]},
               {"type": "MONO_DELAY", "knobs": [4, 4.5, 3.5, 5, 5]},
               {"type": "SMALL_HALL", "knobs": [3, 4.5, 4, 6, 5]}],
    },
    "F_MONEY": {
        "amp": "BRITISH_70S", "cabinet": "4x12G",
        "knobs": {"volume": 5, "gain": 5.5, "treble": 6, "middle": 6.5,
                  "bass": 5.5, "presence": 6},
        "fx": [{"type": "SMALL_ROOM", "knobs": [2, 4, 4, 5, 5]}],
    },
    "F_DOGS": {
        "amp": "BRITISH_70S", "cabinet": "4x12G",
        "knobs": {"volume": 5, "gain": 6, "treble": 5.5, "middle": 6,
                  "bass": 5.5, "presence": 6},
        "fx": [{"type": "SINE_FLANGER", "knobs": [5, 2.5, 5.5, 4, 5]},
               {"type": "SMALL_ROOM", "knobs": [2, 4, 4, 5, 5]}],
    },
    "F_NUMB_STUDIO": {
        "amp": "BRITISH_70S", "cabinet": "4x12G",
        "knobs": {"volume": 4.5, "gain": 4.5, "treble": 5.5, "middle": 6.5,
                  "bass": 5.5},
        "fx": [{"type": "FUZZ", "knobs": [7, 7.5, 0, 5.5, 5]},
               {"type": "MONO_DELAY", "knobs": [4.5, 5, 4, 5, 5]},
               {"type": "LARGE_HALL", "knobs": [4, 5, 4, 6, 5]}],
    },
    "F_SORROW": {
        "amp": "AMERICAN_90S", "cabinet": "4x12V", "noise_gate": 1,
        "knobs": {"volume": 3, "gain": 6, "treble": 5.5, "middle": 4.5,
                  "bass": 6.5},
        "fx": [{"type": "FUZZ", "knobs": [6, 8, 0, 6, 4.5]},
               {"type": "LARGE_HALL", "knobs": [5, 6, 4, 6, 5]}],
    },
    "F_RUN_LIKE_HELL": {
        "amp": "65_TWIN_REVERB", "cabinet": "65TWN", "bright": True,
        "knobs": {"volume": 8.5, "gain": 3, "treble": 6.5, "middle": 4.5,
                  "bass": 5},
        "fx": [{"type": "COMPRESSOR", "knobs": [5.5, 5, 4.5, 6, 5]},
               {"type": "MONO_DELAY", "knobs": [6.5, 4.7, 4.5, 6, 5]},
               {"type": "SMALL_HALL", "knobs": [2.5, 4, 4, 6, 5]}],
    },
    # EXPERIMENT: BIG_FUZZ (Big Muff) is a V2 extended-firmware effect the amp
    # may not have. If this slot lands garbled, the firmware lacks it -- rewrite
    # the slot and stick to FUZZ-based leads.
    "F_BIG_MUFF": {
        "amp": "BRITISH_70S", "cabinet": "4x12G",
        "knobs": {"volume": 4.5, "gain": 4, "treble": 5.5, "middle": 6.5,
                  "bass": 5.5},
        "fx": [{"type": "BIG_FUZZ", "knobs": [6.5, 5.5, 7.5]},
               {"type": "MONO_DELAY", "knobs": [4.5, 5, 4, 5, 5]},
               {"type": "LARGE_HALL", "knobs": [4, 5.5, 4, 6, 5]}],
    },
    # EXPERIMENT: BRITISH_WATTS (Hiwatt) is a V2 extended-firmware amp model --
    # same deal as F_BIG_MUFF (one experiment variable per slot).
    "F_HIWATT": {
        "amp": "BRITISH_WATTS", "cabinet": "4x12G",
        "knobs": {"volume": 6, "gain": 4.5, "treble": 6, "middle": 6,
                  "bass": 5.5, "presence": 6},
        "fx": [{"type": "63_SPRING", "knobs": [2.5, 4, 4.5, 5, 5]}],
    },
    "F_NUMB_PULSE": {
        "amp": "BRITISH_70S", "cabinet": "4x12G",
        "knobs": {"volume": 4, "gain": 5, "treble": 5.5, "middle": 6.5,
                  "bass": 5.5},
        "fx": [{"type": "FUZZ", "knobs": [7, 8, 0, 5.5, 5]},
               {"type": "MONO_DELAY", "knobs": [5, 5.5, 4.5, 5, 5]},
               {"type": "LARGE_HALL", "knobs": [5, 6, 4, 6, 5]}],
    },
    "F_SHINE_LEAD": {
        "amp": "59_BASSMAN", "cabinet": "BSSMN",
        "knobs": {"volume": 5, "gain": 5.5, "treble": 6, "middle": 6,
                  "bass": 5.5},
        "fx": [{"type": "OVERDRIVE", "knobs": [5.5, 4.5, 5, 5.5, 5]},
               {"type": "MONO_DELAY", "knobs": [4, 5, 4, 5, 5]},
               {"type": "LARGE_HALL", "knobs": [4, 5.5, 4, 6, 5]}],
    },
    # The go-to 24Red (LEAD BOOST) with the small hall swapped for a big one.
    "F_JAM_LEAD": {
        "amp": "BRITISH_70S", "cabinet": "4x12G",
        "knobs": {"volume": 3.5, "gain": 7, "treble": 5.5, "middle": 7,
                  "bass": 5},
        "fx": [{"type": "MONO_DELAY", "knobs": [4.5, 5, 4, 5, 5]},
               {"type": "LARGE_HALL", "knobs": [4.5, 5.5, 4, 6, 5]}],
    },
}


def tone(key, name, fname, vol=None):
    spec = dict(TONES[key])
    if vol is not None:
        # deep-copy knobs so a per-slot volume override doesn't mutate the
        # shared TONES entry (other slots reuse the same key).
        spec["knobs"] = dict(spec["knobs"])
        spec["knobs"]["volume"] = vol
    spec["name"] = name
    spec["file"] = fname
    return spec


# Slot layout: AMBER 1-8 = cleans/low gain, GREEN 1-8 = dirt palette,
# RED 1-8 = adjacent quiet<->loud pairs for one-click mid-song switching.
PRESETS = [
    tone("BIG_CLEAN",       "01 BIG CLEAN",       "big-clean"),        # slot 0
    tone("CHORUS_CLEAN",    "02 CHORUS CLEAN",    "chorus-clean"),     # slot 1
    tone("FUNK_DRY_CLEAN",  "03 FUNK DRY CLEAN",  "funk-dry-clean"),   # slot 2
    tone("ETHEREAL",        "04 ETHEREAL",        "ethereal"),         # slot 3 — Tribute fills
    tone("EDGE_BREAKUP",    "05 EDGE BREAKUP",    "edge-breakup"),     # slot 4
    tone("COUNTRY_SNAP",    "06 COUNTRY SNAP",    "country-snap"),     # slot 5
    tone("TEXAS_BLUES",     "07 TEXAS BLUES",     "texas-blues"),      # slot 6
    tone("PURPLE_RAIN",     "08 PURPLE RAIN",     "purple-rain"),      # slot 7
    tone("ACDC_CRUNCH",     "09 ACDC CRUNCH",     "acdc-crunch"),      # slot 8
    tone("CLASSIC_ROCK",    "10 CLASSIC ROCK",    "classic-rock"),     # slot 9
    tone("POP_PUNK",        "11 POP PUNK",        "pop-punk"),         # slot 10
    tone("GRUNGE_BIG",      "12 GRUNGE BIG",      "grunge-big"),       # slot 11
    tone("MODERN_HI_GAIN",  "13 MODERN HI GAIN",  "modern-hi-gain"),   # slot 12
    tone("LEAD_SOLO",       "14 LEAD SOLO",       "lead-solo"),        # slot 13
    tone("VOODOO_WAH",      "15 VOODOO WAH",      "voodoo-wah"),       # slot 14
    tone("GLAM_ROCK",       "16 GLAM ROCK",       "glam-rock"),        # slot 15
    # Red 1/2 gig-tuned levels (vol 10 / 2.5) are now the CHORUS_CLEAN and
    # GRUNGE_BIG base volumes, so the pair tracks its source tones exactly.
    tone("CHORUS_CLEAN",    "17 QUIET VERSE",     "pair-quiet-verse"),  # slot 16
    tone("GRUNGE_BIG",      "18 BIG CHORUS",      "pair-big-chorus"),   # slot 17
    tone("MUTED_DRY_CLEAN", "19 MUTED VERSE",     "pair-muted-verse"),  # slot 18
    tone("POP_PUNK",        "20 PUNK CHORUS",     "pair-punk-chorus", vol=3.5),  # slot 19
    tone("CHORUS_CLEAN",    "21 PRETNDR INTRO",   "pair-pretender-intro"),  # slot 20
    tone("MODERN_HI_GAIN",  "22 PRETNDR SLAM",    "pair-pretender-slam"),  # slot 21
    tone("BIG_CLEAN",       "23 BALLAD CLEAN",    "pair-ballad-clean"),     # slot 22
    tone("LEAD_SOLO",       "24 LEAD BOOST",      "pair-lead-boost", vol=3.5),  # slot 23
]

# Floydian night-noodling set (FLOYDIAN-SET.md). Same bank logic: AMBER cleans/
# atmospheres, GREEN dirt/leads, RED quiet<->loud jam pairs.
PRESETS_FLOYDIAN = [
    tone("F_BREATHE",       "01 BREATHE",         "breathe"),          # slot 0
    tone("F_SHINE_VIB",     "02 SHINE ON VIB",    "shine-on-vib"),     # slot 1
    tone("F_US_AND_THEM",   "03 US AND THEM",     "us-and-them"),      # slot 2
    tone("F_ETHEREAL_DEEP", "04 ETHEREAL DEEP",   "ethereal-deep"),    # slot 3
    tone("F_ECHOES",        "05 ECHOES",          "echoes"),           # slot 4
    tone("F_ANY_COLOUR",    "06 ANY COLOUR",      "any-colour"),       # slot 5
    tone("F_WISH_BREAKUP",  "07 WISH BREAKUP",    "wish-breakup"),     # slot 6
    tone("F_MISTRESS",      "08 MISTRESS",        "mistress"),         # slot 7
    tone("F_TIME_SOLO",     "09 TIME SOLO",       "time-solo"),        # slot 8
    tone("F_MONEY",         "10 MONEY",           "money"),            # slot 9
    tone("F_DOGS",          "11 DOGS FLANGE",     "dogs-flange"),      # slot 10
    tone("F_NUMB_STUDIO",   "12 NUMB STUDIO",     "numb-studio"),      # slot 11
    tone("F_SORROW",        "13 SORROW",          "sorrow"),           # slot 12
    tone("F_RUN_LIKE_HELL", "14 RUN LIKE HELL",   "run-like-hell"),    # slot 13
    tone("F_BIG_MUFF",      "15 BIG MUFF TRY",    "big-muff-try"),     # slot 14
    tone("F_HIWATT",        "16 HIWATT TRY",      "hiwatt-try"),       # slot 15
    tone("F_BREATHE",       "17 NUMB VERSE",      "pair-numb-verse"),  # slot 16
    tone("F_NUMB_PULSE",    "18 NUMB PULSE",      "pair-numb-pulse"),  # slot 17
    tone("F_SHINE_VIB",     "19 SHINE VERSE",     "pair-shine-verse"),  # slot 18
    tone("F_SHINE_LEAD",    "20 SHINE LEAD",      "pair-shine-lead"),   # slot 19
    tone("F_ANY_COLOUR",    "21 DARK VERSE",      "pair-dark-verse"),   # slot 20
    tone("F_TIME_SOLO",     "22 TIME LEAD",       "pair-time-lead"),    # slot 21
    tone("F_ETHEREAL_DEEP", "23 JAM CLEAN",       "pair-jam-clean"),    # slot 22
    tone("F_JAM_LEAD",      "24 JAM LEAD",        "pair-jam-lead"),     # slot 23
]

# set name -> (fuse subdir, preset list). The loader's --set flag keys off this.
PRESET_SETS = {
    "gig": ("fuse", PRESETS),
    "floydian": ("fuse-floydian", PRESETS_FLOYDIAN),
}


def main():
    base = os.path.dirname(os.path.abspath(__file__))
    for set_name, (subdir, presets) in PRESET_SETS.items():
        out = os.path.join(base, subdir)
        os.makedirs(out, exist_ok=True)
        print(f"[{set_name}] -> {subdir}/")
        for slot, spec in enumerate(presets):
            fname = f"{slot:02d}-{spec['file']}.fuse"
            with open(os.path.join(out, fname), "w", encoding="utf-8") as f:
                f.write(preset_xml(spec))
            print(f"  slot {slot:2d}: {fname}  ({spec['name']})")


if __name__ == "__main__":
    main()
