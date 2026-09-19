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
$plan = Get-Content -LiteralPath (Join-Path $root 'docs/IMPLEMENTATION-PLAN.md') -Raw

$planStatus = [regex]::Match($plan, '(?im)^\*\*Status:\*\*\s+([^\r\n]+)').Groups[1].Value
if ($planStatus -notmatch '(?i)^approved\b') {
    throw 'docs/IMPLEMENTATION-PLAN.md must record owner approval before bootstrap continues.'
}

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
    if ($LASTEXITCODE -ne 0) { throw 'Configuration preview failed.' }
    Write-Host 'Preview complete. No files were changed.'
    exit 0
}
if ($PSCmdlet.ShouldProcess($root, 'Configure and verify restoration project')) {
    & $configure -ConfigPath $ConfigPath
    if ($LASTEXITCODE -ne 0) { throw 'Project configuration failed.' }
    & $verify -RepositoryRoot $root -Strict
    if ($LASTEXITCODE -ne 0) { throw 'Project configuration remains incomplete.' }
}
Write-Host 'Bootstrap identity is complete. Continue with docs/BOOTSTRAP-CHECKLIST.md.'
