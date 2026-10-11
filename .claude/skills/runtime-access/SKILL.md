---
name: runtime-access
description: Find out and record in docs/RUNTIME.md what can be done with the original game running, and who can do it - start it, send input, read memory, load a patched save, capture frames and sound, play back recordings. Use in the Runtime access stage, and whenever a tool, emulator or machine may have changed an answer.
---

# Runtime access

The rules are in the [work protocol](../../../docs/upstream/work-protocol.md#runtime-access) (lines 42-62).
Open a linked section only when a step leaves a question it answers, read
only the lines the link gives, and never a section already read this session.
Many games cannot be controlled by an agent at all. Static reading is the main
source of evidence for every game; this check only finds out what runs are
possible, and it is the one time the original is run before the static work
is done.

1. **Take the run lock** as the protocol's
   [Running the original](../../../docs/upstream/work-protocol.md#running-the-original) (lines 391-425)
   says: create the lock file at the path `docs/RUNTIME.md` gives, with an
   exclusive create that fails if it exists (`[IO.File]::Open($path,
   'CreateNew')` in PowerShell), naming this repository, the session and the
   time, and add the ID of each process you start to it. If it already
   exists, do not wait: do static work and try again in a later session.
2. **For each build that will be run**, record how it runs (natively, under
   Wine, in DOSBox-X or another emulator, in a virtual machine), then try each
   capability and answer it `agent`, `person` (only while a person runs the
   game; for input, see below) or `none`:
   - start the original and bring it to a given state without a person;
   - send it input;
   - read its memory, set breakpoints and dump structures while it runs;
   - load a patched save;
   - capture frames and sound;
   - play back a recording the original made;
   - call a single function of the executable in the emulator harness in
     `tools/emu/` (this starts no process of the game and needs no lock).
     Emulated calls are always allowed, so the answer is `agent` wherever
     the harness loads the build, even where no agent may run the game, and
     `none` only while the harness does not exist yet.

   Try each part of a capability that names several things. The parts are
   the ones the game has: for input, each device the game reads, and for
   capture, sound only if the game makes any; memory reads, breakpoints
   and dumps are parts too. One answer stands for every one of those
   parts, so give one only when every part was tried and got that answer.
   Where the parts differ, answer each part on its own under the
   capability (`keyboard: agent`, `mouse: person`, `frames: agent`,
   `sound: none`), each naming the attempt it comes from. For input,
   `person` means a person has to give that input: the agent sends none to
   a game a person runs, so the run is a live session in which the
   maintainer plays.
3. **Write `docs/RUNTIME.md`** from its headings, answering every capability,
   or every part of it where the parts differ: each answer names the tool and
   version tried and what happened, and each `none` or `person` says what
   would change it. For the harness, record the Unicorn version, the builds
   it loads and the stubs it has.
   Replace answers that are no longer true; do not append. Where the agent
   can start the build, read its memory and set breakpoints, runs of it are
   recorded runs: give the probe's command line under Probe, or `none`
   until a tooling batch writes the probe.
4. **Move queue items** between `Emulated call`, `Agent run` and
   `Live session` where an answer changed, in the same commit. An item
   uses the answer of each part it needs: its run cannot be made if any of
   them is `none` (it goes under `Blocked`, with `Waiting on:` naming that
   part), it is a `Live session` if any is `person`, and it is an
   `Agent run` only if every one is `agent`. An item that needs only the
   keyboard stays an `Agent run` in a game whose mouse needs a person, and
   its experiment's Setup says it used only the keyboard. Where the record
   answers the parts of a capability separately, each `Agent run` and
   `Live session` item says in its `Settles it:` text which of those parts
   its run needs, such as only the keyboard, so that the items a changed
   part affects can be found.
5. **Stop every process you started and delete the lock.** Commit, then print
   the status block from `research-item` with `Batch: runtime access`.
