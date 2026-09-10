[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[A-Z][A-Za-z0-9]+$')]
    [string] $ProjectName,
    [Parameter(Mandatory = $true)]
    [string] $DisplayName,
    [string] $GameId,
    [string] $PackageId,
    [string] $AppDataDirectory,
    [string] $BundleId,
    [guid] $AppId = [guid]::NewGuid()
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
if (-not $GameId) { $GameId = $ProjectName.ToLowerInvariant() }
if (-not $PackageId) { $PackageId = $ProjectName }
if (-not $AppDataDirectory) { $AppDataDirectory = $ProjectName }
if (-not $BundleId) { $BundleId = "io.github.kibertoad.$($GameId -replace '[^a-zA-Z0-9.]','')" }
$replacements = [ordered]@{
    '{{DISPLAY_NAME}}' = $DisplayName
    '{{GAME_ID}}' = $GameId
    '{{PACKAGE_ID}}' = $PackageId
    '{{APP_DATA_DIRECTORY}}' = $AppDataDirectory
    '{{APP_ID}}' = $AppId.ToString('B').ToUpperInvariant()
    '{{BUNDLE_ID}}' = $BundleId
}
$extensions = @('.cs','.csproj','.slnx','.md','.json','.ps1','.bat','.iss','.yml','.yaml','.props','.targets')
foreach ($file in Get-ChildItem -LiteralPath $root -Recurse -File | Where-Object {
    $_.FullName -notlike '*\.git\*' -and $extensions -contains $_.Extension
}) {
    $content = Get-Content -LiteralPath $file.FullName -Raw
    foreach ($entry in $replacements.GetEnumerator()) { $content = $content.Replace($entry.Key, $entry.Value) }
    $content = $content.Replace('Restoration', $ProjectName)
    Set-Content -LiteralPath $file.FullName -Value $content -NoNewline
}
foreach ($directory in Get-ChildItem -LiteralPath $root -Recurse -Directory |
    Where-Object { $_.Name -like 'Restoration.*' } | Sort-Object FullName -Descending) {
    Rename-Item -LiteralPath $directory.FullName -NewName $directory.Name.Replace('Restoration', $ProjectName)
}
foreach ($file in Get-ChildItem -LiteralPath $root -Recurse -File |
    Where-Object { $_.Name -like '*Restoration*' } | Sort-Object FullName -Descending) {
    Rename-Item -LiteralPath $file.FullName -NewName $file.Name.Replace('Restoration', $ProjectName)
}
Write-Host "Configured '$DisplayName' with namespace '$ProjectName' and installer AppId $AppId."
Write-Host 'Next: replace the sample source manifest and complete docs/BOOTSTRAP-CHECKLIST.md.'
