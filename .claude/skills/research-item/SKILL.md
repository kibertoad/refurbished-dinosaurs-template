---
name: research-item
description: Settle one research question about the original game as one batch - read the executable or data files (or, as a last resort, run the original), record findings or experiments under the documentation standard, update entry statuses, parity rows and the queue, and commit. Use for any queue item, any "find out how the original does X", and for survey work that adds spec entries.
---

# Research batch

The rules are in the [methodology](https://dinorefurb.com/methodology/), the
[documentation standard](https://dinorefurb.com/documentation-standard/) and
the [work protocol](https://dinorefurb.com/work-protocol/#research-batches).
`AGENTS.md` summarizes the clean-room rules; they never bend.

1. **Turn spec gaps into items**: for every parity row whose Notes starts with
   `Spec gap:`, add a queue item for its entry with that question and remove
   the note, in one commit.
2. **Pick one item** from `queue/<AREA>.md`, or a few about the same entry,
   within the areas your goal claims (an item is taken only if every entry it
   names is in one of them or in an area no running goal claims). Read the
   entries it names, their Open questions sections and any `Tried:` note. Take
   up an item that has a `Tried:` note only with something that attempt did
   not have: new evidence, a new tool, or a reading nobody has tried. If that
   second attempt ends in the same place, move the item to `Blocked` with what
   was tried and what would change the outcome.
3. **State the question and the competing readings** in your working notes
   (not in the repository). Decide what evidence would rule each reading out.
4. **Gather evidence statically**: data files, then a static reading
   (procedure in `docs/GHIDRA.md`). Settle statically whatever a static
   reading can settle, even where a run could too. Keep neutral names
   (`fn_00478CD0`) until evidence shows what a thing does. Keep decompiler
   output, listings and dumps in ignored local storage, and read bounded
   instruction context when signedness or control flow matters. A run of the
   original is the last resort: only for an item under `Agent run`, only when
   no `Static` item in any area can be worked on and this item's static
   attempt is under `Tried:`, and only while holding the run lock
   (`~/.refurbished-dinosaurs/run.lock`; if another agent holds it, do not
   wait). Never touch a process you did not start. Items under `Live session`
   go to `live-session`.
5. **Record it** in `spec/` with the templates in `docs/SPEC-ENTRY-TEMPLATES.md`:
   one finding per observation, an experiment with a fixture for a controlled
   run. Then give each entry it concerns the status the evidence supports
   for everything the entry says, and put what the evidence does not reach in
   its Open questions. An experiment beside a static finding makes an entry
   `established` only if it covers every branch of the procedure and, for a
   random outcome, enough repetitions for its comparison, and a rule stays
   below `established` while a glossary claim it relies on is `(unknown)`.
   Evidence that contradicts an entry makes it `disputed`. Never reproduce
   content.
6. **Update the queue in the same change**: delete the settled item, split an
   item that turned out to be two questions, add every new question as a new
   item in the queue file of the area of the first entry it names, and add
   `Tried:` to an item you could not settle.
7. **Keep the check passing, and change nothing else outside `spec/`,
   `queue/` and `tools/`:**
   - an entry whose status changed: copy it into its row's Spec status and
     work out Status again;
   - a new rule, format or screen entry: add its row with Code `missing`; a
     retitled one: copy the Title into its row;
   - a superseded entry: remove its row, move every citation of it in `src/`,
     `tests/`, `tools/`, `parity/` and `deviations/` to what replaced it
     (changing the ID only), and where code was written for the old entry,
     set the new entry's row to Code `partial` with Notes naming the old one.
8. **Check**: run the documentation check (it rewrites `spec/index/` and
   `PARITY.md`; commit what it writes).
9. **Commit** with a message saying what was found and on what evidence, ending
   in a `Spec:` trailer listing the entries created or changed, and a
   `Parity:` trailer listing the rows whose status changed, if any.
10. **Print the status block** (format below), then continue with the next item
    if a goal is running, or `end-session` if not.

```text
Status
Goal: docs/goals/<name>.md, or none
Batch: research, <entry> <old status> -> <new status>, ...
Queue <AREA>: static N, agent run N, live session N, source N, blocked N
Checks: documentation check <passed|failed>, fast gate <passed|failed|not run>
Commit: <short sha> (<pushed|not pushed>)
Next: <entry and question>
```

An item that needs a person goes under `Live session` with enough detail for
`live-session` to script it; do not wait for one.
