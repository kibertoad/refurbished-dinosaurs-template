# Bounded evidence tools

Requires Node.js 22 or later. No npm install is needed. Run synthetic tests with
`node --test tests/evidence/evidence.test.mjs`; the canonical validation gate
runs them too. These tools read metadata and never run an original executable.
They implement Standard v1 conventions; report schemas are tooling interfaces,
not a new spec version. Keep reports and configurations in `GAME_DIR`; do not commit them.

## Identity and locations

From PowerShell, run
`node tools/evidence/report.mjs operand "$env:GAME_DIR/analysis/operand.json"`.
Save redirected reports under `GAME_DIR` as well.
A config names `source` relative to the config, its `xxh3` (the XXH3-128 hash the
build entry gives, as 32 lower-case hex digits), `loadSegment` (default 4096),
numeric `site` at the segment operand, and numeric `targetOffset`. Every command,
including the `x86-` ones, refuses a source with another hash and a config that
still names a `sha256`; the report's `sourceIdentity` repeats the `xxh3` it checked.
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
(coverage controls: file offsets of known far-call sites to any target). It
examines all declared MZ relocations and FBOV fixups for far-call byte
candidates and canonicalizes segment aliases. A control need not call `target`;
it proves the search decoded real far calls in this domain, which is what makes
a negative result usable. The report lists each control with the canonical
target it resolved to. A missed or unresolved positive control fails. A capped report explicitly says truncated.
A call-byte candidate whose target cannot be mapped is listed under `unresolved`.
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

Export each relevant Ghidra view's functions to a local TSV with the header
`start\tsize` and one row per function: its start as the view shows it and its
body byte count. Leave out analyzer names, code and strings; `inventory` refuses
any other column. Raw segmented exports need the same documented load mapping
as the resolver. For a different overlay import, first convert its starts to
`0x` file offsets using that import's documented map.

An `inventory` config includes source identity, `build`, `manifest`, and
`views`. Each view has a distinct `name`, an input `path` and explicit ownership
`ranges` with numeric inclusive `start` and exclusive `end`. Ranges must lie in
the reader's mapped source regions, and no two views may own overlapping ranges.
The report counts accepted and excluded rows per view and rejects duplicate or
aliased ownership. Choose which view owns a region explicitly; never overwrite
conflicting rows. An inventory size counts body bytes, so it cannot define an
end address.

The output writes each start in the standard's notation for the file's format,
which is what `pnpm exec standard-coverage` reads:

- MZ (the default `sourceKind`, or `mz`): ranges are file offsets, and the
  config keeps `loadSegment` at its default 4096, the segment the standard
  places the load image at. A start in the load image is written `SSSS:OOOO`.
  A segmented input keeps its spelling; a file offset there becomes the
  segment:offset whose offset is below `0x10`, which names the same byte.
  Segmented starts map only into the load image. A start in a Borland FBOV
  overlay is written as an eight-digit file offset (`0x00000210`) and must lie
  inside a row of the build entry's Code ranges for the file, which the config
  gives as `codeRanges`, a list of numeric half-open `start` and `end` file
  offsets, each inside one overlay payload. Without a matching row the join
  fails, as the coverage check would.
- PE32 (`sourceKind: "pe32"`): ranges and starts are virtual addresses at the
  header's image base, and a start must lie in an executable section. It is
  written with eight digits (`0x00401000`). PE32+, LE, LX and NE files are
  refused: the reader has no section model for them yet.

The result gives TSV and the canonical destination, such as
`coverage/BLD-EXAMPLE/@CD/GAME.EXE.tsv` for manifest `CD:GAME.EXE`. Optional
`writeRoot` creates that path with exclusive creation and never overwrites an
inventory. Review replacements before moving a new TSV into place. Reject unsafe
or nonportable manifest paths rather than silently renaming them. Commit only the
permitted inventory columns; keep view reports/configs local. Document the
selected views and exclusions in the build/Ghidra guide in project-authored words.
Coverage describes analyzer-discovered functions, not every function that exists.
The protocol's [Creating and checking an inventory](upstream/work-protocol.md#creating-and-checking-an-inventory) (lines 514-522)
says how to export and check one. The pinned checker reads the protocol's
`ranges` column, the half-open body ranges of a function whose body is not one
range from its start, and does not read the `.provenance.tsv` and
`.regions.tsv` files beside an inventory as inventories. The engine's
`ExportFunctionInventory.java` Ghidra script (`docs/GHIDRA.md`) writes all
three straight to the inventory's `coverage/` path from one analysis view, with
ranges where a body needs them; the protocol commits the provenance and regions
files beside the inventory. This template's `inventory` writes, and its
`inventory-check` accepts, only the four columns above, so an inventory with a
`ranges` column is checked by `standard-coverage`, the documentation check and
the engine's `x86-inventory-check`.

`pnpm exec standard-coverage` reads the committed inventories and prints, per
file, the share of in-scope functions and bytes that an entry's `locations`
cite, and the uncited functions; `--list`, `--json` and `--require-complete`
are its other modes. A byte that two rows list counts once, and the shared
bytes are reported apart. An inventory with a row it cannot read gets no
figures: it is printed as not measured, and `--json` lists it under
`unmeasured`. Run it when the figures are needed and read them from its
output; they are printed on demand and never committed.

Once inventories exist, the documentation check also fails a range in an entry
whose end is the last byte of an inventoried function, since ranges are
half-open and such a range stops a byte short. The message gives the end the
range should have. A range that ends there on purpose goes in the entry's
`ends_on_last_byte` (`docs/SPEC-ENTRY-TEMPLATES.md`).

## Instruction-derived reports

The `x86-trace`, `x86-uses`, `x86-arguments`, `x86-effects`, `x86-returns`,
`x86-memory`, `x86-incoming`, `x86-guards`, `x86-allocation`, `x86-dispatch`,
`x86-operand`, `x86-operand-candidates`, `x86-target`, `x86-bounds`,
`x86-owner`, `x86-callees`, `x86-reach`, `x86-call-order`,
`x86-inventory-check`, `x86-pointers`, `x86-table`, `x86-bodies`,
`x86-imports` and `x86-unpack` commands run the report of the same name from
`@scientific-method/executable-reader`. It runs `pointers`, `table`, `bodies`,
`imports` and `unpack` itself and hands every other one to
`scientific-method-engine`. Install both with `pnpm install`
and `python -m pip install -r requirements-evidence.txt`; `EVIDENCE_PYTHON`
selects the Python executable, and without it the first of `python` and `python3`
that is Python 3.12 or later runs. [Bounded instruction reports](BOUNDED-EVIDENCE-REPORTERS.md)
covers setup and links the toolkit's input contract and supported subset.

`tools/evidence/legacy-image.mjs` re-exports the reader's MZ/FBOV parser, so the
lightweight commands and the `x86-` commands share one parser.
Existing lightweight `incoming`, `flow` and `table` commands retain their scope;
the instruction-derived variants supply the additional analysis.

Use `x86-target` before citing a far call's target: it keeps the raw operand,
the relocation or FBOV fixup, the stored descriptor word and decoded index, the
trampoline and the canonical target, and compares an analyzer's address with
each instead of replacing them. Use `x86-bounds` and `x86-owner` before joining a
call to its caller or bounding a reading by an analyzer's size: an analyzer's
size is a body-byte count and is never added to a start to make an end.
`x86-owner` lists every checked entry's reached `ranges` and, for owners and the
analyzer hypothesis, a `boundaryCheck` whose `joinableWithinModel` is false when
a body is incomplete, contested, stopped at a gap or the entry limit left
entries undecoded. Its `overlayExports` come only from the source FBOV tables;
a config that supplies them is rejected. Give
`formatControls` the build's known relocation, descriptor, overlay, fixup and
trampoline counts so a misread table fails the query. Declare a resident
segment's bounds from the build's code ranges in `segments` so an incoming
search over part of it is reported as partial.

A computed near word jump (segmented16 only) can be followed through a table
declared in `indirectJumps`, with the consumer and table-layout evidence and an
explicit `exhaustive` flag; the CFG commands (`x86-bounds`, `x86-owner`,
`x86-callees`, `x86-incoming` and the entry-path queries) follow its words, while `x86-trace`
and the other path reports still stop there. `x86-pointers` inventories the
declared MZ relocations and FBOV fixups whose preceding word forms an adjacent
segment:offset pair naming a query target, split into exact pairs, aliases,
unresolved and excluded rows. Its rows are word-pair candidates, never proof of
runtime pointer use, and it reads only MZ/FBOV sources.

`x86-reach` lists the target sites a set of starts reaches over resolved calls
and jumps, with the fewest-call chain to each and every reached transfer it
could not resolve, which is the walk a census of a mechanism's sites starts
from. `x86-inventory-check` lists the resolved direct call targets that no row
of a committed inventory starts at. `x86-bodies` says where each byte of given
function bodies lies by the MZ and FBOV tables, and gives every FBOV
descriptor's words, span and loaded address. `x86-imports` gives the import a
PE32 file's import tables put in each import address table slot, checked
against a positive control. `x86-unpack` decodes an LZEXE 0.90 or 0.91, EXEPACK
or PKLITE 1.00 to 2.01 executable without running its stub, writes the unpacked
file by the reader's layout rule, and prints the `size`, `xxh3`, `format` and
`tool` that the build's `unpacked` item gives. The toolkit guide covers their
inputs and limits.

## PE32 executables

The `x86-` commands also accept `sourceKind: "pe32"` for i386 executables. The
loader derives preferred-base mappings from validated source sections. Regions
and entry/control sites are file offsets; flat memory query offsets are VAs. The
toolkit guide documents 32-bit frames, scaled addressing, the flat-segment
assumption and the unsupported indirect and runtime routes.

## Committed inventory verification

`inventory-check` reads the same hash-guarded source as `inventory` (MZ/FBOV, or PE32 with `sourceKind: "pe32"`), with `build`, `manifest` and, for overlay starts, `codeRanges`. Its `inventory` object names a local input `path` and `repositoryPath`, which must match the generated portable coverage destination; the local `path` must end with that `repositoryPath`, so the file read is the one the destination check names. Every start must be in the standard's notation for the file, as `inventory` writes it: an upper-case `SSSS:OOOO` in the MZ load image (any spelling of the byte), an eight-digit upper-case file offset inside a Code ranges row in overlay code, or an eight-digit upper-case virtual address in an executable PE section. Starts must be unique, counting two spellings of one byte as the same start. Body byte counts are positive/bounded and are never interpreted as end addresses. Committed TSV columns are start, size, optional researcher-authored name and out_of_scope. No analyzer names/code/bytes belong there; analyzer default names such as `FUN_0040` are rejected. A configured project retaining a historical path supplies `legacyPath` plus nonempty `legacyEvidence`; the checker validates that exact safe path but continues to report the portable canonical destination. A legacy allowance is an explicit research input, not proof of an arbitrary path's provenance.

`x86-operand-candidates` inventories encoded displacement/immediate matches with
prefix order/repeats, widths and overlap groups. Verified entry-path memory uses,
rejected overlaps and unresolved boundaries remain distinct. Relative branches
and implicit operands never match. Controls, scan caps and result caps keep
partial search and incomplete groups explicit; see the toolkit guide.

`x86-callees` reads a bounded call graph from the entry and established region
entries. An edge back into the active path is `recursivePath`; an edge to an
already read node is `sharedNodeReuse` and still carries that node's memory
observations, continuation assumptions and unread dependencies. It describes
conditional entry-CFG structure, never runtime recursion, and a missing write is
never a read-only claim. Node, edge, depth and instruction limits keep omitted
work unresolved.

`x86-arguments` and `x86-effects` retain LEA address formations and link consumed
near-pointer arguments and later dereferences to them, with the formation and
dereference segments and registers. LEA's default segment never binds a pointer;
storage merges only for propagated equal segments and identical or affine
offsets. `pointerFormationLimit` keeps the most recent formations, and evicted
ones stay counted and refuse merging; see the toolkit guide.
