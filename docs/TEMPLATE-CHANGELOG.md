# Template changelog

Maintenance history of the **unconfigured template itself**: what changed in the
shared scaffolding, and the evidence behind each decision.

A configured project records its own work in `docs/IMPLEMENTATION-PLAN.md`,
not here.

A project created from this template may delete this file.

## Work protocol, 2026-09-25

Follows the new [work protocol](https://dinorefurb.com/work-protocol/), which
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
[File size](https://dinorefurb.com/documentation-standard/#file-size) section,
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
[documentation standard](https://dinorefurb.com/documentation-standard/#deviation-log)
now sets out. `AGENTS.md`, `DEVIATIONS.md` and `docs/VALIDATION.md` say so, and
a test that reaches a mandatory deviation cites its ID and allows for it.

## Documentation standard and methodology, 2026-09-25

The template now follows the dinorefurb.com
[methodology](https://dinorefurb.com/methodology/) and version 1 of the
[documentation standard](https://dinorefurb.com/documentation-standard/).

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
