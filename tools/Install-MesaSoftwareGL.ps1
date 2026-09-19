<#
.SYNOPSIS
Provisions a software OpenGL driver for the platform smoke test on a runner with no usable GPU.

.DESCRIPTION
GitHub's hosted Windows runners expose only the GDI generic OpenGL renderer, which is effectively
OpenGL 1.1 and has no framebuffer objects, so MonoGame's DesktopGL backend cannot create a graphics
device there. Mesa's llvmpipe rasterizes on the CPU and does support them.

The driver is written to a directory of the caller's choosing -- CI passes one under RUNNER_TEMP --
and is deliberately never placed anywhere the build could pick it up. It reaches the game only
through PLATFORM_SMOKE_TEST_GL_DRIVER plus an explicit --software-renderer flag, and
tools/Publish-Windows.ps1 fails the package if a driver ever appears inside it.

Emits the resolved driver path on success.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string] $DestinationPath
)

$ErrorActionPreference = 'Stop'

# Pin both, the way tools/Install-CodeSignTool.ps1 does: this downloads a third-party binary, and an
# unpinned one would be an unreviewed dependency running inside the release pipeline.
$version = ''
$expectedSha256 = ''

if (-not $version -or -not $expectedSha256) {
    throw @'
Install-MesaSoftwareGL.ps1 is not pinned yet. Set $version and $expectedSha256 in this script to a
reviewed mesa-dist-win release before CI depends on it.

To obtain them, on a machine that can reach the releases:
  $v = '<release version, e.g. 25.0.7>'
  $u = "https://github.com/pal1000/mesa-dist-win/releases/download/$v/mesa3d-$v-release-msvc.7z"
  Invoke-WebRequest -Uri $u -OutFile mesa.7z
  (Get-FileHash -LiteralPath mesa.7z -Algorithm SHA256).Hash

Refusing to download an unpinned binary.
'@
}

$archiveName = "mesa3d-$version-release-msvc.7z"
$downloadUri = "https://github.com/pal1000/mesa-dist-win/releases/download/$version/$archiveName"
$resolvedDestination = [IO.Path]::GetFullPath($DestinationPath)

# Private, per-run staging so the archive never lands on a predictable path and never outlives the
# install.
$staging = Join-Path ([IO.Path]::GetTempPath()) ('mesa-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $staging -Force | Out-Null
$archivePath = Join-Path $staging $archiveName

try {
    Invoke-WebRequest -Uri $downloadUri -OutFile $archivePath -MaximumRetryCount 4 -RetryIntervalSec 5

    $actualSha256 = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash
    if ($actualSha256 -ne $expectedSha256) {
        throw "Unexpected SHA-256 for $archiveName. Expected $expectedSha256, got $actualSha256."
    }

    New-Item -ItemType Directory -Path $resolvedDestination -Force | Out-Null
    & 7z x $archivePath "-o$staging\extracted" -y | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Could not expand $archiveName." }

    # The 64-bit build is the one that matches the published game.
    $driver = Get-ChildItem -LiteralPath "$staging\extracted" -Recurse -File -Filter 'opengl32.dll' |
        Where-Object { $_.DirectoryName -match 'x64' } | Select-Object -First 1
    if (-not $driver) { throw "$archiveName did not contain a 64-bit opengl32.dll." }

    Copy-Item -LiteralPath $driver.DirectoryName -Destination $resolvedDestination -Recurse -Force
    $installed = Join-Path $resolvedDestination (Split-Path -Leaf $driver.DirectoryName) |
        Join-Path -ChildPath 'opengl32.dll'
    if (-not (Test-Path -LiteralPath $installed -PathType Leaf)) {
        throw "Software OpenGL driver was not installed at '$installed'."
    }
    $installed
}
finally {
    Remove-Item -LiteralPath $staging -Recurse -Force -ErrorAction SilentlyContinue
}
