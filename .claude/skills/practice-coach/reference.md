# Practice coach — reference

Read this when building the step queue or choosing how to ask for feedback.

## Building the step queue

### Main `/coach` queue — Timed plan only

Parse `## Timed plan` top to bottom. **Ignore** any `## Desk board` (optional)
appendix and anything after Carry-forward that is not Session log / Carry-forward.

Each `###` heading is a **block**. Inside a block, split into atomic steps —
**prefer the most granular split the sheet offers**:

| Block pattern | Atomic steps |
|---|---|
| Chord front-load / chord shapes | **One step per numbered drill** under each lettered subsection (e.g. A1 Isolate, A2 Neighbor changes, A3 Fret-2 flash — not all of A at once). If a subsection has no numbered list, that subsection is one step. Letter labels (A/B/C) are groups only. |
| Priority drill table | **One step per table row** (song) |
| Break | One step |
| Ordered set slice table | **One step per song row** |
| Worst-fail replay | One step (three fields) |
| Cool-down | One step |
| Session log | One step (multi-prompt ok: energy first, then text fields) |

**Example** from a typical chord front-load:

- A1 Isolate → A2 Neighbor changes → A3 Fret-2 flash → B1 Root walk → B2 Song-ish bursts → C1 I–IV–V → C2 Voodoo colors → D Song flash

Shape **tables** above a drill list are shared context: include the relevant rows in that drill’s Instruct message (full table for Isolate; only the chords named in the cycle list for Neighbor changes). Do **not** make the table its own step.

### Resume detection

A step is **incomplete** when its write-target is still blank:

- Chord drill: no notes bullet starting with that drill’s label (e.g. `- Isolate:`, `- Neighbor changes:`, `- Root walk:`)
- Slice/`Done?` empty
- Comfort / shape rating empty when that step required one
- Notes line is only `-` or whitespace (and no drill bullets yet for chord blocks)
- Worst-fail Song/What failed still empty
- Session log fields empty

Skip steps already filled unless the user says "redo \<step\>".

### Desk-board pass queue (only when asked)

Trigger phrases: "desk board", "desk coach", "fake fretboard", "meeting practice".

1. Find `## Desk board` on the sheet. If absent, coach from the standing micro-blocks
   below and offer to paste the appendix onto today’s sheet.
2. Atomic steps = each **Micro-block** (Isolate / Neighbor / Power walk / Blues 7ths),
   one at a time — same granularity rule as guitar chord drills.
3. Optional: if they want “today’s rotation only,” run just that day’s focus from the
   Weekly rotation table (still one micro-block at a time if the focus lists several).
4. Write only under **Desk log**. Never touch Timed plan Done?/comfort fields.

Standing micro-blocks (5-fret silent board): Isolate fret-2 + F/Bb + barre families;
Neighbor changes; Power root walk frets 1–5 (Thunderstruck E5–B5 / F#5 OK; Pretender
bridge A5 only — not the old A5–F5–C5–G5 wall); Blues 7ths E7 A7 B7 D7 C7. Skip full
D#m @6 on desk — say so once, then move on.

## How to ask (input modes)

Always accept **type** or **speak** (voice → text). Prefer buttons for closed sets:

1. If **AskQuestion** (or equivalent choice UI) is available → use it with the
   choice labels below.
2. Otherwise end the instruct message with a clear list:

```
Reply with a number, or say/type it:
1) shaky
2) usable
3) automatic
```

Comfort:

```
Comfort now?
1  2  3  4  5
```

Yes/no:

```
1) done — next
2) skip
3) need more time (stay)
```

Keep choice labels stable so voice replies ("three", "usable", "skip") map cleanly.

## Prompt copy by step kind

### Chord drill (one numbered item)

**Instruct:** Only this drill’s time budget + instructions. Pull fretting from the
parent shape table as needed. Do not preview the next numbered drill.

**Collect** by drill type:

| Drill | Ask |
|---|---|
| **Isolate** (hold each shape) | Per-shape **shaky / usable / automatic** + optional note |
| **Neighbor / changes / cycles** | Done? + which changes still scramble (text) + optional per-chord rating for the ones that failed |
| **Flash / neighborhood / song flash** | Done? + overall **shaky / usable / automatic** + optional note |
| **Root walk / power bursts** | Done? + powers overall **shaky / usable / automatic** + optional note |
| **Blues / 7ths patterns** | Done? + 7ths overall **shaky / usable / automatic** + optional note |

**Write:** Append under the chord block’s notes, prefixed with the drill label:

```
- Isolate: B usable (high-E buzz), F#m shaky, F# usable, Bm usable, C#m shaky, G#m shaky, Dm automatic, D#m shaky, Bb usable
- Neighbor changes: C#m↔G#m and B→D#m still scramble
- Fret-2 flash: usable
```

Update "still foreign" / chord-report checklists when they give shape ratings (usually
on Isolate; refine later if Neighbor/Flash contradicts).

### Priority song row

**Instruct:** `Min` + song title + `#N` + drill text from the table.

**Collect:**

- Done? `done` / `skip` / `more time`
- Optional comfort 1–5
- Free note: "Anything break? Timing, fretting, memory?"

**Write:** Bullet under "Notes while practicing", prefixed with song name if multiple
songs share one notes section:

```
- Darkness (#4): measure ends better at 80bpm; still rushes into chorus — comfort 3
```

### Break

**Instruct:** Stretch / water / retune reminder from the sheet.

**Collect:** `ready` / `more time` only.

**Write:** Only if they mention tuning or something to remember (`Drop D later? Yes — done`).

### Slice song row

**Instruct:** Song `#` + title + play depth rule (≥4 → V+C once; ≤3 → fuller) + any
retune / chord callout in the row.

**Collect (required unless skip):**

- Done? yes / skip
- Comfort 1–5
- First break / note (text; allow "clean" / "none")

**Write:** That table row's `Done?`, `Comfort now`, `First break / note` cells.
After the last slice song, if "Slice notes" is still blank, ask one optional wrap note.

### Worst-fail

**Instruct:** Remind them to name the **first** thing that broke in priority or slice.

**Collect:** three text fields (can be one spoken paragraph — parse into the three):

- Song
- What failed
- What I repeated

**Write:** those three lines.

### Cool-down

**Instruct:** Named cool-down song + any bonus (e.g. name G#m out loud).

**Collect:** free text for Felt (offer soft prompts: clean / rusty / tired / fun).

**Write:** `Felt:` line.

### Session log

Ask in this order (separate messages ok):

1. Energy / focus — buttons **1–5**
2. Biggest win — text/speak
3. Biggest frustration — text/speak
4. Comfort changes — text ("song old→new"); skip if none
5. Chord report — only shapes still blank; buttons shaky/usable/automatic
6. Must do next session — text/speak

**Write:** each field as they answer.

### Carry-forward

Agent writes 3–6 bullets from the filled sheet. Show them; ask `looks good?` before
treating close-out as final. Then offer baseline worksheet patches.

## Mapping spoken / loose replies

| They say | Treat as |
|---|---|
| "three", "3", "comfort three" | comfort **3** |
| "still bad", "can't grab it" | **shaky** |
| "ok", "good enough", "gigable-ish" | **usable** |
| "locked", "automatic", "muscle memory" | **automatic** |
| "next", "done", "finished" | done → write + advance |
| "skip", "pass" | skip → mark skipped + advance |
| "wait", "not yet", "one more minute" | stay on step |

If ambiguous, ask one clarifying choice — do not guess a rating.

## Worksheet write rules

- Edit the real `practice-sessions/YYYY-MM-DD.md` file each step (StrReplace/Write).
- Preserve plan tables and agent focus section; only fill user note fields.
- For `Done?` use `y` / `skipped` / leave blank until answered.
- Do not delete empty placeholder `-` lines elsewhere; replace the relevant blank.
- If a chord-report checklist exists at the bottom, keep it in sync with subsection ratings.
