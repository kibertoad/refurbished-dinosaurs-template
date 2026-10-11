# Runtime access

What can be done with the original game running, and who can do it. The
`runtime-access` skill fills this in during the Runtime access stage; see the
[work protocol](upstream/work-protocol.md#runtime-access) (lines 42-62). This
file says what is true now: replace an answer when a tool, emulator or machine
changes it. Findings from runs go in `spec/`, never here.

Static analysis is the main source of evidence. Runs are the last resort, and
every run of the original, including the checks behind this file, holds the
machine's run lock: `C:\ProgramData\refurbished-dinosaurs\run.lock` on
Windows and `/var/tmp/refurbished-dinosaurs/run.lock` elsewhere, or the path in
`REFURBISHED_DINOSAURS_RUN_LOCK` where the owner set one. See the protocol's
[Running the original](upstream/work-protocol.md#running-the-original) (lines 391-425).

## BLD-_alias_

How it runs: _natively, under Wine, in DOSBox-X or another emulator, or in a
virtual machine, with versions._

Emulator harness: _the Unicorn version, whether `tools/emu/` loads this build,
and the stubs it has, including any port models and video memory mapped as
RAM, and the limits of what they test._ Emulated calls are always allowed, so the emulator harness row is
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

Several capabilities name more than one thing, and the parts can get
different answers. The parts of a capability are the ones the game has: for
input, each device the game reads, and for capture, sound only if the game
makes any; memory reads, breakpoints and dumps are parts too. One answer in
a row stands for every one of those parts, so write it only when every part
was tried and got that answer. Where the parts
differ, the row gives way to one row per part under the capability, and each
names the attempt it comes from. For input, `person` means a person has to
give that input: the agent sends none to a game a person runs, so the run
becomes a live session in which the maintainer plays. For example, a game
that reads the keyboard and the mouse and makes sound could replace its
input and capture rows in the table above with these:

| Capability | Who | Tried | What would change it |
|---|---|---|---|
| Send it input: keyboard | _agent_ | _tool, version, what happened_ | |
| Send it input: mouse | _person_ | _tool, version, what happened_ | _what would make it agent_ |
| Capture frames and sound: frames | _agent_ | _tool, version, what happened_ | |
| Capture frames and sound: sound | _none_ | _tool, version, what happened_ | _what would make it agent or person_ |

A run uses the answer of each part it needs: it cannot be made if any of
those parts is `none`, it is a live session if any is `person`, and it is an
agent run only if every one is `agent`. An item that needs only the keyboard
can be an agent run in a game whose mouse needs a person, and its
experiment's Setup says it used only the keyboard. Where a capability is
split, each `Agent run` and `Live session` item in `queue/` says in its
`Settles it:` text which of these parts its run needs.

Probe: _where the agent can start the build without a person, read its
memory and set breakpoints, the probe's command line and anything the run
sets for the child process alone, such as a copy of the executable outside
the installation's compatibility settings. Otherwise `none`._ See the
protocol's [Recorded runs](upstream/work-protocol.md#recorded-runs) (lines 401-413).

_Repeat the section for each build that will be run._
