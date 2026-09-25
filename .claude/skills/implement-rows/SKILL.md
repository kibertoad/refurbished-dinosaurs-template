---
name: implement-rows
description: Implement rebuild behaviour for parity rows of the current slice from the spec alone, with tests that cite spec IDs, as one batch. Use when writing or changing game code that reproduces the original's rules, formats or screens. Not for research, and not for code outside the parity matrix.
---

# Implementation batch

The rules are in the [work protocol](https://dinorefurb.com/work-protocol/#implementation-batches)
and the standard's [implementation side](https://dinorefurb.com/documentation-standard/#implementation-side).

**Work from the spec only.** Do not open Ghidra, decompiler or disassembly
output, debugger logs, captures or research notes in this batch. If this
conversation already holds any of that, run the batch in a fresh session or a
subagent given only the entry IDs and this skill. That keeps the clean room,
and it tests whether the spec says enough.

1. **Pick rows**: parity rows in `parity/<AREA>.md` that the current slice of
   `docs/IMPLEMENTATION-PLAN.md` names, whose Code is not `complete`. Prefer
   rows whose spec status is `supported` or `established`.
2. **Read the entries** the rows name, and every rule, format and glossary term
   they cite. Read the deviations listed on the rows.
3. **Where the spec does not say enough** to write the code, stop at that
   point: add an item to `queue/<AREA>.md` for the entry, saying what the
   code needs to know. Then either leave the row `partial`, or write the code
   with a `PLACEHOLDER: <spec ID>` comment; the row cannot be `complete`
   while the comment exists. Never fill a gap with a plausible guess. Change
   nothing under `spec/`: the research batch that takes up the item adds the
   gap to the entry's Open questions if it cannot settle it.
4. **Write the code** within the architecture boundaries in `AGENTS.md`
   (deterministic Core, bounded parsing in Resources, presentation in Game).
   Comments cite the spec IDs they implement. A departure from the spec needs
   a deviation file first, with a Default of `off` unless its Justification
   argues otherwise.
5. **Test it**: synthetic tests for the logic; where an experiment fixture
   exists, a test that replays it and lists the row's ID. Tests that need the
   original find it through `GAME_DIR` and skip without it. Manual play is not
   a test.
6. **Update the parity rows** (Code, Tests, Notes) and run the documentation
   check and `./tools/Invoke-Validation.ps1`.
7. **Commit** with a message saying what behaviour now works, ending in `Spec:`
   (entries implemented) and `Parity:` (rows whose status changed) trailers.
8. **Print the status block** from `research-item`, with `Batch: implementation`
   and the rows' old and new statuses, then continue or run `end-session`.
