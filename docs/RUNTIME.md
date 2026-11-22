# Runtime access

What can be done with the original game running, and who can do it. The
`runtime-access` skill fills this in during the Runtime access stage; see the
[work protocol](upstream/work-protocol.md#runtime-access) (lines 46-67). This
file says what is true now: replace an answer when a tool, emulator or machine
changes it. Findings from runs go in `spec/`, never here.

For owner-supplied Windows/DOSBox images, follow
[WINDOWS-PROBES.md](WINDOWS-PROBES.md): patch and fingerprint an isolated copy,
version the actual probe/configuration scripts, validate the real guest/game
and each capability, and document retained paths and exact commands here.
When authorized setup/capability validation passes, record the owner's standing
probe scope; work within it without repeated permission requests. Keep current
checkpoints and unresolved evidence; clean consumed intermediates under
[ANALYSIS-OUTPUTS.md](ANALYSIS-OUTPUTS.md).

Static analysis is the main source of evidence. Runs are the last resort, and
every run of the original, including the checks behind this file, holds the
machine's run lock: rust-dos's lock in the folder that `RUST_DOS_RUN_LOCK_DIR`
names, `C:\ProgramData\refurbished-dinosaurs\run-lock` on Windows. The owner
sets the variable to that folder for every account on the machine, creates the
folder once and lets every user change files in it
(`icacls C:\ProgramData\refurbished-dinosaurs\run-lock /grant "*S-1-5-32-545:(OI)(CI)M" /T`).
A run with no window takes the lock shared: a `dinorefurb-dosbox-session`
session by default, a plain rust-dos run started with `--run-lock` on the
folder and `--run-lock-wait 5`, and a run in another emulator through
`rust-dos lock shared --wait 5 -- <probe>`. A run that uses the desktop and
every timing measurement take it exclusive through
`rust-dos lock exclusive --wait 5 -- <probe>`. See the protocol's
[Running the original](upstream/work-protocol.md#running-the-original) (lines 474-510).

## BLD-_alias_

How it runs: _natively, under Wine, in DOSBox-X or another emulator, or in a
virtual machine, with versions._

Emulator harness: _the Unicorn version, whether `tools/emu/` loads this build,
and the stubs it has, including any port models and video memory mapped as
RAM, and the limits of what they test._ Emulated calls are always allowed, so the emulator harness row is
`agent` wherever the harness loads the build, whoever may run the game, and
`none` only until a tooling batch builds the harness.

Lift harness: _the generator and harness (Spice86 for real-mode DOS programs,
or the project's own emulator), their versions and revisions, whether they
load this build, and what they cannot translate, such as protected mode, the
FPU or code the program writes while it runs._ The lift capability has the
parts `record` and `replace`. Its runs are runs of the game: one with no
window, input only from its script and no device of the machine takes no run
lock, and where a person has to give input, `record` is `person`. Until a
tooling batch builds the harness both parts are `none`, and the Lift stage in
the plan says so ([The lift](upstream/work-protocol.md#the-lift) (lines 550-610)).

| Capability | Who | Tried | What would change it |
|---|---|---|---|
| Start it and bring it to a given state without a person | _agent, person or none_ | _tool, version, what happened_ | _for person or none_ |
| Send it input | | | |
| Read memory, set breakpoints, dump structures while it runs | | | |
| Load a patched save | | | |
| Capture frames and sound | | | |
| Play back a recording the original made | | | |
| Call a single function in the emulator harness (no run lock) | | | |
| Lift harness: `record` the state at each entry to and return from a chosen function during a whole-game run, and `replace` a function with its lifted one | _record: ..., replace: ..._ | | |

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
protocol's [Recorded runs](upstream/work-protocol.md#recorded-runs) (lines 486-498).

_Repeat the section for each build that will be run._
