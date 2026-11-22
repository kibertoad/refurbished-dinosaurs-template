# DOS-extender games: runtime access, the lift and inventories

The guide for `platform: dos-protected-mode`: a DOS game whose code is a
32-bit LE or LX image behind an MZ stub, started by DOS/4GW or another DPMI
host. The rules are in the work protocol's
[Runtime access](upstream/work-protocol.md#runtime-access) (lines 46-67),
[The lift](upstream/work-protocol.md#the-lift) (lines 550-612) and
[Creating and checking an inventory](upstream/work-protocol.md#creating-and-checking-an-inventory) (lines 668-678).

This page is a stub. No restoration has taken a game on this platform
through the Runtime access or Lift stages with this template, so it records
what is known, what a lift harness would have to do, and what nobody has
tried. The first project on this platform replaces those parts with what it
found, the way [the real-mode guide](DOS-REAL-MODE-RUNTIME-AND-LIFT.md) was
written from the first real-mode project.

## What is known

- **Runtime.** The runtime record's "How it runs" names rust-dos, started
  through `dinorefurb-dosbox-session`, with their versions, and the extender
  the game ships with its version (the MZ stub and the files beside the
  executable name it). Runs take the run lock the way
  [RUNTIME.md](RUNTIME.md) says. The real-mode guide's notes on the drive
  layout, the current directory and input concern DOS and the session, so
  they are a starting point here; check each against the game before relying
  on it.
- **Ghidra.** The executable is MZ with an LE or LX image behind it. Stock
  Ghidra imports the MZ stub and does not map the LE objects correctly, so
  its default disassembly of such a file is not evidence.
  [GHIDRA.md](GHIDRA.md#dos-extender-executables) describes the LE reader
  and Iced disassembly another restoration uses in place of Ghidra.
- **Addresses.** The documentation standard writes an LE or LX address as
  eight digits, with each object placed at the relocation base address its
  object table gives.
- **Evidence tools.** `tools/evidence/report.mjs inventory` refuses LE and LX
  files, and the pinned executable reader answers PE32 and MZ questions only
  ([EVIDENCE-TOOLS.md](EVIDENCE-TOOLS.md)). The protocol's emulator harness
  names loaders for MZ, NE and PE, so an LE or LX loader in `tools/emu/` is
  the project's own.
- **Lift harness.** Spice86 implements no protected mode, so it cannot be
  the harness here, and the template has none for this platform. Until a
  tooling batch builds one, both parts of the lift capability are `none` in
  `docs/RUNTIME.md`, and the plan's Lift stage says so.

## What a lift harness would have to provide

The protocol's
[Verifying a lifted function](upstream/work-protocol.md#verifying-a-lifted-function) (lines 580-592)
has the checker compare, case by case, each memory write, each read and
write of an I/O port with its width and value, each interrupt the code
raises, each call with its target and the state at the call, and the
registers and flags callers read at the return. For code running under a
DOS extender, the harness has to:

- load the LE or LX image with its objects at the addresses the build's
  notation uses, apply its fixups, and set up the flat 32-bit segments the
  extender gives the program, or record how its addresses map to the
  notation's;
- record port reads and writes with their width and value, since games on
  this platform still program the video card, the sound card and the timer
  directly;
- record each interrupt the code raises with the registers it passes and
  gets back: DOS calls through INT 21h as the extender passes them on, the
  DPMI services of INT 31h by function number, and BIOS and mouse services;
- for a DPMI call that runs a real-mode interrupt or procedure, compare the
  real-mode register structure in memory that the call reads and fills in,
  since that structure carries the arguments and the results;
- hook a function by its address, run the lifted one in its place, and run
  its callees as the original's code;
- record the state at each entry to and return from a chosen function during
  a whole-game run, for the `record` part.

## What nobody has tried

- Running a DOS-extender game through `dinorefurb-dosbox-session` and
  rust-dos for the capability check, with any extender.
- A lift generator or harness for LE or LX code, or a choice between existing
  tools for one.
- A function inventory of an LE or LX file: no reporter in the template
  writes one, and Ghidra's import is not usable as it stands.
- An LE or LX loader for emulated calls in `tools/emu/`.
