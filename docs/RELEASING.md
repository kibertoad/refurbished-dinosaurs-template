# Building and releasing installers

## Local package builds

Create an SDK-free Windows package with:

```powershell
./tools/Publish-Windows.ps1
```

Build the versioned Windows installer with the pinned Inno Setup 7.1.0 compiler:

```powershell
./tools/Build-WindowsInstaller.ps1 -Version 0.1.0
```

Build Linux x64 and macOS arm64/x64 installers on their native hosts:

```powershell
./tools/Build-LinuxInstaller.ps1 -Version 0.1.0
./tools/Build-MacInstaller.ps1 -Version 0.1.0 -Runtime osx-arm64
./tools/Build-MacInstaller.ps1 -Version 0.1.0 -Runtime osx-x64
```

All portable packages and installed applications include the project `NOTICE`
and canonical MIT `LICENSE`. The Windows Setup wizard displays both before
installation. Release installers are unsigned until a project adds its own
platform-specific signing configuration.

The Windows installer accepts `/ORIGINAL="C:\path\to\original"` for unattended
source selection and `/NOIMPORT=1` to explicitly skip import. The interactive
installer streams progress into the Setup log and allows another source to be
selected if verification fails.

## GitHub release workflow

Run the manual-only `Release installers` workflow, enter a semantic version such
as `0.1.0`, and select `windows` or `all`. The default builds Windows x64 only.
`all` additionally requires Linux x64, macOS arm64, and macOS x64 artifacts. A
tag and GitHub Release are created only after tests and every selected build
succeed.

## Continuous integration

Pull requests and manual runs build, test, and smoke-test the assetless project
on Windows, Linux, and both macOS architectures. Installer jobs verify the
installed filesystem layout; Windows additionally validates the generated Start
menu shortcut and uninstall cleanup.
