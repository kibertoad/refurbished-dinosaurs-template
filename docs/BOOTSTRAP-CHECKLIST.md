# Bootstrap checklist

- [ ] Run `tools/Configure-Project.ps1 -ProjectName ... -DisplayName ...` once; set publisher, copyright holder, repository URL, and shortcut name when their defaults do not apply.
- [ ] Replace the sample manifest and add one fingerprint manifest per supported edition.
- [ ] Decide what may be clean-room/open data and what must remain user-imported.
- [ ] Add explicit/manual source selection first; add storefront, registry, media, or archive discovery as optional adapters.
- [ ] Implement read-only inventory in `Restoration.Inspect` before extraction.
- [ ] Implement bounded format readers in `Restoration.Resources` with synthetic fixtures.
- [ ] Transform rather than copy original executables whenever decoded data is sufficient.
- [ ] Verify generated files before committing the staged `UserContent` directory.
- [ ] Make missing content produce an actionable GUI error and local diagnostic log.
- [ ] Add deterministic commands, events, seed control, snapshots, and replay to Core.
- [ ] Replace this checklist's `Restoration` names if configuration was intentionally skipped.
- [ ] Fill in architecture, format, analysis, fidelity, validation, and implementation-plan docs.
- [ ] Customize the player-facing README, acknowledgements, NOTICE description, and supported/limited feature table.
- [ ] Customize Inno Setup source discovery and validation; keep the generated AppId, shortcut smoke tests, and uninstall checks.
- [ ] Customize Debian package name/dependencies and macOS bundle identifier/minimum version if shipping them.
- [ ] Run assetless package inspection and installed executable tests on CI.
- [ ] Remove this checklist when all project-specific decisions are captured elsewhere.
