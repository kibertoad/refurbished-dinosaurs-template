# Runtime access

What can be done with the original game running, and who can do it. The
`runtime-access` skill fills this in during the Runtime access stage; see the
[work protocol](https://dinorefurb.com/work-protocol/#runtime-access). This
file says what is true now: replace an answer when a tool, emulator or machine
changes it. Findings from runs go in `spec/`, never here.

Static analysis is the main source of evidence. Runs are the last resort, and
every run of the original, including the checks behind this file, holds the
machine's run lock: `C:\ProgramData\refurbished-dinosaurs\run.lock` on
Windows and `/var/tmp/refurbished-dinosaurs/run.lock` elsewhere, or the path in
`REFURBISHED_DINOSAURS_RUN_LOCK` where the owner set one. See the protocol's
[Running the original](https://dinorefurb.com/work-protocol/#running-the-original).

## BLD-_alias_

How it runs: _natively, under Wine, in DOSBox-X or another emulator, or in a
virtual machine, with versions._

Runtime tool: _the text-in, text-out tool that works with it, or none yet._

| Capability | Who | Tried | What would change it |
|---|---|---|---|
| Start it and bring it to a given state without a person | _agent, person or none_ | _tool, version, what happened_ | _for person or none_ |
| Send it input | | | |
| Read memory, set breakpoints, dump structures while it runs | | | |
| Load a patched save | | | |
| Capture frames and sound | | | |
| Play back a recording the original made | | | |

_Repeat the section for each build that will be run._
