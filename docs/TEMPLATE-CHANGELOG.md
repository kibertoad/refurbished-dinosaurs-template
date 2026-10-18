# Template changelog

Maintenance history of the **unconfigured template itself**: what changed in the
shared scaffolding, and the evidence behind each decision.

A configured project records its own work in `docs/IMPLEMENTATION-PLAN.md`,
not here.

A project created from this template may delete this file.

## Research tracker warnings on stdout, 2026-10-18

- **Research tracking.** `tools/Check-ResearchTracking.mjs` prints its `Tried:` warnings on stdout and keeps stderr for errors. Under Windows PowerShell 5.1, running the gate with its output redirected (`& ./tools/Invoke-Validation.ps1 *> gate.log`) turns any stderr line from a native command into an error record, which the gate's `$ErrorActionPreference = 'Stop'` makes fatal, so a warning stopped the gate there.

## Node tests in one run, 2026-10-18

- **Validation.** `tools/Invoke-Validation.ps1` runs its node test files in one `node --test` call, so they run at the same time instead of in three groups one after another, and sets `PWSH` to the running PowerShell for all of them. The configuration test in `tests/upstream/upstream.test.mjs` starts Configure-Project with `PWSH` like the other PowerShell tests; it called `pwsh` by name and failed the gate where only Windows PowerShell is installed.
- **Capture worker test.** `tests/upstream/capture-worker.ps1` blocks the synthetic window for 1.5 seconds before the synchronous baseline and 3 seconds before the bounded capture, with a 1-second capture timeout, and captures again as soon as the window's message loop runs instead of after a fixed 4-second sleep. It took 12 seconds and takes about 5.5; it still fails when the capture timeout does not cut the hung capture short. The validation run without a build to do went from about 21 to 10 seconds.

## A pre-commit snapshot kept between commits, 2026-10-18

- **Pre-commit hook.** `.githooks/pre-commit` keeps the staged tree it checks in `.git/precommit-snapshot`, with an index of its own, instead of copying the whole index to a new temporary directory on every commit. Each commit brings the snapshot to the staged tree with `git read-tree --reset -u`, which rewrites only the files whose staged content changed, removes those no longer staged and restores any file edited or deleted inside the snapshot, then `git clean -x` removes every other file there, ignored ones included. A snapshot whose index cannot be read, or whose index lock a killed run left behind, is rebuilt. On Windows the first read of each newly written file is scanned, so the fresh copy cost a restoration with 3,600 tracked files about 95 seconds a commit, of which the documentation check's own work was 5. With the kept snapshot the hook takes about 0.7 seconds plus the checks; the first commit in a clone still pays the full copy once. The hook removes the snapshot's `node_modules` link before the update and makes it again after, pointing at the checkout's packages, so clean never meets the link and a copied repository never checks against another checkout's packages.

## Documentation checker 6.0.1, 2026-10-18

- **Documentation checker.** `@scientific-method/standard-checker` moves from
  4.2.0 to 6.0.1, with the CI action pinned to the toolkit commit tagged for
  6.0.1. 6.0.1 reads each file once per run instead of up to four times
  (kibertoad/refurbished-dinosaurs-toolkit#543), which takes about 40% off a
  check of a 3,000-file spec. The versions in between change rules the
  unconfigured template does not reach: 5.0.0 fails a finding or experiment
  cited in the rebuild's source (`--rebuild-source`, default `src`), and 6.0.0
  has `standard-coverage` report code without an inventory, complete readings
  and the `.provenance.tsv` and `.regions.tsv` files beside an inventory. A
  configured project checks its `src/` citations and inventory side files
  against the toolkit's migration guide when it takes this version. The
  protocol documents stay at the revision already pinned.

## Evidence reporters with a local candidate index, 2026-10-18

- **Evidence reporters.** `@scientific-method/executable-reader` moves from 4.1.0
  to 4.3.0 and `scientific-method-engine` from 19.1.0 to 19.9.0
  (kibertoad/refurbished-dinosaurs-toolkit#540). Both still speak
  prepared-config protocol 3, and the engine still pins Capstone 5.0.9 and
  pypcode 4.0.1. Engine 19.9 adds `scan-index`, which builds a local SQLite
  corpus of raw immediate, displacement and resolved-call candidates once and
  answers repeated caller and operand searches from it; `report.mjs` runs it as
  `x86-scan-index`. Reader 4.3 gives that command 600 seconds and keeps 120 for
  the others, and 4.2 added `imports` for NE executables. Engine 19.2 to 19.8
  extended `reach` (decoded ranges, query-scoped stops, which starts reach each
  target, transfers into a span, branches on stack arguments), derived table
  counts from the code and let a restoration declare computed calls that leave
  the image or never run. The template reads none of the changed fields. The
  reader's `minimumReleaseAgeExclude` entry follows the new version.

## Repeated queue attempts and Defect notes, 2026-10-11

- **Research tracking.** `tools/Check-ResearchTracking.mjs` warns, without
  failing, about an item under Static with more than three `Tried:` notes,
  naming the item and the count. Under the protocol's rule for repeated
  attempts (kibertoad/refurbished-dinosaurs#107) one note inherited from a
  split and two attempts is the most an item keeps, unless each later attempt
  took part of `Settles it:` out, which the check cannot read from the text.
  `researchTracking` returns the errors and the warnings;
  `checkResearchTracking` still returns the errors alone. The `research-item`
  skill's queue step compares `Settles it:` with what it said before the
  attempt, counts an attempt that only moved it one caller or callee on as
  ending in the same place, and names the warning.
- **Defect notes.** A research batch that changes an entry in place gives its
  row a `Defect (FND-...)` or `Defect (EXP-...)` note
  (kibertoad/refurbished-dinosaurs#109). The `implement-rows` and `start-session` skills and `AGENTS.md` take every
  `Defect` note first, whether it names a report, a finding or an
  experiment; `implement-rows` matched only `Defect (R-...)`.

## Evidence reporters, 2026-10-11

- **Evidence reporters.** `@scientific-method/executable-reader` moves from 4.0.0
  to 4.1.0 and `scientific-method-engine` from 18.4.0 to 19.1.0. Both still
  speak prepared-config protocol 3. The reader's `bodies` lays out FBOV files
  whose resident descriptor spans overlap instead of failing. Engine 19 lists
  inventory row starts at unresolved overlapping instructions in `rowStarts`
  and leaves them out of `notRead`, and adds value ranges for table bounds;
  19.1 lets a restoration declare single call sites that never return. The
  template reads none of the changed `inventory-check` fields. The reader's
  `minimumReleaseAgeExclude` entry follows the new version.

## Standard, protocol and checker 4.2.0, 2026-10-11

- **Standard and protocol.** `docs/upstream/` moves from `e84495f` to `d8ebc1f`
  of kibertoad/refurbished-dinosaurs (#86 to #115). The standard stays
  version 1, and the methodology and licence are unchanged.
  - Standard: every range is half-open, a range that ends on an inventoried
    function's last byte fails unless the entry lists it in
    `ends_on_last_byte`, and such an end is corrected in place (#86, #87,
    #110); a repository may squash superseded entries before anyone outside
    relies on its IDs (#86); the Builds rules are numbered, and a build may
    keep a listing record `BLD-*.listing.yaml`, with directory exclusions in
    its list of other files (#88); validation runs are recorded as one file
    per run in `validation/`, and a root `VALIDATION.md` fails (#89); NE import
    reports and findings follow STATUS-44 (#102); a parity row's Tests lists
    only files that read the original or name an experiment in the entry's
    evidence (#103); a file that ships only inside an archive is listed in its
    archive's `members` and cited as `ARCHIVE|MEMBER` (#104); a question
    whether the code ever does something starts from a census of its mechanism
    (#106); an imported routine marked as not returning is a lead (#97); a
    mouse input row's Region cell names its event (#115).
  - Protocol: new test cases for counts that wrap to zero, loop limits the loop
    writes, stored `FLOAT32` bits, counts reloaded after allocation and more
    continuation cases (#97, #98, #99); goals run across sessions, name a side,
    may be standing goals, stop only for listed reasons and wrap up as stated,
    and claims work when only some tasks authorize a push (#100, #105); an
    implementation session settles each finding citation in `src/` by what the
    code implements (#101); a repeated queue attempt counts only when it
    changed what settles the item, and two in a row split or move it (#107); a
    research batch sends a changed entry's row back to Code `partial` with a
    `Defect` note (#109), moves citations of superseded entries in the
    handover and goal files (#111) and of closed queue items in parity rows
    and deviations (#108), and rechecks a `tools/` citation before moving it
    (#113).
  - `AGENTS.md`, `docs/goals/README.md`, the skills and the documents that
    summarize these rules follow them. The goals README's example standing
    goal conditions no longer count `Blocked` items or `Spec gap` rows as
    done, which the protocol now rules out.
- **Checker.** `@scientific-method/standard-checker` moves from 2.5.0 to 4.2.0,
  the release of toolkit `1f3ce28`. It adds `--squashed`, the range-end check,
  the inventory ranges column (and skips `.provenance.tsv` and `.regions.tsv`),
  listing record checks, `validation/` run files, `unmeasured` inventories
  and `sharedBytes` in `standard-coverage`, and a comparison with the base
  branch's tip that finds an ID taken twice before two branches meet.

## Shared libraries, 2026-10-11

- **Runtime libraries.** `RefurbishedDinosaursVersion` moves from 10.0.0 to
  12.0.0. The solution builds and its tests pass unchanged.
- **Evidence reporters.** `@scientific-method/executable-reader` moves from 2.3.0
  to 4.0.0 and `scientific-method-engine` from 12.0.0 to 18.4.0 in one change.
  Both still speak prepared-config protocol 3. The reader adds `unpack` for
  LZEXE, EXEPACK and PKLITE, `bodies`, `inventory-check` and FBOV descriptor
  extents; its majors rename `packed.pklite.scrambled` and change `bodies` for
  FBOV files, neither of which the template reads. Engine 18 requires
  Capstone 5.0.9 and pypcode 4.0.1. The reader's `minimumReleaseAgeExclude`
  entry follows the new version.

## Standard, protocol and checker 2.5.0, 2026-10-07

- **Standard and protocol.** `docs/upstream/` moves from `efa138b` to `e84495f`
  of kibertoad/refurbished-dinosaurs (#78, #79, #85). The standard stays
  version 1.
  - Standard: a repository may update `spec/index/` and `PARITY.md` on its main
    branch only, chosen by an option of the check script; every other change
    leaves them as they were where it forked, and the check fails one that
    edits, adds or removes them (#85). The checks list the rule that no spec
    file names a path or source file of the rebuild (#78).
  - Protocol: batches leave the generated files alone in such a repository
    (#85). Measuring progress gains early baselines, creating and checking an
    inventory, checking the denominator and reporting coverage by area; an
    inventory start is written in the standard's notation for its file, a
    discontiguous body may list its ranges in a further column, and
    `.provenance.tsv` and `.regions.tsv` files sit beside each inventory (#79).
- **Checker.** `@scientific-method/standard-checker` moves from 2.2.0 to 2.5.0,
  the release of toolkit `3591b66`. It adds `--scheduled-generation` (and the
  action's `scheduled-generation` input), the `standard-coverage` command,
  address checks on the addresses code uses as numbers or in strings and in
  PowerShell comments, `--message` for a commit message, and `--rebuild`
  (default `src,tests`), which fails a spec file that names the rebuild.
- **Generated files on main.** The CI documentation step sets
  `scheduled-generation: "true"`, and `.github/workflows/nightly-generated.yml`
  regenerates `spec/index/` and `PARITY.md` on `main` daily when the spec,
  parity rows or deviations changed in the last 26 hours, commits them as
  `github-actions[bot]` and pushes, retrying on a moved `main`. A protected
  `main` must let the job push (`docs/VALIDATION.md`, `docs/BOOTSTRAP-CHECKLIST.md`).
  `tools/upstream.mjs docs` reads the `rebuild` and `scheduled-generation`
  inputs, and `--generate` drops the latter so a local run or the job writes
  the files. `tools/Test-TemplateInfrastructure.ps1` fails when CI sets the
  input without the nightly workflow. `AGENTS.md`, `docs/VALIDATION.md`,
  `docs/DEVELOPMENT.md`, `docs/UPSTREAM-RULES.md` and the research-item and
  start-session skills say that branches never change the files and how to
  read current copies.
- **Address checks.** `.githooks/commit-msg` runs `docs --message` on each
  commit message. `AddressCitationTests` places its synthetic PE at
  `0x7F000000`, where no executable of the period loads, and builds its
  neutral names at run time: the checker reads a neutral name written in code
  as an address of the original, and no entry records the synthetic image's.
- **Inventories.** `tools/evidence/inventory.mjs` writes and requires starts
  in the standard's notation, which `standard-coverage` reads, in place of the
  manifest-prefixed file offsets it wrote before: `SSSS:OOOO` in an MZ load
  image (with the load image at segment `0x1000`), an eight-digit file offset
  for FBOV overlay code inside a row of the build's Code ranges (the config's
  new `codeRanges`), and an eight-digit virtual address for PE32
  (`sourceKind: "pe32"`, read by the new `tools/evidence/pe-image.mjs`).
  PE32+, LE, LX and NE files are refused until a reader models them.
  `docs/EVIDENCE-TOOLS.md` no longer names an `ExportFunctionInventory.java`
  the template never shipped, and documents `pnpm exec standard-coverage`,
  as do `AGENTS.md`, `docs/EVIDENCE-REVIEW.md` and the plan-work and
  start-session skills: its figures are printed on demand and not committed.
  Checker 2.5.0 accepts only the start, size, name and out_of_scope columns
  and reads every `.tsv` under `coverage/` as an inventory, so the template
  does not yet ask for the protocol's ranges column or provenance and regions
  files.

## Shared libraries, 2026-10-07

- **Runtime libraries.** `RefurbishedDinosaursVersion` in `Directory.Build.props`
  moves from 2.0.0 to 10.0.0 for `RefurbishedDinosaurs.Core` and
  `RefurbishedDinosaurs.LegacyFormats`. The template calls none of the members
  the intervening majors renamed or changed (the toolkit's
  [runtime libraries guide](https://github.com/kibertoad/refurbished-dinosaurs-toolkit/blob/main/docs/runtime-libraries.md#migrations)
  lists them), and its InstallShield expansion still goes through
  `SabreTools.Serialization`, so no source changes.
- **Evidence reporters.** `@scientific-method/executable-reader` moves from 1.0.0
  to 2.3.0 and `scientific-method-engine` from 1.0.1 to 12.0.0 in one change, since
  both now speak prepared-config protocol 3 (`callModels[].preservesMemory`). The
  reader adds the `imports` and `table` commands; the engine's majors change what
  a report says about calls, returns and Ghidra's function ends. The reader's
  `minimumReleaseAgeExclude` entry in `pnpm-workspace.yaml` follows the new version.

## Standard, protocol and checker 2.2.0, 2026-10-07

- **Standard and protocol.** `docs/upstream/` moves from `11dbbc5` to `efa138b`
  of kibertoad/refurbished-dinosaurs (#59 to #75). The standard stays version 1.
  - Standard: a row a deviation replaces has Tests `None` (#59); a rule's
    Parameters section takes a countable list form, and `call` and `emit`
    pass one argument per parameter (#60); How to reproduce may name tools,
    scripts and queries (#64); a correction to anything a finding or
    experiment records supersedes the whole entry (IDENTIFIERS-8, #66); PE
    import slots are mapped from the import tables (STATUS-42, #67) and tables
    of pointers are read from the build's bytes (STATUS-43, #68); an empty
    search needs a control located without the mapping and lists the kinds
    of reference searched (#69); and worked cases for register and stack
    arguments, loop progress, neighbouring dispatch tables, call-graph
    cycles, combined callee results, allocation and cleanup (#72, #74, #75).
  - Protocol: `Queue:` lists only the items a batch closed (#61); commits that
    create, re-scope or delete a goal file are not batches, and the batch that
    meets a goal leaves its file for a later commit to delete (#62); where
    sessions cannot push to the main branch, the one running goal lives on a
    `goal/` branch of the shared clone (#63); the runtime record answers each
    part of a capability (#65); Continuation cases (#71), Rules behind an
    adapter (#70), Arithmetic at the original's widths (#73), Calls that
    combine results (#74) and Allocation, containers and cleanup (#75) give
    the tests implementation batches write; a PE harness fills import slots
    from the import tables (#67).
- **Checker.** `@scientific-method/standard-checker` moves from 2.1.0 to 2.2.0,
  the release of toolkit `92a5592`, which counts the arguments of every `call`
  and `emit` against the Parameters sections and names as a skipped step each
  one it cannot count.
- **Scaffolding.** `AGENTS.md`, `docs/goals/README.md` and the start-session,
  end-session and plan-work skills follow the goal and handover commit rules
  and the `goal/` branch procedure. `docs/EVIDENCE-REVIEW.md` and the
  research-item skill carry the new reading checks, IDENTIFIERS-8, How to
  reproduce, the `Queue:` rule and the harness's import slots. `AGENTS.md` and
  step 6 of the implement-rows skill summarize the four new test subsections.
  The rule template in `docs/SPEC-ENTRY-TEMPLATES.md` shows the countable
  Parameters form, and its deviation notes say a replaced row's Tests is
  `None`. The Continuation cases entry below left `AGENTS.md` and the
  implement-rows skill naming that subsection without a link; both now link
  it. The runtime capability parts (#65) were already reflected (see
  "Runtime answers per part of a capability" below). Section links are
  rewritten to the new line ranges.

## Continuation cases, 2026-10-06

[kibertoad/refurbished-dinosaurs#71](https://github.com/kibertoad/refurbished-dinosaurs/pull/71)
adds a Continuation cases subsection after Checkpoints and replay in the work
protocol, for
[kibertoad/refurbished-dinosaurs#52](https://github.com/kibertoad/refurbished-dinosaurs/issues/52).
It lists the forms a defect takes when the state that decides how play
continues sits in several components, and the tests a game repository writes
for each. The checkpoint summary in `AGENTS.md` and step 6 of the
`implement-rows` skill now name the subsection and the cases a batch meets
most often: a copied field a helper changes, a checkpoint between two steps
of a rule accepted, a missing required field apart from an explicit null,
state published on a zero-result or failure path, identity roles with
different values, and input that names one thing twice. `docs/upstream/` does
not carry the subsection until the next refresh, so the two files name it
without a link. Whoever runs that refresh turns each name into a section link
by hand, and `links --write` then adds its line range.

## Runtime answers per part of a capability, 2026-10-06

`docs/RUNTIME.md` and the runtime-access skill show how to answer each part
of a capability that names several things (each input device the game reads,
frames and sound where the game makes sound, memory reads, breakpoints and
dumps), and how a run uses the answer of each part it needs: it cannot be
made if any part is `none`, it is a live session if any is `person`, and it
is an agent run only if every part is `agent`. For input, `person` means the
maintainer gives that input in a live session. Where the record splits a
capability, `queue/README.md` and the skill have each `Agent run` and
`Live session` item name the parts its run needs in its `Settles it:` text,
so the items a changed part affects can be found. A game repository had
found that keyboard input worked for an agent while the mouse needed a
person, and a single `agent` in the input row could be read as covering the
mouse. The text follows the paragraph and the queue rule
[kibertoad/refurbished-dinosaurs#65](https://github.com/kibertoad/refurbished-dinosaurs/pull/65)
adds to the protocol. `docs/upstream/` is not refreshed here; the protocol's
new text reaches the local copy with the next refresh.
A record that gives one answer per capability still follows the protocol,
so the standard stays version 1.

## Relevant tests only, locally, 2026-10-06

- **Rule.** `AGENTS.md` now says the full validation gate and the full test
  suite are never run locally. A change runs only the tests directly relevant
  to it, through `-TestFilter` or `dotnet test --filter`, and CI runs the gate
  on every pull request. The definition of done asks for the relevant tests
  and CI to pass.
- **Scaffolding.** `docs/DEVELOPMENT.md`, `docs/VALIDATION.md` and the
  implement-rows skill show the filtered gate in place of the full one.

## Deviated parity status, 2026-10-06

- **Standard.** `docs/upstream/` moves from `c1758fd` to `11dbbc5`.
  [kibertoad/refurbished-dinosaurs#58](https://github.com/kibertoad/refurbished-dinosaurs/pull/58)
  adds the parity status `deviated` and two optional deviation items:
  - `Replaces` names the entries a `mandatory` deviation replaces entirely.
  - `Tests` names the tests that check the rebuild does what the deviation
    says.

  A row a Replaces item names has no parity tests, and it is `deviated` once
  every `mandatory` deviation it lists has a Tests item. The range also brings
  #34, which names files by their xxHash3 hash in the methodology. Both are
  minor changes, so the standard stays version 1. Section links are rewritten
  to the new line ranges.
- **Checker.** `@scientific-method/standard-checker` moves from 0.2.0 to 2.1.0,
  the release of toolkit `92e35fc`, which checks the new items and the status.
  The majors in between are 1.0.0, which checks `.fs` files for citations, and
  2.0.0, which refuses a `starting_state` the standard does not define. Neither
  touches the unconfigured template. `PARITY.md` gains a `deviated` row.
- **Scaffolding.** The deviation template in `docs/SPEC-ENTRY-TEMPLATES.md`
  shows the two items, and the plan-work skill lists `deviated` as a slice
  target.

## Dependabot for NuGet packages, 2026-10-04

`.github/dependabot.yml` proposes NuGet updates weekly, after a seven-day
cooldown, with the `RefurbishedDinosaurs.*` packages grouped into one pull
request because they share one pinned version, and the `xunit.*` packages grouped
because they release on one version. Security updates to the
`RefurbishedDinosaurs.*` packages are grouped the same way. Those packages skip
the cooldown, because the template takes its own toolkit's releases at once, as
`pnpm-workspace.yaml` does for the documentation checker. `SabreTools.Serialization`
is ignored: maintenance slice T2 pinned and locked it to the version whose
expansion was compared with Unshield and whose license was reviewed, so a bump
redoes that evidence by hand. The npm and pip packages are left
out: the documentation checker moves only through `tools/upstream.mjs refresh`,
and the executable reader and the instruction engine must move together, which
Dependabot cannot do across ecosystems
([#48](https://github.com/kibertoad/refurbished-dinosaurs-template/issues/48)).
`docs/DEVELOPMENT.md` says how to bump them by hand.

## Pre-commit hook on Windows, 2026-10-04

- **Behaviour.** `.githooks/pre-commit` links the checkout's `node_modules`
  into its staged copy through Node (`fs.symlinkSync` with type `junction`)
  instead of `ln -s`. Git Bash on Windows copies a directory for `ln -s` unless
  symlinks are enabled, and copying pnpm's linked `node_modules` failed with
  "Device or resource busy", so the hook blocked every commit. A junction needs
  no privilege; on other systems Node makes an ordinary symlink. Git Bash's `rm`
  treats the junction as a symlink, so `rm -rf` unlinks it without entering it;
  the exit trap still removes the link first with `rm -f`, which cannot recurse.
- **Checks.** On Windows the hook now passes on a clean checkout and leaves
  `node_modules` in place; the previous hook fails there with the `ln` error.

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
  `tools/evidence/report.mjs` run `@scientific-method/executable-reader` 1.0.0,
  which hands the query to `scientific-method-engine` 1.0.1 from
  `requirements-evidence.txt`; report output keeps the `bounded-x86-v1` schema.
  Both speak prepared-config protocol 2: a query names its source by `xxh3`, the
  hash its build entry gives, and a config that still names a `sha256` is
  refused. The template's own `operand`, `incoming`, `table` and `inventory`
  commands check the same `xxh3` through the reader's `sourceXxh3`, and every
  report's `sourceIdentity` carries it. `legacy-image.mjs` re-exports the reader's parser.
  `tools/evidence/xxh3.mjs` prints a file's `xxh3` the same way, and
  `Capture-OriginalWindow.ps1` uses it to name each captured frame by `xxh3`
  instead of SHA-256 (`checkpoint.json` schema version 3), hashing after the burst so
  Node never delays a frame.
- **Software OpenGL in CI.** The Windows jobs provision Mesa through the toolkit's
  `setup-software-opengl` action, pinned by commit, and `tools/Install-MesaSoftwareGL.ps1`
  is gone. The action pins the same Mesa release and checksum, and it fails the step
  when it cannot install the driver, where the old step only warned and let the
  platform smoke test run against the runner's driver. `docs/BOUNDED-EVIDENCE-REPORTERS.md`
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
  at exactly 2.0.0, set once as `RefurbishedDinosaursVersion` in `Directory.Build.props`. The local `OriginalContentSource`, `SourceKinds`, `SourceEntry`,
  `CueSheet` and `CueTrack` give way to `OriginalContentSource`, `ContentSourceKinds`,
  `ContentSourceEntry`, `CueBinSheet` and `CueBinTrack`; asset-pack staging and commit
  use `StagedAssetPack`, startup failures `StartupFailure` (still with no dialog in a
  platform smoke test or when `CI` is set, now through its `showDialog` overload),
  per-user paths `RestorationPaths`,
  manifest paths `PortableAssetPath.Relative` and pack paths `SafePath.Below`.
  Edition manifests are `AssetManifest`, identified by `AssetVerifier.IdentifyAsync`,
  and the asset pack's manifest is `InstalledAssetManifest`, checked by
  `InstalledAssetVerifier` with unlisted files rejected; the template's `SourceManifest`,
  `AssetPackManifest`, `ContentDiagnostic` and `SpecHash` are gone. InstallShield
  expansion stays in the template.
- **Hashes.** Edition manifests, the asset-pack manifest, InstallShield inventories and
  `Restoration.Inspect` use XXH3-128 (`xxh3`), the hash the standard gives every file,
  instead of SHA-256, so an edition manifest copies its hashes from the build entry.
  `AssetPackFormatVersion` is 2, so a pack written before this change is reported as
  incompatible and the owner imports again. Diagnostics print the toolkit's problem
  names (`[WrongHash]`, `[Unlisted]`) instead of snake_case codes, and a copy two
  edition manifests both match is refused as ambiguous.
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

## Earlier records

Complete earlier records are retained in [001](template-changelog/001.md).
The original headings below preserve incoming section links.

## Website rules up to kibertoad/refurbished-dinosaurs@21f6041, 2026-09-30

[Retained record](template-changelog/001.md#record-001).

## Local copy of the standard, 2026-09-30

[Retained record](template-changelog/001.md#record-002).

## Rules live in `Core`, one test per branch, 2026-09-30

[Retained record](template-changelog/001.md#record-003).

## Bounded evidence tooling, 2026-09-29

[Retained record](template-changelog/001.md#record-004).

## Judgement-call deviations, 2026-09-27

[Retained record](template-changelog/001.md#record-005).

## Emulated calls always allowed, 2026-09-26

[Retained record](template-changelog/001.md#record-006).

## Names and numbers in the spec, 2026-09-26

[Retained record](template-changelog/001.md#record-007).

## Work protocol, 2026-09-25

[Retained record](template-changelog/001.md#record-008).

## Spec file size limit, 2026-09-25

[Retained record](template-changelog/001.md#record-009).

## Mandatory deviations and justified defaults, 2026-09-25

[Retained record](template-changelog/001.md#record-010).

## Documentation standard and methodology, 2026-09-25

[Retained record](template-changelog/001.md#record-011).

## Research tools from the game repositories, 2026-09-24

[Retained record](template-changelog/001.md#record-012).

## Template infrastructure evolution — 2026-09-19

[Retained record](template-changelog/001.md#record-013).

### Maintenance slice T1 — bounded original-media sources

[Retained record](template-changelog/001.md#record-014).

### Maintenance slice T2 — bounded InstallShield expansion

[Retained record](template-changelog/001.md#record-015).

### Maintenance slice T3 — signed, smoke-tested release installers

[Retained record](template-changelog/001.md#record-016).

### Maintenance slice T4 — bootstrap and launch experience

[Retained record](template-changelog/001.md#record-017).

### Maintenance slice T5 — bounded Ghidra toolbox and repeatable reuse audit

[Retained record](template-changelog/001.md#record-018).

### Maintenance open questions

[Retained record](template-changelog/001.md#record-019).

### Maintenance risks

[Retained record](template-changelog/001.md#record-020).

### Maintenance done when

[Retained record](template-changelog/001.md#record-021).

## 2026-09-30: v1 evidence review and offline authority

[Retained record](template-changelog/001.md#record-022).

## Reporter case-verification refinements

[Retained record](template-changelog/001.md#record-023).

## Bounded memory-map selection and JVM diagnostics

[Retained record](template-changelog/001.md#record-024).

## Committed function-inventory identity checks

[Retained record](template-changelog/001.md#record-025).

## Selected-window capture isolation

[Retained record](template-changelog/001.md#record-026).

## Bounded string effects and saved flags

[Retained record](template-changelog/001.md#record-027).

## Research queue tracking

[Retained record](template-changelog/001.md#record-028).

## Executable file-data locations

[Retained record](template-changelog/001.md#record-029).

## Contested overlap reachability in the x86 reporter

[Retained record](template-changelog/001.md#record-030).
