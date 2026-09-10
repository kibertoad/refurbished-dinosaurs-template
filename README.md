# {{DISPLAY_NAME}}

A clean-room MonoGame restoration. This repository contains no copyrighted assets
from the original game. To use original audiovisual content, you must own a supported
legal release and run the included importer against that copy.

> New repository checklist: run `./tools/Configure-Project.ps1`, replace the sample
> source manifest, and work through `docs/BOOTSTRAP-CHECKLIST.md`.

## Quick start

Requirements: .NET 10 SDK and a supported original release from any lawful source.

```powershell
dotnet run --project tools/Restoration.Import -- verify-source --source "C:\path\to\original"
dotnet run --project tools/Restoration.Import -- import --source "C:\path\to\original"
dotnet run --project tools/Restoration.Import -- verify-output
dotnet run --project src/Restoration.Game
```

The importer compares every supported-edition manifest, writes an installed-content
manifest into a staging directory, verifies the result, and only then replaces
`UserContent`. Extracted content is ignored by Git and
must not be redistributed. Source discovery is deliberately storefront-agnostic;
add edition-specific adapters only after fingerprint verification is established.

## Projects

- `Restoration.Core`: deterministic rules and serializable state.
- `Restoration.Resources`: bounded binary parsing and original-content contracts.
- `Restoration.Game`: MonoGame DesktopGL presentation with assetless smoke modes.
- `Restoration.Import`: legal-copy verification and transactional extraction.
- `Restoration.Inspect`: read-only inventory and research output.
- `Restoration.Tests`: initial architecture and safety tests.

Build and test with `./tools/Test.ps1`. Build a clean Windows package with
`./tools/Publish-Windows.ps1`; build the Inno Setup 7 installer with
`./tools/Build-WindowsInstaller.ps1 -Version 0.1.0`.
Native-host Linux `.deb` and macOS `.pkg` builders are also included for projects
that choose to ship those platforms.

Shared guidance and libraries live in
[`toad-discovery-center`](https://github.com/kibertoad/toad-discovery-center).
