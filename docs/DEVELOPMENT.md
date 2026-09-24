# Development guide

## Run from source

Install the .NET 10 SDK and obtain a supported legal copy of the original game,
then verify and extract its content with the separate Asset Extractor:

```powershell
dotnet run --project src/Restoration.Extractor -- verify-source --source "C:\path\to\original"
dotnet run --project src/Restoration.Extractor -- extract --source "C:\path\to\original"
dotnet run --project src/Restoration.Extractor -- verify-pack
dotnet run --project src/Restoration.Game
```

Each edition manifest declares `sourceKind` as `directory`, `iso9660`, or
`cue-bin`. The same `--source` option accepts the corresponding directory, ISO,
CUE/BIN directory, `.cue`, or `.bin` path. Projects that need InstallShield can
stage a supported cabinet through the bounded isolated adapter:

```powershell
dotnet run --project src/Restoration.Extractor -- expand-installshield `
  --cabinet "C:\path\to\data1.cab" --output "C:\empty\staging"
```

Extraction is transactional: a new content pack is staged and fully verified before
it replaces the previous verified pack. Imported content is ignored by Git and
must not be redistributed.

Build and test the complete solution with:

```powershell
./tools/Invoke-Validation.ps1
```

The default gate skips tests tagged `Category=LongRunning`; pass
`-IncludeLongRunningTests` to run them, `-TestFilter` to narrow a run, and
`-MinimumExpectedTests` to fail when discovery drops below an expected count.

Tests that compare the rebuild with the original read its files from the
directory named by `GAME_DIR`, laid out as `docs/VALIDATION.md` describes, and
skip when it is not set. Point it at your own copy to run them.

Every compiled C# source file is limited to 1,000 lines by default. The limit can
be lowered with the `MaximumSourceFileLines` MSBuild property for validation.
Exceptional builds can disable it explicitly with
`DisableSourceFileLineLimit=true`; routine development should split oversized
responsibilities instead.

## Repository projects

- `Restoration.Core`: deterministic rules and serializable state.
- `Restoration.Resources`: bounded binary parsing and original-content contracts.
- `Restoration.Game`: MonoGame DesktopGL presentation with assetless smoke modes.
- `Restoration.Extractor`: separate legal-copy verification and transactional extraction executable.
- `Restoration.Inspect`: read-only inventory and research output, including the
  `citations` check of documented addresses (`docs/GHIDRA.md`).
- `Restoration.Tests`: architecture, safety, and behavioral tests.

New repositories start with `tools/project-config.json` and
`./tools/Bootstrap-Project.ps1`; `docs/CUSTOMIZATION.md` documents every field,
and `./tools/Verify-Configuration.ps1` reports whatever is still left over from
the template. `AGENTS.md` is the working agreement for the repository, including
the rule that `docs/IMPLEMENTATION-PLAN.md` is written and approved before
implementation starts.

The original game is documented in `spec/`, following the
[documentation standard](https://dinorefurb.com/documentation-standard/), and
the rebuild's coverage of it in `PARITY.md` and `DEVIATIONS.md`. Architecture,
validation, and reverse-engineering tool notes live in the other files in this
directory. Shared guidance and libraries live in
[Toad Discovery Center](https://github.com/kibertoad/toad-discovery-center).
