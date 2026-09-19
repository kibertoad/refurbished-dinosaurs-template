<#
.SYNOPSIS
Turns this template into a project for one specific game.

.DESCRIPTION
Reads tools/project-config.json, applies any parameters given on the command line,
substitutes every {{PLACEHOLDER}} token, renames the template's `Restoration.*`
projects to the configured project name, and writes the resolved values back to
tools/project-config.json so later tooling and contributors share one source of truth.

Values left empty are derived where a sensible default exists. Placeholders whose
value is still unknown are left in place and reported, so
tools/Verify-Configuration.ps1 can keep flagging them until they are filled in.

.EXAMPLE
./tools/Configure-Project.ps1
Configures the repository from tools/project-config.json alone.

.EXAMPLE
./tools/Configure-Project.ps1 -ProjectName Sanctuary -DisplayName 'Sanctuary Restored' -WhatIf
Shows every file, rename, and unresolved placeholder without changing anything.

.EXAMPLE
./tools/Configure-Project.ps1 -SkipIfConfigured -ProjectName Sample -DisplayName Sample
Configures only an unconfigured template, which is how CI gives the packaging
jobs an identity to build without touching a real project's own.
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [ValidatePattern('^[A-Z][A-Za-z0-9]+$')]
    [string] $ProjectName,
    [string] $DisplayName,
    [string] $GameId,
    [string] $PackageId,
    [string] $AppDataDirectory,
    [string] $BundleId,
    [string] $ShortcutName,
    [string] $SourceEnvironmentVariable,
    [string] $Publisher,
    [string] $CopyrightHolder,
    [int] $CopyrightYear,
    [string] $RepositoryUrl,
    [string] $Summary,
    [string] $OriginalTitle,
    [string] $OriginalDeveloper,
    [string] $OriginalReleaseYear,
    [string] $OriginalGenre,
    [string] $LatestOfficialVersion,
    [string] $AnalysisVersion,
    [string] $PatchStatusEvidence,
    [switch] $PatchStatusEstablished,
    [guid] $AppId,
    [string] $ConfigPath,
    [switch] $Force,
    [switch] $SkipIfConfigured
)

$ErrorActionPreference = 'Stop'

# The identifier the unconfigured template uses for its projects, namespaces, and
# solution file. Configuring a repository twice renames from the previously
# configured name instead, so a project can still be renamed later.
$templateName = 'Restoration'
$excludedDirectories = @('.git', 'bin', 'obj', 'artifacts', 'TestResults', 'UserContent', 'analysis', 'reference')
$textExtensions = @('.cs', '.csproj', '.slnx', '.md', '.json', '.ps1', '.bat', '.iss', '.yml', '.yaml', '.props', '.targets')
$textFileNames = @('LICENSE', 'NOTICE')

function Read-ProjectConfig([string] $path) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { return [pscustomobject]@{} }
    try { return Get-Content -LiteralPath $path -Raw | ConvertFrom-Json }
    catch { throw "Could not parse '$path': $($_.Exception.Message)" }
}

function Get-ConfigValue($config, [string] $name) {
    $property = $config.PSObject.Properties[$name]
    $value = if ($null -ne $property) { $property.Value } else { $null }
    if ($value -is [string] -and [string]::IsNullOrWhiteSpace($value)) { return $null }
    return $value
}

function Resolve-Setting([object] $parameter, $config, [string] $name, [object] $fallback = $null) {
    if ($parameter -is [string]) { if (-not [string]::IsNullOrWhiteSpace($parameter)) { return $parameter } }
    elseif ($null -ne $parameter -and $parameter -ne 0) { return $parameter }
    $stored = Get-ConfigValue $config $name
    if ($null -ne $stored) { return $stored }
    return $fallback
}

function Test-IncludedPath([string] $root, [string] $fullName) {
    $normalizedRoot = [IO.Path]::GetFullPath($root).TrimEnd('\', '/')
    $normalizedName = [IO.Path]::GetFullPath($fullName)
    if (-not $normalizedName.StartsWith($normalizedRoot + [IO.Path]::DirectorySeparatorChar,
            [StringComparison]::OrdinalIgnoreCase)) { return $false }
    $relative = $normalizedName.Substring($normalizedRoot.Length + 1).Replace('\', '/')
    return -not ($relative.Split('/') | Where-Object { $excludedDirectories -contains $_ })
}

function Get-TextFiles([string] $root, [string[]] $excludedFiles) {
    # -Force is required: on Linux and macOS PowerShell treats dot-prefixed entries
    # as hidden, which would silently skip .github workflows.
    Get-ChildItem -LiteralPath $root -Recurse -File -Force | Where-Object {
        $excludedFiles -notcontains $_.FullName -and
            (Test-IncludedPath $root $_.FullName) -and
            ($textExtensions -contains $_.Extension -or $textFileNames -contains $_.Name)
    }
}

function Get-TemplateProjectSuffixes([string] $root, [string] $fromName) {
    # Discovered rather than hard-coded so a project that added its own
    # `<Name>.Something` project is still renamed correctly.
    @(Get-ChildItem -LiteralPath $root -Recurse -Directory -Force |
        Where-Object { $_.Name -like "$fromName.*" -and (Test-IncludedPath $root $_.FullName) } |
        ForEach-Object { $_.Name.Substring($fromName.Length + 1) }) + @('slnx', 'iss') |
        Sort-Object -Unique
}

function Update-FileContent([IO.FileInfo] $file, [System.Collections.Specialized.OrderedDictionary] $replacements, [regex] $identifier, [string] $projectName) {
    $bytes = [IO.File]::ReadAllBytes($file.FullName)
    $hasBom = $bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF
    $offset = if ($hasBom) { 3 } else { 0 }
    $original = [Text.UTF8Encoding]::new($false).GetString($bytes, $offset, $bytes.Length - $offset)
    $content = $original
    foreach ($entry in $replacements.GetEnumerator()) { $content = $content.Replace($entry.Key, $entry.Value) }
    $content = $identifier.Replace($content, $projectName)
    if ($content -ceq $original) { return $false }
    if ($PSCmdlet.ShouldProcess($file.FullName, 'Rewrite')) {
        [IO.File]::WriteAllText($file.FullName, $content, [Text.UTF8Encoding]::new($hasBom))
    }
    return $true
}

function Rename-TemplateItems([string] $root, [string] $fromName, [string] $projectName, [string[]] $excludedFiles) {
    $renamed = 0
    $items = @(Get-ChildItem -LiteralPath $root -Recurse -Directory -Force |
        Where-Object { $_.Name -like "$fromName.*" -and (Test-IncludedPath $root $_.FullName) })
    $items += @(Get-ChildItem -LiteralPath $root -Recurse -File -Force | Where-Object {
        $_.Name -like "*$fromName*" -and $excludedFiles -notcontains $_.FullName -and
            (Test-IncludedPath $root $_.FullName)
    })
    foreach ($item in $items | Sort-Object FullName -Descending) {
        if (-not (Test-Path -LiteralPath $item.FullName)) { continue }
        $name = $item.Name.Replace($fromName, $projectName)
        if ($name -ceq $item.Name) { continue }
        if ($PSCmdlet.ShouldProcess($item.FullName, "Rename to '$name'")) {
            Rename-Item -LiteralPath $item.FullName -NewName $name
        }
        $renamed++
    }
    return $renamed
}

function Rename-PlaceholderFiles([string] $root, [System.Collections.Specialized.OrderedDictionary] $replacements, [string[]] $excludedFiles) {
    $renamed = 0
    foreach ($file in Get-ChildItem -LiteralPath $root -Recurse -File -Force |
        Where-Object { $excludedFiles -notcontains $_.FullName -and (Test-IncludedPath $root $_.FullName) } |
        Sort-Object FullName -Descending) {
        $name = $file.Name
        foreach ($entry in $replacements.GetEnumerator()) { $name = $name.Replace($entry.Key, $entry.Value) }
        if ($name -ceq $file.Name) { continue }
        if ($PSCmdlet.ShouldProcess($file.FullName, "Rename to '$name'")) {
            Rename-Item -LiteralPath $file.FullName -NewName $name
        }
        $renamed++
    }
    return $renamed
}

function Save-ProjectConfig([string] $path, [hashtable] $values) {
    $document = [ordered]@{
        '$schema-note' = 'Resolved identity and latest-official-version gate. Re-run ./tools/Configure-Project.ps1 -Force after changing projectName; other substituted values must be updated in place.'
        configured = $true
        projectName = $values.ProjectName
        displayName = $values.DisplayName
        gameId = $values.GameId
        packageId = $values.PackageId
        appDataDirectory = $values.AppDataDirectory
        appId = $values.AppId
        bundleId = $values.BundleId
        shortcutName = $values.ShortcutName
        sourceEnvironmentVariable = $values.SourceEnvironmentVariable
        publisher = $values.Publisher
        copyrightHolder = $values.CopyrightHolder
        copyrightYear = $values.CopyrightYear
        repositoryUrl = $values.RepositoryUrl
        summary = $values.Summary
        original = [ordered]@{
            title = $values.OriginalTitle
            developer = $values.OriginalDeveloper
            releaseYear = $values.OriginalReleaseYear
            genre = $values.OriginalGenre
            latestOfficialVersion = $values.LatestOfficialVersion
            analysisVersion = $values.AnalysisVersion
            patchStatusEvidence = $values.PatchStatusEvidence
            patchStatusEstablished = $values.PatchStatusEstablished
        }
    }
    if ($PSCmdlet.ShouldProcess($path, 'Write resolved project configuration')) {
        [IO.File]::WriteAllText(
            $path,
            (($document | ConvertTo-Json -Depth 5) + "`n"),
            [Text.UTF8Encoding]::new($false))
    }
}

$root = Split-Path -Parent $PSScriptRoot
if (-not $ConfigPath) { $ConfigPath = Join-Path $PSScriptRoot 'project-config.json' }
$ConfigPath = [IO.Path]::GetFullPath($ConfigPath)
$config = Read-ProjectConfig $ConfigPath

$wasConfigured = [bool] (Get-ConfigValue $config 'configured')
$fromName = $templateName
if ($wasConfigured) {
    $configuredName = Get-ConfigValue $config 'projectName'
    if ($configuredName) { $fromName = $configuredName }
}
if ($wasConfigured -and $SkipIfConfigured) {
    Write-Host "Already configured as '$fromName'; leaving the repository unchanged."
    exit 0
}
if ($wasConfigured -and -not $Force) {
    throw "This repository is already configured as '$fromName'. Pass -Force to reconfigure, and see docs/CUSTOMIZATION.md for what re-running can and cannot change."
}

$original = Get-ConfigValue $config 'original'
if ($null -eq $original) { $original = [pscustomobject]@{} }
$name = Resolve-Setting $ProjectName $config 'projectName'
$display = Resolve-Setting $DisplayName $config 'displayName'
if (-not $name -or -not $display) {
    throw "projectName and displayName are required. Fill them in at '$ConfigPath' or pass -ProjectName and -DisplayName."
}
if ($name -notmatch '^[A-Z][A-Za-z0-9]+$') {
    throw "projectName '$name' must be PascalCase with no separators, for example 'Sanctuary'."
}

$values = @{
    ProjectName = $name
    DisplayName = $display
    GameId = Resolve-Setting $GameId $config 'gameId' $name.ToLowerInvariant()
    PackageId = Resolve-Setting $PackageId $config 'packageId' $name
    AppDataDirectory = Resolve-Setting $AppDataDirectory $config 'appDataDirectory' $name
    ShortcutName = Resolve-Setting $ShortcutName $config 'shortcutName' ($display -replace '[:\\/*?"<>|]', '-')
    SourceEnvironmentVariable = Resolve-Setting $SourceEnvironmentVariable $config 'sourceEnvironmentVariable' `
        (([regex]::Replace($name, '([a-z0-9])([A-Z])', '$1_$2')).ToUpperInvariant() + '_SOURCE_PATH')
    Publisher = Resolve-Setting $Publisher $config 'publisher' 'kibertoad'
    Summary = Resolve-Setting $Summary $config 'summary'
    OriginalTitle = Resolve-Setting $OriginalTitle $original 'title'
    OriginalDeveloper = Resolve-Setting $OriginalDeveloper $original 'developer'
    OriginalReleaseYear = Resolve-Setting $OriginalReleaseYear $original 'releaseYear'
    OriginalGenre = Resolve-Setting $OriginalGenre $original 'genre'
    LatestOfficialVersion = Resolve-Setting $LatestOfficialVersion $original 'latestOfficialVersion'
    AnalysisVersion = Resolve-Setting $AnalysisVersion $original 'analysisVersion'
    PatchStatusEvidence = Resolve-Setting $PatchStatusEvidence $original 'patchStatusEvidence'
    PatchStatusEstablished = if ($PatchStatusEstablished) { $true } else {
        [bool] (Get-ConfigValue $original 'patchStatusEstablished')
    }
}
$values.BundleId = Resolve-Setting $BundleId $config 'bundleId' `
    "io.github.$($values.Publisher.ToLowerInvariant() -replace '[^a-z0-9.]', '').$($values.GameId -replace '[^a-zA-Z0-9.]', '')"
$values.CopyrightHolder = Resolve-Setting $CopyrightHolder $config 'copyrightHolder' $values.Publisher
# A stored year of 0 means 'not chosen yet', so fall back to the current year.
$storedYear = [int] (Resolve-Setting $CopyrightYear $config 'copyrightYear' 0)
$values.CopyrightYear = if ($storedYear -gt 0) { $storedYear } else { (Get-Date).Year }
$values.RepositoryUrl = (Resolve-Setting $RepositoryUrl $config 'repositoryUrl' `
    "https://github.com/$($values.Publisher)/$($values.GameId)").TrimEnd('/')
$resolvedAppId = Resolve-Setting $AppId $config 'appId'
$values.AppId = if ($resolvedAppId) {
    ([guid] $resolvedAppId).ToString('B').ToUpperInvariant()
} else {
    [guid]::NewGuid().ToString('B').ToUpperInvariant()
}
# A summary composed from the original-game metadata beats leaving README and
# NOTICE with a visible placeholder; an explicit summary always wins.
if (-not $values.Summary -and $values.OriginalTitle) {
    $attribution = @($values.OriginalDeveloper, $values.OriginalReleaseYear) | Where-Object { $_ }
    $attributionText = if ($attribution.Count) { " ($($attribution -join ', '))" } else { '' }
    $values.Summary = "A clean-room MonoGame reimplementation of $($values.OriginalTitle)" +
        $attributionText + '.'
}
if ($values.GameId -notmatch '^[a-z0-9][a-z0-9.-]*$') {
    throw "gameId '$($values.GameId)' must be lowercase and start with a letter or digit."
}
if ($values.SourceEnvironmentVariable -notmatch '^[A-Z_][A-Z0-9_]*$') {
    throw "sourceEnvironmentVariable '$($values.SourceEnvironmentVariable)' must be a portable uppercase environment-variable name."
}

# Placeholders with no resolved value are left untouched on purpose: an obvious
# {{TOKEN}} that Verify-Configuration.ps1 reports beats a plausible wrong default.
$replacements = [ordered]@{}
$candidates = [ordered]@{
    '{{PROJECT_NAME}}' = $values.ProjectName
    '{{DISPLAY_NAME}}' = $values.DisplayName
    '{{GAME_ID}}' = $values.GameId
    '{{PACKAGE_ID}}' = $values.PackageId
    '{{APP_DATA_DIRECTORY}}' = $values.AppDataDirectory
    '{{APP_ID}}' = $values.AppId
    '{{BUNDLE_ID}}' = $values.BundleId
    '{{SHORTCUT_NAME}}' = $values.ShortcutName
    '{{SOURCE_ENVIRONMENT_VARIABLE}}' = $values.SourceEnvironmentVariable
    '{{PUBLISHER}}' = $values.Publisher
    '{{COPYRIGHT_HOLDER}}' = $values.CopyrightHolder
    '{{COPYRIGHT_YEAR}}' = [string] $values.CopyrightYear
    '{{REPOSITORY_URL}}' = $values.RepositoryUrl
    '{{PROJECT_SUMMARY}}' = $values.Summary
    '{{ORIGINAL_TITLE}}' = $values.OriginalTitle
    '{{ORIGINAL_DEVELOPER}}' = $values.OriginalDeveloper
    '{{ORIGINAL_RELEASE_YEAR}}' = $values.OriginalReleaseYear
    '{{ORIGINAL_GENRE}}' = $values.OriginalGenre
}
$unresolved = @()
foreach ($candidate in $candidates.GetEnumerator()) {
    if ([string]::IsNullOrWhiteSpace([string] $candidate.Value)) { $unresolved += $candidate.Key; continue }
    $replacements[$candidate.Key] = [string] $candidate.Value
}

# Only rename the template's own identifiers. A blunt text replacement also
# rewrites prose and unrelated identifiers that merely contain the same word.
$suffixes = Get-TemplateProjectSuffixes $root $fromName
$identifier = [regex]::new(
    "(?<![A-Za-z0-9_])$([regex]::Escape($fromName))(?=\.(?:$(($suffixes | ForEach-Object { [regex]::Escape($_) }) -join '|'))\b|Game\b)")

# These files describe the template mechanism itself: the placeholder table, the
# template project name, and the documentation of both. Substituting into them
# would destroy the ability to reconfigure and would corrupt the guide.
$selfManaged = @(
    $PSCommandPath,
    (Join-Path $PSScriptRoot 'Verify-Configuration.ps1'),
    (Join-Path $root 'docs/CUSTOMIZATION.md'),
    (Join-Path $root 'AGENTS.md'),
    $ConfigPath
) | ForEach-Object { [IO.Path]::GetFullPath($_) }

$rewritten = 0
foreach ($file in Get-TextFiles $root $selfManaged) {
    if (Update-FileContent $file $replacements $identifier $values.ProjectName) { $rewritten++ }
}
$renamed = if ($fromName -ceq $values.ProjectName) {
    0
} else {
    Rename-TemplateItems $root $fromName $values.ProjectName $selfManaged
}
$renamed += Rename-PlaceholderFiles $root $replacements $selfManaged
Save-ProjectConfig $ConfigPath $values

Write-Host "Configured '$($values.DisplayName)' as '$($values.ProjectName)' (game id '$($values.GameId)', installer AppId $($values.AppId))."
Write-Host "Rewrote $rewritten file(s) and renamed $renamed path(s)."
if ($unresolved.Count) {
    Write-Warning ("Unresolved placeholders left in the repository: " + ($unresolved -join ', ') +
        ". Fill them in at '$ConfigPath' and re-run with -Force, or edit the affected files directly.")
}
Write-Host 'Next: run ./tools/Verify-Configuration.ps1, replace the sample source manifest, and complete docs/BOOTSTRAP-CHECKLIST.md.'
