[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
& (Join-Path $PSScriptRoot 'Verify-Repository.ps1') -RepositoryRoot $root
if ($LASTEXITCODE -ne 0) { throw 'Repository policy failed.' }
& (Join-Path $PSScriptRoot 'Verify-Configuration.ps1') -RepositoryRoot $root
if ($LASTEXITCODE -ne 0) { throw 'Project configuration is incomplete.' }
$artifacts = Join-Path $root 'artifacts/test'
dotnet test --project (Join-Path $root 'tests/Restoration.Tests/Restoration.Tests.csproj') `
  -p:UseSharedCompilation=false --artifacts-path $artifacts --no-progress -v minimal
if ($LASTEXITCODE -ne 0) { throw 'Tests failed.' }
