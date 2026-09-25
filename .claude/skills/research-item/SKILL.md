---
name: research-item
description: Settle one research question about the original game as one batch - read the executable or data files, or run the original, record findings or experiments under the documentation standard, update entry statuses and the queue, and commit. Use for any queue item, any "find out how the original does X", and for survey work that adds spec entries.
---

# Research batch

The rules are in the [methodology](https://dinorefurb.com/methodology/), the
[documentation standard](https://dinorefurb.com/documentation-standard/) and
the [work protocol](https://dinorefurb.com/work-protocol/#research-batches).
`AGENTS.md` summarizes the clean-room rules; they never bend.

1. **Pick one item** from `queue/<AREA>.md`, or a few about the same entry.
   Read the entries it names, their Open questions sections and any `Tried:`
   note. If the item has been tried twice without new evidence, move it to
   `Blocked` instead of trying again.
2. **State the question and the competing readings** in your working notes
   (not in the repository). Decide what evidence would rule each reading out.
3. **Gather evidence, cheapest first**: data files, then a static reading
   (procedure in `docs/GHIDRA.md`), then a run of the original. Keep neutral
   names (`fn_00478CD0`) until evidence shows what a thing does. Keep
   decompiler output, listings and dumps in ignored local storage, and read
   bounded instruction context when signedness or control flow matters.
4. **Record it** in `spec/` with the templates in `docs/SPEC-ENTRY-TEMPLATES.md`:
   one finding per observation, an experiment with a fixture for a controlled
   run. Then give each entry it concerns the status the evidence supports,
   and put what the evidence does not reach in its Open questions. Evidence
   that contradicts an entry makes it `disputed`. Never reproduce content.
5. **Update the queue in the same change**: delete the settled item, split an
   item that turned out to be two questions, add every new question as a new
   item, and add `Tried:` to an item you could not settle.
6. **Check**: run the documentation check (it rewrites `spec/index/` and
   `PARITY.md`; commit what it writes). Do not change `src/` apart from tools
   the research needed.
7. **Commit** with a message saying what was found and on what evidence, ending
   in a `Spec:` trailer listing the entries created or changed.
8. **Print the status block** (format below), then continue with the next item
   if a goal is running, or `end-session` if not.

```text
Status
Goal: docs/goals/<name>.md, or none
Batch: research, <entry> <old status> -> <new status>, ...
Queue <AREA>: static N, agent run N, maintainer run N, source N, blocked N
Checks: documentation check <passed|failed>, fast gate <passed|failed|not run>
Commit: <short sha> (<pushed|not pushed>)
Next: <entry and question>
```

An item that needs a person goes under `Maintainer run` with enough detail for
`maintainer-session` to script it; do not wait for one.
