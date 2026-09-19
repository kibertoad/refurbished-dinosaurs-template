# Implementation plan

> Fill this document in and have it approved **before** writing implementation
> code. `AGENTS.md` explains the gate; this file is what gets reviewed. Replace
> the italic guidance with real content and delete nothing structural.

**Status:** draft — not approved.
**Approved by:** _name_ on _date_, covering slices _…_.

## Template infrastructure evolution — 2026-09-19

**Status:** complete and verified on 2026-09-19; approved by the repository
owner for slices T1–T5 and the proposed defaults in TQ1–TQ5.

This maintenance plan improves the unconfigured template itself. It does not
choose an original game, claim support for an edition, or replace the
game-specific plan scaffold below. The comparison set is:

- `C:\sources\wages-due`;
- `C:\sources\rechaos-overlords`;
- `C:\sources\outpost-returns`;
- `C:\sources\dark-sun-wake-redux`;
- `C:\sources\enemy-reinfestation`;
- `C:\games\magicmayhem-again`.

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

## Game profile

| | |
|---|---|
| Original title | {{ORIGINAL_TITLE}} |
| Developer | {{ORIGINAL_DEVELOPER}} |
| Release year | {{ORIGINAL_RELEASE_YEAR}} |
| Genre | {{ORIGINAL_GENRE}} |
| Editions available for validation | _list them; `docs/SOURCE-EDITIONS.md` holds the detail_ |
| Existing research relied on | _manuals, community documentation, prior analysis_ |

## Scope

_What this project intends to reproduce, in the player's terms._

**Non-goals.** _What it deliberately will not do: remakes of cut content,
multiplayer, editors, engine features the original never had. An explicit
non-goal is cheaper than a half-finished system._

## Slices

Organize the work as playable vertical slices, ordered so that each one leaves
the game runnable. A workable default order is source identification and extraction,
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
  on, with identifiers from `docs/RULES-AND-EVIDENCE.md`._
- **Acceptance — rules.** _Deterministic behavior that must hold._
- **Acceptance — presentation.** _Resolution, scaling, timing, audio._
- **Acceptance — original content.** _What is extracted, and how a missing or
  unsupported source behaves._
- **Extractor boundary.** _Which exact licensed source is accepted, which bounded
  transformations produce the versioned local pack, how complete staged output is
  verified and promoted transactionally, and how the runtime rejects missing,
  incomplete, stale, or foreign packs without reading the original installation._
- **Automated tests.** _The tests that prove it, none of which may require
  original content._
- **Observed parity.** _What will be compared against the original, and how._

_Repeat this block per slice. Keep finished slices here with their status
updated; the plan is the record of what was decided, not only of what is next._

## Open questions

Track every uncertainty here until it is settled by evidence. A question is
closed by a document update, not by a plausible assumption in code.

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
