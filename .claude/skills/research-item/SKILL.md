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
   `Spec gap:` and has no item ID, add a queue item for its entry with that
   question, taking the ID from the file's `Next ID:` line and raising it,
   and add the ID to the note (`Spec gap (Q-COMBAT-014):`), in one commit.
   The note stays until the batch that closes the item removes it.
2. **Pick one item** from `queue/<AREA>.md`, or a few about the same entry,
   within the areas your goal claims (an item is taken only if every entry it
   names is in one of them; to take another area, add it to the goal's scope
   first, only if no other goal file claims it, and get that onto the main
   branch). Read the entries it names, their Open questions sections and any
   `Tried:` note. Take up an item that has a `Tried:` note only with something
   that attempt did not have: new evidence, a new tool, or a reading nobody
   has tried. If that second attempt ends in the same place, move the item to
   the section of the evidence that would change the outcome (`Emulated call`,
   `Agent run` or `Live session` for a run, `Source` for a document) with what was tried,
   and to `Blocked` with `Waiting on:` only when that evidence is out of
   reach for now.
3. **State the question and the competing readings.** Decide what evidence
   would rule each reading out. Readings still open when the batch ends go in
   the Open questions section of the entry they concern, one per reading: what
   it claims, the findings and experiments for and against it by ID, and the
   evidence that would rule it out (the same as the queue item's Settles
   it). A reading the evidence rules out moves to the Alternatives section of
   the finding that ruled it out, and the one that survives becomes the
   entry's description at the status its evidence supports. Every open
   reading has a queue item, and outside the spec it is cited by that item's
   ID; readings get no IDs of their own. An entry whose readings are all
   open stays `unknown` (or `sourced`). Never leave a reading only in the
   session's memory, and never let one reach code except as what an entry
   says.
4. **Gather evidence statically**: data files, then a static reading
   (procedure in `docs/GHIDRA.md`). Settle statically whatever a static
   reading can settle, even where a run could too. Keep neutral names
   (`fn_00478CD0`) until evidence shows what a thing does. Keep decompiler
   output, listings and dumps in ignored local storage, and read bounded
   instruction context when signedness or control flow matters. A run of the
   original that you drive is the last resort for each question, because such
   runs are fragile (focus, timing, emulator automation, unexpected dialogs)
   and a result that cannot be repeated is not evidence. Script it, start from
   a fixed state, and record enough to repeat it. Only for an item under
   `Agent run` whose own static attempt is under `Tried:` or that asks for the
   run confirming a static reading of an entry that depends on something the
   code does not decide, and only while holding the run lock (path
   in `docs/RUNTIME.md`; take it with an exclusive create that fails if the
   file exists, record the ID of every process the run starts in it, and if
   another agent holds it, do not wait). Never touch a process you did not
   start. Items under `Live session` go to `live-session`.
   For an item under `Emulated call`, follow the protocol's
   [Emulated calls](https://dinorefurb.com/work-protocol/#emulated-calls).
   It needs no run lock. Write each reading under test as a procedure in
   `tools/emu/`, set up only the state the function reads (through layout
   fields that are `supported` or `established`), choose the special values,
   the type edges, cases for every branch and seeded random cases, run them
   all in the harness and in each reading, and compare exactly. The fixture
   names arguments by the rule's Parameters and memory by field path or
   glossary name, never by register or address, with
   `starting_state: emulated-call`. The entry reaches `established` only if
   the cases reached every branch it describes and the reading of its
   callers and inputs is complete, and a rule with `# may run:` never does on
   emulated calls alone. If Ghidra's p-code emulator disagrees on a replay,
   move the item to `Blocked` with the defect under `Waiting on:` and change
   nothing in the spec.
5. **Record it** in `spec/` with the templates in `docs/SPEC-ENTRY-TEMPLATES.md`:
   one finding per observation, an experiment with a fixture for a controlled
   run. Then give each entry it concerns the status the evidence supports
   for everything the entry says, and put what the evidence does not reach in
   its Open questions. Only direct evidence counts: a finding that locates the
   code producing the behaviour. Circumstantial evidence (sizes that divide,
   value patterns, names, the manual, similar games) is recorded as findings
   and named in Open questions for or against a reading, never listed in
   `evidence`, and leaves the entry `unknown` or `sourced`.
   A complete reading makes an entry `established` with no run, and is the
   usual way there: every branch, every place a format is read or written,
   every caller and every write to the state it reads, every indirect call
   resolved, the instructions checked wherever types, signedness or casts
   decide a result, and nothing left to interrupts or threads (`# may run:`),
   memory nothing wrote, timing, or the operating system. List its findings in
   the entry's `complete_reading`. An entry that depends on any of those needs
   an experiment or dynamic finding beside the static one, covering every
   branch and, for a random outcome, enough repetitions for its comparison. A
   rule stays below `established` while a glossary claim it relies on is
   `(unknown)`. Evidence that contradicts an entry makes it `disputed`. Never
   reproduce content.
6. **Update the queue in the same change**: delete the settled item, split an
   item that turned out to be two questions, add every new question as a new
   item in the queue file of the area of the first entry it names, and add
   `Tried:` to an item you could not settle, saying what was examined and why
   it did not settle the question (anything learned about the original is a
   finding first, and `Tried:` names it). Where a static reading settled the
   item without being complete, add a `Static` item for what it still has to
   cover, and an `Emulated call` item where the harness can reach the
   functions the reading covers (every rule the code decides gets one, even
   once established, since its fixture is what the row's tests replay). Only where the entry depends on something the code does not decide,
   and `docs/RUNTIME.md` allows a run, add an `Agent run` or `Live session`
   item for the experiment that would confirm it; where no run is possible,
   say in the entry's Open questions which observation of the original would
   confirm it, so that a tester's capture can later.
   Remove the `Spec gap (Q-...)` note of every item you closed.
7. **Keep the check passing, and change nothing else outside `spec/`,
   `queue/` and `tools/`:**
   - an entry whose status changed: copy it into its row's Spec status and
     work out Status again; a `disputed` one: its row's Notes names the
     evidence in the entry's `conflicting`, until the dispute is settled;
   - a new rule, format or screen entry: add its row with Code `missing`; a
     retitled one: copy the Title into its row;
   - a superseded entry: remove its row, and move every citation of it in
     `src/`, `tests/`, `tools/`, `parity/` and the deviations that have not
     been dropped to the entries its `superseded_by` names, all of them where
     it names several (changing the ID only). Leave a dropped deviation's
     Departs from as it is. Where code was written for the old entry, set the
     row of each rule, format or screen that replaced it to Code `partial`
     with Notes naming the old one; where only findings or experiments
     replaced it, the code now cites them, and an implementation session
     removes it;
   - a deviation whose Departs from moved: list it in the Deviations column of
     the new entry's row;
   - `Spec gap:` notes: add item IDs (step 1) and remove the notes of closed
     items.
8. **Check**: run the documentation check (it rewrites `spec/index/` and
   `PARITY.md`; commit what it writes). Resolve a merge conflict in those
   files by taking either side and running the check again, never by hand.
9. **Commit** with a message saying what was found and on what evidence, ending
   in a `Spec:` trailer listing the entries created or changed, and a
   `Parity:` trailer listing the rows whose status changed, if any, and a
   `Queue:` trailer listing the IDs of the items it closed.
10. **Print the status block** (format below), then continue with the next item
    if a goal is running, or `end-session` if not.

```text
Status
Goal: docs/goals/<name>.md, or none
Batch: research, <entry> <old status> -> <new status>, ...
Queue <AREA>: static N, emulated call N, agent run N, live session N, source N, blocked N
Checks: documentation check <passed|failed>, fast gate <passed|failed|not run>
Commit: <short sha> (<pushed|not pushed>)
Next: <queue item ID, entry and question>
```

An item that needs a person goes under `Live session` with enough detail for
`live-session` to script it; do not wait for one.
