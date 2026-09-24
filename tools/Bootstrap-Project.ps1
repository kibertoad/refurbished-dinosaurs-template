<#
.SYNOPSIS
Runs the gated, one-time bootstrap for a new restoration project.
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param([string] $ConfigPath)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
if (-not $ConfigPath) { $ConfigPath = Join-Path $PSScriptRoot 'project-config.json' }
$config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json

$required = [ordered]@{
    projectName = $config.projectName
    displayName = $config.displayName
    'original.title' = $config.original.title
    'original.developer' = $config.original.developer
    'original.releaseYear' = $config.original.releaseYear
    'original.genre' = $config.original.genre
    'original.latestOfficialVersion' = $config.original.latestOfficialVersion
    'original.analysisVersion' = $config.original.analysisVersion
    'original.patchStatusEvidence' = $config.original.patchStatusEvidence
}
$missing = @($required.GetEnumerator() | Where-Object { [string]::IsNullOrWhiteSpace([string] $_.Value) } |
    ForEach-Object Key)
if ($missing.Count) { throw "Bootstrap facts are missing: $($missing -join ', ')." }
if (-not [bool] $config.original.patchStatusEstablished) {
    throw 'Patch status is not established. Verify and document the latest official version before analysis.'
}
if ($config.original.latestOfficialVersion -cne $config.original.analysisVersion) {
    throw ("The owned analysis copy is '$($config.original.analysisVersion)', but the latest official version is " +
        "'$($config.original.latestOfficialVersion)'. Patch it before analysis; mapping older versions is refused.")
}

$configure = Join-Path $PSScriptRoot 'Configure-Project.ps1'
$verify = Join-Path $PSScriptRoot 'Verify-Configuration.ps1'
if ($WhatIfPreference) {
    & $configure -ConfigPath $ConfigPath -WhatIf
    Write-Host 'Preview complete. No files were changed.'
    exit 0
}
if ($PSCmdlet.ShouldProcess($root, 'Configure and verify restoration project')) {
    # Configure-Project.ps1 reports failure by throwing, and only calls exit on its
    # -SkipIfConfigured path, so $LASTEXITCODE says nothing about how it went: in a fresh session
    # it is still $null, and $null -ne 0 would fail every successful bootstrap. Verify-Configuration.ps1
    # does exit with a status, so that one is checked.
    & $configure -ConfigPath $ConfigPath
    & $verify -RepositoryRoot $root -Strict
    if ($LASTEXITCODE -ne 0) { throw 'Project configuration remains incomplete.' }
}
Write-Host 'Bootstrap identity is complete. Continue with docs/BOOTSTRAP-CHECKLIST.md.'
