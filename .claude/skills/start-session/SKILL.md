---
name: start-session
description: Resume restoration work at the start of a session. Use before any research or implementation in this repository, when resuming, when running a /goal, or when asked "where were we" or "what's next". Reads the handover and goal files, checks the tree, runs the documentation check, and picks the next item.
---

# Start a session

The rules are in the [work protocol](https://dinorefurb.com/work-protocol/#sessions).
This skill is the procedure; where they differ, the protocol wins.

1. Decide the session's side: research (with tooling that reads the original)
   or implementation (with tooling that runs the rebuild). A session never
   holds both.
2. Find the session's handover. Under a goal it is the Handover section of
   the goal's file in `docs/goals/`; read the whole file. With no goal it is
   `docs/HANDOVER.md`. If the user gave a goal with no file, write the file
   first (see `docs/goals/README.md`), check that no other goal file claims
   the same areas, and get it onto the main branch before the first batch.
   An implementation session reads no research goal files.
3. Compare the handover with reality: `git status`, `git log --oneline -10`,
   the current branch, and any `wip/` branch the handover names. Anything
   uncommitted that the handover does not mention belongs to someone else or
   to a crashed session: report it and leave it alone.
4. Run the documentation check in `--check` mode as `docs/VALIDATION.md` ("Spec
   checks") describes. A failure on a clean tree is the first thing to fix.
5. Read the plan's stage and current slice in `docs/IMPLEMENTATION-PLAN.md`,
   and check `docs/live-sessions/` for a request the owner has accepted.
6. Pick the next work:
   - Research: first turn every `Spec gap:` note in `parity/` that has no
     queue item ID yet into a queue item (`research-item` step 1). Then, from
     every section of the queue alike: what the goal names; items that block
     the current slice; items others depend on (RNG, main loop, save format,
     state structures); items where one piece of evidence raises the most
     entries; items with the cheapest evidence. Within each step `Static`
     items come first. An `Agent run` or `Live session` item needs its own
     static attempt under `Tried:`, unless it asks for the run that confirms
     a static reading.
   - Implementation: first remove any code in `src/` that cites a finding or
     an experiment (`FND-`, `EXP-`), with the tests that exercise it: its
     entry was superseded because the mechanic does not exist. Then parity
     rows of the current slice from the goal or the plan, whose spec status is
     at least `supported`. Do not open `queue/`.
7. Say in two or three lines what you picked and why, then hand over to
   `research-item`, `implement-rows` or `live-session`.
