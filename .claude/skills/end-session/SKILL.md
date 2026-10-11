---
name: end-session
description: Close a work session on this restoration - stop processes the session started and release the run lock, rewrite the handover (docs/HANDOVER.md, or the goal file's Handover) to the current state, commit it, push, and either start the next session (under a goal whose condition does not hold) or report. Use at the end of every session, before handing over, when a goal is met or dropped, or when stopping for any reason.
---

# End a session

The rules are in the [work protocol](../../../docs/upstream/work-protocol.md#sessions) (lines 321-329).
Open a linked section only when a step leaves a question it answers, read
only the lines the link gives, and never a section already read this session.

1. **Processes**: stop every process this session started (Ghidra and Java,
   the original game, test hosts, servers), and leave anything whose owner is
   uncertain. Reusable MSBuild nodes are not orphans. Delete the run lock
   (path in `docs/RUNTIME.md`) if this session created it, and never
   otherwise. Follow any process-audit rule in `AGENTS.md`.
2. **Goal**: if the goal's condition holds, or the goal is dropped, the
   handover commit in step 4 deletes its file in `docs/goals/` in place of
   rewriting its Handover, says which in the commit message, and adds anything
   in its Handover still worth handing on (a blocker, a `wip/` branch) to
   `docs/HANDOVER.md`, leaving the rest of that file as it was. The batch that
   met the condition left the file in place. If the goal continues, add any
   new dead end to its file.
3. **Working tree**: every finished batch is already committed. For anything
   half done, finish it, discard it, or leave it out of the batch commits and
   describe it under Unfinished in the handover. Where the working tree does
   not outlive the session (a cloud container), commit the half-done work to
   `wip/<working branch>` and push it there instead. Never commit to the
   working branch anything that fails the documentation check or the fast
   gate, or mixes two kinds of batch.
4. **Handover**: under a goal that continues, rewrite the Handover section of
   its goal file; for a goal met or dropped, make the deletion in step 2;
   otherwise rewrite `docs/HANDOVER.md` from its section headings. Under no
   goal, first merge any commit on the main branch that deleted a goal file
   and added to `docs/HANDOVER.md`, and keep what it added unless this session
   dealt with it. State what
   is true now: stage, the last gate result with its date, unfinished work
   (with its `wip/` branch), blockers, and at
   most five next items naming queue items by ID, parity rows or a slice.
   Get branch, commit and remote sync state from Git when needed; do not copy
   them into the handover. Never write what research found or tried. Delete
   what is no longer true instead of adding below it. Stay under 200 lines.
   Commit the handover on its own. It is not a batch: it changes nothing
   outside `docs/HANDOVER.md` and `docs/goals/`, and carries no trailers.
5. **Push** the branch unless `AGENTS.md` says the owner pushes or the user
   has instructed otherwise, with the explicit refspec and the check that the
   push landed from "Pushing a branch" in `AGENTS.md`. When the owner asked to
   wrap up, push the work to the main branch, as "Wrapping up" in `docs/goals/README.md` says. Check
   Git directly for the branch's remote sync state when reporting it; do not
   copy a count into the handover.
6. **Continue or stop.** If the session worked under a goal whose condition
   does not hold and none of the stop reasons in `docs/goals/README.md`
   applies, the session's end is a checkpoint: run `start-session` now and
   take the next item, without reporting or ending the turn. Otherwise run
   `node tools/goal-run.mjs stop` and go on to the report, naming the stop
   reason that applies. When the owner asked to wrap up, follow "Wrapping up"
   in `docs/goals/README.md`: no new item starts.
7. **Report** the final status block from `research-item`, followed by one
   line on anything the owner has to decide or do, such as a live session
   request waiting for an answer.
