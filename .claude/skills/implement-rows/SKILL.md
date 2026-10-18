---
name: implement-rows
description: Implement rebuild behaviour for parity rows of the current slice from the spec alone, with tests that cite spec IDs, as one batch. Use when writing or changing game code that reproduces the original's rules, formats or screens. Not for research, and not for features outside the parity matrix.
---

# Implementation batch

The rules are in the [work protocol](../../../docs/upstream/work-protocol.md#implementation-batches) (lines 206-224)
and the standard's [implementation side](../../../docs/upstream/documentation-standard.md#implementation-side) (lines 1216-1344).
Open a linked section only when a step leaves a question it answers, read
only the lines the link gives, and never a section already read this session.

**Work from the spec only.** Do not open Ghidra, decompiler or disassembly
output, debugger logs, captures, screenshots of the original, research notes,
`queue/`, `docs/reports/` or research goal files in this batch. If this conversation already holds any of that, run the
batch in a fresh session or a subagent given only the entry IDs and this
skill. That keeps the clean room, and it tests whether the spec says enough.

1. **Settle finding citations first**: code in `src/` cites the rules,
   formats, screens and bugs it implements, never a finding or an experiment
   (`FND-`, `EXP-`). For each such citation, `PLACEHOLDER:` comments included,
   as a batch of its own: move a citation of a superseded finding or
   experiment to what its `superseded_by` names, then settle each one by what
   the code does. Where the code implements rules, formats, screens or bugs
   that are not superseded (a deviation that has not been dropped counts as
   the entries its Departs from names), move the citation to each of them that
   lists the finding or experiment in its `evidence` and is not cited there
   already, or delete it where none does. Each rule, format or screen that
   gains the citation takes Code `partial` with a note naming the finding or
   experiment. Where nothing that is not superseded or dropped describes what
   the code does, remove the code with the tests that exercise it.
2. **Pick rows**: rows whose Notes start with a `Defect` note first, whether
   it names a report (`Defect (R-...)`) or the finding or experiment that
   changed the entry (`Defect (FND-...)`, `Defect (EXP-...)`). Fix the
   rebuild to what the entry says, add a test that fails without the fix,
   and remove the note; when the fault is branch logic in `Game`, extract the
   rule into `Core` first and pin every branch with a test. Then take parity
   rows in `parity/<AREA>.md` that the current slice of
   `docs/IMPLEMENTATION-PLAN.md` names, whose Code is not `complete`. Prefer
   rows whose spec status is `supported` or `established`.
3. **Read the entries** the rows name, and every rule, format and glossary term
   they cite. Read the deviations listed on the rows.
4. **Where the spec does not say enough** to write the code, stop at that
   point and write what the code needs to know as a question in the entry's
   Open questions section. Where no entry describes the behaviour at all,
   create an `unknown` entry holding only that question, with its parity row.
   Then either leave the row `partial`, or write the code with a
   `PLACEHOLDER: <spec ID>` comment; the row cannot be `complete` while the
   comment exists. Start the row's Notes with `Spec gap:` and the question; the
   next research session turns it into a queue item and adds the item's ID,
   and removes the note once the spec answers it. A `partial` row with no note
   is one the spec now answers: pick it up again. Never fill a gap with a
   plausible guess. Under `spec/` add only questions and such `unknown`
   entries: never evidence, statuses or descriptions. Never open `queue/`: its
   items hold what research tried.
5. **Write the code** within the architecture boundaries in `AGENTS.md`
   (deterministic Core, bounded parsing in Resources, presentation in Game). A
   decision — a gate, a cascade, a branch table, an outcome selector, a state
   transition — lives in `Core` as a pure function of the serializable state
   and its inputs, never in `Game` alone.
   Comments cite the spec IDs they implement. An address of the original in a
   comment (`0x…` or a neutral name such as `fn_00478CD0`) must be one the
   cited entry, or a finding or experiment in its `evidence`, records; never
   cite a finding to make the check pass, even where its message suggests
   one. Where no entry the code implements records the address, leave it
   out, and if the code needs it, that is a spec gap (step 4) and the row
   stays `partial` without that code. A departure from the spec needs
   a deviation file first, with a Default of `off` unless its Justification
   argues otherwise.
6. **Test it**: synthetic tests for the logic, one per branch the entry
   describes, including the branches `Game` cannot reach yet and the
   "impossible" arms of a guard; where an experiment fixture exists, a test
   that replays it and names both the experiment's ID and the row's ID. A fixture with `draws` is
   replayed through the generator's hook and compared draw by draw, rule ID
   included; a failure names the first draw that differs. The rebuild is
   never fitted to a recording: a divergence the spec does not explain is a
   `Spec gap:`. Tests that need the original find
   it through `GAME_DIR`, skip without it, and carry the comment
   `// needs: GAME_DIR`; after they pass locally with the original, record the
   run in a `validation/` run file as `docs/VALIDATION.md` describes. Where the code
   uses a different algorithm from the entry's procedure, compare the state a
   later call reads as well as the result (for a queued search: a node queued
   twice, a score improved while an older entry waits, a stop at the step
   limit and a resume). Where the batch wires a rule into `Game`, follow one
   shared value through input, `Core`, presentation and a save and restore,
   with distinct values per axis, and test what a second actor sees at each
   `# visible:` point. A checkpoint or replay change follows the protocol's
   [Checkpoints and replay](../../../docs/upstream/work-protocol.md#checkpoints-and-replay) (lines 308-316)
   and [Continuation cases](../../../docs/upstream/work-protocol.md#continuation-cases) (lines 318-350).
   Where the state that
   decides how play continues sits in several components, test a field
   several components copy, changed by a helper and checked in the next
   consumer and after a restore; a checkpoint taken between two steps of a
   rule accepted, while a value no step produces is rejected; each required
   field missing on its own, and an explicit null apart from a missing field;
   state published on a path that returns zero or fails; integer identities
   in different roles with different values; and input that names one thing
   twice, such as numeric keys `11` and `011` read as decimal, rejected
   before anything is built. Where the entry's shape calls for them, add the
   cases of
   [Calls that combine results](../../../docs/upstream/work-protocol.md#calls-that-combine-results) (lines 226-242)
   (an earlier callee reports and a later one returns 0; a fallback taken on
   one exact status, tested with 0, 1, 2 and a negative status; each caller
   of one target given those statuses, since callers can test its result
   differently),
   [Rules behind an adapter](../../../docs/upstream/work-protocol.md#rules-behind-an-adapter) (lines 244-260)
   (each case run on the rules layer directly and again through the adapter,
   which keeps shared objects and read-only collections, rejects no input the
   entry gives an outcome for, and keeps what the rule did before a failure),
   [Arithmetic at the original's widths](../../../docs/upstream/work-protocol.md#arithmetic-at-the-originals-widths) (lines 262-282)
   (operands at the largest and smallest values of their types, stores between
   two writes, shift counts of 0 and 32, values outside every narrower type
   through the adapter; a guard checked before a transformation, such as a
   `UINT8` count of 0, 1, 127, 128 and 255 that is doubled; a body that runs
   before its decrement and test, where a count taken to 0 wraps; a loop limit
   the original loads again on each pass while the loop's writes can reach
   it; the bits of each stored floating-point intermediate and single-precision
   constant, such as `0x3FD55556` against `0x3FD55555` for `1/3` stored as
   `FLOAT32` then times 5; a copy that fits its record but runs from one field
   into the next) and
   [Allocation, containers and cleanup](../../../docs/upstream/work-protocol.md#allocation-containers-and-cleanup) (lines 290-306)
   (a test-supplied allocator and release routine that record calls, return
   null, fill blocks with a pattern and read or change the container when
   called; a count checked before the allocation and loaded again by the copy,
   changed in between, with counts of 0, 1 and the type's largest value). From
   the continuation cases, also: a decision taken from a value read before a
   call is not taken again after it, and a value read at several points is
   changed between reads; state a failure leaves (a tried flag, published
   arguments) changes the next call, so call again with it kept and changed;
   a field that says which kind an object is follows the copy-ownership rule;
   the identity of a source (path, content fingerprint) is kept apart from the
   request and destination it fills. A rule moved out of a screen handler is
   tested as Rules behind an adapter says.
   None of these tests validates a row, and the row's Tests column does not
   list them.
7. **Update the parity rows** (Code, Tests, Notes). Tests lists only files
   that compare the rebuild with the original: each carries the
   `needs: GAME_DIR` comment, or names by ID an experiment that the row's
   entry (or a bug whose `related` names the entry) lists in its `evidence`
   and replays that fixture or compares with its measured distribution.
   Tests over synthetic state, decoder tests on synthetic files, tests that
   compare the rebuild with itself and a deviation's Tests item are left out,
   and a row with only those has Tests `None`. Then run the documentation
   check and the tests the change touches
   (`./tools/Invoke-Validation.ps1 -TestFilter <filter>`); CI runs the rest.
8. **Commit** with a message saying what behaviour now works, ending in `Spec:`
   (entries implemented) and `Parity:` (rows whose status changed) trailers.
9. **Print the status block** from `research-item`, with `Batch: implementation`
   and the rows' old and new statuses. Under a goal whose condition does not
   hold, start the next rows in the same turn (`docs/goals/README.md` lists the
   only reasons to stop); after the owner asks to wrap up, or with no goal,
   run `end-session`.
