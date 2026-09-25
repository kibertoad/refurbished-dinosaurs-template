---
name: start-session
description: Resume restoration work at the start of a session. Use before any research or implementation in this repository, when resuming, when running a /goal, or when asked "where were we" or "what's next". Reads the handover and goal files, checks the tree, runs the documentation check, and picks the next item.
---

# Start a session

The rules are in the [work protocol](https://dinorefurb.com/work-protocol/#sessions).
This skill is the procedure; where they differ, the protocol wins.

1. Read `docs/HANDOVER.md`. If a goal is running, or the user started one,
   read its file in `docs/goals/`. If the user gave a goal with no file, write
   the file first (see `docs/goals/README.md`), and check that no other goal
   file claims the same areas.
2. Compare the handover with reality: `git status`, `git log --oneline -10`,
   the current branch. Anything uncommitted that the handover does not mention
   belongs to someone else or to a crashed session: report it and leave it
   alone.
3. Run the documentation check in `--check` mode as `docs/VALIDATION.md` ("Spec
   checks") describes. A failure on a clean tree is the first thing to fix.
4. Read the plan's stage and current slice in `docs/IMPLEMENTATION-PLAN.md`.
5. Pick the next item, in this order: what the goal names; queue items that
   block the current slice; items others depend on (RNG, main loop, save
   format, state structures); items where one piece of evidence raises the most
   entries; items with the cheapest evidence. Parity rows of the current slice
   whose spec status is at least `supported` are the implementation work.
6. Say in two or three lines what you picked and why, then hand over to
   `research-item` or `implement-rows`. Never mix the two in one batch.
