---
name: end-session
description: Close a work session on this restoration - commit or account for everything in the working tree, rewrite docs/HANDOVER.md to the current state, stop processes the session started, and report. Use at the end of every session, before handing over, when a goal is met or dropped, or when stopping for any reason.
---

# End a session

The rules are in the [work protocol](https://dinorefurb.com/work-protocol/#sessions).

1. **Working tree**: commit every finished batch. For anything half done,
   either finish it, discard it, or leave it uncommitted and describe it under
   Unfinished in the handover. Never commit a failing documentation check.
2. **Goal**: if the goal's condition holds, or the goal is dropped, delete its
   file in `docs/goals/` in the last commit and say which in the message. If it
   continues, add any new dead end to its file.
3. **Handover**: rewrite `docs/HANDOVER.md` from its section headings, stating
   what is true now: stage, branch and commit, which commits are not pushed,
   the last gate result with its date, goals running, unfinished work,
   blockers, and at most five next items pointing at queue items, parity rows
   or a slice. Delete what is no longer true instead of adding below it. Stay
   under 200 lines. Commit it.
4. **Processes**: stop every process this session started (Ghidra and Java,
   the original game, test hosts, servers), and leave anything whose owner is
   uncertain. Reusable MSBuild nodes are not orphans. Follow any process-audit
   rule in `AGENTS.md`.
5. **Push** only if `AGENTS.md` or the user says so.
6. **Report** the final status block from `research-item`, followed by one
   line on anything the owner has to decide or do.
