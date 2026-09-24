[CmdletBinding()]
param([string] $RepositoryRoot)

$ErrorActionPreference = 'Stop'
if (-not $RepositoryRoot) { $RepositoryRoot = Split-Path -Parent $PSScriptRoot }
$root = (Resolve-Path -LiteralPath $RepositoryRoot).Path
$failures = [Collections.Generic.List[string]]::new()
$config = Get-Content -LiteralPath (Join-Path $root 'tools/project-config.json') -Raw | ConvertFrom-Json
$projectName = if ($config.configured -and $config.projectName) { $config.projectName } else { 'Restoration' }

function Assert-RequiredFile([string] $relative) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $relative) -PathType Leaf)) {
        $failures.Add("missing required infrastructure file: $relative")
    }
}

foreach ($relative in @(
    'tools/Bootstrap-Project.ps1',
    'tools/Install-CodeSignTool.ps1',
    'tools/Invoke-ESigner.ps1',
    'tools/Invoke-GpgSigner.ps1',
    "src/$projectName.Extractor/packages.lock.json",
    # The documentation standard's layout: the spec, its licences, and the implementation's two ledgers.
    'spec/README.md',
    'spec/LICENSE',
    'spec/glossary.md',
    'PARITY.md',
    'DEVIATIONS.md'
)) { Assert-RequiredFile $relative }

$release = Get-Content -LiteralPath (Join-Path $root '.github/workflows/release.yml') -Raw
foreach ($required in @('signed_release:', 'release-signing', 'Invoke-ESigner.ps1',
    'Invoke-GpgSigner.ps1', 'Get-AuthenticodeSignature')) {
    if ($release.IndexOf($required, [StringComparison]::Ordinal) -lt 0) {
        $failures.Add("release workflow is missing '$required'")
    }
}

$launchers = @(Get-ChildItem -LiteralPath $root -File -Filter 'Start *.bat')
if ($launchers.Count -ne 1) {
    $failures.Add("expected exactly one root Start launcher, found $($launchers.Count)")
}
else {
    $launcher = Get-Content -LiteralPath $launchers[0].FullName -Raw
    foreach ($required in @('where dotnet', 'verify-pack', '--smoke-test', '--platform-smoke-test', '%*')) {
        if ($launcher.IndexOf($required, [StringComparison]::OrdinalIgnoreCase) -lt 0) {
            $failures.Add("root launcher is missing '$required'")
        }
    }
}

foreach ($name in @('ExportEditionAnalysis.java', 'ExportFunctionAddressCorrelations.java',
    'ExportVersionTrackingAddressContexts.java', 'ExportVersionTrackingMatches.java')) {
    $path = Join-Path $root "tools/ghidra/$name"
    Assert-RequiredFile "tools/ghidra/$name"
    if ((Test-Path -LiteralPath $path) -and
        (Get-Content -LiteralPath $path -Raw).IndexOf('requireLocalOutput', [StringComparison]::Ordinal) -lt 0) {
        $failures.Add("$name does not guard broad export output")
    }
}

# Bootstrap-Project.ps1 gates on the FIRST '**Status:**' line in the plan, so a second one -- a
# maintenance record, an appended slice log -- would silently decide the approval gate.
$plan = Get-Content -LiteralPath (Join-Path $root 'docs/IMPLEMENTATION-PLAN.md') -Raw
$statusLines = @([regex]::Matches($plan, '(?im)^\*\*Status:\*\*'))
if ($statusLines.Count -ne 1) {
    $failures.Add(
        "docs/IMPLEMENTATION-PLAN.md must contain exactly one '**Status:**' line, found $($statusLines.Count)")
}

foreach ($name in @('latestOfficialVersion', 'analysisVersion', 'patchStatusEvidence', 'patchStatusEstablished')) {
    if (-not $config.original.PSObject.Properties[$name]) {
        $failures.Add("project configuration is missing original.$name")
    }
}

if ($failures.Count) {
    throw "Template infrastructure checks failed:`n - $($failures -join "`n - ")"
}
Write-Host 'Template infrastructure checks passed.'
