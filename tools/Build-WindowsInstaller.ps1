[CmdletBinding()]
param([string] $Version = '0.1.0', [string] $Compiler, [switch] $SkipPackage)
$ErrorActionPreference = 'Stop'; $required = '7.1.0'; $root = Split-Path -Parent $PSScriptRoot
if ($Version -notmatch '^\d+\.\d+\.\d+$') { throw 'Version must be x.y.z.' }
if (-not $SkipPackage) { & (Join-Path $PSScriptRoot 'Publish-Windows.ps1') -SkipArchive }
if (-not $Compiler) {
  $Compiler = @((Join-Path $env:LOCALAPPDATA 'Programs/Inno Setup 7/ISCC.exe'),(Join-Path ${env:ProgramFiles(x86)} 'Inno Setup 7/ISCC.exe'),(Join-Path $env:ProgramFiles 'Inno Setup 7/ISCC.exe')) |
    Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
}
if (-not $Compiler -or -not (Test-Path -LiteralPath $Compiler)) { throw "Inno Setup $required was not found." }
$reported = (& $Compiler --version | Out-String).Trim()
if ($reported -ne $required) { throw "Inno Setup $required is required; found $reported." }
& $Compiler "/DMyAppVersion=$Version" (Join-Path $root 'packaging/windows/Restoration.iss')
if ($LASTEXITCODE -ne 0) { throw 'Installer compilation failed.' }
$installer = Join-Path $root "artifacts/{{PACKAGE_ID}}-Setup-$Version.exe"
if (-not (Test-Path -LiteralPath $installer)) { throw "Expected installer was not created at $installer." }
Write-Host "Windows installer created at $installer"
