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
installation. Local and continuous-integration installers are unsigned; the
manual release workflow can sign release artifacts as described below.

The Windows installer accepts `/ORIGINAL="C:\path\to\original"` for unattended
source selection and `/NOEXTRACT=1` to explicitly skip extraction. The interactive
installer streams progress into the Setup log and allows another source to be
selected if verification fails.

## GitHub release workflow

Run the manual-only `Release installers` workflow, enter a semantic version such
as `0.1.0`, select `windows`, `no-mac-x64`, or `all`, and select `none`,
`Windows`, or `Windows/Linux` signing. The default builds
Windows x64 only; `no-mac-x64` adds Linux x64 and macOS arm64, while `all` also
adds macOS x64. Each preset requires all of its selected artifacts. A tag and
GitHub Release are created only after tests and every selected build succeed.
Installer artifacts used to assemble the release are retained in Actions for one
day; the durable downloadable copies are the assets attached to the resulting
GitHub Release. The release workflow has no scheduled or push trigger.

Both signing jobs use the protected `release-signing` GitHub environment and
fail before packaging when a required secret is missing.

### Windows Authenticode signing

Windows signing uses SSL.com eSigner. Configure `ES_USERNAME`, `ES_PASSWORD`,
`CREDENTIAL_ID`, and `ES_TOTP_SECRET` as `release-signing` environment secrets.
The workflow downloads the pinned CodeSignTool archive, verifies its SHA-256,
signs every project executable before packaging, signs the completed installer,
and requires valid timestamped Authenticode signatures both before and after the
installer smoke test.

### Linux detached signature

`Windows/Linux` signing creates an armored detached `.deb.asc` signature because
standalone `.deb` consumers do not validate an embedded package signature.
Configure `GPG_PRIVATE_KEY`, `GPG_PASSPHRASE`, and the full 40-character
`GPG_FINGERPRINT`. The signer imports the key into a temporary GnuPG home,
requires the expected private key, rejects expired or revoked signatures,
verifies its output against the exact fingerprint, and removes the temporary
keyring. Publish the matching public key; users can verify a download with:

```shell
gpg --verify package.deb.asc package.deb
```

### macOS signing status

macOS installers remain deliberately unsigned. A trustworthy implementation
requires Developer ID Application and Installer identities, hardened-runtime
compatible bundle layout, and notarization; selecting a signed release does not
pretend otherwise.

## Continuous integration

Pull requests run only the Windows installer and the zizmor security audit. The
full multi-platform matrix (build, test, and installer checks on Windows, Linux,
and both macOS architectures) runs on manual dispatch. Installer jobs verify the
installed filesystem layout; Windows additionally validates the generated Start
menu shortcut and uninstall cleanup.
