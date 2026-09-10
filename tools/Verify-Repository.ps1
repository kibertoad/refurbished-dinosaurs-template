[CmdletBinding()]
param([string] $RepositoryRoot)
$ErrorActionPreference = 'Stop'
if (-not $RepositoryRoot) { $RepositoryRoot = Split-Path -Parent $PSScriptRoot }
$root = (Resolve-Path -LiteralPath $RepositoryRoot).Path
$policy = Get-Content -LiteralPath (Join-Path $root 'tools/repository-policy.json') -Raw | ConvertFrom-Json
$safeRoot = $root.Replace('\', '/')
function Normalize([string] $value) { return $value.Replace('\', '/').TrimStart('./') }
function Under([string] $path, [string[]] $roots) {
    foreach ($candidate in $roots) { if ($path.StartsWith((Normalize $candidate), [StringComparison]::OrdinalIgnoreCase)) { return $true } }
    return $false
}
$paths = @(& git -c "safe.directory=$safeRoot" -c core.quotepath=false -C $root ls-files --cached --others --exclude-standard)
if ($LASTEXITCODE -ne 0) { throw 'Could not enumerate repository files.' }
$errors = [Collections.Generic.List[string]]::new()
foreach ($raw in $paths | Sort-Object -Unique) {
    $path = Normalize $raw
    if (Under $path $policy.deniedRoots) { $errors.Add("original/local content: $path"); continue }
    if ($policy.restrictedExtensions -contains [IO.Path]::GetExtension($path) -and -not (Under $path $policy.approvedRestrictedRoots)) {
        $errors.Add("restricted media: $path")
    }
    $file = Join-Path $root $path
    if ([IO.File]::Exists($file) -and ([IO.FileInfo]$file).Length -gt $policy.maximumTrackedFileBytes -and $policy.approvedLargeFiles -notcontains $path) {
        $errors.Add("unreviewed large file: $path")
    }
}
if ($errors.Count) { Write-Error ("Repository policy failed:`n - " + ($errors -join "`n - ")); exit 1 }
Write-Host "Repository policy passed for $($paths.Count) files."
