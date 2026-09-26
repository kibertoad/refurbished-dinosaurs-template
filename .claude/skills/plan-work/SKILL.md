---
name: plan-work
description: Plan restoration work - record the project's stage, write or revise slices with checkable exit criteria, seed and reprioritise the research queue from the spec and coverage reports, and write /goal conditions and goal files. Use when starting a project stage or slice, when the queue or plan looks stale, or when asked what to work on next over days rather than minutes.
---

# Plan work

The rules are in the [work protocol](https://dinorefurb.com/work-protocol/).
Planning changes `docs/IMPLEMENTATION-PLAN.md`, `queue/` and `docs/goals/`,
never code or spec entries apart from new `unknown` entries.

## Stage and slices

1. Establish the stage (Intake, Runtime access, Survey, Slices, Audit) by checking
   each earlier stage's exit criteria in the protocol against the repository.
   Record it in the plan. Do not move the stage forward on a criterion you
   could not check.
2. Each slice in the plan names the spec areas or entries it needs and the
   parity rows it must bring to `implemented` or `validated`, and each target
   is one `docs/RUNTIME.md` makes reachable: without runs of the original,
   format rows whose entries list files can reach `validated`, but rule and
   screen rows, and formats with no files (memory structures, messages), stop
   at `implemented`, and a row that needs a live session nobody has accepted
   stays at `implemented` with the gap in the risks. The first slice gives the
   rebuild a headless runner that a test drives from a fixture; where the
   plan has no such slice because the project adopted the protocol later,
   the current slice builds it. Exit criteria
   are statements a script or reviewer can check, naming queue items by ID. Put questions only the owner can
   answer in the plan's owner questions, and nothing else there.
3. Remove anything from the plan that is status narration, a dated
   checkpoint or a list of what was done. Git has it.

## Seed the queue

1. For every spec entry below `established` whose Open questions has something
   workable, and every `unknown` entry, make sure a queue file has an item,
   under the section for the evidence it needs, in the area of the first entry
   it names, with an ID from that file's `Next ID:` line. A question a static
   reading can settle goes under `Static`; a call of one function goes under
   `Emulated call`; a run of the game goes under `Agent run` or
   `Live session` as `docs/RUNTIME.md` says. A `supported` entry gets a
   `Static` item to complete its reading and an `Emulated call` item where
   the harness reaches its functions, or, only where it depends on something
   the code does not decide, a run item to confirm it. Every rule the code
   decides gets an `Emulated call` item, since its fixture is what a
   `validated` row's tests replay. Items duplicating one another are merged,
   and
   the merged item keeps one of their IDs.
2. During Survey: every file the manifest lists as `data` without a format
   entry gets an `unknown` format entry and a queue item (CD audio tracks need
   none); so does every screen the manual mentions. Where function
   inventories exist in `coverage/`, a large function no entry cites gets a
   queue item against the nearest entry or a new `unknown` one.
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
claims the same areas, get the file onto the main branch before the goal's
first batch (where sessions cannot push, run only one goal at a time), and
give the user the condition to paste after `/goal`.
Split research and implementation into separate goals. An implementation
goal's condition allows no change under `spec/` beyond added open questions
and `unknown` entries, and accepts a `partial` row only with a `Spec gap:` note. Never write a goal
like "finish the combat system": nobody can check it.
