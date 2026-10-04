# Template changelog

Maintenance history of the **unconfigured template itself**: what changed in the
shared scaffolding, and the evidence behind each decision.

A configured project records its own work in `docs/IMPLEMENTATION-PLAN.md`,
not here.

A project created from this template may delete this file.

## Published standard checker, scientific-method packages and runtime libraries, 2026-10-04

Follows the toolkit's
[migration guide](https://github.com/kibertoad/refurbished-dinosaurs-toolkit/blob/main/docs/migrating-to-scientific-method.md)
and its [runtime package migration](https://github.com/kibertoad/refurbished-dinosaurs-toolkit/blob/main/docs/runtime-libraries.md#migrations).

- **Standard.** `docs/upstream/` moves from `ca39d07` to `c1758fd`, where
  [kibertoad/refurbished-dinosaurs#33](https://github.com/kibertoad/refurbished-dinosaurs/pull/33)
  numbered the rules of Identifiers, Status and the shared part of Entry types and
  moved the reporter contracts out of the page. Numbering changes no rule, so the
  standard stays version 1. Section links are rewritten to the new line ranges.
- **Checker.** `vendor/` is gone. `package.json` pins
  `@scientific-method/standard-checker` 0.2.0, which labels each problem with the
  rule it breaks, and CI pins the `check-documentation` action at toolkit
  `a260e39`, the commit that released it. `tools/upstream-lock.json` records both,
  `tools/upstream.mjs verify` fails when the CI pin, the lock and `package.json`
  disagree, `docs` refuses an installed checker of another version, and `refresh`
  moves all three together, refusing a toolkit commit other than the one tagged
  for that checker release. (`docs/UPSTREAM-RULES.md`.)
- **Evidence reporters.** `tools/evidence/x86-reporter/`, `x86-lock.json`,
  `sync-x86.mjs` and the copied reporter tests are gone. The `x86-` commands of
  `tools/evidence/report.mjs` run `@scientific-method/executable-reader` 0.2.0,
  which hands the query to `scientific-method-engine` 0.9.1 from
  `requirements-evidence.txt`; report output keeps the `bounded-x86-v1` schema.
  `legacy-image.mjs` re-exports the reader's parser. `docs/BOUNDED-EVIDENCE-REPORTERS.md`
  now covers setup and links the toolkit's guide instead of copying it.
- **Ghidra scripts.** The 23 scripts the engine ships are deleted from
  `tools/ghidra/`; `scientific-method-engine ghidra-scripts` prints their
  directory, and `docs/GHIDRA.md` shows passing both directories to
  `-scriptPath`. The packaged copies carry fixes the template's lacked: a call path
  reads the whole body, capped outputs say whether anything was left, and file
  offsets are hex. `ReportMemoryBlockForFileOffset` now maps offsets to loaded
  addresses (see the engine README). ExportEditionAnalysis,
  ExportFunctionAddressCorrelations, ExportVersionTracking* and ReportJumpTable
  stay.
- **Runtime libraries.** `Restoration.Resources`, the Extractor, the game and
  Inspect reference `RefurbishedDinosaurs.Core` and `RefurbishedDinosaurs.LegacyFormats`
  at exactly 1.5.1, set once as `RefurbishedDinosaursVersion` in `Directory.Build.props`. The local `OriginalContentSource`, `SourceKinds`, `SourceEntry`,
  `CueSheet` and `CueTrack` give way to `OriginalContentSource`, `ContentSourceKinds`,
  `ContentSourceEntry`, `CueBinSheet` and `CueBinTrack`; asset-pack staging and commit
  use `StagedAssetPack`, startup failures `StartupFailure` (still with no dialog in a
  platform smoke test or when `CI` is set, now through its `showDialog` overload),
  per-user paths `RestorationPaths`,
  manifest paths `PortableAssetPath.Relative` and pack paths `SafePath.Below`.
  Edition manifests with `sourceKind`, source identification, the asset-pack manifest
  and its verification, and InstallShield expansion stay in the template.
- **Behaviour.** Manifest paths that are drive-relative, end a component with a dot
  or space, or name a device are rejected on every host. The ISO 9660 reader checks
  extents against the declared volume, and the cue parser requires track 01 at
  00:00:00 and rejects layout lines it cannot read. A configured project revalidates
  its supported media with `verify-source`.
- **Gate.** CI and the release workflow install the engine and run
  `pnpm install --frozen-lockfile`; the pre-commit hook links the checkout's
  `node_modules` into its staged copy. Tests that only covered removed copies are
  deleted. `tests/evidence/evidence.test.mjs` runs an `x86-` command through the
  installed reader and engine, the memory-map test runs against the engine's
  `ReportMemoryBlocks.java`, and the .NET tests cover source verification through
  each kind, portable path rejection and a staged pack that fails verification.

## Callee graph and near-pointer segment provenance, 2026-10-01

- **Reporter.** The reporter pin moves from `1ef21ef` to toolkit `67340fc`
  (toolkit PRs 39 and 40); adopt exact source/tests/guide.
- **Callee graph.** New `x86-callees` reads a bounded graph from the entry and
  established region entries. Edges back into the active path are
  `recursivePath`; edges to an already read node are `sharedNodeReuse` and keep
  that node's memory observations, continuation assumptions and unread
  dependencies. Node, edge, depth and instruction limits keep omitted work
  unresolved; a missing write is never a read-only claim.
- **Near-pointer provenance.** `x86-arguments` and `x86-effects` retain LEA
  address formations and link consumed near-pointer arguments and later
  dereferences to them, keeping formation and dereference segments and
  registers. Storage merges only for propagated equal segments and identical or
  affine offsets. `pointerFormationLimit` keeps the most recent formations;
  evicted ones stay counted and refuse merging.
- **Checks.** Synthetic diamond, recursion, conditional-write, cap, DS/SS,
  rebinding, field-offset and string-destination controls accompany the pin.

## Overlapping operand candidate inventory, 2026-10-01

- **Reporter.** Toolkit PR 38 merged at `1ef21ef`; adopt exact source/tests/guide.
- **Behavior.** Encoded literal candidates retain prefix order/repeats, operand
  widths, intersecting spans and entry-path classifications. Only verified memory
  starts count; rejected or unresolved boundaries remain explicit. Implicit
  operands and relative branches are excluded. Caps qualify groups and coverage.
- **Checks.** Synthetic prefix, preceding/interior overlap, literal-only, repeated
  prefix, cap and source-bridge controls accompany the pinned reporter.

## Indirect jump tables, relocated pointer inventories and ownership ranges, 2026-10-01

- **Reporters.** The reporter pin moves from `313bb7d` to toolkit `c133cd4`,
  where toolkit PRs
  [33](https://github.com/kibertoad/refurbished-dinosaurs-toolkit/pull/33) to
  [37](https://github.com/kibertoad/refurbished-dinosaurs-toolkit/pull/37)
  merged. The mapping adds `pointer-inventory.mjs`, `x86/dispatch.py` and
  `tests/evidence/test_dispatch.py`.
- **Behaviour.** CFG commands follow a segmented16 computed near word jump
  through an `indirectJumps` table declared with consumer and layout evidence
  and an explicit `exhaustive` flag; a non-exhaustive table keeps its
  unresolved exit, supplied edges never prove an overlapping start, and path
  reports still stop at the jump. `x86-pointers` inventories adjacent
  segment:offset pairs at declared MZ relocations and FBOV fixups naming a query
  target, as exact pairs, aliases, unresolved and excluded rows under one cap,
  with positive controls. `x86-owner` adds every checked entry's reached
  ranges, source-derived FBOV overlay exports and a `boundaryCheck` that is
  never joinable for incomplete, contested or gap-stopped bodies or past the
  entry limit; supplied `overlayExports` are rejected.
  (`docs/BOUNDED-EVIDENCE-REPORTERS.md`, `docs/EVIDENCE-TOOLS.md`.)
- **Checks.** The pinned `test_dispatch.py` now falls back to the vendored
  `tools/evidence/x86-reporter` layout like the other pinned suites, so
  `tools/Invoke-Validation.ps1` needs no `PYTHONPATH` change.

## Validation reruns without restore, 2026-10-01

- **Behaviour.** `tools/Invoke-Validation.ps1 -NoRestore` skips only
  `dotnet restore` and uses the restore state a normal run left in the
  checkout; every policy, configuration, infrastructure, Node and Python check,
  the build and the tests still run, and a missing restore state fails through
  .NET diagnostics with no restore fallback. Normal runs and CI still restore.
  Evidence: a configured project's validation failed on NuGet service and
  signature endpoints although its packages were already restored.
- **Checks.** `tests/upstream/offline-validation.test.mjs`, in the fast gate,
  drives a copy of the script with command doubles: default restore, no
  restore and `--no-restore` consumers under the switch, unchanged checks and
  test filters, and a failed build propagating without a restore. The gate
  passes the PowerShell running it to the test, and the test skips when no
  PowerShell 7 is available. (`docs/VALIDATION.md`.)

## Call targets, function bounds, incoming coverage and carry arithmetic, 2026-10-01

- **Reporters.** The reporter pin moves from `7da1b93` to toolkit `313bb7d`,
  where the reporter work of toolkit PRs
  [28](https://github.com/kibertoad/refurbished-dinosaurs-toolkit/pull/28),
  [29](https://github.com/kibertoad/refurbished-dinosaurs-toolkit/pull/29),
  [30](https://github.com/kibertoad/refurbished-dinosaurs-toolkit/pull/30) and
  [31](https://github.com/kibertoad/refurbished-dinosaurs-toolkit/pull/31)
  reached `main` through
  [32](https://github.com/kibertoad/refurbished-dinosaurs-toolkit/pull/32).
- **Behaviour.** `x86-target` reports one direct call's raw words, relocation or
  FBOV fixup chain, trampoline, canonical target and citation, and compares an
  analyzer's address with them. `x86-bounds` and `x86-owner` report an entry's
  reached body, holes and exits, and which entries own a site, with an
  analyzer's size compared as a body-byte count. `formatControls` rejects a
  query whose table counts differ from a build's known counts. Incoming reports
  label a search over part of an overlay, section or declared segment partial
  and say where each unverified candidate sits. The path model tracks CF and
  adds ADC/SBB, NEG/NOT, rotates, one-operand MUL/IMUL/DIV/IDIV, JCXZ and the
  LOOP family, with `visitLimit` in place of the fixed four passes. Review
  fixes in the merged stack: a site whose candidate owners overlap or whose
  entries stopped at a gap is `unresolved` rather than `unowned`; a conditional
  branch to another entry is a conditional tail transfer; repeat and BND
  prefixes hide no return, port access or jump; a `scanLimit` that stops short
  makes an incoming search partial; and a target whose loaded address the
  loader cannot resolve keeps `targetError` and gets no target.
  (`docs/BOUNDED-EVIDENCE-REPORTERS.md`, `docs/EVIDENCE-TOOLS.md`.)
- **Rules.** `docs/upstream/` moves from `82deb76` to `ca39d07`, where
  [kibertoad/refurbished-dinosaurs#31](https://github.com/kibertoad/refurbished-dinosaurs/pull/31)
  merged. It adds the call-target, boundary and ownership contracts, format-table
  controls and the incoming-call coverage rule. Under these contracts a near
  call takes the caller's segment, an unresolved computed jump is an exit with
  unknown targets, a query that gives no table counts is reported as unchecked,
  and a repeat limit and a division that may overflow are named. Section links
  are rewritten to the new line ranges. The vendored checker stays on toolkit
  `f7da132`.

## Addresses in code comments, and a pre-commit hook, 2026-10-01

Adopts the parts of
[kibertoad/chaos-overlords-new-chrome#268](https://github.com/kibertoad/chaos-overlords-new-chrome/pull/268)
that apply to every restoration.

- **Checker.** `vendor/check-documentation.mjs` and the CI pin move from
  toolkit `f5e62e0` to `f7da132`, where
  [toolkit PR 23](https://github.com/kibertoad/refurbished-dinosaurs-toolkit/pull/23)
  merged.
  An address a code comment gives must be recorded in an entry the comment
  cites, or in the evidence of a cited entry. Neutral names (`fn_…`, `g_…`) are
  always checked; plain `0x…` values only once the CI step gives `images`,
  which `ci.yml` explains how to add.
- **Local runs match CI.** `tools/upstream.mjs docs` passes the checker the
  inputs the CI step gives under `with:`; a command-line option still wins.
- **Pre-commit hook.** `.githooks/pre-commit` runs the gate's node checks on
  the staged tree. The checks are listed once, in `tools/Invoke-NodeChecks.mjs`,
  which `tools/Invoke-Validation.ps1` also runs. `tools/evidence/sync-x86.mjs`
  now compares real paths before running, so a symlinked path (macOS's
  temporary directory) no longer skips its check with exit 0.
- **Rules.** `AGENTS.md`: evidence lives in the spec and is recorded before a
  comment, test or commit message gives it; look for a new ID on the open pull
  request branches too; enable the hook and do not bypass it.
- **Acceptance.** `node tools/upstream.mjs verify`, `node tools/upstream.mjs links`
  and `node tools/Invoke-NodeChecks.mjs` pass, and so does the upstream Node
  suite apart from the bootstrap preservation test, which needs PowerShell.

## Variable uses past a stop, and website rules up to kibertoad/refurbished-dinosaurs@3b4e6fc, 2026-09-30

- **Reporters.** The reporter pin moves from `a0b91d6` to toolkit `926e287`,
  where PR [18](https://github.com/kibertoad/refurbished-dinosaurs-toolkit/pull/18)
  merged.
- **Behaviour.** `x86-uses` no longer lists a memory operand reached only past a
  stop (an unread call, an unsupported instruction, an exhausted budget) in
  `matches`. It goes in `conditionalAccesses`, and its `dependsOn` names every
  stop that reaches it and every untraced call it is reached past. Such an
  access still satisfies a positive control and always makes `negativeUsable`
  false. A concrete segment query marks it as a possible alias rather than
  moving it to `unresolvedAccesses`. (`docs/BOUNDED-EVIDENCE-REPORTERS.md`.)
- **Rules.** `docs/upstream/` moves from `94f8f67` to `3b4e6fc`, where
  [kibertoad/refurbished-dinosaurs#27](https://github.com/kibertoad/refurbished-dinosaurs/pull/27)
  merged. The standard's report contracts gain the variable-use rule above,
  the PUSH CS / near call far-return frame and uncorrelated unknown flag
  producers, and the work protocol says what a reporter verification record
  holds. The vendored checker stays on toolkit `c361820`.
- **Acceptance.** `node tools/evidence/sync-x86.mjs --check`,
  `node tools/upstream.mjs verify`, `node tools/upstream.mjs docs --check` and
  `node tools/upstream.mjs links` pass, and so do the Python reporter suites.
  The Node evidence, upstream, bridge and vendor tests pass apart from the
  bootstrap preservation test, which needs PowerShell.

## PE32/i386 bounded reports, 2026-09-30

- **Reporters.** The reporter pin moves from `b51b0c0` (toolkit PR 16, see
  "Reporter case-verification refinements") to toolkit `a0b91d6`, which
  holds PRs [15](https://github.com/kibertoad/refurbished-dinosaurs-toolkit/pull/15)
  and [17](https://github.com/kibertoad/refurbished-dinosaurs-toolkit/pull/17). The pin
  gains `x86/pe.py` and `tests/evidence/test_pe.py`.
  (`docs/BOUNDED-EVIDENCE-REPORTERS.md`.)
- **PE32.** `sourceKind: "pe32"` derives preferred-base mappings from the
  source's section table and runs the ten existing reports under a flat
  32-bit model. Regions and entry/control sites are file offsets; memory query
  offsets are VAs. Raw alignment padding past `VirtualSize` is not loaded
  source, and malformed `regions` fail with a diagnosable error. PE32+,
  rebasing, imports and computed targets stay outside the model.
- **16-bit behaviour.** Shared changes reach MZ/FBOV reports: overlapping
  entry-path instructions become unresolved boundary gaps, and
  operand-size-prefixed control transfers and LEAVE stop the path. Every report
  adds `instructionModel`, `sourceMapping` and `declaredRegions`.
  (`docs/EVIDENCE-TOOLS.md`.)
- **Validation.** The canonical gate, CI and release discover every Python
  reporter suite with `test*.py`, and bootstrap preserves the added pinned files.
- **Acceptance.** `node tools/evidence/sync-x86.mjs --check`,
  `node tools/upstream.mjs verify` and `node tools/upstream.mjs docs --check`
  pass, and so do the Python reporter suites. The Node evidence, upstream,
  bridge and vendor tests pass apart from the bootstrap preservation test,
  which needs PowerShell.

## Pinned x86 reporters and website rules up to kibertoad/refurbished-dinosaurs@94f8f67, 2026-09-30

- **Reporters.** `tools/evidence/x86-reporter/` holds an exact copy of the
  toolkit's bounded 16-bit x86 reporter at `c2b21ee`, with its tests, guide
  (`docs/BOUNDED-EVIDENCE-REPORTERS.md`) and license. `tools/evidence/report.mjs`
  exposes it as the `x86-*` commands. `tools/evidence/x86-lock.json` records
  the hashes, `node tools/evidence/sync-x86.mjs --check` verifies them offline,
  and specialization leaves those bytes alone. (`docs/EVIDENCE-TOOLS.md`.)
  `tools/evidence/legacy-image.mjs` now re-exports the pinned MZ/FBOV reader
  instead of keeping a second copy.
- **Validation.** The canonical gate, CI and the release test job install
  `capstone==5.0.7` and run the Python reporter tests and the Node bridge and
  pin tests.
- **Website rules.** `docs/upstream/` is refreshed to `94f8f67`, which adds
  the standard's bounded analysis report contracts and the protocol's rule for
  reporter tooling batches. `docs/EVIDENCE-REVIEW.md` applies them, and section
  links are regenerated. The vendored checker stays on toolkit `c361820`.
- **Acceptance.** The following commands pass:
  - `node tools/evidence/sync-x86.mjs --check`
  - `node tools/upstream.mjs verify`
  - `node tools/upstream.mjs links`
  - `node tools/upstream.mjs docs --check`

## Website rules up to kibertoad/refurbished-dinosaurs@b923e85, 2026-09-30

The local copy in `docs/upstream/` is refreshed to the core website's
`b923e85`, which brings in #23. The work protocol gains a Recorded runs
section, and the standard lets a fixture's run list its draws from the
generator. The vendored checker stays on toolkit `c361820`, which already
checks those draws. Where the template now repeats the new rules:

- **Recorded runs.** Where an agent can start the original, read its memory
  and set breakpoints, a probe records the seed and every draw under the ID
  of the rule that made it, reaches its state by memory writes to
  `supported` or `established` fields, and waits on a state it can read.
  A divergence is explained by a copy of memory at the first differing draw,
  kept in `GAME_DIR/captures/`. (`AGENTS.md`, `research-item`,
  `live-session`.)
- **Runtime record.** Each build's section gives the probe's command line.
  (`docs/RUNTIME.md`, `runtime-access`.)
- **Implementation.** The generator takes the rule ID with every draw and has
  a hook only tests use. A fixture with draws is replayed draw by draw, and
  the rebuild is never fitted to a recording. (`AGENTS.md`, `implement-rows`.)
- **Acceptance.** The following commands pass:
  - `node tools/upstream.mjs verify`
  - `node tools/upstream.mjs links`
  - `node tools/upstream.mjs docs --check`

## Website rules up to kibertoad/refurbished-dinosaurs@21f6041, 2026-09-30

The local copy in `docs/upstream/` is refreshed to the core website's
`21f6041`. That brings in changes #15 to #25. What they add, and where the
template now repeats it:

- **Survey.** The installation is listed in full. Every path goes either in
  the manifest, which holds every file the game uses, or in the build's
  Other files with a reason. A long list goes in
  `BLD-<alias>.other-files.yaml`. (`AGENTS.md`, `plan-work`, bootstrap
  checklist, build template.)
- **Code ranges.** A build entry has a Code ranges section. An offset into
  overlay code has to lie wholly inside one of its rows. (Build template,
  `research-item`, `AGENTS.md`.)
- **Readings and findings.** New rules cover:
  - segment identity
  - stored call targets
  - overlapping writes
  - allocations
  - output counts
  - "no other caller" searches
  - dispatch tables
  - return values
  - cleanup paths
  - errors passed back through recursion
  - procedure steps, rejected calls and `# visible:` points

  (`AGENTS.md`, `research-item`.)
- **Emulated calls.** Every port access needs an explicit stub. Port models
  and video memory mapped as RAM are named in the experiment. A copy into
  video memory shows bytes, never pixels. (`AGENTS.md`, `research-item`,
  `docs/RUNTIME.md`.)
- **Implementation.** New test rules cover:
  - agreement between different algorithms
  - intermediate states while a rule is wired into `Game`
  - checkpoint and replay identity and restore contracts

  (`AGENTS.md`, `implement-rows`.)

The vendored checker and the CI action are pinned to the toolkit change
that enforces the Code ranges section and the other-files list
(kibertoad/refurbished-dinosaurs-toolkit#12), and to #13 after it, which
checks that each draw a fixture's run lists is `{ rule, bound, result }`
naming a rule entry; the `research-item` skill says so.

- **Acceptance.** The following commands pass:
  - `node tools/upstream.mjs verify`
  - `node tools/upstream.mjs links`
  - `node tools/upstream.mjs docs --check`

## Local copy of the standard, 2026-09-30

Agents had been fetching the published methodology, documentation standard and
work protocol again and again during routine work, often a whole page for
every link with a section anchor. The hash-verified copies in `docs/upstream/`
are now the only place agents read them: the methodology joins the documentation
standard and the work protocol there, and every link to those pages in the
template points at the copy with the same anchor. `AGENTS.md` tells agents to
read the copy, to assume it is up to date, to read only the lines a section
link gives, and never to go online to check for a newer version: checking and
refreshing are started only by a person, following `docs/UPSTREAM-RULES.md`.
The template is updated when the website changes.

`AGENTS.md`, `docs/SPEC-ENTRY-TEMPLATES.md` and the `research-item` skill
keep their own statement of the rules. An earlier version of this change
replaced it with links to the copy, but the template's text was newer than
the published pages, so that dropped rules the pages did not have yet; the
text is restored, with its links pointing at the copy. The published pages
were then brought up to date with it (kibertoad/refurbished-dinosaurs#14), and
the copy is pinned to that version.

A file-read tool ignores anchors, so every link to a section of the copy now
gives the section's lines, as in `work-protocol.md#batches (lines 137-183)`,
and agents read only those. The skills open with the sections they rely on
instead of whole pages, and say that their steps are enough: a section is
opened only for a question a step leaves, and never twice in a session.
`node tools/upstream.mjs links --write` writes the ranges after a refresh.

- **Acceptance.** The upstream tests fail when a link to one of the three
  pages misses `docs/upstream/` or names no heading there, when a section
  link's line range is missing or stale, when a link inside the copy names
  no heading, and when a file links the published pages instead of the copy.

## Rules live in `Core`, one test per branch, 2026-09-30

The architecture boundaries now say that every decision the original makes — a
flag cascade, a gate, a branch table, an outcome selector, a state transition —
lives in `Core` as a pure function of the serializable state and its inputs,
even when only `Game` calls it; that each entry's branch table is implemented
whole, one test per branch, including the branches `Game` cannot reach yet; and
that a bug traced to branch logic in `Game` is fixed by extracting the rule
into `Core` first. `AGENTS.md` says so, the definition of done requires it, and
the `implement-rows` and `start-session` skills repeat it.

- **Evidence.** The Wages of War restoration (`wages-due`) implemented the
  office fax dispatcher's signed-contract branch table inside the presentation
  shell with its intelligence-purchase arm inverted; no fast-gate test could
  reach the decision, and only a play session exposed it. Moving the decision
  to `FaxDispatch` in `Core` and pinning every branch with a test made each arm
  checkable.

- **Acceptance.** No check changes: no script enforces where a rule lives, and
  the existing validation keeps passing.

## Bounded evidence tooling, 2026-09-29

Adds MZ/FBOV location provenance, incoming candidate controls, explicit flow
review, bounded table layouts and portable function inventory joins. Generic
Ghidra exporters omit original code and analyzer names from committed inventories.
Synthetic Node fixtures run in the canonical gate. The maintenance plan and
EVIDENCE-TOOLS guide state unsupported cases and the limits of each report.
Standard v1 remains in use.

## Judgement-call deviations, 2026-09-27

Follows the documentation standard's amended deviation rule: a deviation may
be `on` or `mandatory` when it is strictly better than the original, or when it
is a small judgement call that makes the game better to play and touches
nothing players build strategies around. A change some players would
reasonably not want gets a setting that starts `off`. `AGENTS.md` and
`docs/SPEC-ENTRY-TEMPLATES.md` say so.

- **Acceptance.** No check changes: `on` and `mandatory` deviations already
  need a Justification.

## Emulated calls always allowed, 2026-09-26

Follows the work protocol's statement that any agent may build the emulator
harness and make emulated calls in every game repository, including one whose
`AGENTS.md` keeps agents from running the original, since an emulated call
starts no process of the game. `AGENTS.md`, `docs/RUNTIME.md` and the
`runtime-access` and `research-item` skills say so: a limit on runs covers
runs of the game only, the harness row of the runtime record is `agent`
wherever the harness loads the build, and emulated calls need no decision
from the owner.

- **Acceptance.** No check changes.

## Names and numbers in the spec, 2026-09-26

Follows the documentation standard's narrower definition of content. The spec
may use the names of the things a designer made, in its text and in
enumeration names such as `UNIT_ARCHER`, and writes numbers, formulas and
tables in full, including per-unit and per-item statistics. It still keeps no
substantial copy of the game's writing, none of its art, and no meaningful
slice of its code or scripts. `AGENTS.md` and the research-item skill say so.

- **Acceptance.** No check changes: the documentation check never enforced the
  old restriction, so every spec that passed it still passes.

## Work protocol, 2026-09-25

Follows the new [work protocol](upstream/work-protocol.md), which
sets how restoration work is planned, tracked and handed on.

- The stages are Intake, Runtime access, Survey, Slices and Audit.
  `docs/RUNTIME.md` records what can be done with the original running and
  whether an agent, only a person, or nobody can do it, and slices aim only at
  the parity statuses that makes reachable.
- Static analysis comes first, and runs of the original are the last resort
  for each question: a run item needs its own static attempt first, or asks
  for the run that confirms a static reading, and then takes its place in the
  order of work. Every run holds the machine-wide lock, taken with an
  exclusive create at `C:\ProgramData\refurbished-dinosaurs\run.lock` on
  Windows or `/var/tmp/refurbished-dinosaurs/run.lock` elsewhere (or the path
  in `REFURBISHED_DINOSAURS_RUN_LOCK`), since several agents work on different
  games on one machine at once, under one account or several.
- People test the rebuild when they happen to. `docs/reports/` holds their
  reports until a research session triages each one, with the new
  `triage-report` skill, into a `Defect (R-...)` note on a parity row, a queue
  item or a finding. Screenshots stay in the local reference store under
  `GAME_DIR`, never in the repository. Competing readings of an open question
  are kept in the entry's Open questions section, each with a queue item that
  cites it, and commits that close items carry a `Queue:` trailer.
- Adds the `Emulated call` queue section, between `Static` and `Agent run`,
  for calling one function of the original in a Unicorn harness in
  `tools/emu/`. `research-item`, `plan-work`, `runtime-access`,
  `start-session`, `triage-report`, `AGENTS.md` and `docs/RUNTIME.md` say
  how such a call is made and what it can establish. `docs/RUNTIME.md` no
  longer asks for a text-in, text-out runtime tool.
- Follows the standard's new direct evidence and complete reading rules:
  circumstantial evidence never raises a status, and a complete reading of the
  code makes an entry `established` without a run, listed in the optional
  `complete_reading` field. Runs are queued only for entries that depend on
  something the code does not decide. `AGENTS.md`, `research-item`,
  `plan-work`, `queue/README.md` and `docs/SPEC-ENTRY-TEMPLATES.md` follow.
- A run that needs a person is a live session, requested in a file in
  `docs/live-sessions/` that the owner answers by editing its Status line.
  Work that needs no run carries on in the meantime.
- `queue/` holds the open research questions, one file per spec area, grouped
  by the evidence each one needs (Static, Agent run, Live session, Source,
  Blocked), each with an ID such as `Q-COMBAT-012`. `queue/README.md` gives
  the format.
- `docs/HANDOVER.md` is the current state of work outside any goal, at most
  200 lines, rewritten every session and committed on its own. `docs/goals/`
  holds one file per running long-running goal, which claims its areas and
  carries its own handover, and `docs/DECISIONS.md` the owner's decisions, whose
  oldest entries move to numbered files in `docs/decisions/` before it passes
  1,000 lines.
- Function inventories go in `coverage/<build ID>/<manifest path>.tsv`, with a
  `CD:` prefix written as an `@CD` directory, one per file the analysis reads, with addresses, sizes and the researcher's own
  names only. They are the one analysis export that is committed, and
  `.gitignore` now lets the root `coverage/` through.
- `docs/IMPLEMENTATION-PLAN.md` records the project's stage, gives each slice
  an Exit item, and keeps only owner questions; research questions move to
  `queue/`.
- Batches are research, implementation or tooling. Implementation batches
  work from the spec alone, never open `queue/`, and leave gaps as `Spec gap:`
  notes on parity rows. Research batches make the parity and citation changes
  the documentation check needs.
- `AGENTS.md` gains a Planning and tracking work section, and the bootstrap
  checklist gains the Runtime access and Survey stages.
- `.claude/skills/` carries the protocol's procedures as agent skills:
  `runtime-access`, `plan-work`, `start-session`, `research-item`,
  `implement-rows`, `triage-report`, `live-session` and `end-session`. They hold steps and link
  to the published pages for the rules.
- `Test-TemplateInfrastructure.ps1` requires the new files and skills, fails on
  a Markdown file over 1,000 lines in `queue/`, `docs/goals/`,
  `docs/live-sessions/`, `docs/reports/`, the plan or the decisions (including
  `docs/decisions/`), and on a handover over 200 lines.

## Spec file size limit, 2026-09-25

Follows the documentation standard's new
[File size](upstream/documentation-standard.md#file-size) (lines 104-118) section,
which limits every Markdown file it defines to 1,000 lines and splits the files
that grew with the whole project.

- `spec/glossary.md` is replaced by `spec/glossary/`, one file per term.
- `DEVIATIONS.md` is replaced by `deviations/`, one file per deviation.
- The parity rows move to `parity/`, one file per area. `PARITY.md` keeps the
  totals and a list of area files, and the check writes it.
- A build entry names a `BLD-*.files.yaml` manifest instead of listing its
  files. A list of more than 64 values, and an enumeration table that would
  take its format past the limit, go in a CSV value file.
- `docs/SPEC-ENTRY-TEMPLATES.md` adds templates for a glossary term, a
  deviation, a parity area file, a build manifest and value files.
- CI runs the documentation standard check from refurbished-dinosaurs-toolkit
  in a new `Documentation standard` job, pinned to a commit SHA, and
  `spec/index/` and `PARITY.md` are what that check writes.
- `Test-TemplateInfrastructure.ps1` requires the new directories, fails on a
  Markdown file over 1,000 lines in `spec/`, `parity/`, `deviations/` or
  `PARITY.md`, and fails if CI stops running the check.
- A synthetic test no longer names its fixture after a finding ID that does not
  exist, since the check requires every cited ID to resolve.

## Mandatory deviations and justified defaults, 2026-09-25

A deviation's Default is now `off`, `on` or `mandatory`. `mandatory` replaces
`always on` and means the deviation has no setting. A deviation that is
`mandatory`, or `on` without being the fix of an unintended bug players do not
rely on, carries a `Justification` item arguing that the rebuild's behavior is
strictly better than the original's, as the
[documentation standard](upstream/documentation-standard.md#deviation-log) (lines 1004-1025)
now sets out. `AGENTS.md`, `DEVIATIONS.md` and `docs/VALIDATION.md` say so, and
a test that reaches a mandatory deviation cites its ID and allows for it.

## Documentation standard and methodology, 2026-09-25

The template now follows the dinorefurb.com
[methodology](upstream/methodology.md) and version 1 of the
[documentation standard](upstream/documentation-standard.md).

- `spec/` holds the documentation of the original game: `README.md` (scope,
  standard version, area list), `glossary.md`, `LICENSE` (CC BY 4.0 for the
  Markdown, MIT for definitions, fixtures and patches), and an empty directory
  per entry kind. `docs/SPEC-ENTRY-TEMPLATES.md` has a blank entry of each kind.
- `PARITY.md` and `DEVIATIONS.md` at the root replace `docs/PARITY-MATRIX.md`
  and `docs/FIDELITY.md`. `docs/RULES-AND-EVIDENCE.md`, `docs/UI-ATLAS.md` and
  `docs/ORIGINAL-FORMATS.md` are gone, since rules, screens and formats are
  spec entries. The source-media description moved to `docs/ARCHITECTURE.md`.
- The `unknown`/`low`/`medium`/`high`/`verified` confidence scale is replaced by
  the standard's statuses throughout `AGENTS.md` and `docs/GHIDRA.md`.
- `AGENTS.md` adds the eligibility gate (released in 2004 or earlier, no
  official remake on sale), the fidelity policy, spec-ID citations and
  `PLACEHOLDER:` comments. Refusal gates are checked once and recorded, and are
  not re-checked unless the owner asks.
- `OriginalGameFiles` in the test project finds original files under
  `GAME_DIR` in the standard's layout, checks their hashes, and skips tests
  when they are absent.
- `Test-TemplateInfrastructure.ps1` requires the spec skeleton and both ledgers.
- Follows the standard's seventh review (refurbished-dinosaurs `b7e5341`): spec
  hashes are 128-bit xxHash3. `SpecHash` in `Restoration.Inspect` computes it,
  the source inventory prints `xxh3` next to `sha256`, `citations` takes
  `--xxh3`, and `OriginalGameFiles` checks and names captures by it. Checked
  against the standard's GOG `Chaos Overlords.exe` example. The entry
  templates gain `environment` on findings and a Shows column on screens, and
  `docs/VALIDATION.md` covers base saves in the captures, distribution tests
  from recorded generator states, and unscaled palette-true screen captures.
- Build entries name the game's `developer` and `publisher` separately,
  following the standard's change in refurbished-dinosaurs `4a07fc9`. Source
  entries keep `author` alone.
- The implementation-plan approval gate is gone: `Bootstrap-Project.ps1` no
  longer reads a `**Status:**` line, and the plan, checklist, and guides no
  longer ask for approval.

## Research tools from the game repositories, 2026-09-24

- `Restoration.Inspect citations` checks documented addresses against the owned
  PE32 executable, optionally against a Ghidra instruction export, and fails on
  addresses outside every section or `fn_` names that are not function entries.
  Ported from Enemy Infestation's `tools/validate_native_citations.py`, changed
  to the documentation standard's `0x`/`fn_`/`g_` notation and with no original
  bytes in its report. Synthetic PE tests in `AddressCitationTests`.
- `docs/GHIDRA.md` points to the LE loader and Iced disassembly in the Conqueror
  A.D. 1086 restoration for DOS-extender executables, and to the Windows
  debugging-API capture harness in the Magic & Mayhem restoration. Neither is
  copied into the template until a second game needs it.

## Template infrastructure evolution — 2026-09-19

**Status:** complete and verified on 2026-09-19; approved by the repository
owner for slices T1–T5 and the proposed defaults in TQ1–TQ5.

This maintenance record describes work on the unconfigured template itself. It
does not choose an original game, claim support for an edition, or form part of
any project's `docs/IMPLEMENTATION-PLAN.md`. The designs below were drawn from a
comparison set of the maintainer's own MIT-licensed restoration repositories:

- `wages-due`;
- `rechaos-overlords`;
- `outpost-returns`;
- `dark-sun-wake-redux`;
- `enemy-reinfestation`;
- `magicmayhem-again`.

The selected designs are independently maintained code from these related MIT
repositories. No original game content, reverse-engineering output, or files
under their local-only `analysis/original` trees will be copied.

### Maintenance slice T1 — bounded original-media sources

- **Outcome.** A configured project's Extractor and Inspect tool can consume a
  directory, a 2048-byte-sector ISO-9660 image, or a single-file mixed-mode
  CUE/BIN image through one read-only source abstraction. CUE/BIN support exposes
  the MODE1/2352 data track as ISO-9660 files and retains enough track metadata
  for a game-specific extractor to process CD audio later.
- **Evidence.** `EnemyReinfestation.Resources/OriginalContentSource.cs` supplies
  the defensive ISO-9660 extent reader. `OutpostReturns.Resources/CueSheet.cs`,
  `RawCdImage.cs`, and their synthetic tests supply the bounded CUE parser,
  MODE1/2352 user-data stream, and fixture shape. Magic & Mayhem's
  `SourceCandidates.cs`, `RawCdImage.cs`, and logical-fingerprint tests supply
  safe CUE/BIN resolution, path containment, and edition-identification
  integration.
- **Acceptance — rules.** Paths are normalized and traversal is rejected;
  descriptor, directory, entry, depth, file-count, sector, and extent bounds are
  checked before allocation or reading; ambiguous multi-file media is rejected
  with an actionable diagnostic; source access is read-only; identical logical
  media produces identical inventory ordering and fingerprints.
- **Acceptance — presentation.** Extractor help and diagnostics name every
  accepted source form and explain unsupported or ambiguous media without a
  stack trace.
- **Acceptance — original content.** No media image or extracted byte enters
  Git. Only source fingerprints and synthetic ISO/CUE/BIN fixtures are retained.
  The template does not claim that every ISO-9660 or CUE dialect is supported.
- **Extractor boundary.** Source manifests declare the expected source kind and
  may fingerprint logical files. Opening media only inventories and streams
  files; game-specific decoding and transactional pack promotion remain in the
  configured Extractor.
- **Automated tests.** Synthetic directory, ISO, and raw CUE/BIN sources prove
  inventory, reads, deterministic normalization, bad endian fields, invalid
  extents, non-sector-aligned images, unsafe CUE references, ambiguous files,
  malformed timestamps, unsupported track layouts, and cancellation/disposal.
- **Observed parity.** None in the template. Each configured project records its
  supported editions and validates logical fingerprints against its owned media.

### Maintenance slice T2 — bounded InstallShield expansion

- **Outcome.** A configured Extractor can opt into reusable InstallShield 5 CAB
  expansion without shelling out to an unpinned machine-global tool.
- **Evidence.** Magic & Mayhem's `InstallShieldCabinetProcessor.cs` uses the
  MIT-licensed `SabreTools.Serialization` 3.2.0 wrapper in a child process,
  limits file count and expanded sizes, rejects unsafe/non-portable paths, and
  inventories hashes and provenance after extraction. Its recorded comparison
  against Unshield 1.6.2 found byte-identical expanded file content.
- **Acceptance — rules.** The adapter is optional and isolated from the main
  extractor process; package version is pinned and locked; file count,
  per-file size, total expanded size, duplicate paths, device names, traversal,
  reparse points, cancellation, exit status, and output sizes are checked.
- **Acceptance — presentation.** Unsupported cabinets and limit violations
  identify the cabinet and reason while preserving the previous verified pack.
- **Acceptance — original content.** Tests use no proprietary cabinet. Unit
  tests cover path construction, safety limits, subprocess diagnostics, and an
  unsupported synthetic input; real-cabinet validation stays project-local.
- **Extractor boundary.** Expansion writes only inside the transaction's staging
  root and returns an inventory with source path and conversion provenance.
- **Automated tests.** Synthetic/fake cabinet metadata exercises safe and unsafe
  names, duplicates, size arithmetic, empty output, cancellation, and failed
  isolated extraction. Package-lock and repository checks prove the dependency
  is pinned and no upstream test corpus or binary fixture was copied.
- **Observed parity.** None in the template; configured projects must record a
  lawful edition-specific comparison before claiming equivalent extraction.

### Maintenance slice T3 — signed, smoke-tested release installers

- **Outcome.** Manual GitHub releases can build the existing Windows, Linux, and
  macOS installers, optionally Authenticode-sign project executables and the
  Windows installer with SSL.com eSigner, and optionally publish a verified
  detached OpenPGP signature beside the Linux package. Unsigned releases remain
  available and macOS remains explicitly unsigned until proper app/installer
  signing and notarization are designed.
- **Evidence.** Rechaos Overlords' `release.yml`,
  `Install-CodeSignTool.ps1`, `Invoke-ESigner.ps1`, and
  `Invoke-GpgSigner.ps1` provide pinned downloads, early secret validation,
  signature/timestamp verification before and after installation, an ephemeral
  GnuPG home, exact fingerprint verification, and revoked/expired-key rejection.
- **Acceptance — rules.** Workflow permissions stay least-privilege; third-party
  actions and signing-tool downloads remain pinned and verified; secrets are
  scoped to the `release-signing` environment; signed artifacts are verified
  before upload; artifact counts account for optional `.asc` files; no signing
  secret is printed or persisted.
- **Acceptance — presentation.** `docs/RELEASING.md` documents unsigned,
  Windows-signed, and Windows/Linux-signed modes, required environment secrets,
  Linux verification, and why macOS is not yet signed.
- **Acceptance — original content.** Release and installer smoke tests remain
  assetless and select the existing no-extraction path.
- **Automated tests.** Validation parses the workflow, exercises signer
  configuration failures without secrets, runs zizmor, builds all selected
  packages where the existing CI matrix supports them, installs/uninstalls the
  Windows package, launches the installed executable in platform-smoke mode,
  and checks Authenticode only in signed mode.
- **Observed parity.** Not applicable.

### Maintenance slice T4 — bootstrap and launch experience

- **Outcome.** A new owner has one documented bootstrap command that validates
  the fact-gathering/plan gate, previews configuration, applies identity changes,
  verifies the result, and prints the remaining manual work. The configured
  repository contains a root Windows launcher whose filename and content are
  adjusted during configuration, finds `dotnet` robustly, forwards arguments,
  uses the configured local asset-pack contract, and returns the real game exit
  code.
- **Evidence.** The current template's config file, idempotent
  `Configure-Project.ps1`, strict verifier, and checklist are newer and safer
  than the one-shot scripts in Enemy Reinfestation and Magic & Mayhem. The
  Outpost launcher has the best SDK discovery and argument forwarding; Wages of
  War has the best verify-before-extract flow; Enemy Reinfestation has the best
  actionable missing-pack handoff; Magic & Mayhem has the cleanest
  workspace-local versus Local AppData selection.
- **Acceptance — rules.** Bootstrap refuses implementation readiness while the
  plan is unapproved or required original-game facts are missing; `-WhatIf`
  makes no changes; configuration never searches or rewrites ignored proprietary
  roots; reruns preserve the stable AppId; the launcher has no developer-machine
  path, honors smoke-test modes, quotes paths, forwards `%*`, and preserves the
  child exit code.
- **Acceptance — presentation.** `README.md`, `CUSTOMIZATION.md`, and the
  checklist give a short start-to-finish path and separate automated identity
  work from edition research and format decisions.
- **Acceptance — original content.** Bootstrap never discovers or fingerprints
  an edition by guessing. The launcher only uses an already verified pack or an
  explicitly supplied legal source.
- **Automated tests.** Temporary-copy tests cover preview/no-op behavior,
  unconfigured-to-configured rename/substitution including the launcher,
  configured rerun behavior, missing required facts, strict verification, and
  launcher static invariants. Existing cross-platform configuration CI remains
  green.
- **Observed parity.** Not applicable.

### Maintenance slice T5 — bounded Ghidra toolbox and repeatable reuse audit

- **Outcome.** The template gains the most generally useful bounded Ghidra
  navigation scripts from the comparison repositories plus clearer setup and
  cross-edition guidance. A discoverable personal Codex skill can repeat this
  same six-repository reuse audit, report provenance and exclusions, and update
  the template only after its plan gate is satisfied. A second discoverable
  skill performs evidence-preserving fleet upgrades from the golden template
  into known configured game repositories.
- **Evidence.** Rechaos adds bounded direct-call paths, function-local scalar
  searches, and first-argument call summaries. Outpost adds bounded flow-to-range
  and file-offset/memory correlation useful for segmented executables. Magic &
  Mayhem's edition/version-tracking exporters provide a reproducible
  cross-edition workflow; their generated whole-program inventories are
  local-only analysis artifacts rather than end-user asset exports.
- **Acceptance — rules.** Every included Ghidra script requires explicit narrow
  inputs, enforces hard output limits, uses a game-agnostic category, and is
  documented in the script table. Setup keeps projects and output under a unique
  temporary or ignored analysis root, refuses a repository-tracked output path,
  and verifies the executable hash before address-based claims.
  The skill treats all reference repositories as read-only, excludes build,
  artifact, dependency, temporary, and original-content trees, records source
  file provenance, checks licenses, distinguishes exact copies from adapted
  patterns, and never bypasses a target repository's plan/approval rules.
- **Acceptance — presentation.** Ghidra docs explain PE versus NE/segmented
  address cases, bounded fallback paths when decompilation fails, and how to
  compare editions without committing broad exports. The skill returns a concise
  candidate matrix and verification report.
- **Acceptance — original content.** No Ghidra project, executable, dump,
  screenshot, broad listing, decompiler output, or generated edition inventory
  is committed.
- **Automated tests.** Repository validation enforces the Java line limit and
  forbidden-content policy; documentation names every shipped script and its
  cap; the new skill passes the skill validator and a dry run inventories the
  fixed repositories without writing to them.
- **Observed parity.** Not applicable.

### Maintenance open questions

| ID | Question | Blocks | Owner | Status |
|---|---|---|---|---|
| TQ1 | Use one dependency-free bounded ISO-9660 reader over both cooked 2048-byte images and the MODE1/2352 user-data stream. | T1 | implementer | resolved |
| TQ2 | Ship the pinned, locked SabreTools adapter with the Extractor, but invoke it only through the explicit isolated `expand-installshield` command. | T2 | owner | resolved |
| TQ3 | Retain the template's explicit release-tag input and port Rechaos's signing/hardening rather than its `version.txt` workflow. | T3 | owner | resolved |
| TQ4 | Verify the pack first and auto-extract only when the configured explicit source environment variable is present. | T4 | owner | resolved |
| TQ5 | Install both requested skills in the personal Codex skills directory for discovery; do not commit redundant non-discoverable copies in the template. | T5 | owner | resolved |

### Maintenance risks

- ISO-9660, raw MODE1/2352, CUE, and InstallShield each have more variants than
  the comparison games exercise. The reusable API will state its supported
  subset and reject other forms instead of guessing.
- A third-party archive parser expands the dependency and native-code attack
  surface. Isolation, strict limits, a locked version, and staged output reduce
  the impact; projects that do not need InstallShield should not activate it.
- Cloud signing providers and runner images change. Pinned tools, explicit
  verification, early configuration checks, and an unsigned mode keep failures
  diagnosable without silently publishing unverified artifacts.
- Batch launchers and configuration renames are Windows-sensitive. Static tests
  plus the existing Windows packaging smoke test cover quoting and substitution;
  non-Windows development continues to use `dotnet run` directly.

### Maintenance done when

All five slices are implemented after approval; synthetic tests require no
original content; `./tools/Invoke-Validation.ps1` passes; the configured-sample
CI and installer smoke tests pass; status documents match reality; the skill
validator and read-only dry run pass; changes are committed on a feature branch,
pushed, and opened as a pull request with the evidence summarized.

## 2026-09-30: v1 evidence review and offline authority

Added conditional evidence review examples and queue decomposition guidance.
Pinned unchanged Standard v1, Protocol and checker snapshots with explicit
freshness/refresh commands, digest verification and configuration preservation.
The checker and CI both include merged toolkit PR #11.


## Reporter case-verification refinements

Pinned toolkit commit `b51b0c0cfe85205f054e03b0c030912e2507f377`, where
toolkit PR 16 merged. This refines entry-CFG use discovery after unread calls, unknown
flag generations, push-CS/near-call frames, explicit modeled return widths, far
indirect guard provenance and effective-width conversions. XCHG and low-result
IMUL are supported; output exhaustion names the 32 MiB limit.
CFG operand discovery covers only code reachable from a stopped trace, so fully
traced accesses are no longer repeated as unresolved; unmatched concrete operands
are dropped, LDS/LES operands count four bytes and XLATB is reported as a gap.
Modeled `returnBytes` are validated before tracing, and a four-byte model reached
without an executed `push cs` stops that path instead of failing the report.

Validation: 58 Python, 39 Node and 56 .NET tests pass in the canonical gate,
with a zero-warning/error solution build. No original files are needed.
The standards/protocol clarification is proposed in website PR 27; the current
rules snapshots remain unchanged pending its review.


## Bounded memory-map selection and JVM diagnostics

Added ReportMemoryBlocks.java with capped page/exact-name selection, explicit total/requested/partial scope and diagnosed invalid selections. JVM crash/replay diagnostics and heap dumps are ignored and rejected by the `deniedFileNamePatterns` of `tools/repository-policy.json` even if force-staged. The Ghidra guide explains local-only JVM output redirection and separates diagnostic existence from process ownership. Synthetic scratch-Git and constructed 3,546-block Java tests exercise the contracts; read-only Ghidra map checks against a configured project's large map pass without exporting code or bytes. `./tools/Invoke-Validation.ps1` passes with a clean build.

## Committed function-inventory identity checks

Added hash-guarded inventory-check to validate committed TSVs against build/manifest prefixes, mapped source bounds, numeric start uniqueness, bounded body-byte counts, allowed optional researcher columns and portable destinations. Explicit evidenced legacy paths support configured projects without silently renaming historical inventories. Synthetic tests cover CLI/identity failures and empty optional cells. The actual Dark Sun installed 2,153-row inventory passes; shared export reproduces its retained mapped export and view join exactly. Canonical gate passes 92 Python, 40 Node and 56 .NET tests with a zero-warning/error build.

## Selected-window capture isolation

Use selected-client PrintWindow capture, fail on unsupported or uniform results,
and never fall back to desktop pixels. Add an offscreen Windows regression and
document the distinction between captured client pixels and a verified game state.

## Bounded string effects and saved flags

Pinned toolkit 247e30c8cbdf9448901d39891512fb9c62364ae5 adds bounded sequential string operations with conditional direction provenance and intact saved-flag restoration. The matching synthetic controls and guide ship with the pin. IRET and native hardware/timing remain outside this model.

Toolkit follow-up e08397283b9cc8271dba01019803d4571430f618 adds explicit overlapping-target proof and strictly local segmented16 IRET with validated saved flag frames. External and flat IRET remain unsupported.

Toolkit candidate 2f864f21ec63139043d707fa8fbf401a9f624191 adds instruction-owned segment operand provenance and preserves flag/string events in effect summaries. Hash-guarded CLI and boundary/width controls ship with the pin.

Re-pinned toolkit 92a182333e4c4c24a91024c16d4427f84c6269cb after review: string operations are matched by opcode rather than final byte, the unknown-direction split reuses the current path and reserves iterations only when they fit, zero counts complete regardless of budget, unsupported string forms stop before any split, local flag-frame checks no longer report a read, and an overlap proof must be reachable without its own target. Non-object operand queries are rejected.

Re-pinned to merged toolkit commit f5e62e083eda1aac202695682f8299dc681e4fd4, the squash of toolkit PR 19, so the pin stays reproducible from toolkit history. It also drops the flags-restore arithmeticProducerRestored field, which duplicated intactLocalSnapshot.

## Research queue tracking

Added `tools/Check-ResearchTracking.mjs` to the fast gate. It checks that every listed area has a queue file (or split directory) with its heading, `Next ID:` line and sections in order, that no queue file names an unlisted area, and that each item has a well-formed ID, names existing, non-superseded spec entries with the first in the file's area, asks a question, says what settles it and what it blocks, and, under Blocked, what it waits on. IDs are unique and below their area's allocator. Every reading in an active entry's Open questions cites a queue item that names the entry; content no item can settle yet (a neutral name the standard requires the entry to list, or the observation that would confirm a reading where no run is possible) ends with `(No item: <why>)` instead, and an exemption with no reason fails. The check is structural: it never raises a status or declares a survey complete. `queue/RNG.md` and `queue/SAVE.md` seed the scaffold's two areas with empty queues. Synthetic tests cover missing queues, duplicate and dangling IDs, wrong ownership, allocator reuse, untracked questions, reasoned and empty exemptions, blocked records, consecutive and multi-paragraph items, malformed items, dotted build aliases, split directories, wrapped text and CRLF.

## Executable file-data locations

`docs/upstream/` moves from website `3b4e6fc` to `82deb76`, which holds kibertoad/refurbished-dinosaurs PRs 28, 29 and 30. The vendored checker and the CI action move from toolkit `c361820` to `f5e62e0`, which holds the matching checker changes from toolkit PRs 20 and 21. Bytes in an executable that are read as data can now be located with `kind: file-data` and an `offset` into the shipped file, or with `unpacked: true` and an offset into the unpacked file for bytes the unpacker writes outside the load image. A Code ranges row's finding needs a location in that file that is not `kind: file-data`. The build and finding templates, `AGENTS.md` and the research-item skill say the same, and section line ranges were regenerated with `node tools/upstream.mjs links --write`. `node tools/upstream.mjs verify`, `docs --check` and `links` pass, and so do the Node evidence, upstream, bridge and vendor tests apart from the bootstrap preservation test, which needs PowerShell.

## Contested overlap reachability in the x86 reporter

The reporter pin moves from toolkit `f5e62e0` to `7da1b93`, the squash merge of toolkit PR 22, adopted with `node tools/evidence/sync-x86.mjs`. A start proven by an overlapping edge now carries its proof through its fall-through, and a call's return site never proves an overlapping start. Confirmed means reachable from accepted starts. An instruction reached only through a rejected overlapping start leaves the entry path, and `incoming` lists such calls under `contested` with `counts.contested`; they share the result limit and make `negativeUsable` false. `uses` reports accesses at those sites as an unverified overlapping instruction path and never as traced matches. `sync-x86.mjs --check`, the Python reporter suites and the Node evidence, upstream, bridge and vendor tests pass, apart from the bootstrap preservation test, which needs PowerShell.
