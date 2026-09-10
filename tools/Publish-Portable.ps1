[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('linux-x64', 'osx-x64', 'osx-arm64')]
    [string] $Runtime,
    [string] $OutputDirectory
)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$artifacts = [IO.Path]::GetFullPath((Join-Path $root 'artifacts'))
if (-not $OutputDirectory) { $OutputDirectory = Join-Path $artifacts "{{PACKAGE_ID}}-$Runtime" }
$package = [IO.Path]::GetFullPath($OutputDirectory)
$prefix = $artifacts.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
if (-not $package.StartsWith($prefix, [StringComparison]::Ordinal)) { throw "Output must be below $artifacts." }
if ($Runtime.StartsWith('linux-') -and -not $IsLinux) { throw 'Linux packages must be built and smoke-tested on Linux.' }
if ($Runtime.StartsWith('osx-') -and -not $IsMacOS) { throw 'macOS packages must be built and smoke-tested on macOS.' }
& (Join-Path $PSScriptRoot 'Verify-Repository.ps1') -RepositoryRoot $root
if ($LASTEXITCODE -ne 0) { throw 'Repository policy failed.' }
if (Test-Path -LiteralPath $package) { Remove-Item -LiteralPath $package -Recurse -Force }
$game = Join-Path $package 'Game'; $importer = Join-Path $package 'Tools'; $build = Join-Path $package '.build'
New-Item -ItemType Directory -Path $game,$importer -Force | Out-Null
$common = @('--configuration','Release','--runtime',$Runtime,'--self-contained','true','-p:PublishSingleFile=true','-p:IncludeNativeLibrariesForSelfExtract=true','-p:DebugType=None','-p:DebugSymbols=false','-p:UseSharedCompilation=false','-m:1','--artifacts-path',$build,'--verbosity','minimal')
dotnet publish (Join-Path $root 'src/Restoration.Game/Restoration.Game.csproj') @common --output $game
if ($LASTEXITCODE -ne 0) { throw 'Game publish failed.' }
dotnet publish (Join-Path $root 'tools/Restoration.Import/Restoration.Import.csproj') @common --output $importer
if ($LASTEXITCODE -ne 0) { throw 'Importer publish failed.' }
Remove-Item -LiteralPath $build -Recurse -Force
Copy-Item -LiteralPath (Join-Path $root 'README.md') -Destination $package
if (Test-Path -LiteralPath (Join-Path $package 'UserContent')) { throw 'Package contains original content.' }
$gameExecutable = Join-Path $game 'Restoration.Game'; $importExecutable = Join-Path $importer 'Restoration.Import'
& chmod 755 $gameExecutable $importExecutable
if ($LASTEXITCODE -ne 0) { throw 'Could not mark executables as executable.' }
& $gameExecutable --smoke-test
if ($LASTEXITCODE -ne 0) { throw 'Smoke test failed.' }
Write-Host "Verified $Runtime package at $package"
