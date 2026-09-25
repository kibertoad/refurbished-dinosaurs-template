# Research queue

The open research questions about the original, one file per spec area,
named after the area: `queue/COMBAT.md`. The
[work protocol](https://dinorefurb.com/work-protocol/#the-queue) defines the
format; this file is a short reminder of it and stays in place when the area
files arrive.

An area file opens with the area as a `#` heading and a line giving the ID the
next new item takes, `Next ID: Q-COMBAT-013`, followed by these `##` sections
in this order, each holding list items or `None.`:

1. `Static`: a reading of the executable or data files settles it.
2. `Agent run`: a run of the original `docs/RUNTIME.md` says an agent can make alone.
3. `Live session`: a run that needs a person to run the original while an agent
   measures it.
4. `Source`: a document that has to be found or read.
5. `Blocked`: stopped until something else changes; the item says what.

One item:

```markdown
- Q-COMBAT-012. RULE-COMBAT-012, FMT-STATE-001: Which of two gangs attacking
  each other rolls first? Settles it: the order of the two calls at the
  resolver's entry, and one experiment from a save where both attack.
  Blocks: slice 4.
```

Every item has an ID, names the spec entries it concerns (behaviour with no
entry gets an `unknown` entry first), asks one question, says what would
settle it, and names the slice it blocks or `none`. It goes in the file of the
area of the first entry it names. The ID comes from the file's `Next ID:`
line, which then goes up by one; it is never reused, and it stays with the
item when the item moves. Everything outside the queue (handovers, live
session requests, slice exits, `Spec gap:` notes, status blocks) names items
by ID. An item already worked on adds `Tried:`, saying what was examined and
why it did not settle the question; anything the attempt learned about the
original goes in `spec/` first and `Tried:` names the finding. An item under
`Blocked` adds `Waiting on:`.

Static analysis comes first, and runs are the last resort for each question:
an `Agent run` or `Live session` item is taken up only after its own static
attempt is recorded under `Tried:`, or when it asks for the run that confirms
a static reading. Runs do not wait for every `Static` item to be done: items
are picked in the protocol's order of work, and within one step of it the
`Static` items come first. When `docs/RUNTIME.md` changes, move the items it
affects between `Agent run` and `Live session` in the same commit.

Close an item by recording the answer in `spec/` and deleting the item in the
same commit, which names it in a `Queue:` trailer so that it can still be
found. An open reading of an entry, in its Open questions section, always has
an item, and is cited by the item's ID. A complete static reading makes its
entries `established` with no run. A reading that is not complete yet leaves
them `supported`, and the same commit adds a `Static` item for what it still
has to cover. Only an entry that depends on something the code does not
decide (interrupts, uninitialised memory, timing, the operating system) gets
an `Agent run` or `Live session` item for the experiment that would confirm
it, where `docs/RUNTIME.md` allows a run. An item with a
`Tried:` note is taken up again only with something the first attempt did not
have: new evidence, a new tool, or a reading nobody has tried. If that second
attempt ends in the same place, move the item, with what was tried, to the
section of the evidence that would change the outcome (`Agent run` or
`Live session` for a run, `Source` for a document), and to `Blocked` only when
that evidence is out of reach for now.

A file that would pass 1,000 lines becomes a directory of the same name, with
a `README.md` holding the heading and the `Next ID:` line, and one file per
section that has items, named after the section in lower case
with a hyphen for the space: `queue/COMBAT/static.md`,
`queue/COMBAT/agent-run.md`. Each opens with `# COMBAT: Static`. A section file
that would still pass is split by the kind of the first entry each item names:
`queue/COMBAT/static/RULE.md`.
