# Goals

One file per long-running goal while it runs, named after it:
`docs/goals/combat-static.md`. The
[work protocol](../upstream/work-protocol.md#coding-agents-and-long-running-goals) (lines 542-640)
says how to write the condition. The files here are the list of goals running,
together with the `goal/` branches where some or all sessions cannot push to
the main branch (see below).

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

Side: research. Areas: COMBAT. Queue sections: Static.

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

`Scope` names the goal's side of the clean room, research or implementation,
and the areas it claims. A goal takes up a queue item only if every entry it
names is in one of those areas, and adds an area to its scope only while no
other goal claims it. Another goal's claim counts only when that goal is on the
same side or its file names no side, so a research goal and an implementation
goal whose files name their sides may claim the same area. Where every session
can push to the main branch, the file, and every change to its scope, reaches
the main branch before the first batch that relies on it, so every session sees
the claim. Where work lands through pull requests, that commit goes in a pull
request of its own, merged before any batch that relies on it. Where no session
can push, or only some can, see the sections below. `Dead ends` records tools and approaches that failed across the
whole goal, in a line or two each, so a resumed session does not repeat them;
what a research attempt tried on a question goes under its queue item's
`Tried:`. `Handover` holds what `docs/HANDOVER.md` holds, for this goal only,
and is rewritten at the end of every session under the goal. Progress is not
written here: the queue and the commits show it.

## Standing goals

The owner may give a goal that ends only when the restoration does, such as
"keep working until the whole game is restored". Research and implementation
never share a conversation, so that takes two standing goals, each run in its
own conversation and worktree, with its side named in its file. Their files
have no turn limit: the limit is the state the Audit stage ends in, and the
reasons to stop below take the place of a turn count. Work that is only
blocked for now does not meet such a condition. For example:

- research: every queue item is closed or is one the owner has accepted as
  out of reach;
- implementation: every parity row is `validated` or `deviated`, or has a note
  other than a `Spec gap:` note saying why it can be neither.

When the implementation goal has nothing left but rows waiting on research, it
stops for the third reason below and keeps its file. The owner, or a scheduled
task, starts it again once research has closed some of those items. Where no
session can push to the main branch, the two goals take turns instead: a
standing goal that stops with work left ends as a dropped goal does, deleting
its goal file and moving its handover to `docs/HANDOVER.md`, and its side's
next turn starts a new goal with the same condition.

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
  written in `docs/DECISIONS.md` or the goal's Handover as a question;
- a goal with a bounded scope has reached the number of turns its condition
  gives.

None of these is a reason to stop: a finished batch or status block, a
committed handover, the length of the conversation (it is summarized when it
grows long), a check running in the background (do other work meanwhile and
use its result in a later commit), or a question the owner asks while the goal
runs (answer it, then go on). Before stopping, the agent runs
`node tools/goal-run.mjs stop` and says which of the reasons above applies, in
the Handover and in its last message.

### Where no session can push

Where no session can push to the main branch, because the sessions lack the
access or the owner's instructions forbid it, only one goal runs at a time, and its claim
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

### Where only some sessions can push

Where the owner authorizes a push to the main branch in some tasks and forbids
it in others, a goal takes the form the session that starts it can use and
keeps it until it ends: a goal started in a task that authorizes the push has
its file on the main branch, and one started without that authorization runs
on a `goal/` branch as above, the only goal on a branch while it runs.

- A goal file on the main branch claims its areas for every session, unless
  the shared clone has a `goal/` branch of the same name; the file is then that
  branch's copy, and the branch's tip decides. So a goal started on the main
  branch never takes the name of a `goal/` branch in the shared clone, and a
  `goal/` branch is kept until the main branch no longer has a copy of its
  goal file.
- Before starting a goal or adding an area to one, a session checks both
  forms: it fetches and reads `docs/goals/` at the remote's tip
  (`git ls-tree --name-only origin/main:docs/goals/`, where "Not a valid
  object name" means no goal file claims anything), and it runs the `goal/*`
  listing. A goal on the main branch may claim only areas that no goal file
  there and no running `goal/` branch claims. A goal on a branch may start
  only while no other `goal/` branch runs, and may claim only areas no goal
  file on the main branch claims.
- After its claim commit reaches where the claim lives (the first commit on
  the branch; for the main branch, the push, or the merge of the claim's own
  pull request, before which the goal runs no batch), the session checks both
  forms again. On a clash it withdraws: it deletes its branch, or lands a
  commit on the main branch that deletes its goal file. A session that added
  an area withdraws only that area.
- A session that resumes a goal under a different authorization goes on in
  the goal's form. A goal on a branch stays there when a later task authorizes
  a push. A goal on the main branch keeps its claim when the session cannot
  push, but that session cannot change the claim, so it takes only items in
  the areas already claimed; its batches and handover stay on the goal's
  working branch until they reach the main branch, and the next session reads
  the handover there.
- A session outside the shared clone starts no goal of either form, and adds
  no area to one, unless the person running it says that no `goal/` branch is
  running.

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
   authorization for that push, unless it says otherwise or `AGENTS.md` says
   the owner pushes. Where work lands through pull requests, push the working
   branch and open or update its pull request instead; a session without the
   access to push to the main branch pushes its working branch.
5. Run `node tools/goal-run.mjs stop`, report and stop. The goal file stays, so
   a later session resumes it, except where two standing goals take turns on
   `goal/` branches as described above.

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
