---
name: plan-work
description: Plan restoration work - record the project's stage, write or revise slices with checkable exit criteria, seed and reprioritise the research queue from the spec and coverage reports, and write /goal conditions and goal files. Use when starting a project stage or slice, when the queue or plan looks stale, or when asked what to work on next over days rather than minutes.
---

# Plan work

The rules are in the work protocol's [Stages](../../../docs/upstream/work-protocol.md#stages) (lines 32-82),
[The queue](../../../docs/upstream/work-protocol.md#the-queue) (lines 84-163) and
[Coding agents and long-running goals](../../../docs/upstream/work-protocol.md#coding-agents-and-long-running-goals) (lines 542-640).
Open a linked section only when a step leaves a question it answers, read
only the lines the link gives, and never a section already read this session.
Planning changes `docs/IMPLEMENTATION-PLAN.md`, `queue/` and `docs/goals/`,
never code or spec entries apart from new `unknown` entries.

## Stage and slices

1. Establish the stage (Intake, Runtime access, Survey, Slices, Audit) by checking
   each earlier stage's exit criteria in the protocol against the repository.
   Record it in the plan. Do not move the stage forward on a criterion you
   could not check.
2. Each slice in the plan names the spec areas or entries it needs and the
   parity rows it must bring to `implemented`, `deviated` or `validated`, and each target
   is one `docs/RUNTIME.md` makes reachable: without runs of the original,
   format rows whose entries list files can reach `validated`, but rule and
   screen rows, and formats with no files (memory structures, messages), stop
   at `implemented`, and a row that needs a live session nobody has accepted
   stays at `implemented` with the gap in the risks. The first slice gives the
   rebuild a headless runner that a test drives from a fixture. Exit criteria
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
   `Live session` as `docs/RUNTIME.md` says for the parts of each capability
   the run needs, and where the record answers those parts separately, the
   item's `Settles it:` text names them. A `supported` entry gets a
   `Static` item to complete its reading and an `Emulated call` item where
   the harness reaches its functions, or, only where it depends on something
   the code does not decide, a run item to confirm it. Every rule the code
   decides gets an `Emulated call` item, since its fixture is what a
   `validated` row's tests replay. Items duplicating one another are merged,
   and
   the merged item keeps one of their IDs.
2. During Survey: until every path of the installation's listing (other than
   members of archives the listing went inside) is in the manifest or the
   build's Other files, the plan says what is still missing and Survey stays
   open. Where the build keeps a listing record (`BLD-*.listing.yaml`,
   ENTRY-TYPES-16), the documentation check compares it with the manifest and
   the list of other files, whose paths ending in `/` are directory
   exclusions; agreement shows the lists name the same paths, not that the
   Survey is complete. Every file the manifest lists as `data` without a format
   entry gets an `unknown` format entry and a queue item (CD audio tracks need
   none); so does every screen the manual mentions. Where function
   inventories exist in `coverage/`, run `pnpm exec standard-coverage`
   (`--list` names the entries citing each function): a large function no
   entry cites gets a queue item against the nearest entry or a new
   `unknown` one. Its figures are printed when wanted and never committed;
   the plan names the command and copies none of the shares it printed. The protocol's
   [Measuring progress](../../../docs/upstream/work-protocol.md#measuring-progress) (lines 483-536)
   says how to set an early baseline and report coverage by area.
3. Move items that block the current slice to the top of their section.

## Goals

A goal condition names a state the agent can show by running something,
names its scope, and has a limit. A goal with a bounded scope has a turn
limit, for example:

```text
Every item under Static in queue/COMBAT.md is closed or moved to Blocked with
what was tried, the documentation check passes on the last commit, and each
batch ended with a status block; or stop after 40 turns.
```

Write the goal file from `docs/goals/README.md`, naming its side at the
start of its Scope line (`Side: research.` or `Side: implementation.`), check that no other goal on the same side, and no goal whose
file names no side, claims the same areas, get the file to where claims live
before the goal's first batch, in a commit (or pull request) of its own that
is not a batch, and give the user the condition to paste after `/goal`. Where
sessions can push to the main branch, the file goes there. Where no session
can, only one goal runs at a time, on a `goal/` branch whose first commit
creates the file ("Where no session can push" in `docs/goals/README.md`).
Where only some sessions may push, follow "Where only some sessions can push"
there: the session that starts the goal fixes its form for good.

When the owner wants work to go on until the game is restored, write two
standing goals (`docs/goals/README.md`), one research and one implementation,
each in its own conversation and worktree. A standing goal's limit is the
state the Audit stage ends in, with no turn count; work that is only blocked
for now does not meet it. Conditions such as:

```text
Every queue item is closed or is one the owner has accepted as out of reach,
the documentation check passes on the last commit, and each batch ended with a
status block; stop earlier only for a reason docs/goals/README.md lists.
```

```text
Every parity row is validated or deviated, or has a note other than a Spec gap
note saying why it can be neither, the fast validation gate and the
documentation check pass on the last commit, and the only changes under spec/
are added open questions and unknown entries; stop earlier only for a reason
docs/goals/README.md lists.
```

Split research and implementation into separate goals: a goal stays on one
side of the clean room. Never write a goal like "finish the combat system":
nobody can check it.
