# Development guide

## Run from source

Install the .NET 10 SDK and obtain a supported legal copy of the original game,
then verify and import its content:

```powershell
dotnet run --project tools/Restoration.Import -- verify-source --source "C:\path\to\original"
dotnet run --project tools/Restoration.Import -- import --source "C:\path\to\original"
dotnet run --project tools/Restoration.Import -- verify-output
dotnet run --project src/Restoration.Game
```

Import is transactional: a new content pack is staged and fully verified before
it replaces the previous verified pack. Imported content is ignored by Git and
must not be redistributed.

Build and test the complete solution with:

```powershell
./tools/Test.ps1
```

Every compiled C# source file is limited to 1,000 lines by default. The limit can
be lowered with the `MaximumSourceFileLines` MSBuild property for validation.
Exceptional builds can disable it explicitly with
`DisableSourceFileLineLimit=true`; routine development should split oversized
responsibilities instead.

## Repository projects

- `Restoration.Core`: deterministic rules and serializable state.
- `Restoration.Resources`: bounded binary parsing and original-content contracts.
- `Restoration.Game`: MonoGame DesktopGL presentation with assetless smoke modes.
- `Restoration.Import`: legal-copy verification and transactional extraction.
- `Restoration.Inspect`: read-only inventory and research output.
- `Restoration.Tests`: architecture, safety, and behavioral tests.

Detailed architecture, validation, reverse-engineering, format, and parity notes
live in the other files in this directory. Shared guidance and libraries live in
[Toad Discovery Center](https://github.com/kibertoad/toad-discovery-center).
