---
name: end-session
description: Close a work session on this restoration - stop processes the session started and release the run lock, rewrite docs/HANDOVER.md to the current state, commit everything, push, and report. Use at the end of every session, before handing over, when a goal is met or dropped, or when stopping for any reason.
---

# End a session

The rules are in the [work protocol](https://dinorefurb.com/work-protocol/#sessions).

1. **Processes**: stop every process this session started (Ghidra and Java,
   the original game, test hosts, servers), and leave anything whose owner is
   uncertain. Reusable MSBuild nodes are not orphans. Remove
   `~/.refurbished-dinosaurs/run.lock` if this session created it, and never
   otherwise. Follow any process-audit rule in `AGENTS.md`.
2. **Goal**: if the goal's condition holds, or the goal is dropped, delete its
   file in `docs/goals/` and say which in the commit message. If it continues,
   add any new dead end to its file.
3. **Handover**: rewrite `docs/HANDOVER.md` from its section headings, stating
   what is true now: stage, branch and whether it is pushed, the last gate
   result with its date, goals running, unfinished work, blockers, open live
   session requests, and at most five next items pointing at queue items,
   parity rows or a slice. Name items and entries by ID; never write what
   research found or tried. Delete what is no longer true instead of adding
   below it. Stay under 200 lines.
4. **Working tree**: commit the handover with every finished batch. For
   anything half done, either finish it, discard it, or leave it uncommitted
   and describe it under Unfinished in the handover. Never commit a failing
   documentation check.
5. **Push** the branch, unless `AGENTS.md` says the owner pushes; then the
   handover says how many commits the branch is ahead of its remote, counting
   its own.
6. **Report** the final status block from `research-item`, followed by one
   line on anything the owner has to decide or do, such as a live session
   request waiting for an answer.
