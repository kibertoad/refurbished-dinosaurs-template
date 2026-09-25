# Research queue

The open research questions about the original, one file per spec area,
named after the area: `queue/COMBAT.md`. The
[work protocol](https://dinorefurb.com/work-protocol/#the-queue) defines the
format; this file is a short reminder of it and stays in place when the area
files arrive.

An area file opens with the area as a `#` heading, followed by these `##`
sections in this order, each holding list items or `None.`:

1. `Static`: a reading of the executable or data files settles it.
2. `Agent run`: a run of the original an agent can make with this repository's tools.
3. `Maintainer run`: a run that needs a person or a machine an agent cannot reach.
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
names the slice it blocks or `none`. An item already worked on adds `Tried:`;
an item under `Blocked` adds `Waiting on:`.

Close an item by recording the answer in `spec/` and deleting the item in the
same commit. After two attempts that end in the same place, move the item to
`Blocked` with what was tried. A file that would pass 1,000 lines is split into
`queue/AREA/KIND.md`, one file per section.
