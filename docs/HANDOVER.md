# Handover

Where the work outside any goal stands now. Rewrite this file at the end of
every session that works under no goal; do not append to it. A session under a
goal writes the same sections in its goal file's Handover instead, so two
sessions running at once never write the same file. It is at most 200 lines.
History is in git, open research questions are in `queue/`, the plan is in
`docs/IMPLEMENTATION-PLAN.md`, the goals running are the files in
`docs/goals/`, and the open live session requests are the files in
`docs/live-sessions/`. Name items and entries by ID; what research found or
tried belongs in the spec and the queue, never here.
See the [work protocol](https://dinorefurb.com/work-protocol/#working-files).

## State

- Stage: _Intake, Runtime access, Survey, Slices (which slice) or Audit._
- Branch: _name_, at _commit_. _Pushed, or, where the owner pushes, how many
  commits it is ahead of its remote, counting the one holding this file._
- Last gate: _date, `./tools/Invoke-Validation.ps1` result, documentation check result._

## Unfinished

_Anything left half done and left out of the batch commits, with where it
stands, what finishes it, and its `wip/` branch where the working tree does not
outlive the session. `None.` when the working tree is clean and every batch was
committed._

## Blockers

None known.

## Next

_At most five items, each naming a queue item by its ID, a parity row or a slice._
