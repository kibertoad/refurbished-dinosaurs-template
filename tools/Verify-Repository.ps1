[CmdletBinding()]
param(
    [string] $RepositoryRoot
)

$ErrorActionPreference = 'Stop'

if (-not $RepositoryRoot) {
    $RepositoryRoot = Split-Path -Parent $PSScriptRoot
}

Import-Module (Join-Path $PSScriptRoot 'Repository-Policy.psm1') -Force
$result = Test-RepositoryPolicy -RepositoryRoot $RepositoryRoot
if ($result.Violations.Count -gt 0) {
    Write-Error ("Repository policy failed:`n - " + ($result.Violations -join "`n - "))
    exit 1
}
Write-Host "Repository policy passed for $($result.FileCount) files."
