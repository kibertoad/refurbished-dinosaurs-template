---
name: end-session
description: Close a work session on this restoration - stop processes the session started and release the run lock, rewrite the handover (docs/HANDOVER.md, or the goal file's Handover) to the current state, commit it, push, and report. Use at the end of every session, before handing over, when a goal is met or dropped, or when stopping for any reason.
---

# End a session

The rules are in the [work protocol](https://dinorefurb.com/work-protocol/#sessions).

1. **Processes**: stop every process this session started (Ghidra and Java,
   the original game, test hosts, servers), and leave anything whose owner is
   uncertain. Reusable MSBuild nodes are not orphans. Delete the run lock
   (path in `docs/RUNTIME.md`) if this session created it, and never
   otherwise. Follow any process-audit rule in `AGENTS.md`.
2. **Goal**: if the goal's condition holds, or the goal is dropped, delete its
   file in `docs/goals/` and say which in the commit message, and move
   anything in its Handover still worth handing on (a blocker, a `wip/`
   branch) to `docs/HANDOVER.md`. If it continues, add any new dead end to its
   file.
3. **Working tree**: every finished batch is already committed. For anything
   half done, finish it, discard it, or leave it out of the batch commits and
   describe it under Unfinished in the handover. Where the working tree does
   not outlive the session (a cloud container), commit the half-done work to
   `wip/<working branch>` and push it there instead. Never commit to the
   working branch anything that fails the documentation check or the fast
   gate, or mixes two kinds of batch.
4. **Handover**: under a goal, rewrite the Handover section of its goal file;
   otherwise rewrite `docs/HANDOVER.md` from its section headings. State what
   is true now: stage, branch and whether it is pushed, the last gate result
   with its date, unfinished work (with its `wip/` branch), blockers, and at
   most five next items naming queue items by ID, parity rows or a slice.
   Never write what research found or tried. Delete what is no longer true
   instead of adding below it. Stay under 200 lines. Commit the handover on
   its own.
5. **Push** the branch, unless `AGENTS.md` says the owner pushes; then the
   handover says how many commits the branch is ahead of its remote, counting
   its own.
6. **Report** the final status block from `research-item`, followed by one
   line on anything the owner has to decide or do, such as a live session
   request waiting for an answer.
