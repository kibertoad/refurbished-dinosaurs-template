---
name: plan-work
description: Plan restoration work - record the project's stage, write or revise slices with checkable exit criteria, seed and reprioritise the research queue from the spec and coverage reports, and write /goal conditions and goal files. Use when starting a project stage or slice, when the queue or plan looks stale, or when asked what to work on next over days rather than minutes.
---

# Plan work

The rules are in the [work protocol](https://dinorefurb.com/work-protocol/).
Planning changes `docs/IMPLEMENTATION-PLAN.md`, `queue/` and `docs/goals/`,
never code or spec entries apart from new `unknown` entries.

## Stage and slices

1. Establish the stage (Intake, Survey, Harness, Slices, Audit) by checking
   each earlier stage's exit criteria in the protocol against the repository.
   Record it in the plan. Do not move the stage forward on a criterion you
   could not check.
2. Each slice in the plan names the spec areas or entries it needs and the
   parity rows it must bring to `implemented` or `validated`. Exit criteria are
   statements a script or reviewer can check. Put questions only the owner can
   answer in the plan's owner questions, and nothing else there.
3. Remove anything from the plan that is status narration, a dated
   checkpoint or a list of what was done. Git has it.

## Seed the queue

1. For every spec entry below `established` whose Open questions has something
   workable, and every `unknown` entry, make sure `queue/<AREA>.md` has an item,
   under the section for the evidence it needs. Items duplicating one another
   are merged.
2. During Survey: every file in the build manifest without a format entry gets
   an `unknown` format entry and a queue item; so does every screen the manual
   mentions. Where a function inventory exists in `coverage/`, a large
   function no entry
   cites gets a queue item against the nearest entry or a new `unknown` one.
3. Move items that block the current slice to the top of their section.

## Goals

A goal condition names a state the agent can show by running something,
names its scope, and has a turn limit, for example:

```text
Every item under Static in queue/COMBAT.md is closed or moved to Blocked with
what was tried, the documentation check passes on the last commit, and each
batch ended with a status block; or stop after 40 turns.
```

Write the goal file from `docs/goals/README.md`, check that no other goal file
claims the same areas, and give the user the condition to paste after `/goal`.
Split research and implementation into separate goals. Never write a goal
like "finish the combat system": nobody can check it.
