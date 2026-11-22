<#
.SYNOPSIS
The platforms a restoration can target, the guide for each, and the marked blocks that link it.

.DESCRIPTION
`platform` in tools/project-config.json names the platform the original runs on. Each platform has
one guide in docs/ for running the game, the lift harness and function inventories. AGENTS.md,
docs/RUNTIME.md and the runtime-access skill each hold a block between the markers below. In the
unconfigured template the block lists every platform's guide; Configure-Project.ps1 rewrites it to
link only the configured platform's guide, and Verify-Configuration.ps1 reports a block that does
not match the configuration.
#>

$script:Platforms = [ordered]@{
    'dos-real-mode' = [pscustomobject]@{
        Label = '16-bit real-mode DOS'
        Guide = 'DOS-REAL-MODE-RUNTIME-AND-LIFT.md'
    }
    'dos-protected-mode' = [pscustomobject]@{
        Label = '32-bit DOS behind a DOS extender such as DOS/4GW or another DPMI host'
        Guide = 'DOS-PROTECTED-MODE-RUNTIME-AND-LIFT.md'
    }
    'win16' = [pscustomobject]@{
        Label = '16-bit Windows (NE executables on Windows 3.x and 9x)'
        Guide = 'WIN16-RUNTIME-AND-LIFT.md'
    }
    'win32' = [pscustomobject]@{
        Label = '32-bit Windows (PE executables)'
        Guide = 'WIN32-RUNTIME-AND-LIFT.md'
    }
}

$script:BlockBegin = '<!-- platform-guide:begin (tools/Configure-Project.ps1 writes this block from "platform") -->'
$script:BlockEnd = '<!-- platform-guide:end -->'

# Each file that links the platform's guide, with the path from it to docs/.
$script:Targets = @(
    [pscustomobject]@{ Path = 'AGENTS.md'; Prefix = 'docs/' }
    [pscustomobject]@{ Path = 'docs/RUNTIME.md'; Prefix = '' }
    [pscustomobject]@{ Path = '.claude/skills/runtime-access/SKILL.md'; Prefix = '../../../docs/' }
)

function Get-PlatformIds { return @($script:Platforms.Keys) }

function Get-PlatformGuide([string] $Platform) {
    if (-not $script:Platforms.Contains($Platform)) { return $null }
    return $script:Platforms[$Platform]
}

function Get-PlatformGuideTargets { return $script:Targets }

function Assert-Platform([string] $Platform, [string] $Source) {
    if ([string]::IsNullOrWhiteSpace($Platform)) { return }
    if (-not $script:Platforms.Contains($Platform)) {
        throw ("platform '$Platform' in $Source is not a known platform. Use one of: " +
            ((Get-PlatformIds) -join ', ') + '.')
    }
}

# The block's text for one file: every guide while no platform is set, else the platform's guide alone.
function Get-PlatformGuideBlock([string] $Platform, [string] $Prefix) {
    $lines = [Collections.Generic.List[string]]::new()
    $lines.Add($script:BlockBegin)
    if ([string]::IsNullOrWhiteSpace($Platform)) {
        $lines.Add('Each platform has its own guide to running the game, the lift harness and')
        $lines.Add('function inventories. `platform` in `tools/project-config.json` names the')
        $lines.Add("game's platform, and configuration leaves only that platform's guide here:")
        $lines.Add('')
        foreach ($entry in $script:Platforms.GetEnumerator()) {
            $lines.Add("- ``$($entry.Key)``, $($entry.Value.Label): [$($entry.Value.Guide)]($Prefix$($entry.Value.Guide))")
        }
    }
    else {
        $guide = Get-PlatformGuide $Platform
        if (-not $guide) { throw "Unknown platform '$Platform'." }
        $lines.Add("The game's platform is $($guide.Label), ``$Platform`` in")
        $lines.Add('`tools/project-config.json`. Its guide to running the game, the lift harness')
        $lines.Add("and function inventories is [$($guide.Guide)]($Prefix$($guide.Guide)). The guides")
        $lines.Add('for other platforms do not apply to this game.')
    }
    $lines.Add($script:BlockEnd)
    return ($lines -join "`n")
}

# Returns the block's current text in a file's content, or $null when the markers are missing.
function Get-PlatformGuideBlockText([string] $Content) {
    $begin = $Content.IndexOf($script:BlockBegin, [StringComparison]::Ordinal)
    if ($begin -lt 0) { return $null }
    $end = $Content.IndexOf($script:BlockEnd, $begin, [StringComparison]::Ordinal)
    if ($end -lt 0) { return $null }
    return $Content.Substring($begin, $end + $script:BlockEnd.Length - $begin).Replace("`r`n", "`n")
}

# Returns the content with its block replaced, or $null when the markers are missing.
function Set-PlatformGuideBlockText([string] $Content, [string] $Block) {
    $current = Get-PlatformGuideBlockText $Content
    if ($null -eq $current) { return $null }
    $begin = $Content.IndexOf($script:BlockBegin, [StringComparison]::Ordinal)
    $end = $Content.IndexOf($script:BlockEnd, $begin, [StringComparison]::Ordinal) + $script:BlockEnd.Length
    $newline = if ($Content.Contains("`r`n")) { "`r`n" } else { "`n" }
    return $Content.Substring(0, $begin) + $Block.Replace("`n", $newline) + $Content.Substring($end)
}

# Lists every file whose block is missing or does not match the platform (empty for the template's listing).
function Test-PlatformGuideBlocks([string] $Root, [string] $Platform) {
    $findings = [Collections.Generic.List[string]]::new()
    foreach ($target in $script:Targets) {
        $path = Join-Path $Root $target.Path
        if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
            $findings.Add("platform guide block: $($target.Path) is missing")
            continue
        }
        $current = Get-PlatformGuideBlockText ([IO.File]::ReadAllText($path))
        if ($null -eq $current) {
            $findings.Add("platform guide block: $($target.Path) has no platform-guide markers")
        }
        elseif ($current -cne (Get-PlatformGuideBlock $Platform $target.Prefix)) {
            $state = if ([string]::IsNullOrWhiteSpace($Platform)) { 'the unconfigured listing' } else { "platform '$Platform'" }
            $findings.Add("platform guide block: $($target.Path) does not match $state; re-run ./tools/Configure-Project.ps1 -Force")
        }
    }
    return $findings
}

Export-ModuleMember -Function Get-PlatformIds, Get-PlatformGuide, Get-PlatformGuideTargets, Assert-Platform,
    Get-PlatformGuideBlock, Get-PlatformGuideBlockText, Set-PlatformGuideBlockText, Test-PlatformGuideBlocks
