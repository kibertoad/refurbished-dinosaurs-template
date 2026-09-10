# Bootstrap checklist

- [ ] Run `tools/Configure-Project.ps1 -ProjectName ... -DisplayName ...` once.
- [ ] Replace the source manifest placeholder with fingerprints for every supported edition.
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
- [ ] Customize Inno Setup AppId, source experience, shortcuts, smoke tests, and uninstall behavior.
- [ ] Run assetless package inspection and installed executable tests on CI.
- [ ] Remove this checklist when all project-specific decisions are captured elsewhere.
