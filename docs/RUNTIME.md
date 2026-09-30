# Runtime access

What can be done with the original game running, and who can do it. The
`runtime-access` skill fills this in during the Runtime access stage; see the
[work protocol](upstream/work-protocol.md#runtime-access) (lines 42-60). This
file says what is true now: replace an answer when a tool, emulator or machine
changes it. Findings from runs go in `spec/`, never here.

Static analysis is the main source of evidence. Runs are the last resort, and
every run of the original, including the checks behind this file, holds the
machine's run lock: `C:\ProgramData\refurbished-dinosaurs\run.lock` on
Windows and `/var/tmp/refurbished-dinosaurs/run.lock` elsewhere, or the path in
`REFURBISHED_DINOSAURS_RUN_LOCK` where the owner set one. See the protocol's
[Running the original](upstream/work-protocol.md#running-the-original) (lines 217-251).

## BLD-_alias_

How it runs: _natively, under Wine, in DOSBox-X or another emulator, or in a
virtual machine, with versions._

Emulator harness: _the Unicorn version, whether `tools/emu/` loads this build,
and the stubs it has, including any port models and video memory mapped as
RAM, and the limits of what they test._ Emulated calls are always allowed, so the last row is
`agent` wherever the harness loads the build, whoever may run the game, and
`none` only until a tooling batch builds the harness.

| Capability | Who | Tried | What would change it |
|---|---|---|---|
| Start it and bring it to a given state without a person | _agent, person or none_ | _tool, version, what happened_ | _for person or none_ |
| Send it input | | | |
| Read memory, set breakpoints, dump structures while it runs | | | |
| Load a patched save | | | |
| Capture frames and sound | | | |
| Play back a recording the original made | | | |
| Call a single function in the emulator harness (no run lock) | | | |

Probe: _where the agent can start the build without a person, read its
memory and set breakpoints, the probe's command line and anything the run
sets for the child process alone, such as a copy of the executable outside
the installation's compatibility settings. Otherwise `none`._ See the
protocol's [Recorded runs](upstream/work-protocol.md#recorded-runs) (lines 227-239).

_Repeat the section for each build that will be run._
