# Reviewing evidence under Standard v1

This is a research procedure, not a new standard or confidence scale. The
rules it applies are the Standard and Protocol in the local
[pinned copies](UPSTREAM-RULES.md), read as `AGENTS.md` says. Apply only the checks relevant to the entry's claims. Keep the
reasoning in findings, complete-reading citations and Open questions using the
existing v1 fields; do not add unsupported schema fields.

Apply the [bounded analysis report contracts](upstream/documentation-standard.md#bounded-analysis-reports) (lines 295-375)
to each supported query. Keep configurations and reports in `GAME_DIR` and out
of commits. A report's complete-search claim covers only its stated domain and
model. A game's request for reporter behaviour stays open until the reporter
passes that request's own case; synthetic examples and adopted guidance alone
do not close it.

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

A callee reads whatever last wrote its argument bytes before the call, which
need not be what the caller pushed: a slot made with `PUSH EBX` and filled by a
`thiscall` wrapper holds what the wrapper wrote. Name the last write to every
byte the callee reads from the caller's frame, and match the width pushed, the
width read and the bytes removed on return before calling a value an argument.
In 32-bit code give ESP's offset from its entry value at each instruction that
forms an address from ESP: a caller that leaves one call's arguments on the
stack and removes two calls' arguments with one `ADD ESP` addresses `[ESP+n]`
lower until that instruction. A trace where every slot in a stretch sits the
same distance from where the decompiler puts it is checked again. A callee can
remove an argument it never reads (`RET 4` while it reads the actor's record):
record the bytes removed as part of the call's contract and the value used as
the read it is, and say where the two could differ.

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

Code that allocates a record, fills it and links it in is read step by step:
request, the test of the returned pointer, header and payload writes, count,
linking, balancing. A test of a derived pointer (base plus payload offset) does
not test the base, so name the first access through the base on the null path
and what it does on that build. A removal that unlinks, calls a release
routine, then decrements says which load of the count the decrement uses.
Cleanup that releases and clears fields is read in the code's order, since a
release routine reads fields not cleared yet; two fields holding one pointer
give two requests, and what the cleanup leaves is the state the next read
starts from. A caller of several callees names how it combines their results
(first event, last result, OR of statuses, a fallback on one exact value, or
dropped), and the instruction that keeps, combines or drops each one; a chosen
warning followed by a success return is not a failure.

## Capacities, arithmetic and caller ranges

Separate source counts, generated counts, allocated bytes and output capacity.
Include terminators and headers. Establish integer width, signedness, truncation,
carry/overflow and the ranges callers actually supply. Record the origin of each
bound; neither adjacent data nor a convenient divisor proves a table's extent.
Two neighbouring dispatch tables with similar indexing code each get their own
extent, from their own range check, selector values and what follows them.

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
cycle check. Before saying whether a loop progresses, follow each value a callee
returns in a register to every store of it on the way back to the test,
including stores at an entry into the middle of the loop's first block, and
give the widths and signedness of the comparison; a loop that looks endless in
a decompiler is a lead. A call-graph cycle bounded by a state field (a mode set
to 0 before each call into the cycle) needs a separate argument for any loop
over records inside it, and names what was checked for writes to the field
between the store and its test. A mocked memory write at a video address proves the write in that
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
The control for an empty search is a reference whose target was located without
the address mapping under test (an absolute address in an instruction or stored
pointer, a relocation entry, a debugger run), in the same section, segment or
overlay; a relative call or jump went through the same mapping and checks
nothing. The observation lists the kinds of reference searched (each with a
known hit) and those not searched. Code nothing calls, jumps to or stores can
still be entered by a conditional branch or fall-through, so a finding that
calls code unreachable lists every kind as searched and states its assumptions
about computed targets.

## Imports and pointer tables

An operating-system or library function reached through a PE import address
table is named by the slot's address and the import the file's import tables
put there, read as [STATUS-42](upstream/documentation-standard.md#status-42) (lines 365-367)
describes, never by its position in a listing such as `dumpbin /imports`. The
query names a positive control slot. Arguments at a call site can confirm or
contradict a mapping, never identify an import. A finding about what a table of
pointers holds reads the entries from the build's bytes as
[STATUS-43](upstream/documentation-standard.md#status-43) (lines 373-375) describes: address,
stride, pointer offset and width, count and the code that bounds it, the
mapping, and per entry the length read and its terminator. An analyzer listing
is compared with the bytes, never used in their place, and an entry that points
outside mapped or initialized memory or has no terminator is recorded as unread.

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
A finding or experiment is edited in place only where nothing it records
changes (spelling, formatting, a broken link, a rewording that states the same
facts). Any correction to a recorded fact supersedes the whole entry under
[IDENTIFIERS-8](upstream/documentation-standard.md#identifiers-8) (lines 154-162): the
observations that still hold go into replacements under new IDs, which start
`recorded` and say in Alternatives (an experiment's Conclusion) what was wrong
and how it was found. Every citing entry and glossary claim then moves to the
replacements it drew on and takes the status its remaining evidence supports.

A finding's How to reproduce may name the tool and version, a script under
`tools/` with the commit it was run from, and the query, and gives every value
from a configuration kept in `GAME_DIR` that the result depends on. Rules,
formats, screens and bugs name no research tool; they cite the finding.

Inventories contain only function starts, body sizes and permitted
researcher-authored names/reasons. Export raw analyzer coordinates locally, map
them through declared views, reject ambiguous ownership and use portable paths.
Coverage totals describe the measured inventory, including exclusions; they are
not a percentage of understood behavior. `pnpm exec standard-coverage` computes
them from the inventories and the spec's locations when they are wanted, and
they are not committed. Original bytes, generated analyzer names
and analysis reports stay outside Git.
