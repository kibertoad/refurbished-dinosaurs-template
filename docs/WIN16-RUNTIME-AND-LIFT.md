# 16-bit Windows games: runtime access, the lift and inventories

The guide for `platform: win16`: a game whose executable is an NE file for
Windows 3.x, run on Windows 3.x or 9x. The rules are in the work protocol's
[Runtime access](upstream/work-protocol.md#runtime-access) (lines 46-67),
[The lift](upstream/work-protocol.md#the-lift) (lines 550-612) and
[Creating and checking an inventory](upstream/work-protocol.md#creating-and-checking-an-inventory) (lines 668-678).

This page is a stub. No restoration has taken an NE game through the Runtime
access or Lift stages with this template, so it records what is known, what
a lift harness would have to do, and what nobody has tried. The first project
on this platform replaces those parts with what it found.

## What is known

- **Runtime.** The runtime record's "How it runs" names rust-dos booting an
  owner-supplied Windows guest image, with the rust-dos and guest versions.
  [WINDOWS-PROBES.md](WINDOWS-PROBES.md) is the procedure for preparing and
  probing a Windows 9x guest in rust-dos. It was validated with a PE game on
  Windows 95 and has not been run with an NE game or a Windows 3.x guest.
- **Ghidra.** Ghidra's NE loader imports the file. The documentation
  standard writes an NE address as `segment:offset` with the segment number
  from the segment table; where Ghidra shows a selector of its own, a
  finding's How to reproduce gives Ghidra's address as well.
- **Imports.** A far call to an imported function is stored with a
  placeholder operand, and the segment's relocation records name the module
  and ordinal or name. The standard's STATUS-44 says how an NE import report
  walks those chains, and the protocol's emulator harness has its NE loader
  write a stub at each site the same way.
- **Evidence tools.** `tools/evidence/report.mjs inventory` and the pinned
  executable reader refuse NE files ([EVIDENCE-TOOLS.md](EVIDENCE-TOOLS.md)),
  so an NE inventory needs another route.
- **Lift harness.** Spice86 runs DOS programs and not Windows ones, and the
  template has no harness for NE code. Until a tooling batch builds one, both
  parts of the lift capability are `none` in `docs/RUNTIME.md`, and the
  plan's Lift stage says so.

## What a lift harness would have to provide

The protocol's
[Verifying a lifted function](upstream/work-protocol.md#verifying-a-lifted-function) (lines 580-592)
has the checker compare, case by case, each memory write, each read and
write of an I/O port, each interrupt the code raises, each call with its
target and the state at the call, and the registers and flags callers read
at the return. For Windows code most of what a function does outside its own
memory goes through imported functions and window messages, so the harness
has to:

- load the NE file, apply its relocation chains, and hook a function by
  `segment:offset`, running the lifted one in its place and its callees as
  the original's code;
- record each call to an imported function by module and ordinal or name,
  with its arguments read from the stack under the exporting module's
  calling convention, its results in the registers, and the memory it writes
  through pointer arguments;
- record each window message delivered to the game's window procedures and
  other callbacks, with the window handle, message, `wParam`, `lParam` and
  the value returned, since Windows calls those functions and a recorded
  case starts at such a call;
- record port accesses and interrupts where the code still makes them, such
  as DOS calls;
- record the state at each entry to and return from a chosen function during
  a whole-game run, for the `record` part.

## What nobody has tried

- Running an NE game in rust-dos, on a Windows 3.x or a Windows 9x guest.
- A lift generator or harness for NE code, or a choice between existing tools
  for one.
- A function inventory of an NE file with the template's tools.
- An NE loader for emulated calls in `tools/emu/`.
