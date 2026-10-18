# Research closure assessment

Use an explicit function ownership map and a finite list of remaining
obligations to choose work that closes a subsystem contract. The accepted
complete-reading count comes from the pinned `standard-coverage` report.
An ownership assignment or checked box changes no entry's evidence status.

## Establish the baseline

Run the documentation check, then measure the current inventories:

```sh
node tools/upstream.mjs docs --check
pnpm exec standard-coverage --json --list
```

Keep report output in ignored local storage. Record the inventory revision,
its SHA-256, the build/file pair and the scope being assessed. Preserve
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

The command runs the installed pinned coverage reporter freshly with `--list`
and verifies the offline pins. It compares current inventory hashes with the
plan, checks area/queue/evidence references and reports unassigned/shared
functions, open obligations, missing checklist kinds and missing inventories.
A changed inventory makes its assignments stale until they are reconciled.
Superseded/disputed evidence and queue items no longer open fail reference checks.

`--require-ready` exits 1 while any function ownership, accepted-reading or
checklist gap remains; invalid input or a failed coverage command exits 2.
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
