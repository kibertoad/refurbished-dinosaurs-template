# Bootstrap checklist

Work top to bottom. `AGENTS.md` describes the same sequence for coding agents,
and `docs/CUSTOMIZATION.md` documents every configuration knob.

## Plan

- [ ] Record the original title, developer, publisher, release year, genre, and the
      editions available for validation.
- [ ] **Eligibility gate:** confirm once that the game was released in 2004 or
      earlier and that no official remake or remaster is on sale, and record
      the outcome and evidence in the Eligibility row of
      `docs/IMPLEMENTATION-PLAN.md`. After that it is settled; do not re-check
      it unless the repository owner asks.
- [ ] **Mandatory analysis gate:** establish from authoritative or corroborated
      evidence the latest official patch/version, patch the legally owned
      analysis copy to it, and record the conclusion, patch provenance,
      executable length, and SHA-256 in `tools/project-config.json`,
      `docs/SOURCE-EDITIONS.md`, and `docs/GHIDRA.md`. Refuse executable analysis
      until this is complete. After that it is settled; do not repeat the
      version investigation unless the repository owner asks.
- [ ] Write the analysis copy's build entry in `spec/builds/`, fill in the
      scope and area list in `spec/README.md`, and add a source entry for each
      manual, FAQ, or earlier tool the work relies on.
- [ ] Fill in `docs/IMPLEMENTATION-PLAN.md`.
- [ ] Survey: give every file in the build manifest a format entry (`unknown`
      where nothing is known), export a function inventory of the executable
      to `coverage/<build ID>.tsv` (start address and size per function),
      add a screen entry for every screen the manual mentions, and seed a
      `queue/<AREA>.md` for every area.
- [ ] Harness: specify the random number generator, understand the save
      format well enough to patch it, choose the tool that observes the
      original running, and replay one recorded experiment in a test.

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
- [ ] Write a format entry, with a Kaitai definition, for each file format
      before implementing its reader.
- [ ] Implement bounded format readers in `Resources` with synthetic fixtures,
      plus tests that decode every shipped file from `GAME_DIR` and skip
      without it.
- [ ] Transform rather than copy original executables whenever decoded data is
      sufficient.
- [ ] Verify generated files before committing the staged `UserContent` directory.
- [ ] Make missing content produce an actionable GUI error and local diagnostic log.

## Implement

- [ ] Add deterministic commands, events, seed control, snapshots, and replay to
      Core.
- [ ] Record rules, formats, screens, bugs, findings, and experiments in
      `spec/` as the answers arrive, and keep the parity matrix and `deviations/`
      in step with the code.
- [ ] Set up a main-branch CI job with a maintainer-owned copy of the game in
      `GAME_DIR`, which fails if a test listed for a `validated` row skips.

## Package and verify

- [ ] Customize Inno Setup source discovery and validation; keep the generated
      AppId, shortcut smoke tests, and uninstall checks.
- [ ] Customize Debian package name/dependencies and macOS bundle
      identifier/minimum version if shipping them.
- [ ] Run assetless package inspection and installed executable tests on CI.
- [ ] Remove this checklist when all project-specific decisions are captured
      elsewhere.
