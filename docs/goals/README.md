# Goals

One file per long-running goal while it runs, named after it:
`docs/goals/combat-static.md`. The
[work protocol](../upstream/work-protocol.md#coding-agents-and-long-running-goals) (lines 332-370)
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

- Stage: Slices.
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

## Standing goals

The owner may give a goal that ends only when the restoration does, such as
"keep working until the whole game is restored". Its condition names that
end, for example: the plan is past Audit, every parity row that is not
superseded is `validated` or `deviated`, and every queue item is closed or
under `Blocked` with `Waiting on:`. Its file has no turn limit.

Under a standing goal, the end of a session is a checkpoint, not a stop:
`end-session` commits the handover, and the agent runs `start-session` and
takes the next item in the same conversation. The goal keeps going from
session to session until its condition holds.

An agent under any goal whose condition does not hold stops only when:

- the owner asks it to wrap up, and the wrap-up below is done;
- every item the goal may take is under `Blocked`, `Live session` or an
  `Agent run` that cannot run now, no `plan-work` step adds one within the
  goal's scope, and no other stage or slice in scope has work;
- a decision only the owner can make blocks all remaining work in scope,
  written in `docs/DECISIONS.md` or the goal's Handover as a question.

None of these is a reason to stop: a finished batch or status block, a
committed handover, the length of the conversation (it is summarized when it
grows long), a check running in the background (do other work meanwhile and
use its result in a later commit), or a question the owner asks while the goal
runs (answer it, then go on). Before stopping, the agent says which of the
reasons above applies, in the Handover and in its last message.

### Wrapping up

When the owner asks to wrap up, the goal stops iterating, whether or not its
condition holds:

1. Spawn no new agents and start no new item, batch or session.
2. Finish the batch in progress as one cohesive batch: its findings, spec
   entries, parity rows, queue changes and tests, passing the documentation
   check and the fast gate. Work that cannot be finished that way is left out
   of the batch and described under Unfinished in the Handover, or committed to
   `wip/<working branch>` where the working tree does not outlive the session.
3. Run `end-session`: stop processes, rewrite the Handover with the next items
   and `Stopped: owner asked to wrap up`, and commit it.
4. Push the work to the main branch. The owner's request to wrap up is the
   authorization for that push, unless `AGENTS.md` says the owner pushes.
5. Report and stop. The goal file stays, so a later session resumes it.

Where the repository's `.claude/settings.json` installs
`tools/goal-stop-hook.mjs`, Claude Code holds back the first stop on a
`goal/<name>` branch whose goal file exists and reminds the agent of these
reasons; a second stop in a row goes through.
