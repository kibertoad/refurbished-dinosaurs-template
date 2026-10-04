# Implementation plan

> Fill this document in before writing implementation code. Replace the italic
> guidance with real content and delete nothing structural.
>
> This file says what the project intends and what is true now, following the
> [work protocol](upstream/work-protocol.md). It holds no dated
> checkpoints, no status narration and no research questions: git keeps the
> history, `queue/` holds the research questions, and `docs/HANDOVER.md` says
> where the last session stopped.

## Game profile

| | |
|---|---|
| Original title | {{ORIGINAL_TITLE}} |
| Developer | {{ORIGINAL_DEVELOPER}} |
| Publisher | {{ORIGINAL_PUBLISHER}} |
| Release year | {{ORIGINAL_RELEASE_YEAR}} |
| Genre | {{ORIGINAL_GENRE}} |
| Eligibility | _released in 2004 or earlier, and no official remake or remaster on sale: the outcome, the evidence, and the date checked. Checked once; settled from then on unless the owner asks for a re-check._ |
| Editions available for validation | _their `BLD-` IDs; `docs/SOURCE-EDITIONS.md` holds the detail_ |
| Existing research relied on | _their `SRC-` IDs: manuals, community documentation, prior analysis_ |
| Stage | _Intake, Runtime access, Survey, Slices or Audit, as the [work protocol](upstream/work-protocol.md#stages) (lines 32-80) defines them. Move on only when the previous stage's exit criteria hold._ |

## Scope

_What this project intends to reproduce, in the player's terms._

**Non-goals.** _What it deliberately will not do: remakes of cut content,
multiplayer, editors, engine features the original never had. An explicit
non-goal is cheaper than a half-finished system._

## Slices

Slices start once the Runtime access and Survey stages have ended. Organize
the work as playable vertical slices, ordered so that each one leaves the game
runnable. Set each slice's targets to what `docs/RUNTIME.md` makes reachable:
without runs of the original, rule and screen rows, and format rows with no
files (memory structures, messages), stop at `implemented`. The
first slice gives the rebuild a headless runner that a test drives from a
fixture. A workable default order is source identification and extraction,
separate asset extraction plus assetless startup and diagnostics, native resolution and scaling,
title-to-first-interaction flow, deterministic state and replay, and only then
breadth.

| # | Slice | Player-visible outcome | Depends on | Status |
|---|---|---|---|---|
| 1 | _name_ | _what a player can do afterwards_ | — | planned |
| 2 | | | | |

### Slice 1 — _name_

- **Outcome.** _What the player can do when it is finished._
- **Evidence.** _The manual sections, observations, or data-file facts it rests
  on, by their IDs in `spec/`._
- **Acceptance — rules.** _Deterministic behavior that must hold._
- **Acceptance — presentation.** _Resolution, scaling, timing, audio._
- **Acceptance — original content.** _What is extracted, and how a missing or
  unsupported source behaves._
- **Extractor boundary.** _Which exact licensed source is accepted, which bounded
  transformations produce the versioned local pack, how complete staged output is
  verified and promoted transactionally, and how the runtime rejects missing,
  incomplete, stale, or foreign packs without reading the original installation._
- **Automated tests.** _The tests that prove it. Tests that compare against the
  original read it from `GAME_DIR` and skip without it; the rest need no
  original content._
- **Observed parity.** _The parity rows the slice should make `validated`,
  and the experiments or captures their tests compare against._
- **Exit.** _Statements a script or reviewer can check: which parity rows reach
  which status, and which queue items, by ID, must be closed first._

_Repeat this block per slice. Keep finished slices here with their status
updated; the plan is the record of what was decided, not only of what is next._

## Owner questions

Questions only the repository owner can answer: editions, scope, product
decisions. Research questions about the original go in `queue/`, never here.
A question is closed by a document update (usually `docs/DECISIONS.md`), not
by a plausible assumption in code.

| ID | Question | Blocks | Owner | Status |
|---|---|---|---|---|
| Q1 | _…_ | slice _n_ | _who_ | open |

## Risks

_Formats that may resist clean-room description, editions that differ in ways
that break a shared extraction path, timing or audio behavior that may not be
reproducible on modern hardware, and what the fallback is for each._

## Done when

_The release-shaped definition of finished for this plan: which slices, which
parity matrix rows validated, which platforms packaged and smoke-tested._


## Template maintenance: evidence tooling

While this checkout is unconfigured, the game-agnostic tooling work in
[the evidence tooling plan](TEMPLATE-EVIDENCE-PLAN.md) is authorized by the
request to address the ten accumulated research priorities. It introduces
no game behavior and retains documentation Standard v1.

## Bounded reporter tooling

Integrate toolkit reports for variable uses, near-pointer segments, stack
arguments, path effects, return widths, overlapping accesses, incoming calls,
effective guards, allocation extents and dispatch inputs.
This is research tooling; it changes no gameplay, evidence status or asset pack.

The toolkit owns a bounded 16-bit x86 instruction reader and path reporter. The
template ships an exact pinned copy and integrates its synthetic tests. The
methodology website defines report acceptance, without claiming that guidance
implements a reporter. Existing MZ/FBOV resolution and bounded table tools are
reused under their MIT license. Only synthetic executable bytes enter tests.

Reports must preserve source identity, explicit code-region and entry bounds,
segment and byte-width provenance, ordered effects and individual exits. They
must distinguish verified instruction paths from raw candidates, validate known
positive controls, and expose unsupported instructions, unresolved callees,
unknown aliases and exhausted limits. Unknown effects cannot prove preservation,
safety, success, rollback, native reachability or a complete reading.

Acceptance tests cover data between entries; segment mismatch and equality;
near/far stack frames and widening; writes before failure; low-byte return tests;
byte writes followed by word reads; late and aliased incoming calls; checked
snapshots followed by writes or calls; allocation wrapping, unit conversion and
failure effects; normalized dispatch equivalence and rejected indices. Invalid
bounds, absent controls, instruction/path limits and malformed inputs fail or
produce explicit incomplete reports. Tests require no original files or runtime.

Exit: all ten cases have executable reports and synthetic regressions, the
command interface and limits are documented, repository gates pass, and linked
PRs identify the exact delivered scope for review before propagation.

Align this integration with standards PR 26 as merged at
`94f8f678afb05171567f48d9fb19488e48309f12`. Adopt its exact rules snapshots,
regenerate section links, and preserve the current checker revision. The guide
must put configurations and reports in `GAME_DIR` and keep each game's reporter
request open until its own case passes. Adopt the toolkit's paired DS/SS
acceptance regression. Exit: pin verification, section-link checks and the
canonical validation gate pass; configured game repositories remain untouched.


## Tooling refinement: game-case reporter verification

Propagate the toolkit fixes verified against recorded restoration cases: explicit
CFG operand discovery after unresolved calls, distinct unknown flag producers,
push-CS/near-call far frames (including explicit modeled return widths), far
indirect pointer provenance, effective-width conversions, XCHG and low-result
IMUL. Operand discovery covers only the CFG reachable from a stopped trace, so
fully traced accesses keep their values; LDS/LES count the full pointer, XLAT's
implicit operand is a gap, and a four-byte call model reached without an
executed push cs stops that path. Adopt the exact committed toolkit source and
acceptance tests through sync-x86.mjs, pinned where toolkit PR 16 merged. No
proprietary code, reports or game-specific case data is copied.

Acceptance: source pin verification, synthetic reporter/bridge tests and the
canonical Invoke-Validation.ps1 gate pass. Document that CFG operands retain
unknown value/segment state and conditional callee returns; supported arithmetic
and frame shapes do not supply a complete reading. Standard/protocol wording is
proposed separately and is not refreshed before it is reviewed and merged.
Exit: tested tooling commit, separate handover and upstream propagation PR.

## PE32 bounded reporter extension

Adopt toolkit revision `a0b91d65031e360c6599bcd52cc2a1d3c732c258`, where PR [17](https://github.com/kibertoad/refurbished-dinosaurs-toolkit/pull/17) merged on top of PR [15](https://github.com/kibertoad/refurbished-dinosaurs-toolkit/pull/15) and PR 16, for Windows restoration research. Exact pin mappings add `x86/pe.py` and `tests/evidence/test_pe.py`. Acceptance covers all ten query interfaces, malformed source mappings and regions, alignment padding past VirtualSize, overlapping instruction paths, late/cross-region calls, stack cleanup, partial producers and exhausted limits. Existing rules/checker snapshots remain unchanged. PE32+ and unresolved imports/computed targets remain outside the declared model. Exit: reporter/rules pins, section links, synthetic acceptance and canonical validation pass.


## Bounded memory maps and JVM diagnostics

Tooling batch, 2026-09-30. Outcome: a researcher can select a bounded page or exact named block from a large analyzed map without exporting the entire map, and JVM crash/replay diagnostics and heap dumps stay local even if someone force-stages an ignored file. Evidence: a configured project's analyzed map has 3,546 blocks and the old reporter fails before filtering; crash logs, replay files and heap dumps can contain original memory and local environment data. Acceptance: page offset/limit are explicit, output never exceeds 512 rows, exact-name selection diagnoses absence/ambiguity, headers state total/selected/emitted and partial scope; default still rejects an oversized whole-map request. Ignore rules and the repository policy's denied file-name patterns cover diagnostic basenames at any depth; synthetic scratch Git tests prove ordinary logs remain permitted, ignored diagnostics are omitted and forcibly staged diagnostics are rejected. Java tests use constructed maps; compile against the public installed Ghidra API and verify the recorded large map when available. No original bytes or reports committed. Exit: canonical fast gate, bounded-map cases and policy regressions pass; document upstream provenance and local-only storage. No owner questions.

## Verify committed function inventories

Tooling batch. Outcome: shared tooling validates a committed coverage TSV against the selected build/manifest identity, mapped source ranges and portable destination, including documented configured-project legacy paths. Existing export/join preserves only start/size; committed format may additionally contain researcher-authored name and out_of_scope reason columns. Acceptance: require start/size plus only those optional columns; reject empty/duplicate/aliased starts, invalid sizes, mismatched manifest prefixes, unmapped source offsets, oversized body counts, wrong destination and undocumented legacy paths. An explicit legacyPath requires evidence and must be a safe repository-relative .tsv path; it never changes portable generation. CLI inventory-check reads bounded TSV data and uses the hash-guarded MZ/FBOV parser. Synthetic cases prove corruption/mapping/identity failures and optional columns. Actual Dark Sun shared export must reproduce the retained mapped export; joined output matches 2,153 rows, and the installed plus separately owned disc inventories pass with their own sources and documented CD path. No original contents or rich exports in Git. Exit: all controls, canonical gates, and source identity checks pass; upstream PR tracks shared delivery.

## Isolated original-window capture

Tooling batch. A window hidden behind another application previously captured
that application's desktop pixels. Render the selected client with PrintWindow,
reject unsupported or uniform output before writing, and remove automatic dumps
of unrelated window titles. No desktop fallback. Acceptance: an offscreen
synthetic window yields its own known painted colors; blank and invalid windows
write no output. The fast gate includes that Windows regression. An inspected
DOSBox client frame proves transport only, not gameplay-state control. Original
pixels and runtime artifacts remain local. No game evidence status changes.

## Bounded string reporter adoption

Adopt the reviewed toolkit bounded-string candidate by exact commit. Outcome: sequential MOVS/STOS/LODS, conditional direction and intact saved-flag provenance are available to template researchers. Acceptance: synthetic segmented/flat controls, zero/unknown/budget limits, overlapping copy, pointer wrap, segment overrides and flags corruption pass; pin integrity and canonical validation pass. No native execution, proprietary fixtures or game behavior changes. IRET is out of this batch; the local-return adoption below covers it. Exit: source/guide/tests pinned together and canonical gate passes.

## Explicit overlapping local return adoption

Pin the follow-up toolkit candidate with verified direct-edge overlap proof and strictly local segmented16 IRET. Acceptance: preserve false-boundary rejection; saved/missing/corrupted/overwritten frame tests pass; source, guide and tests share one exact pin; canonical gate and build pass. External interrupts, hardware and flat IRET remain unsupported.

## Instruction-owned operand adoption

Pin the toolkit candidate with instruction-verified MOV/PUSH immediate ownership, declared segment provenance and effect-summary flag events. Exact guide/source/tests must share the pin; canonical gate proves synthetic boundary/width/CLI controls. Keep mapped addresses separate from native reachability and preserve unresolved raw words.

## Research queue tracking

Tooling batch. A spec can pass the documentation checker while its area queues
are missing and its Open questions have no actionable queue references. Add a
structural protocol check for area files, section order, stable allocators,
entry ownership, duplicate IDs, dangling references and untracked questions.
Blocked items require Waiting on. Empty RNG/SAVE scaffold queues allocate no
questions. Acceptance: synthetic positive and negative fixtures, wrapped text
and Windows line endings; the unconfigured scaffold passes. The check never
promotes evidence or declares Survey complete. Include it in the fast gate.

## Explicit validation reruns without restore

Tooling batch. Outcome: an explicit -NoRestore rerun uses dependencies already
restored for the same checkout and build paths. Normal invocation and CI retain
restore. Evidence: configured-project validation failed on NuGet service/signature
endpoints despite previously restored packages. No gameplay or spec change.
Acceptance: -NoRestore skips only restore; policy, configuration, infrastructure,
node/Python checks, build and tests remain required. Missing restore state fails
without fallback; callers must restore again after dependency input changes.
Existing test filters/count controls and serialization remain intact. Synthetic command doubles prove default restore,
offline build/test arguments, retained checks and failure propagation. A configured
project must pass a real offline rerun after normal validation has restored its
existing artifact paths. Documentation states the prerequisite and normal CI path.
Exit: canonical normal and offline validation pass; open a shared template PR and
adopt only reviewed delivery. No new persisted file layout or owner decision.

## Exact dispatch, pointer and ownership reporter adoption

Tooling outcome: adopt merged toolkit c133cd48bfe6cc3cb7126616996e7d548982a068
including evidenced near-jump tables, canonical relocated-pointer exact/alias
inventories, bounded pointer-domain exclusions, owner ranges, boundary checks
and source-derived overlay export provenance. Evidence: merged toolkit PRs
33-37 and the configured-project source controls recorded separately.
Acceptance: source/guide/tests remain exact and hashed; the mapping includes
both new modules and dispatch tests; normal template validation runs the pinned
tests unchanged, with no module-path override. Existing source identity, caps,
partial-search and unresolved-flow safeguards remain intact. No original
content, game claims or runtime access. Exit: exact pin, synthetic reporter
checks and canonical template validation pass; publish a reviewable template PR.

## Reviewed overlapping operand candidate reporter adoption

Adopt toolkit PR 38's exact merged revision 1ef21ef46567dd108ea082a0a493f7024ba79a07.
Outcome: encoded literal candidates retain widths, ordered/repeated prefixes and
overlap groups with verified, rejected and unresolved entry-path classifications.
Acceptance: exact source/test/guide hashes, source bridge, literal/width/overlap
controls and every canonical validation check. Preserve configured identity and
NoRestore behavior. No game claims or proprietary fixtures. Exit: template gate
passes and reviewed adoption PR is published. No owner decision needed.

## Reviewed callee graph and near-pointer provenance adoption

Adopt toolkit PRs 39 and 40 at exact merged revision 67340fcb975449600c160ef5a4995119d4e8f127.
Outcome: `x86-callees` separates shared-node reuse from active-path recursion
with explicit limits and unread dependencies; argument and effect reports retain
caller-formed near-pointer segment provenance without binding LEA defaults.
Acceptance: exact source/test/guide hashes, source bridge, callee-graph and
pointer-provenance controls and every canonical validation check. Preserve
configured identity and NoRestore behavior. No game claims or proprietary
fixtures. Exit: template gate passes and the adoption PR is updated. No owner
decision needed.

## Locked package tooling bootstrap

Tooling outcome: install exact npm dependencies from the repository lock and the
engine/Capstone wheel hashes from Python requirements. The default Python
environment lives under artifacts/evidence-python (Scripts/python.exe on Windows,
bin/python elsewhere); EVIDENCE_PYTHON can select an explicitly supplied
interpreter. Normal validation restores those dependencies; NoRestore checks
existing dependencies and never installs or falls back to network. Standalone
wrappers select that same project environment and give an actionable setup
command when it is missing. Existing runtime/source-specific Ghidra wrappers
combine the packaged shared scripts with retained project-specific scripts.
Acceptance: locked clean normal restore, offline rerun, missing/mismatched engine
and prepared-protocol controls, wrapper routing and configured source/control
regressions pass; published archives contain the required modules/scripts.
No gameplay, source manifest or rule snapshot refresh. Exit: canonical gates and
reviewable template migration; no copied competing shared implementation remains.

## Published engine 0.4.0 adoption

Adopt published engine 0.4.0 by exact wheel hash. It carries the merged
call-order (toolkit PR 41), return-flow (PR 43) and effect-ordering (PR 45)
commands: caller sequences and shared guards, width-preserving result flow, and
bounded effect timelines with qualified local restoration witnesses. The
published npm reader forwards these commands. Acceptance: normal and
unreachable-proxy NoRestore canonical gates pass, and installed-package
call-order, return-flow and existing source controls pass. Conditional callee
models, stopped paths and caps stay explicit; a stopped or capped path leaves a
request open. No gameplay, research claims or rule snapshot changes. Exit:
reproducible registry delivery and a reviewable template lock update.

## Published reader 0.2.0 adoption

Adopt the registry executable-reader 0.2.0 archive from toolkit release d938689
with an exact npm lock. Engine 0.4.0 and checker 0.1.0 remain pinned. The release
includes merged command help and prepared-reader integration; do not adopt the
unmerged conditional-table candidate. Acceptance: normal and unavailable-proxy
NoRestore canonical gates in configured and template checkouts, version/missing-
dependency controls and all retained installed-package source drivers pass.
Configs/reports stay in GAME_DIR; no candidate PYTHONPATH is used. Exit: validated
locks, reviewable template PR update and source regression record. No gameplay,
rule snapshot or persisted content-contract change.
