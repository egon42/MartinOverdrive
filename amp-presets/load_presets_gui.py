#!/usr/bin/env python3
"""Dead-simple desktop UI for load_presets.py.

A tiny Tkinter window (Python stdlib -- no extra install beyond `pip install
hidapi`) that wraps the verified command-line loader: detect the amp, run the
packet self-test, and write presets, with a live log. It calls straight into
load_presets.py, so the wire protocol is exactly the reviewed one.

    python load_presets_gui.py

(or double-click mustang-loader.bat)
"""

import contextlib
import queue
import threading

import tkinter as tk
from tkinter import messagebox, scrolledtext, ttk

import load_presets as lp

ALL_SLOTS = list(range(len(lp.PRESETS)))


class _QueueWriter:
    """File-like object; forwards captured stdout to the UI queue."""

    def __init__(self, q):
        self.q = q

    def write(self, s):
        if s:
            self.q.put(("log", s))

    def flush(self):
        pass


class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Mustang Preset Loader")
        self.minsize(560, 460)
        self.q = queue.Queue()
        self.busy = False
        self.buttons = []
        self._build()
        self.after(80, self._poll)

    # --- layout ---------------------------------------------------------------
    def _build(self):
        pad = {"padx": 8, "pady": 4}
        root = ttk.Frame(self, padding=10)
        root.pack(fill="both", expand=True)

        ttk.Label(
            root,
            text="Load the Martin Overdrive presets onto the Fender Mustang.",
            font=("Segoe UI", 11, "bold"),
        ).pack(anchor="w")
        ttk.Label(
            root,
            text="Amp powered ON and USB connected. Start with Detect, "
                 "then Self-test, then Write.",
            foreground="#555",
        ).pack(anchor="w", pady=(0, 8))

        # check row
        checks = ttk.Frame(root)
        checks.pack(fill="x")
        self._btn(checks, "1.  Detect amp", self.act_detect).pack(
            side="left", **pad)
        self._btn(checks, "2.  Self-test (no amp)", self.act_selftest).pack(
            side="left", **pad)

        ttk.Separator(root, orient="horizontal").pack(fill="x", pady=8)

        # write-all row
        ttk.Label(root, text="Write to amp (overwrites preset slots):").pack(
            anchor="w")
        self._btn(root, "3.  Write ALL 24 presets", self.act_load_all).pack(
            anchor="w", pady=6)

        # subset row
        sub = ttk.Frame(root)
        sub.pack(fill="x", pady=2)
        ttk.Label(sub, text="…or just a subset (e.g. 9-16 or 9,17-18):").pack(
            side="left")
        self.subset_var = tk.StringVar()
        ttk.Entry(sub, textvariable=self.subset_var, width=14).pack(
            side="left", padx=6)
        self._btn(sub, "Write subset", self.act_load_subset).pack(side="left")
        self._btn(sub, "Preview", self.act_preview).pack(side="left", padx=6)

        # options
        opts = ttk.Frame(root)
        opts.pack(fill="x", pady=(6, 0))
        self.alt_init = tk.BooleanVar(value=False)
        ttk.Checkbutton(
            opts,
            text="Use alternate init byte (0x03) — try this only if writes fail",
            variable=self.alt_init,
        ).pack(anchor="w")

        # log
        ttk.Label(root, text="Log:").pack(anchor="w", pady=(8, 0))
        self.log = scrolledtext.ScrolledText(
            root, height=14, wrap="word", state="disabled",
            font=("Consolas", 9))
        self.log.pack(fill="both", expand=True)

        self.status = ttk.Label(root, text="Ready.", foreground="#555")
        self.status.pack(anchor="w", pady=(6, 0))

    def _btn(self, parent, text, cmd):
        b = ttk.Button(parent, text=text, command=cmd)
        self.buttons.append(b)
        return b

    # --- helpers --------------------------------------------------------------
    def _init1(self):
        return 0x03 if self.alt_init.get() else 0xc1

    def _append(self, text):
        self.log.configure(state="normal")
        self.log.insert("end", text)
        self.log.see("end")
        self.log.configure(state="disabled")

    def _set_busy(self, busy):
        self.busy = busy
        for b in self.buttons:
            b.configure(state="disabled" if busy else "normal")
        self.status.configure(text="Working…" if busy else "Ready.")

    def _run(self, fn, confirm=None, banner=None):
        if self.busy:
            return
        if confirm and not messagebox.askyesno("Confirm", confirm):
            return
        self._set_busy(True)
        if banner:
            self._append("\n=== %s ===\n" % banner)

        def worker():
            try:
                with contextlib.redirect_stdout(_QueueWriter(self.q)):
                    fn()
            except SystemExit as e:  # loader uses SystemExit for user errors
                msg = str(e or "")
                if msg and msg not in ("0", "1"):
                    self.q.put(("log", msg + "\n"))
            except Exception as e:  # noqa: BLE001 - surface anything to the log
                self.q.put(("log", "ERROR: %r\n" % (e,)))
            finally:
                self.q.put(("done", None))

        threading.Thread(target=worker, daemon=True).start()

    def _poll(self):
        try:
            while True:
                kind, payload = self.q.get_nowait()
                if kind == "log":
                    self._append(payload)
                elif kind == "done":
                    self._set_busy(False)
        except queue.Empty:
            pass
        self.after(80, self._poll)

    def _selection(self):
        """Parsed subset, or None (with a dialog) if the text is invalid."""
        text = self.subset_var.get().strip()
        if not text:
            return None
        try:
            return lp.parse_selection(text)
        except SystemExit as e:
            messagebox.showerror("Bad subset", str(e))
            return "error"

    # --- actions --------------------------------------------------------------
    def act_detect(self):
        self._run(lp.list_devices, banner="Detect amp")

    def act_selftest(self):
        self._run(lambda: lp.self_test(ALL_SLOTS), banner="Self-test")

    def act_load_all(self):
        self._run(
            lambda: lp.write_presets(ALL_SLOTS, self._init1(), 1000),
            confirm="This overwrites ALL 24 preset slots on the amp.\n\n"
                    "Your .fuse files are the backup. Continue?",
            banner="Write ALL 24 presets",
        )

    def act_load_subset(self):
        slots = self._selection()
        if slots == "error":
            return
        if not slots:
            messagebox.showinfo("Subset", "Enter preset numbers first, "
                                           "e.g. 9-16.")
            return
        pretty = ", ".join("#%d" % (s + 1) for s in slots)
        self._run(
            lambda: lp.write_presets(slots, self._init1(), 1000),
            confirm="Overwrite these slots on the amp?\n\n" + pretty,
            banner="Write subset: " + pretty,
        )

    def act_preview(self):
        slots = self._selection()
        if slots == "error":
            return
        if not slots:
            slots = [0]  # default to preset #1 so we don't dump all 24
        self._run(lambda: lp.dry_run(slots, self._init1()),
                  banner="Preview packets (no amp)")


def main():
    App().mainloop()


if __name__ == "__main__":
    main()
