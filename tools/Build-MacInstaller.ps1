[CmdletBinding()]
param(
    [string] $Version = '0.1.0',
    [ValidateSet('osx-x64','osx-arm64')]
    [string] $Runtime = 'osx-arm64'
)
$ErrorActionPreference = 'Stop'
if ($Version -notmatch '^\d+\.\d+\.\d+$') { throw 'Version must be x.y.z.' }
$root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$artifacts = [IO.Path]::GetFullPath((Join-Path $root 'artifacts'))
$portable = Join-Path $artifacts "{{PACKAGE_ID}}-$Runtime"
& (Join-Path $PSScriptRoot 'Publish-Portable.ps1') -Runtime $Runtime -OutputDirectory $portable
if ($LASTEXITCODE -ne 0) { throw 'macOS publication failed.' }
$stage = [IO.Path]::GetFullPath((Join-Path $artifacts ".macos-pkg-$Runtime-$Version"))
$prefix = $artifacts.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
if (-not $stage.StartsWith($prefix, [StringComparison]::Ordinal)) { throw 'Unsafe staging path.' }
if (Test-Path -LiteralPath $stage) { Remove-Item -LiteralPath $stage -Recurse -Force }
$app = Join-Path $stage 'Applications/{{DISPLAY_NAME}}.app'; $contents = Join-Path $app 'Contents'
$mac = Join-Path $contents 'MacOS'; $resources = Join-Path $contents 'Resources'; $tools = Join-Path $resources 'Tools'
New-Item -ItemType Directory -Path $mac,$tools -Force | Out-Null
Get-ChildItem -LiteralPath (Join-Path $portable 'Game') | Copy-Item -Destination $mac -Recurse
Get-ChildItem -LiteralPath (Join-Path $portable 'Tools') | Copy-Item -Destination $tools -Recurse
Copy-Item -LiteralPath (Join-Path $portable 'README.md') -Destination $resources
@"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "https://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleDisplayName</key><string>{{DISPLAY_NAME}}</string>
<key>CFBundleExecutable</key><string>Restoration.Game</string>
<key>CFBundleIdentifier</key><string>{{BUNDLE_ID}}</string>
<key>CFBundleInfoDictionaryVersion</key><string>6.0</string>
<key>CFBundleName</key><string>{{DISPLAY_NAME}}</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>$Version</string>
<key>CFBundleVersion</key><string>$Version</string>
<key>LSMinimumSystemVersion</key><string>12.0</string>
<key>NSHighResolutionCapable</key><true/>
</dict></plist>
"@ | Set-Content -LiteralPath (Join-Path $contents 'Info.plist') -Encoding utf8NoBOM
@'
#!/bin/sh
set -eu
if [ "$#" -ne 1 ]; then echo "Usage: Install Original Resources /path/to/original" >&2; exit 2; fi
contents="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
output="$HOME/Library/Application Support/{{APP_DATA_DIRECTORY}}/UserContent"
exec "$contents/Resources/Tools/Restoration.Import" import --source "$1" --output "$output"
'@ | Set-Content -LiteralPath (Join-Path $mac 'Install Original Resources') -Encoding utf8NoBOM
& chmod 755 (Join-Path $mac 'Restoration.Game') (Join-Path $tools 'Restoration.Import') (Join-Path $mac 'Install Original Resources')
if ($LASTEXITCODE -ne 0) { throw 'Could not mark app executables executable.' }
& plutil -lint (Join-Path $contents 'Info.plist')
if ($LASTEXITCODE -ne 0) { throw 'Info.plist is invalid.' }
& (Join-Path $mac 'Restoration.Game') --smoke-test
if ($LASTEXITCODE -ne 0) { throw 'App smoke test failed.' }
$installer = Join-Path $artifacts "{{PACKAGE_ID}}-$Runtime-Setup-$Version.pkg"
if (Test-Path -LiteralPath $installer) { Remove-Item -LiteralPath $installer -Force }
& pkgbuild --root $stage --identifier '{{BUNDLE_ID}}' --version $Version --install-location '/' $installer
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $installer)) { throw 'macOS package failed.' }
Remove-Item -LiteralPath $stage -Recurse -Force
Write-Host "macOS installer created at $installer"
