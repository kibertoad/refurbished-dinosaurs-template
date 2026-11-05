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

When successive snapshots add findings without qualifying complete readings,
evidenced queue answers or narrowed settling conditions, assess existing
entries before opening more original code. Preserve the current priority order
and existing evidence rules. This procedure implements closure review without
changing the pinned standard or treating the worksheet as accepted evidence.

Select up to ten existing rule, format, screen or bug entries tied to the
current subsystem (all of them if fewer exist). Record exact baseline revisions,
the selection and its limits in a metadata-only review under `docs/`. Keep
original-derived reports in the approved local store. For each candidate,
record the following in your own words:

| Review field | Required record |
|---|---|
| Entry and contract | ID, build and the behavior the whole entry claims |
| Existing evidence | Findings assessed, retained-report provenance and which complete-reading conditions they meet |
| Declaration gap | Qualifying findings missing from `complete_reading`, or `none`; do not declare a partial reading |
| Evidence gap | Specific missing branches, callers, writers/lifetimes, indirect targets or external evidence, referenced by queue ID |
| Decision | Whole entry qualifies, or remains open with the reason; checklist completion does not promote status |

Assess the complete entry, not just its easiest procedure. Do not promote an
entry to meet a target number. If no candidate qualifies, explain what evidence
would remove the remaining obligations and choose the next objective from it.

Use the ownership plan above for the chosen contract. Stable local obligation
IDs reference the queue's questions and settling conditions rather than copying
them. Include shared/unassigned functions and missing inventories, and name
what the assessment leaves outside its scope. An unassigned count is a gap in
this map, not a count of functions nobody understands. Separate record layout,
placement, cache management and rendering when they are independent contracts.
Preserve unresolved scope and follow the standard's identity and supersession
rules when changing entries; a split is not an answered deletion.

Replace an indefinite warning about writers or aliases with the actual state,
possible access mechanisms, census scope, controls, exclusions and reachable
callbacks still to be checked. Keep these obligations in queue items. A map or
worksheet points to them and does not become a second research queue.

Use one closure objective per batch. Name the obligation, the result that would
remove it and the related callers/helpers needed for that answer. Use supported
decompiler, cross-reference and call-graph views to understand connected code,
then check instructions where widths, register returns, segment identity,
indirect transfers or failure ordering matter. Use approved reporters and
retained controlled censuses before new tooling. If decompilation cannot read
the file reliably, record that limit and use bounded instruction/reference
analysis. A new helper belongs in the batch only when it answers the named
obligation; another contract gets its own bounded queue item.

For the next three batches, record elapsed research, tooling, validation and
handover time separately, including retries. State whether a figure is elapsed
time or active effort. Commit counts alone do not measure cost. Keep required
gates and hooks, single-kind batches and clean-room separation unchanged.
After the assessment and two closure-focused research batches, compare exact
revisions over the same scope. Lead with accepted complete readings, evidenced
queue answers and removed obligations; show remaining gaps and then activity
counts. A lack of closure calls for a different objective, not weaker evidence.

This is a human review procedure. Existing reporters validate only their
documented inputs; they do not automatically verify this worksheet's judgments.
