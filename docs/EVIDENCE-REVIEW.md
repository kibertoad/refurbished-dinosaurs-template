# Reviewing evidence under Standard v1

This is a research procedure, not a new standard or confidence scale. Use the
published Standard and Protocol, or the verified [pinned copies](UPSTREAM-RULES.md)
when offline. Apply only the checks relevant to the entry's claims. Keep the
reasoning in findings, complete-reading citations and Open questions using the
existing v1 fields; do not add unsupported schema fields.

## Locations and complete readings

Identify the build and manifest file before interpreting a location. Distinguish
file offset, load address, relocation operand and analysis address. For MZ
resident code retain relocation provenance; for overlays retain descriptor,
fixup and trampoline provenance. Equivalent runtime aliases share a canonical
file target. See [evidence tools](EVIDENCE-TOOLS.md). Toolkit PR #11 permits file
offsets for MZ overlays; COM, NE, PE, LE, LX and ELF executable locations still
require addresses. Unknown formats require a standard decision, not a guessed
checker exception. Packed files use their declared unpacked format.

A function entry and an analyzer body are leads. Follow reachable instructions,
including shared tails and separately entered overlapping instruction streams.
Record gaps, cross-entry edges, indirect targets and external effects. Body-byte
coverage does not prove instruction identity, all callers, termination or a
complete reading. A reviewed call continuation still depends on the callee's
return and effects. Do not infer a whole-file range from start plus body size.

## Memory identity and arguments

Before naming a field, record its segment or owning object, offset, width,
lifetime and the paths that initialize it. Resolve aliases and indirect writes.
For arguments, establish the caller's pushed width and order, near/far return
frame, callee consumption and cleanup. Describe arguments by semantic parameter
in the spec; keep machine details in the finding that proves the mapping.

Synthetic example: DS:0020 and SS:0020 are different storage unless the segment
bases are proved equal. A caller pushing a word does not prove the callee reads
both bytes. A far return frame shifts stack arguments relative to a near frame.
Two byte writes can overlap a later word read; the last write on each path wins.
A string operation's direction depends on DF and its incoming state. An
unresolved segment, flag or initializer remains an Open question, not a default.

## Paths, failures and ordering

For each branch the entry describes, trace guards before accesses, writes in
execution order, calls, success/failure exits and cleanup. Identify which values
are definitely assigned at each exit. A failure return does not imply rollback.

Synthetic example: a callee returns FFFF but its caller tests only AL. Preserve
the byte test rather than interpreting a signed word error convention. If a
store precedes a failing allocation, the store persists unless an observed path
undoes it. Two stores through potentially aliased pointers can change the final
value when reordered. A bounds check after a read cannot justify that read's
safety. An early failure reaching cleanup without initialization does not prove
that cleanup receives a null handle. Write separate claims when these paths
have different evidence.

## Capacities, arithmetic and caller ranges

Separate source counts, generated counts, allocated bytes and output capacity.
Include terminators and headers. Establish integer width, signedness, truncation,
carry/overflow and the ranges callers actually supply. Record the origin of each
bound; neither adjacent data nor a convenient divisor proves a table's extent.

Synthetic example: 12 inputs generating up to 3 outputs each need room for 36
outputs, plus a terminator if written. A 32-byte allocation with a 4-byte header
has 28 payload bytes. An unsigned 8-bit intermediate for count times 4 wraps at
count 64 even when a later destination is wider. A caller range of 0..15 may
exclude that wrap for one path; it says nothing about unreviewed callers. Test
boundary and exceptional values from the established domain, not an invented
larger or narrower API contract.

## Progress and external behavior

A complete reading covers loops and recursive calls as well as branch outcomes.
Identify a decreasing measure, bounded state progression, or explicit assumptions
needed for termination. Distinguish the origin of an error from its propagation.
A shared callee reached twice is not recursion; a cycle in the call graph needs
its own progress argument. Reaching all local branches is insufficient when a
callee, callback or external input can prevent return.

Synthetic example: a loop subtracting zero on one path has no decreasing measure.
A recursive traversal needs evidence that children cannot cycle, or an effective
cycle check. A mocked memory write at a video address proves the write in that
model; it does not prove pixels, port I/O, timing, interrupts or operating-system
behavior. Emulated calls retain the Protocol's branch/caller/input conditions
and cannot establish claims that depend on those external effects. Seek the
bounded original observation through the repository's runtime policy.

## Negative evidence and queue size

A negative result names the searched build/file, mapped ranges, match semantics,
positive controls, caps and exclusions. A raw byte search is not an instruction
search; absence from analyzer-defined strings is not absence from loaded bytes.
A relocated far-call scan excludes near, computed and unrelocated calls. A
successful control proves that control was covered, not that exclusions vanished.
A cap, failed control or unresolved mapping prevents an exhaustive negative.

Give each queue item one falsifiable question and a `Settles it:` condition. If a
question requires independent segment identity, caller bounds and hardware
behavior, split it into separately identified items and cite dependencies. Close
only what the spec answers, in the same commit. Keep competing readings and their
support in the entry. A repeated attempt without new evidence follows the
Protocol's move-to-settling-evidence rule; do not append an endless list of tasks.

## Status and inventories

Keep the v1 statuses. No tool output automatically promotes a claim. A complete
reading cites all relevant findings; unresolved dependencies limit the claim or
remain separate questions. Contradiction makes a claim disputed; supersession
preserves history and transfers active citations to the replacements.

Inventories contain only function starts, body sizes and permitted
researcher-authored names/reasons. Export raw analyzer coordinates locally, map
them through declared views, reject ambiguous ownership and use portable paths.
Coverage totals describe the measured inventory, including exclusions; they are
not a percentage of understood behavior. Original bytes, generated analyzer names
and analysis reports stay outside Git.
