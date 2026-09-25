---
name: implement-rows
description: Implement rebuild behaviour for parity rows of the current slice from the spec alone, with tests that cite spec IDs, as one batch. Use when writing or changing game code that reproduces the original's rules, formats or screens. Not for research, and not for features outside the parity matrix.
---

# Implementation batch

The rules are in the [work protocol](https://dinorefurb.com/work-protocol/#implementation-batches)
and the standard's [implementation side](https://dinorefurb.com/documentation-standard/#implementation-side).

**Work from the spec only.** Do not open Ghidra, decompiler or disassembly
output, debugger logs, captures, screenshots of the original, research notes,
`queue/`, `docs/reports/` or research goal files in this batch. If this conversation already holds any of that, run the
batch in a fresh session or a subagent given only the entry IDs and this
skill. That keeps the clean room, and it tests whether the spec says enough.

1. **Remove dead code first**: code in `src/` that cites a finding or an
   experiment (`FND-`, `EXP-`) was written for an entry that turned out to
   describe nothing. Remove it, with the tests that exercise it, as a batch
   of its own.
2. **Pick rows**: rows whose Notes start with `Defect (R-...)` first (fix
   the rebuild to what the entry says, add a test that fails without the fix,
   and remove the note), then parity rows in `parity/<AREA>.md` that the current slice of
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
   (deterministic Core, bounded parsing in Resources, presentation in Game).
   Comments cite the spec IDs they implement. A departure from the spec needs
   a deviation file first, with a Default of `off` unless its Justification
   argues otherwise.
6. **Test it**: synthetic tests for the logic; where an experiment fixture
   exists, a test that replays it and lists the row's ID. Tests that need the
   original find it through `GAME_DIR` and skip without it. Manual play is not
   a test.
7. **Update the parity rows** (Code, Tests, Notes) and run the documentation
   check and `./tools/Invoke-Validation.ps1`.
8. **Commit** with a message saying what behaviour now works, ending in `Spec:`
   (entries implemented) and `Parity:` (rows whose status changed) trailers.
9. **Print the status block** from `research-item`, with `Batch: implementation`
   and the rows' old and new statuses, then continue or run `end-session`.
