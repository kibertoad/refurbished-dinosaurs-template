# Live session requests

One file per live session an agent has asked for, named after it:
`docs/live-sessions/combat-order.md`. In a live session the maintainer runs the
original and signals at each point the script names, and the agent measures
the running process. The
[work protocol](https://dinorefurb.com/work-protocol/#live-sessions) sets the
rules, and the `live-session` skill writes, runs and ingests them.

The owner answers a request by editing its Status line. Until it says
`accepted`, the work goes on without it. After the session the Status becomes
`held` with the date, the results go into the spec in one research batch per
area, and the last of those batches deletes the request. A declined request
stays, so that it is not asked again without something new. The files here
are the list of open requests.

A request:

```markdown
# combat-order

Status: requested
<!-- or: accepted, YYYY-MM-DD / declined: the owner's reason / held, YYYY-MM-DD -->

- Build: BLD-GOG-EN-1.1, on the maintainer's Windows machine.
- Settles: Q-COMBAT-012, Q-COMBAT-015 (queue/COMBAT.md, Live session).
- Blocks: slice 4.
- Length: about 40 minutes.

## Script

1. Q-COMBAT-012, RULE-COMBAT-012. Start from `saves/EXP-COMBAT-009.patch.json` on the base
   save described in its Setup. Vary: which gang attacks first, 20 times each.
   Signal: when the combat panel opens. Agent: breakpoint at the resolver's
   entry, record the order of the two roll calls. Captures: none.
```
