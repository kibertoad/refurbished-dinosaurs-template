[CmdletBinding()]
param([string] $OutputDirectory, [switch] $SkipArchive)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$artifacts = [IO.Path]::GetFullPath((Join-Path $root 'artifacts'))
if (-not $OutputDirectory) { $OutputDirectory = Join-Path $artifacts '{{PACKAGE_ID}}-win-x64' }
$package = [IO.Path]::GetFullPath($OutputDirectory)
$prefix = $artifacts.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
if (-not $package.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) { throw "Output must be below $artifacts." }
& (Join-Path $PSScriptRoot 'Verify-Repository.ps1') -RepositoryRoot $root
if ($LASTEXITCODE -ne 0) { throw 'Repository policy failed.' }
if (Test-Path -LiteralPath $package) { Remove-Item -LiteralPath $package -Recurse -Force }
$game = Join-Path $package 'Game'; $importer = Join-Path $package 'Tools'; $build = Join-Path $package '.build'
New-Item -ItemType Directory -Path $game,$importer -Force | Out-Null
$common = @('--configuration','Release','--runtime','win-x64','--self-contained','true','-p:DebugType=None','-p:DebugSymbols=false','-p:UseSharedCompilation=false','-m:1','--artifacts-path',$build,'--verbosity','minimal')
dotnet publish (Join-Path $root 'src/Restoration.Game/Restoration.Game.csproj') @common --output $game
if ($LASTEXITCODE -ne 0) { throw 'Game publish failed.' }
dotnet publish (Join-Path $root 'tools/Restoration.Import/Restoration.Import.csproj') @common '-p:PublishSingleFile=true' --output $importer
if ($LASTEXITCODE -ne 0) { throw 'Importer publish failed.' }
Remove-Item -LiteralPath $build -Recurse -Force
Copy-Item -LiteralPath (Join-Path $root 'README.md') -Destination $package
Copy-Item -LiteralPath (Join-Path $root 'packaging/windows/Import Original Resources.bat') -Destination $package
if (Test-Path -LiteralPath (Join-Path $package 'UserContent')) { throw 'Package contains original content.' }
& (Join-Path $game 'Restoration.Game.exe') --smoke-test
if ($LASTEXITCODE -ne 0) { throw 'Smoke test failed.' }
foreach ($native in @('SDL2.dll','openal.dll')) { if (-not (Test-Path (Join-Path $game $native))) { throw "Missing $native." } }
if (-not $SkipArchive) { Compress-Archive -LiteralPath $package -DestinationPath "$package.zip" -Force }
Write-Host "Verified package at $package"
