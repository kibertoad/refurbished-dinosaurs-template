[CmdletBinding()]
param([string] $Version = '0.1.0')
$ErrorActionPreference = 'Stop'
if ($Version -notmatch '^\d+\.\d+\.\d+$') { throw 'Version must be x.y.z.' }
$root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$artifacts = [IO.Path]::GetFullPath((Join-Path $root 'artifacts'))
$portable = Join-Path $artifacts '{{PACKAGE_ID}}-linux-x64'
& (Join-Path $PSScriptRoot 'Publish-Portable.ps1') -Runtime linux-x64 -OutputDirectory $portable
if ($LASTEXITCODE -ne 0) { throw 'Linux publication failed.' }
$stage = [IO.Path]::GetFullPath((Join-Path $artifacts ".linux-deb-$Version"))
$prefix = $artifacts.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
if (-not $stage.StartsWith($prefix, [StringComparison]::Ordinal)) { throw 'Unsafe staging path.' }
if (Test-Path -LiteralPath $stage) { Remove-Item -LiteralPath $stage -Recurse -Force }
$install = Join-Path $stage 'opt/{{GAME_ID}}'; $debian = Join-Path $stage 'DEBIAN'
$bin = Join-Path $stage 'usr/bin'; $desktop = Join-Path $stage 'usr/share/applications'
New-Item -ItemType Directory -Path $install,$debian,$bin,$desktop -Force | Out-Null
Get-ChildItem -LiteralPath $portable | Copy-Item -Destination $install -Recurse
@"
Package: {{GAME_ID}}
Version: $Version
Section: games
Priority: optional
Architecture: amd64
Maintainer: {{DISPLAY_NAME}} contributors
Depends: libc6, libgl1, libx11-6, libopenal1
Description: Clean-room restoration of {{ORIGINAL_TITLE}}
 Requires resources extracted from a supported legally owned original for copyrighted media.
"@ | Set-Content -LiteralPath (Join-Path $debian 'control') -Encoding utf8NoBOM
@'
#!/bin/sh
exec /opt/{{GAME_ID}}/Game/Restoration.Game "$@"
'@ | Set-Content -LiteralPath (Join-Path $bin '{{GAME_ID}}') -Encoding utf8NoBOM
@'
#!/bin/sh
set -eu
if [ "$#" -ne 1 ]; then echo "Usage: {{GAME_ID}}-extract /path/to/original" >&2; exit 2; fi
output="${XDG_DATA_HOME:-$HOME/.local/share}/{{APP_DATA_DIRECTORY}}/UserContent"
exec /opt/{{GAME_ID}}/Tools/Restoration.Extractor extract --source "$1" --output "$output"
'@ | Set-Content -LiteralPath (Join-Path $bin '{{GAME_ID}}-extract') -Encoding utf8NoBOM
@'
[Desktop Entry]
Type=Application
Name={{DISPLAY_NAME}}
Comment=Clean-room restoration of {{ORIGINAL_TITLE}}
Exec={{GAME_ID}}
Terminal=false
Categories=Game;
'@ | Set-Content -LiteralPath (Join-Path $desktop '{{GAME_ID}}.desktop') -Encoding utf8NoBOM
& chmod 755 (Join-Path $bin '{{GAME_ID}}') (Join-Path $bin '{{GAME_ID}}-extract')
if ($LASTEXITCODE -ne 0) { throw 'Could not mark launchers executable.' }
$installer = Join-Path $artifacts "{{PACKAGE_ID}}-linux-x64-Setup-$Version.deb"
if (Test-Path -LiteralPath $installer) { Remove-Item -LiteralPath $installer -Force }
& dpkg-deb --build --root-owner-group $stage $installer
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $installer)) { throw 'Debian package failed.' }
Remove-Item -LiteralPath $stage -Recurse -Force
Write-Host "Linux installer created at $installer"
