# Bootstrap checklist

Work top to bottom. `AGENTS.md` describes the same sequence for coding agents,
and `docs/CUSTOMIZATION.md` documents every configuration knob.

## Plan

- [ ] Record the original title, developer, release year, genre, and the
      editions available for validation.
- [ ] **Mandatory analysis gate:** establish from authoritative or corroborated
      evidence the latest official patch/version, patch the legally owned
      analysis copy to it, and record the conclusion, patch provenance,
      executable length, and SHA-256 in `tools/project-config.json`,
      `docs/SOURCE-EDITIONS.md`, and `docs/GHIDRA.md`. Refuse executable analysis
      until this is complete. Once conclusively documented, do not repeat the
      same version investigation unless contradictory evidence appears.
- [ ] Fill in `docs/IMPLEMENTATION-PLAN.md` and have it approved before writing
      implementation code.

## Configure

- [ ] Customize the provisional root `AGENTS.md` for this game's terminology,
      canonical patched oracle, evidence ledgers, local tools, and validation
      commands while preserving its universal safety rules.
- [ ] Fill in `tools/project-config.json` and run `./tools/Bootstrap-Project.ps1`.
- [ ] Run `./tools/Verify-Configuration.ps1` and resolve every finding.
- [ ] Customize the player-facing README, acknowledgements, NOTICE description,
      and the supported/limited feature table.

## Original content

- [ ] Replace the sample manifest and add one fingerprint manifest per supported
      edition.
- [ ] Extend `tools/repository-policy.json` with the extensions the original
      game actually uses.
- [ ] Decide what may be clean-room/open data and what must remain user-imported.
- [ ] Review the locked InstallShield dependency tree and complete the
      configured project's third-party notices before distributing binaries.
- [ ] Add a separate Asset Extractor with explicit/manual source selection first;
      make the Game consume only its verified versioned pack; add storefront, registry,
      media, or archive discovery as optional adapters.
- [ ] Implement read-only inventory in `Inspect` before extraction.
- [ ] Implement bounded format readers in `Resources` with synthetic fixtures.
- [ ] Transform rather than copy original executables whenever decoded data is
      sufficient.
- [ ] Verify generated files before committing the staged `UserContent` directory.
- [ ] Make missing content produce an actionable GUI error and local diagnostic log.

## Implement

- [ ] Add deterministic commands, events, seed control, snapshots, and replay to
      Core.
- [ ] Fill in architecture, format, analysis, fidelity, and validation docs as
      the answers arrive.

## Package and verify

- [ ] Customize Inno Setup source discovery and validation; keep the generated
      AppId, shortcut smoke tests, and uninstall checks.
- [ ] Customize Debian package name/dependencies and macOS bundle
      identifier/minimum version if shipping them.
- [ ] Run assetless package inspection and installed executable tests on CI.
- [ ] Remove this checklist when all project-specific decisions are captured
      elsewhere.
