# Bounded evidence tools

Requires Node.js 22 or later. No npm install is needed. Run synthetic tests with
`node --test tests/evidence/evidence.test.mjs`; the canonical validation gate
runs them too. These tools read metadata and never run an original executable.
They implement Standard v1 conventions; report schemas are tooling interfaces,
not a new spec version. Keep reports/configs under ignored `analysis/original/`.

## Identity and locations

Run `node tools/evidence/report.mjs operand analysis/original/operand.json`.
A config names `source` relative to the config, its explicit `sha256` baseline,
`loadSegment` (default 4096), numeric `site` at the segment operand, and numeric
`targetOffset`. The SHA-256 guard binds the local tool input; retain the
Standard's XXH3-128 build fingerprint and build ID in the finding itself.
The source may be an ordinary MZ or an MZ followed by a Borland FBOV envelope.
Other extended formats fail explicitly. Resident ranges include data: location
resolution alone does not establish an instruction or behavior.

The operand report preserves its raw value, declared relocation/fixup kind,
descriptor index, loaded segment:offset, shipped-file location and canonical
trampoline destination. It resolves pushed segments and segment loads as well
as call operands. An absent relocation stays unresolved. A finding cites the
build/file and the Standard's address or overlay `offset`, and describes the
mapping. File offsets are independent of analyzer view addresses.

Use `incoming` with numeric `target`, `limit` (default 100) and `controls`
(known call-site file offsets). It examines all declared MZ relocations and
FBOV fixups for far-call byte candidates and canonicalizes segment aliases.
A missed positive control fails. A capped report explicitly says truncated.
Candidates still need entry-based instruction verification. Near/computed calls,
unrelocated pointers and unresolved instruction boundaries remain excluded.
A zero result never proves absence outside this declared domain.

## Control flow and tables

In Ghidra, run `ExportBoundedFlow.java <entry> <limit> <ignored-output.json>`.
The script follows explicit flows from one entry and stops at other recognized
entries. Missing instructions and the limit leave edge targets for review.
It emits starts, lengths, flow kinds, successors, callees and analyzer ownership,
without code text or bytes. Addresses are Ghidra-view coordinates, not canonical
file offsets. Keep the import mapping and its provenance alongside this report.

Run `flow` with a config containing `graph`, numeric `entry` and `limit`.
The reviewer retains explicit overlapping starts, reports unresolved targets,
indirect edges, ownership disagreements and hardware/terminal boundaries, and
counts the union of reached instruction bytes separately from contiguous spans.
A local-path result does not establish input coverage, callee effects, loop
termination, hardware behavior or a complete Standard reading. Inspect those
conditions in the finding. The Ghidra hardware mnemonic warning is a lead;
manual review still covers architecture-specific I/O and memory-mapped devices.

Run `table` with source identity and a `table` object containing `start`,
`count`, `stride`, `countEvidence`, optional `limit`, and `fields` of
`name`, `offset`, `width` (1, 2 or 4). It reads only unsigned numeric fields
within the declared layout. Record the input-to-index transformation and
range checks separately before assigning semantic dispatch cases. No ASCII
fallback reads into neighboring target data.

## Inventories from multiple views

Run `ExportFunctionInventory.java <new-output.tsv>` in each relevant Ghidra
view. The exporter writes only `start` and `size` (body byte count), without
analyzer names, code or strings. Raw segmented exports need the same documented
load mapping as the resolver. For a different overlay import, first convert
its starts to canonical `0x` file offsets using that import's documented map.

An `inventory` config includes source identity, `build`, `manifest`, and
`views`. Each view has a distinct `name`, an input `path` and explicit ownership
`ranges` with numeric inclusive `start` and exclusive `end` file offsets.
Ranges must lie in the resolver's declared source regions. The report counts
accepted and excluded rows per view and rejects duplicate or aliased ownership.
Choose which view owns a region explicitly; never overwrite conflicting rows.
An inventory size counts body bytes, so it cannot define an end address.

The result gives TSV and the canonical destination, such as
`coverage/BLD-EXAMPLE/@CD/GAME.EXE.tsv` for manifest `CD:GAME.EXE`. Each start
retains the manifest prefix (`CD:GAME.EXE+0x00000210`). Optional `writeRoot`
creates that path with exclusive creation and never overwrites an inventory.
Review replacements before moving a new TSV into place. Reject unsafe or
nonportable manifest paths rather than silently renaming them. Commit only the
permitted inventory columns; keep view reports/configs local. Document the
selected views and exclusions in the build/Ghidra guide in project-authored words.
Coverage describes analyzer-discovered functions, not every function that exists.
