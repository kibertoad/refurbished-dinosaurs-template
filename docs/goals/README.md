# Goals

One file per long-running goal while it runs, named after it:
`docs/goals/combat-static.md`. The
[work protocol](https://dinorefurb.com/work-protocol/#coding-agents-and-long-running-goals)
says how to write the condition. Delete the file in the commit that meets or
drops the goal; git keeps it. The files here are the list of goals running.

A goal file:

```markdown
# combat-static

## Condition

Every item under Static in queue/COMBAT.md is closed or moved to Blocked with
what was tried, the documentation check passes on the last commit, and each
batch ended with a status block; or stop after 40 turns.

## Scope

Areas: COMBAT. Batches: research only. Queue sections: Static.

## Must not touch

Other areas' entries, queue files and parity rows. `src/`.

## Dead ends

None known.

## Handover

- Branch: claude/combat-static, at 3f2a9c1, pushed.
- Last gate: 2026-09-25, documentation check passed, fast gate passed.
- Unfinished: none.
- Blockers: none known.
- Next: Q-COMBAT-015, Q-COMBAT-017.
```

`Scope` names the areas the goal claims. A goal takes up a queue item only if
every entry it names is in one of those areas, and adds an area to its scope
only while no other goal file claims it. The file, and every change to its
scope, reaches the main branch before the first batch that relies on it, so
every session sees the claim; where sessions cannot push, only one goal runs
at a time. `Dead ends` records tools and approaches that failed across the
whole goal, in a line or two each, so a resumed session does not repeat them;
what a research attempt tried on a question goes under its queue item's
`Tried:`. `Handover` holds what `docs/HANDOVER.md` holds, for this goal only,
and is rewritten at the end of every session under the goal. Progress is not
written here: the queue and the commits show it.
