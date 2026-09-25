# Goals

One file per long-running goal while it runs, named after it:
`docs/goals/combat-static.md`. The
[work protocol](https://dinorefurb.com/work-protocol/#coding-agents-and-long-running-goals)
says how to write the condition. Delete the file in the commit that meets or
drops the goal; git keeps it. `docs/HANDOVER.md` lists the goals running.

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
```

`Scope` names the areas the goal claims; a second session does not start a
goal that claims any of them. `Dead ends` records what was tried and failed
across the whole goal, in a line or two each, so a resumed session does not
repeat it. Progress is not written here: the queue and the commits show it.
