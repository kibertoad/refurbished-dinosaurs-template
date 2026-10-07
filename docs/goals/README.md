# Goals

One file per long-running goal while it runs, named after it:
`docs/goals/combat-static.md`. The
[work protocol](../upstream/work-protocol.md#coding-agents-and-long-running-goals) (lines 482-533)
says how to write the condition. The files here are the list of goals running
(or, where sessions cannot push to the main branch, the `goal/` branches; see
below).

The batch whose work meets the goal's condition leaves the file in place, and a
later commit deletes it, moving what is still worth handing on to
`docs/HANDOVER.md` and leaving the rest of that file as it was. For the
session's own goal, met or dropped during the session, that is the session's
handover commit. Any other goal, such as one dropped between sessions or found
to have been met by an earlier batch, loses its file in a commit of its own. A
commit that creates a goal file, changes the areas it claims or deletes it is
not a batch: it changes nothing outside `docs/HANDOVER.md` and `docs/goals/`,
leaves the documentation check and the fast gate passing, and carries no
trailers. Git keeps the deleted file.

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
only while no other goal file claims it. Where sessions can push to the main
branch, the file, and every change to its scope, reaches the main branch before
the first batch that relies on it, so every session sees the claim. Where work
lands through pull requests, that commit goes in a pull request of its own,
merged before any batch that relies on it. Where sessions cannot push, see
"Where sessions cannot push" below. `Dead ends` records tools and approaches that failed across the
whole goal, in a line or two each, so a resumed session does not repeat them;
what a research attempt tried on a question goes under its queue item's
`Tried:`. `Handover` holds what `docs/HANDOVER.md` holds, for this goal only,
and is rewritten at the end of every session under the goal. Progress is not
written here: the queue and the commits show it.

## Standing goals

The owner may give a goal that ends only when the restoration does, such as
"keep working until the whole game is restored". Research and implementation
never share a conversation, so that takes two standing goals, each run in its
own conversation and worktree. Their files have no turn limit. Their
conditions name the end of their own side, for example:

- research: every queue item is closed or under `Blocked` with `Waiting on:`;
- implementation: every parity row that is not superseded is `validated` or
  `deviated`, or `partial` with a `Spec gap:` note naming an open queue item.

When the implementation goal has nothing left but rows waiting on research, it
stops for the second reason below. The owner, or a scheduled task, starts it
again once research has closed some of those items.

Under a standing goal, the end of a session is a checkpoint: `end-session`
commits the handover, and the agent runs `start-session` and takes the next
item in the same conversation. The goal keeps going from session to session
until its condition holds.

An agent under any goal whose condition does not hold stops only when:

- the owner asks it to wrap up, and the wrap-up below is done;
- the owner tells it to stop at once, without a wrap-up;
- every item the goal may take is under `Blocked`, `Live session` or an
  `Agent run` that cannot run now, no `plan-work` step adds one within the
  goal's scope, and no other stage or slice in scope has work;
- a decision only the owner can make blocks all remaining work in scope,
  written in `docs/DECISIONS.md` or the goal's Handover as a question.

None of these is a reason to stop: a finished batch or status block, a
committed handover, the length of the conversation (it is summarized when it
grows long), a check running in the background (do other work meanwhile and
use its result in a later commit), or a question the owner asks while the goal
runs (answer it, then go on). Before stopping, the agent runs
`node tools/goal-run.mjs stop` and says which of the reasons above applies, in
the Handover and in its last message.

### Where sessions cannot push

Where sessions cannot push to the main branch, because they lack the access or
the owner's instructions forbid it, only one goal runs at a time, and its claim
lives in the one clone that every session's worktree is made from:

- The goal works on a branch named `goal/<file name without .md>`, and the
  first commit on that branch creates the goal file.
- At the start of every session, and again before it starts or resumes a goal,
  a session runs `git branch --list 'goal/*'` and looks in `docs/goals/` at
  the tip of each branch listed. A branch whose tip still has its goal file is
  the running goal: a session resuming that goal continues on it, and no other
  goal starts while it is there, even one that would claim different areas.
- A session that starts a goal runs the listing again after that first commit.
  If another listed branch has its goal file at the tip, it deletes its own
  branch and starts no goal.
- Deleting the goal file on the branch ends the claim, whether or not the owner
  has merged the branch. A copy of the goal file that reaches the main branch
  through the owner's merge claims nothing there, and the owner's next merge of
  the branch removes it.
- A separate clone or a cloud container sees none of these branches, even after
  a fetch, so a session that does not run in a worktree of the shared clone
  starts no goal unless the person running it says that none is running.

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
5. Run `node tools/goal-run.mjs stop`, report and stop. The goal file stays, so
   a later session resumes it.

### Run marker

`start-session` runs `node tools/goal-run.mjs start <name>` in the session's
worktree when it works under `docs/goals/<name>.md`. That writes a marker into
the worktree's Git directory, so it is never committed and other worktrees do
not see it. Where the repository's `.claude/settings.json` installs the hook
(`node tools/goal-run.mjs hook`), the first stop after `start` binds the marker
to that conversation, and Claude Code then holds back every stop of that
conversation and reminds the agent of the reasons above, until the agent runs
`node tools/goal-run.mjs stop` or the goal file is deleted. Other
conversations are never held back, on any branch.

If HEAD has not moved over three held-back stops in a row, the hook lets
stops through until the next commit, so an agent that makes no progress ends
its turn and the owner sees why. A marker left by a crashed session holds back
no other conversation, and the next `start` in that worktree replaces it.
