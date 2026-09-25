---
name: runtime-access
description: Find out and record in docs/RUNTIME.md what can be done with the original game running, and who can do it - start it, send input, read memory, load a patched save, capture frames and sound, play back recordings. Use in the Runtime access stage, and whenever a tool, emulator or machine may have changed an answer.
---

# Runtime access

The rules are in the [work protocol](https://dinorefurb.com/work-protocol/#runtime-access).
Many games cannot be controlled by an agent at all. Static reading is the main
source of evidence for every game; this check only finds out what runs are
possible, and it is the one time the original is run before the static work
is done.

1. **Take the run lock** as the protocol's
   [Running the original](https://dinorefurb.com/work-protocol/#running-the-original)
   says: create `~/.refurbished-dinosaurs/run.lock` naming this repository,
   the session and the time. If it already exists, do not wait: do static work
   and try again in a later session.
2. **For each build that will be run**, record how it runs (natively, under
   Wine, in DOSBox-X or another emulator, in a virtual machine), then try each
   capability and answer it `agent`, `person` (only while a person runs the
   game) or `none`:
   - start the original and bring it to a given state without a person;
   - send it input;
   - read its memory, set breakpoints and dump structures while it runs;
   - load a patched save;
   - capture frames and sound;
   - play back a recording the original made.
3. **Write `docs/RUNTIME.md`** from its headings: each answer names the tool and
   version tried and what happened, and each `none` or `person` says what
   would change it. Name the text-in, text-out runtime tool if one works.
   Replace answers that are no longer true; do not append.
4. **Move queue items** between `Agent run` and `Live session` where an answer
   changed, in the same commit.
5. **Stop every process you started and remove the lock.** Commit, then print
   the status block from `research-item` with `Batch: runtime access`.
