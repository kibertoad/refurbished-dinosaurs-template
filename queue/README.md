# Research queue

The open research questions about the original, one file per spec area,
named after the area: `queue/COMBAT.md`. The
[work protocol](https://dinorefurb.com/work-protocol/#the-queue) defines the
format; this file is a short reminder of it and stays in place when the area
files arrive.

An area file opens with the area as a `#` heading, followed by these `##`
sections in this order, each holding list items or `None.`:

1. `Static`: a reading of the executable or data files settles it.
2. `Agent run`: a run of the original `docs/RUNTIME.md` says an agent can make alone.
3. `Live session`: a run that needs a person to run the original while an agent
   measures it.
4. `Source`: a document that has to be found or read.
5. `Blocked`: stopped until something else changes; the item says what.

One item:

```markdown
- RULE-COMBAT-012, FMT-STATE-001: Which of two gangs attacking each other rolls
  first? Settles it: the order of the two calls at the resolver's entry, and one
  experiment from a save where both attack. Blocks: slice 4.
```

Every item names the spec entries it concerns (behaviour with no entry gets an
`unknown` entry first), asks one question, says what would settle it, and
names the slice it blocks or `none`. It goes in the file of the area of the
first entry it names. An item already worked on adds `Tried:`; an item under
`Blocked` adds `Waiting on:`.

Static analysis comes first. Runs are the last resort: an `Agent run` or
`Live session` item is taken up only when no `Static` item in any area can be
worked on, and after its own static attempt is recorded under `Tried:`. When
`docs/RUNTIME.md` changes, move the items it affects between `Agent run` and
`Live session` in the same commit.

Close an item by recording the answer in `spec/` and deleting the item in the
same commit. An item with a `Tried:` note is taken up again only with
something the first attempt did not have: new evidence, a new tool, or a
reading nobody has tried. If that second attempt ends in the same place, move
the item to `Blocked` with what was tried.

A file that would pass 1,000 lines becomes a directory of the same name with
one file per section that has items, named after the section in lower case
with a hyphen for the space: `queue/COMBAT/static.md`,
`queue/COMBAT/agent-run.md`. Each opens with `# COMBAT: Static`. A section file
that would still pass is split by the kind of the first entry each item names:
`queue/COMBAT/static/RULE.md`.
