# Real-mode DOS games: runtime access, the lift and inventories

How to run a 16-bit real-mode DOS game for the Runtime access and Lift
stages, and how to get its function inventories right. The rules are in the
work protocol's [Runtime access](upstream/work-protocol.md#runtime-access) (lines 46-67),
[The lift](upstream/work-protocol.md#the-lift) (lines 548-608) and
[Creating and checking an inventory](upstream/work-protocol.md#creating-and-checking-an-inventory) (lines 664-672);
this page covers the tools. It was written from the first restoration that
went through these stages with rust-dos 1.9.2, `dinorefurb-dosbox-session`
1.1.0, Spice86 built from master and Ghidra 12.2. Record the versions the
project actually uses in `docs/RUNTIME.md` and `docs/GHIDRA.md`, and check
each step below against them.

Examples use `GAME.EXE`, a configuration file `GAME.CFG` and an install
directory `c:\game\`. Put the game's real names in the project's own
documents, never here.

## Running the game in rust-dos

`dinorefurb-dosbox-session` starts rust-dos with its debug server, mounts the
media, and runs the target from the DOS prompt, stopped at its entry. Version
the capability check as a script in `tools/runtime/` (for example
`tools/runtime/check_capabilities.py`) and give its command line in
`docs/RUNTIME.md`, so the check can be run again when rust-dos or the session
changes.

### Drives, the current directory and hard-coded paths

The session runs the target from the C: prompt, with C: as the current drive
and its root as the current directory. It has no setting for another starting
drive or directory. Many DOS games open their data relative to the current
directory and their configuration and saves at a fixed path such as
`c:\game\GAME.CFG`, and stop with an install error when either is missing.

1. Read the executable's strings for drive-qualified paths (`c:\...`) and for
   relative paths of data files.
2. Find the directory layout the installer makes: the installer's own script,
   the launch scripts of a preservation collection, or an installation the
   owner already has.
3. Recreate that layout on the run's C: in the session's `prepare_drive`
   callback, which gets the new, empty C: directory before the emulator
   starts. Copy the configuration the run needs (the sound card choice, for
   example) to the path the game reads it from.
4. Where the game reads its data from the current directory, copy the disc's
   data folders onto C: as well, even when the target itself starts from the
   CD-ROM drive. Leave out folders the game never reads, such as manuals.

The run's C: is a copy in the run directory, so the installation and the disc
stay read-only. A starting drive and directory for the target would remove the
copy; ask for it as a session feature if a game needs it.

### Input

Mouse events go to `/api/input/mouse` (the session's `send_input("mouse",
event)`):

```json
{"action": "click", "x": 320, "y": 330, "hold_ms": 300}
```

`x` and `y` are screenshot pixels. In VGA mode 13h the screenshot is 640x400
and the DOS mouse driver works in a 640x200 virtual screen, so the game sees
`x` unchanged and half of `y`. Give clicks a hold of about 300 ms: a game that
polls INT 33h function 3 sees only the state at each poll, and with the default
hold (50 ms in rust-dos 1.9.2) the press and the release can both fall between
two polls, so the click is lost.

To find out which input a game reads, read the handler's address from the
interrupt vector table (INT 33h at `0000:00CC`, INT 16h at `0000:0058`, INT 09h
at `0000:0024`), set a one-time breakpoint there, let the game run on the
screen that waits for input, and see whether it stops. A stop with AX 0003 on
the INT 33h handler shows a game polling the mouse. A handler that is never
reached is a device the game does not read on that screen, and the
capability's parts follow from that.

### Frames and sound

`/api/screenshot` returns a PNG of the current frame. The text screen endpoint
answers 409 in graphics modes, so use the screenshot there.

Sound comes from the WebSocket `/ws/audio`: the first message is a JSON text
frame with the format, and the binary frames after it are s16le stereo PCM at
44.1 kHz. A minimal client (an HTTP upgrade request and a frame reader, about
fifty lines of Python with `socket` and `struct`) is enough; no WebSocket
library is needed. `/api/status` gives `audio.peak`, the largest sample since the previous
status request, which tells silence from sound without recording. Keep the recording in
`GAME_DIR/captures/` and write only the format, the byte count and the peak in
`docs/RUNTIME.md`.

## Spice86 as the lift harness

[Spice86](https://github.com/OpenRakis/Spice86) runs a real-mode DOS program,
records the functions and the control flow it executed, writes C# for them,
and runs the program again with that C# in place of the original's code.

### Build and pin it

Build Spice86 from upstream master and record the revision in
`docs/RUNTIME.md`. The 16.1.0 release, and the NuGet package of the same
version, do not route mouse events sent through the MCP server to the DOS
mouse driver; master has the fix (commit `b351cbe6`). Take a later release
only after checking that it contains every fix the game needs.

The generated project references the Spice86 NuGet package. Replace that
`PackageReference` with a `ProjectReference` to the same local build that
recorded the run. Otherwise the record run and the replace run use different
emulators, and a difference between them says nothing about the lifted code.

### Start and drive it

Spice86 has no CD-ROM image support in this setup. Give it a C: folder with
the executable and the data it reads, laid out the way the game expects (see
[Drives, the current directory and hard-coded paths](#drives-the-current-directory-and-hard-coded-paths)):

```sh
Spice86.exe -e <work>/c/GAME.EXE -c <work>/c -r <work>/dump \
  --HeadlessMode Minimal -g 11000 --McpHttpPort 8081
```

Start it with its working directory set to a new work directory outside the
repository. Spice86 writes `logs/` in its current directory, and those logs
hold local paths, so a run started from the repository leaves files that are
easy to commit by mistake.

The command line option for the MCP port is `--McpHttpPort`; the README and
`doc/mcp.md` call it `--mcp-http-port`, and Spice86 silently ignores options
it does not know, so the documented spelling leaves the server on its default
port. OpenRakis/Spice86#2527 fixes the documents and rejects unknown options;
check whether it has merged before relying on either behaviour.

The MCP server takes JSON-RPC `tools/call` requests on
`http://127.0.0.1:<port>/mcp`. The tools a check needs:

| Tool | Use |
|---|---|
| `read_video_state` | poll it until the server answers, to know the program has started |
| `send_keyboard_key` | `key` is a `PcKeyboardKey` name (`D2` for the 2 key, `Enter`, `Escape`), with `isPressed` true and then false as two calls |
| `send_mouse_move` | `x` and `y` normalized to 0..1 of the screen |
| `send_mouse_button` | `button` `Left`, with `isPressed` true and then false, a few hundred milliseconds apart |
| `screenshot` | returns the path of a PNG it wrote; copy it to `GAME_DIR/captures/` |
| `list_functions` | the functions seen so far, with whether each has an override |

Wait on a state the script can read where one exists, such as a function
being reached or a value in memory. Fixed sleeps are acceptable only in the
capability check, which proves the harness runs at all.

### Dumping the recording

The GDB server's `monitor dumpall` writes the execution flow, the control flow
graph and the generated C# project. Send it as a single `qRcmd` packet
(`$qRcmd,<hex of "dumpall">#<checksum>`), read the reply packet, and
acknowledge it with `+`. Spice86's GDB server does not answer the
`qSupported` packet a GDB client sends first, so a stock client hangs; a
plain socket and the one packet work. OpenRakis/Spice86#2528 adds an MCP
`dump_all` tool, which removes the need for the GDB server once it merges.

The dump goes to a subfolder of the `-r` directory named by the program's
SHA-256 in upper case, and the generated C# project is `GeneratedProject/`
inside it. All of it is the game's code in another language: it stays in
`GAME_DIR/lift/` and is never committed.

### What the generated code covers

Spice86 generates code only for the paths the recording run executed. Every
other path in a generated function throws `FailAsUntested`, so a path no run
reached fails loudly the first time a replace run takes it. Plan recording runs
to reach the code each slice needs before that code is lifted: a run that
stops at the title screen gives functions that fail as soon as play begins.

### What the generated code looks like

These details decide how the checker the protocol describes can be built:

- The generated functions are `virtual` methods of a `partial` class
  (`CfgGeneratedOverrides`), one file per code segment or part of one, each
  named by segment, offset and linear address.
- Calls go through `NearCall` and `FarCall` with the callee's C# delegate.
  To check one function alone, with its callees running as the original's
  code, subclass the generated class and redirect each callee to the
  emulated original.
- Where the generator knows a DOS function number, it emits a direct call
  into Spice86's DOS model (for example `Dos.ReadDosVersion()`), which never
  goes through the interrupt vector table. Other interrupts stay as
  `InterruptCall` calls that pass the instruction's offset and the interrupt
  number. A checker that compares the
  interrupts each side raises hooks at both levels: the vector on the
  original's side, and the DOS model's methods on the lifted side.

### A replace run is a smoke test

Running the generated executable with every generated function in place and
reaching the same screen as the record run shows that the harness, the
generator and the build work together. It verifies no function, and it is
enough for the `replace` part of the lift capability and nothing more. A
function becomes `verified` only through the case-by-case comparison with
branch coverage in [Verifying a lifted function](upstream/work-protocol.md#verifying-a-lifted-function) (lines 576-588).
Say this plainly in `docs/RUNTIME.md` and the plan; a replace run that
"works" is easy to report as more than it is.

## Ghidra for real-mode MZ inventories

### The real-mode CS fix

Stock Ghidra 12.2 computes CS in real mode from the instruction's address
instead of tracking the value the code loaded. After a far call into another
segment, disassembly continues in the wrong segment, and analysis logs
"could not follow disassembly flow into non-existing memory". Each such
warning is a function body that is missing or wrong. Look for the warning in
the import log of every MZ file before exporting an inventory.

The fix is [ghidra#9703](https://github.com/NationalSecurityAgency/ghidra/pull/9703),
which has not merged. It can be applied to a release without building Ghidra:

1. Copy the release to a directory of its own (for example
   `C:\tools\ghidra_12.2_csfix`), so the stock release stays as it was.
2. Apply the PR's diff to `Ghidra/Processors/x86/data/languages/ia.sinc` and
   `Ghidra/Processors/x86/data/languages/x86-16-real.pspec`. Apply the diff
   rather than copying the PR's files: the release's `ia.sinc` differs from the
   PR's base.
3. Compile the x86 languages again:
   `support\sleigh.bat -a Ghidra\Processors\x86\data\languages`.
4. Compile the PR's `SymbolicPropogator.java` with `javac --release 21`
   against the release's jars, writing the classes to `Ghidra/patch`, which
   Ghidra puts ahead of its own jars.
5. Import the executable again with the default analysis, and check that the
   log has no flow warnings.

Record the copy, the PR revision and the steps in `docs/GHIDRA.md`, and name
the fix in the inventory's snapshot label. When a release includes the fix,
move to it and export the inventories again. Building Ghidra from source on
Windows failed in `:SoftwareModeling:generateGrammarSource` with an illegal
`*` in a path, which is why the patch route is the one described here.

### Exporting

Export each inventory twice from the same database and compare the two files
byte for byte, as the protocol asks. Opened read-only with automatic analysis
off, the two exports of the first restoration that did this were identical. `docs/GHIDRA.md` covers the headless
command line and its Windows quoting limits.
