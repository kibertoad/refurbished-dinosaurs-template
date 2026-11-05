# Research closure assessment

Use an explicit function ownership map and a finite list of remaining
obligations to choose work that closes a subsystem contract. The accepted
complete-reading count comes from the pinned `standard-coverage` report.
An ownership assignment or checked box changes no entry's evidence status.

After the order of work selects a question in partly read code, assess the
existing findings and retained reports before another code reading. Rewrite
the queue item's `Settles it` to hold only its remaining obligations, citing
the findings that answered the rest. Reference those queue items by ID from
the assessment. Check whether the findings
already meet the standard's complete-reading conditions and record qualifying
findings in the entry's `complete_reading`. State which remaining obligations
the next batch can remove and what result would remove them. A bounded answer
can need several functions; a function boundary does not require a commit.

Before building a reporter, check existing readers and retained controlled
reports. Prefer a reusable census where questions share a source and mechanism;
name its queue items and the capability existing tools lack. If checks or
bookkeeping seem to dominate, time research, tooling, checks and handover
separately before proposing changes. Required gates and evidence conditions
still apply.

## Establish the baseline

Run the documentation check, then measure the current inventories:

```sh
node tools/upstream.mjs docs --check
pnpm exec standard-coverage --json --list
```

Keep report output in ignored local storage. Record the inventory revision,
its SHA-256 (of the file with LF line endings and no byte order mark, so
CRLF and LF checkouts agree), the build/file pair and the scope being assessed. Preserve
`withoutInventory`, `unmeasured`, mapping gaps and the reasons functions are
out of scope. An empty inventory set cannot close a native-code assessment.
Mapping, citations, accepted complete readings and validated parity remain
separate measures. Zero accepted readings counts the declarations that
qualify at this baseline; existing findings may still need assessment.

## Assign ownership explicitly

Create a metadata-only JSON plan under `docs/`, separate from the original
inventories. Use the spec's area IDs. Assign each in-scope inventoried
function to its owning area or leave it visibly unassigned. A function
shared by several contracts lists every owner and the reason. Citation
locations do not assign ownership. The inventory path and function start
identify a row; no bytes, disassembly or extracted names enter the plan.

Each area's scope states the behavior contract and its boundary. Name the
callers, state producers and indirect mechanisms that remain to be assessed
as independently answerable queue items. Give each obligation a stable local
ID, its falsifiable question and the queue items that would settle it.
Split newly discovered dependencies into bounded obligations rather than
repeatedly appending an unspecified set of other aliases or callers.

Every area covers these checklist kinds:

| Kind | Closure review asks |
|---|---|
| `callers` | Which callers and result widths were checked, including rejected paths and independent census controls? |
| `state-producers` | Which initializers, later writers, alias/lifetime paths and relevant arithmetic/field widths determine the inputs? |
| `indirect-transfers` | Which tables, callbacks, stored target parts and reachable callees are resolved, and which transfers remain outside the census? |
| `remaining-evidence` | Which code, data, boundary, runtime, timing or external-service evidence is still needed for the scoped claim? |

Multiple obligations of a kind are expected when they ask different questions.
Close one only after the spec records its answer; replace its open queue
references with the active evidence IDs. A kind with no applicable mechanism
still needs a bounded evidenced answer. The standard's complete-reading
requirements continue to govern branch, field, continuation and callee review.

This synthetic example shows the plan shape. Its hash, starts and IDs are
illustrative and must be replaced with the checkout's metadata and entries:

```json
{
  "version": 1,
  "areas": [{"id": "RNG", "scope": "Generator and bounded-draw callers"}],
  "inventories": [{
    "path": "coverage/BLD-TEST-1.0/PROGRAM.EXE.tsv",
    "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "assignments": [{"start": "7F001000", "areas": ["RNG"]}]
  }],
  "obligations": [{
    "id": "rng-input-writers",
    "area": "RNG",
    "kind": "state-producers",
    "question": "Which later seed writers reach the scoped generator?",
    "state": "open",
    "queue": ["Q-RNG-001"],
    "evidence": []
  }]
}
```

The example leaves three checklist kinds missing and is not ready for review.
Shared assignments use an `areas` array with several IDs and a nonempty
`reason`. A closed obligation has evidence and an empty `queue` array.

## Assess the plan

```sh
node tools/Report-ResearchClosure.mjs --plan docs/research-closure.json --json
node tools/Report-ResearchClosure.mjs --plan docs/research-closure.json --require-ready
```

The `--plan` path is relative to the repository root, from any working
directory. The command runs the installed pinned coverage reporter freshly with `--list`
and verifies the offline pins. It compares current inventory hashes with the
plan, checks area/queue/evidence references and reports unassigned/shared
functions, open obligations, missing checklist kinds and missing inventories.
A changed or missing inventory makes its assignments stale until they are
reconciled; an assigned row the change dropped or excluded is reported as an
error. Superseded, disputed or unknown evidence and queue items no longer open
fail reference checks.

`--require-ready` exits 1 while any function ownership, accepted-reading or
checklist gap remains. Errors, including the invalid inventories and side
files the reporter lists, exit 1. Invalid input, or a coverage command that
produces no report, exits 2.
Coverage output beyond the 16 MiB capture bound fails without an assessment.
Without that flag, a structurally valid incomplete assessment is reported
successfully. Shared function counts are non-additive; byte counts remain
the inventory reporter's union-counted figures. No combined game percentage
is computed. Mapping classifications and gaps remain visible for review.

A ready assessment requests human review of the declared boundaries and
evidence. It does not establish an entry, validate a parity row or prove
whole-game completion. Inventory discovery gaps, data/media research and
the plan's stage exit criteria still need their own evidence. Preserve a
remaining question when its census or runtime obligation is incomplete.

Reassess after changing inventories, ownership, obligations or evidence.
Use the protocol's existing priority order to select the next obligation;
between equally ranked items prefer one that closes a shared dependency.

## Review when findings accumulate without closure

This applies the protocol's recovery for research that does not converge. Its
section is not yet in the local copy of the protocol; until the copy is
refreshed, this section is the procedure.

When successive snapshots add findings but no qualifying complete readings,
answered queue items or narrowed `Settles it` among the items being worked on,
the next research batch assesses existing evidence before opening more
original code. Compare the snapshots at their exact revisions and over the same
areas; splits and moves are not answers. Keep the priority order, including
reports and current-slice blockers. The review is research. It adds no stage
and no evidence status, and the worksheet below is not evidence.

Select up to ten existing rule, format, screen or bug entries in the area
being worked on, or all of them when fewer exist. Each batch of the assessment
takes only the entries one research batch may settle (see
[Research batches](upstream/work-protocol.md#research-batches) (lines 203-224)),
so a selection of ten can take several batches. The first of them names the
selection, its limits and the baseline revisions. Keep original-derived reports
in the approved local store. For each entry, record the following in your own
words:

| Review field | Required record |
|---|---|
| Entry and claim | ID, build and the behavior the whole entry claims |
| Existing evidence | Findings assessed, retained-report provenance and which complete-reading conditions they meet |
| Declaration gap | Qualifying findings missing from `complete_reading`, or `none`; do not declare a partial reading |
| Evidence gap | Missing branches, callers, state writers and lifetimes, indirect targets, or evidence the code cannot supply, each named by the queue item that holds it |
| Decision | Whole entry qualifies, or remains open with the reason; checklist completion does not promote status |

Assess the whole entry, including its hardest procedure. Record qualifying
findings in `complete_reading` only when the whole entry qualifies, and never
to meet a target number. Zero qualifying entries is a valid result, but a list
of unchecked boxes is not an assessment. If no entry qualifies, say what
evidence would remove the remaining obligations and choose the next objective
from it.

Choose one assessed entry to close next and give it a finite ownership and
dependency map tied to the current function inventories. The map goes in the
entry's Open questions section. Each obligation in it is a queue item, named
by the item's ID, which holds its question and `Settles it`, so the map gets
no IDs of its own and does not repeat those conditions. An obligation with no
item yet gets one in the same commit. Where the project keeps the JSON
ownership plan above, its obligations for this entry list the same queue items.
Among the functions the entry's callers and helpers reach, name those it
shares with other entries and those no entry owns, including ones outside the
assessed entries, and the files they sit in that have no inventory. An
unassigned function is a gap in the map and says nothing about whether anyone
understands it. Assignment is not evidence of understanding. Keep record
layout, placement, cache management and rendering separate where they describe
independently testable behavior. A split keeps unresolved claims, their
evidence and references under the standard's
[Identifiers](upstream/documentation-standard.md#identifiers) (lines 122-168)
rules. It answers nothing.

The next batch names one closure objective: the obligation it can remove, the
result that would remove it and the connected callers and helpers needed to
decide it. Before following another dependency, identify which obligation it
answers. A dependency that belongs to another entry gets its own bounded queue
question; do not grow the chosen entry to absorb it. A remaining writer or
alias obligation names the state, the possible access or transfer mechanisms,
the searched scope and the controls or exclusions still missing. A generic
warning about other writers is not a settling condition.

Read connected behavior in a supported decompiler with cross-references and
call graphs, such as Ghidra, when one is available. Verify the instructions
wherever inferred types, arithmetic widths, register returns, segment
identity, indirect transfers or failure ordering decide the claim. Reuse
retained reports, and take censuses with reporters that meet the standard's
[bounded analysis report](upstream/documentation-standard.md#bounded-analysis-reports) (lines 301-385)
contracts. Linear listings support that reading; extending them helper by
helper does not replace a caller or writer audit. If decompilation is
unavailable or unreliable for the file, record the limitation and use bounded
instruction and reference analysis. Keep original-derived output local and
write findings in independent words.

For the next three batches, record elapsed research, tooling, validation and
handover time separately, including failed checks and retries, in each batch's
commit message above its trailers, under the limits
[Batches](upstream/work-protocol.md#batches) (lines 187-407) sets for any such
measurement. Keep elapsed time apart from active effort, and commit counts
apart from both; none of them proves overhead alone. After two
closure-focused research batches, compare their outcomes with the assessment
baseline at exact revisions over the same scope: qualifying complete readings,
answered queue items and removed caller, writer and indirect-transfer
obligations, each with its evidence, then the remaining obligations and
inventory gaps, then counts of findings and commits as activity. The handover
(`docs/HANDOVER.md`, or the goal file's own handover) records the two
revisions compared and the result. Report a lack of closure there and change
the next objective. The evidence threshold stays where it is, and no success
quota applies.

This is a human review procedure. Existing reporters validate only their
documented inputs; they do not check this worksheet's judgments.
