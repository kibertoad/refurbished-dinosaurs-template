<#
.SYNOPSIS
Reports whatever still ties this repository to the unconfigured template.

.DESCRIPTION
Scans the repository for unresolved {{PLACEHOLDER}} tokens, leftover template
project names, the sample source manifest, and unfilled entries in
tools/project-config.json.

While tools/project-config.json still reports `"configured": false` the findings
are informational and the script succeeds, so the template itself stays green in
CI. Once a repository is configured, or when -Strict is passed, any finding fails
the run.

.EXAMPLE
./tools/Verify-Configuration.ps1
.EXAMPLE
./tools/Verify-Configuration.ps1 -Strict
#>
[CmdletBinding()]
param(
    [string] $RepositoryRoot,
    [switch] $Strict
)

$ErrorActionPreference = 'Stop'

$templateName = 'Restoration'
$textExtensions = @('.cs', '.csproj', '.slnx', '.md', '.json', '.ps1', '.bat', '.iss', '.yml', '.yaml', '.props', '.targets')
$textFileNames = @('LICENSE', 'NOTICE')
# Files that document the template mechanism and legitimately name placeholders.
$templateDocumentation = @(
    'tools/Configure-Project.ps1',
    'tools/Verify-Configuration.ps1',
    'docs/CUSTOMIZATION.md',
    'AGENTS.md'
)
# {{DISPLAY_NAME}}-style tokens only; Inno Setup's {#Define} and GitHub's ${{ }} do not match.
$placeholderPattern = [regex]::new('(?<!\$)\{\{[A-Z][A-Z0-9_]*\}\}')

if (-not $RepositoryRoot) { $RepositoryRoot = Split-Path -Parent $PSScriptRoot }
$root = (Resolve-Path -LiteralPath $RepositoryRoot).Path
$safeRoot = $root.Replace('\', '/')
$configPath = Join-Path $root 'tools/project-config.json'

$config = $null
$projectName = $null
$isConfigured = $false
if (Test-Path -LiteralPath $configPath -PathType Leaf) {
    $config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
    $projectName = $config.projectName
    $isConfigured = [bool] $config.configured
}
$findings = [Collections.Generic.List[string]]::new()

$paths = @(& git -c "safe.directory=$safeRoot" -c core.quotepath=false -C $root ls-files --cached --others --exclude-standard)
if ($LASTEXITCODE -ne 0) { throw 'Could not enumerate repository files.' }

$identifier = [regex]::new("(?<![A-Za-z0-9_])$([regex]::Escape($templateName))(?=\.[A-Z][A-Za-z0-9]*\b|Game\b)")
$checkIdentifiers = $isConfigured -and $projectName -and $projectName -cne $templateName

foreach ($relative in $paths | Sort-Object -Unique) {
    $file = Join-Path $root $relative
    if (-not [IO.File]::Exists($file)) { continue }
    $extension = [IO.Path]::GetExtension($relative)
    if ($textExtensions -notcontains $extension -and $textFileNames -notcontains [IO.Path]::GetFileName($relative)) { continue }
    if ($templateDocumentation -notcontains $relative) {
        $lineNumber = 0
        foreach ($line in [IO.File]::ReadLines($file)) {
            $lineNumber++
            foreach ($match in $placeholderPattern.Matches($line)) {
                $findings.Add("unresolved placeholder $($match.Value): ${relative}:$lineNumber")
            }
            if ($checkIdentifiers -and $identifier.IsMatch($line)) {
                $findings.Add("leftover template name '$templateName': ${relative}:$lineNumber")
            }
        }
    }
    if ($checkIdentifiers -and [IO.Path]::GetFileName($relative) -like "*$templateName*") {
        $findings.Add("leftover template name '$templateName' in path: $relative")
    }
    if ($relative -like 'tools/*/source-manifests/*.json' -or
        $relative -like 'src/*.Extractor/source-manifests/*.json') {
        $manifest = [IO.File]::ReadAllText($file)
        if ($manifest -match 'REPLACE\.ME' -or $manifest -match '"sha256"\s*:\s*"0{64}"' -or
            $manifest -match '"sourceEdition"\s*:\s*"replace-with-supported-edition"') {
            $findings.Add("sample source manifest is still a placeholder: $relative")
        }
    }
}

if (-not $config) {
    $findings.Add('tools/project-config.json is missing; run ./tools/Configure-Project.ps1.')
}
elseif ($isConfigured) {
    $original = $config.original
    $required = [ordered]@{
        projectName = $config.projectName
        displayName = $config.displayName
        gameId = $config.gameId
        appId = $config.appId
        sourceEnvironmentVariable = $config.sourceEnvironmentVariable
        repositoryUrl = $config.repositoryUrl
        summary = $config.summary
        'original.title' = $original.title
        'original.developer' = $original.developer
        'original.releaseYear' = $original.releaseYear
        'original.genre' = $original.genre
        'original.latestOfficialVersion' = $original.latestOfficialVersion
        'original.analysisVersion' = $original.analysisVersion
        'original.patchStatusEvidence' = $original.patchStatusEvidence
    }
    foreach ($entry in $required.GetEnumerator()) {
        if ([string]::IsNullOrWhiteSpace([string] $entry.Value)) {
            $findings.Add("tools/project-config.json is missing a value for '$($entry.Key)'.")
        }
    }
    if (-not [bool] $original.patchStatusEstablished) {
        $findings.Add("tools/project-config.json has not conclusively established the analysis edition's patch status.")
    }
    if ($original.latestOfficialVersion -and $original.analysisVersion -and
        $original.latestOfficialVersion -cne $original.analysisVersion) {
        $findings.Add("analysisVersion does not match latestOfficialVersion; patch the owned game before analysis.")
    }
}

$checklist = Join-Path $root 'docs/BOOTSTRAP-CHECKLIST.md'
$openChecklistItems = 0
if (Test-Path -LiteralPath $checklist -PathType Leaf) {
    $openChecklistItems = @(Select-String -LiteralPath $checklist -Pattern '^\s*- \[ \]' -AllMatches).Count
}

if (-not $findings.Count) {
    $configurationLabel = if ($isConfigured) { " as '$projectName'" } else { ' (template is unconfigured)' }
    Write-Host "Configuration verified for $($paths.Count) files$configurationLabel."
    if ($openChecklistItems) { Write-Host "docs/BOOTSTRAP-CHECKLIST.md still has $openChecklistItems open item(s)." }
    exit 0
}

$placeholders = @($findings | Where-Object { $_ -like 'unresolved placeholder*' })
$other = @($findings | Where-Object { $_ -notlike 'unresolved placeholder*' })

if (-not ($Strict -or $isConfigured)) {
    # Expected state for the template itself: report the shape, not 60 lines of it.
    Write-Host ("This repository is still an unconfigured template: " +
        "$($placeholders.Count) unresolved placeholder(s) and $($other.Count) other finding(s).")
    Write-Host 'Run ./tools/Configure-Project.ps1 to resolve them, or this script with -Strict for the full list.'
    if ($openChecklistItems) { Write-Host "docs/BOOTSTRAP-CHECKLIST.md still has $openChecklistItems open item(s)." }
    exit 0
}

$grouped = $findings | Group-Object { ($_ -split ':')[0] } | Sort-Object Name
$summary = ($grouped | ForEach-Object { " - $($_.Name) ($($_.Count))" }) -join "`n"
$detail = ($findings | Select-Object -First 40 | ForEach-Object { " - $_" }) -join "`n"
$message = "Configuration is incomplete:`n$summary`n`nFindings:`n$detail"
if ($findings.Count -gt 40) { $message += "`n - ... and $($findings.Count - 40) more" }

# Written directly so the multi-line report survives PowerShell's error view.
[Console]::Error.WriteLine($message)
exit 1
