# 32-bit Windows games: runtime access, the lift and inventories

The guide for `platform: win32`: a game whose executable is a PE file. The
rules are in the work protocol's
[Runtime access](upstream/work-protocol.md#runtime-access) (lines 46-67),
[The lift](upstream/work-protocol.md#the-lift) (lines 550-612) and
[Creating and checking an inventory](upstream/work-protocol.md#creating-and-checking-an-inventory) (lines 668-678).

Running the game has a procedure; the lift does not. No restoration has
taken a PE game through the Lift stage with this template, so the lift part
of this page records what a harness would have to do and what nobody has
tried. The first project to do it replaces those parts with what it found.

## What is known

- **Runtime.** [WINDOWS-PROBES.md](WINDOWS-PROBES.md) is the procedure for
  running the game in rust-dos on an owner-supplied Windows 9x guest image:
  preparing and fingerprinting the guest, owning the emulator process, input,
  memory, breakpoints and checkpoints. The runtime record's "How it runs"
  names rust-dos, the session package and the guest, with their versions.
  The protocol also allows running natively, under Wine or in a virtual
  machine; [GHIDRA.md](GHIDRA.md#watching-the-original-run) points to a
  native debugger capture another restoration uses.
- **Ghidra.** Ghidra's PE loader imports the file. The documentation
  standard writes a PE address as the full virtual address at the header's
  image base.
- **Evidence tools.** `tools/evidence/report.mjs inventory` writes PE32
  inventories, and the pinned executable reader answers PE32 questions about
  imports, callers and function extents ([EVIDENCE-TOOLS.md](EVIDENCE-TOOLS.md)).
  PE32+ files are refused.
- **Emulated calls.** The protocol's emulator harness has a PE loader that
  fills each import address table slot with the stub for the import named
  there.
- **Lift harness.** Spice86 runs DOS programs and not Windows ones, and the
  template has no harness for PE code. Until a tooling batch builds one, both
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

- load the PE file at its image base, or record its relocation, and hook a
  function by its address, running the lifted one in its place and its
  callees as the original's code;
- record each call to an imported function by DLL and name or ordinal, with
  its arguments read under the function's calling convention, its results
  in the registers, and the memory it writes through pointer arguments;
- record calls into COM interfaces such as DirectDraw or DirectSound by
  interface and method, since those go through the object's method table
  and not through the import address table;
- record each window message delivered to the game's window procedures and
  other callbacks, such as timer and thread procedures, with the window
  handle, message, `wParam`, `lParam` and the value returned, since Windows
  calls those functions and a recorded case starts at such a call;
- record the state at each entry to and return from a chosen function during
  a whole-game run, for the `record` part.

## What nobody has tried

- A lift generator or harness for PE code, or a choice between existing tools
  for one.
- [WINDOWS-PROBES.md](WINDOWS-PROBES.md) on rust-dos 1.9.2: it was run on
  rust-dos 1.7.2, as that page says.
