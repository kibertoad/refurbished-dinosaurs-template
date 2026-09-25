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
    'spec/glossary/.gitkeep',
    'PARITY.md',
    'parity/.gitkeep',
    'deviations/.gitkeep'
)) { Assert-RequiredFile $relative }

# The documentation standard limits every Markdown file it defines to 1,000 lines.
$standardMarkdown = @(Get-Item -LiteralPath (Join-Path $root 'PARITY.md') -ErrorAction SilentlyContinue)
foreach ($directory in @('spec', 'parity', 'deviations')) {
    $path = Join-Path $root $directory
    if (Test-Path -LiteralPath $path) {
        $standardMarkdown += @(Get-ChildItem -LiteralPath $path -Recurse -File -Filter '*.md')
    }
}
foreach ($file in $standardMarkdown) {
    $lineCount = @(Get-Content -LiteralPath $file.FullName).Count
    if ($lineCount -gt 1000) {
        $relative = $file.FullName.Substring($root.Length + 1).Replace('\', '/')
        $failures.Add("$relative has $lineCount lines; the documentation standard allows 1,000")
    }
}

$release = Get-Content -LiteralPath (Join-Path $root '.github/workflows/release.yml') -Raw
foreach ($required in @('signed_release:', 'release-signing', 'Invoke-ESigner.ps1',
    'Invoke-GpgSigner.ps1', 'Get-AuthenticodeSignature')) {
    if ($release.IndexOf($required, [StringComparison]::Ordinal) -lt 0) {
        $failures.Add("release workflow is missing '$required'")
    }
}

$ci = Get-Content -LiteralPath (Join-Path $root '.github/workflows/ci.yml') -Raw
if ($ci -notmatch 'kibertoad/refurbished-dinosaurs-toolkit/actions/check-documentation@[0-9a-f]{40}(\s|$)') {
    $failures.Add('CI workflow does not run the documentation standard check pinned to a full commit SHA')
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

foreach ($name in @('latestOfficialVersion', 'analysisVersion', 'patchStatusEvidence', 'patchStatusEstablished')) {
    if (-not $config.original.PSObject.Properties[$name]) {
        $failures.Add("project configuration is missing original.$name")
    }
}

if ($failures.Count) {
    throw "Template infrastructure checks failed:`n - $($failures -join "`n - ")"
}
Write-Host 'Template infrastructure checks passed.'
