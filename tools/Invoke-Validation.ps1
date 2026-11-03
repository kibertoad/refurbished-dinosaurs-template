[CmdletBinding()]
param(
    [ValidateRange(1, 16)]
    [int] $MaxCpuCount = 2,
    [switch] $ShutdownBuildServersAfterRun,
    [string] $TestFilter,
    [switch] $IncludeLongRunningTests,
    [switch] $LongRunningTestsOnly,
    [int] $MinimumExpectedTests,
    [switch] $TraceTestOutput,
    [switch] $NoRestore,
    [string] $ChangedSince,
    [switch] $Integration,
    [switch] $Research
)

$ErrorActionPreference = 'Stop'
$repositoryRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$temporaryRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$sha256 = [Security.Cryptography.SHA256]::Create()
try {
    if (($TestFilter -and ($IncludeLongRunningTests -or $LongRunningTestsOnly)) -or
        ($IncludeLongRunningTests -and $LongRunningTestsOnly)) {
        throw 'Choose only one of -TestFilter, -IncludeLongRunningTests, or -LongRunningTestsOnly.'
    }

    $repositoryHash = $sha256.ComputeHash(
        [Text.Encoding]::UTF8.GetBytes($repositoryRoot.ToUpperInvariant()))
}
finally {
    $sha256.Dispose()
}
$repositoryIdentity = [BitConverter]::ToString($repositoryHash).Replace('-', '')
$lockPath = Join-Path $temporaryRoot "restoration-validation-$($repositoryIdentity.Substring(0, 16)).lock"
$lock = $null

function Invoke-CheckedDotnet {
    param([Parameter(Mandatory = $true)][string[]] $Arguments)

    & node (Join-Path $PSScriptRoot 'Project-Inputs.mjs') -- dotnet @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "dotnet $($Arguments[0]) failed with exit code $LASTEXITCODE."
    }
}

function Stop-CheckoutGame {
    $repositoryPrefix = $repositoryRoot.TrimEnd([IO.Path]::DirectorySeparatorChar) +
        [IO.Path]::DirectorySeparatorChar
    foreach ($process in @(Get-Process -Name 'Restoration.Game' -ErrorAction SilentlyContinue)) {
        try {
            $processPath = [IO.Path]::GetFullPath($process.Path)
        }
        catch {
            Write-Warning "Could not inspect Restoration.Game process $($process.Id); leaving it running."
            continue
        }

        if (-not $processPath.StartsWith($repositoryPrefix, [StringComparison]::OrdinalIgnoreCase)) {
            continue
        }

        Write-Host "Stopping checkout game process $($process.Id) before validation."
        Stop-Process -Id $process.Id -Force
        Wait-Process -Id $process.Id -ErrorAction SilentlyContinue
    }
}

try {
    try {
        $lock = [IO.File]::Open(
            $lockPath,
            [IO.FileMode]::OpenOrCreate,
            [IO.FileAccess]::ReadWrite,
            [IO.FileShare]::None)
    }
    catch [IO.IOException] {
        throw "Another validation run is already active for this checkout ($lockPath)."
    }

    $suiteBase = if ($Integration -or $env:CI -or -not $ChangedSince) { '--integration' } else { $ChangedSince }
    if ($Research -and (-not $ChangedSince -or $Integration -or $env:CI -or $TestFilter -or
        $IncludeLongRunningTests -or $LongRunningTestsOnly -or $MinimumExpectedTests)) {
        throw 'Research needs -ChangedSince and cannot request rebuild tests or integration; run integration separately.'
    }
    [string[]] $suiteArguments = @($suiteBase)
    if ($Research) { $suiteArguments = @('--research') + $suiteArguments }
    $selectionJson = & node (Join-Path $PSScriptRoot 'Select-ValidationSuites.mjs') @suiteArguments
    if ($LASTEXITCODE -ne 0) { throw 'Could not select validation suites.' }
    try { $selection = $selectionJson | ConvertFrom-Json -ErrorAction Stop }
    catch { throw 'Could not parse validation suite plan.' }
    if ($selection.mode -notin @('selected', 'integration') -or $selection.dotnet -isnot [bool]) {
        throw 'Invalid validation suite plan.'
    }
    if ($Research -and ($selection.dotnet -or $selection.mode -eq 'integration')) {
        throw 'Research selection returned rebuild tests; run integration separately.'
    }
    $explicitTests = $TestFilter -or $IncludeLongRunningTests -or $LongRunningTestsOnly -or $MinimumExpectedTests
    $runDotnet = $selection.dotnet -or $explicitTests
    $fullAcceptance = $selection.mode -eq 'integration' -and ($ChangedSince -or $Integration -or $env:CI)
    if ($fullAcceptance -and $explicitTests) {
        Write-Host 'Integration is required; manual filters cannot narrow acceptance.'
        $TestFilter = $null
        $LongRunningTestsOnly = $false
    }
    if ($fullAcceptance) { $IncludeLongRunningTests = $true }
    elseif ($explicitTests) { Write-Host 'Manual .NET filters are partial diagnostic acceptance.' }
    if ($runDotnet) { Stop-CheckoutGame }

    & (Join-Path $PSScriptRoot 'Verify-Repository.ps1') -RepositoryRoot $repositoryRoot
    if ($LASTEXITCODE -ne 0) { throw 'Repository policy verification failed.' }

    & (Join-Path $PSScriptRoot 'Verify-Configuration.ps1') -RepositoryRoot $repositoryRoot
    if ($LASTEXITCODE -ne 0) { throw 'Project configuration is incomplete.' }

    # Repository policy includes the line limits on spec, queue and handover files, which documentation changes can break.
    & (Join-Path $PSScriptRoot 'Test-TemplateInfrastructure.ps1') -RepositoryRoot $repositoryRoot
    if ($LASTEXITCODE -ne 0) { throw 'Template infrastructure verification failed.' }

    # The node checks are listed once, in tools/Invoke-NodeChecks.mjs, which .githooks/pre-commit also runs.
    & node (Join-Path $repositoryRoot 'tools/Invoke-NodeChecks.mjs')
    if ($LASTEXITCODE -ne 0) { throw 'Node documentation or queue checks failed.' }

    # Domain execution retains fresh checks above; integration discovers every test.
    # Some tests run PowerShell scripts; give them the PowerShell running now, which need not be on PATH.
    $previousPwsh = $env:PWSH
    if (-not $env:PWSH) { $env:PWSH = [Diagnostics.Process]::GetCurrentProcess().MainModule.FileName }
    try {
        & node (Join-Path $PSScriptRoot 'Run-ValidationSuites.mjs') @suiteArguments
    }
    finally {
        $env:PWSH = $previousPwsh
    }
    if ($LASTEXITCODE -ne 0) { throw 'Synthetic tooling tests failed. Run pnpm install and install requirements-evidence.txt.' }

    if (-not $runDotnet) {
        Write-Host 'Selected validation passed; no runtime inputs changed.'
        return
    }

    $msbuildArguments = @(
        "-maxCpuCount:$MaxCpuCount",
        '-nodeReuse:true',
        '--verbosity', 'minimal'
    )
    if ($NoRestore) {
        Write-Host 'NoRestore: using existing restore state for this checkout; no restore fallback.'
    }
    else {
        Invoke-CheckedDotnet -Arguments (@(
            'restore', (Join-Path $repositoryRoot 'Restoration.slnx')
        ) + $msbuildArguments)
    }
    Invoke-CheckedDotnet -Arguments (@(
            'build', (Join-Path $repositoryRoot 'Restoration.slnx'),
            '--configuration', 'Release',
            '--no-restore'
    ) + $msbuildArguments)
    $testArguments = @(
        'test',
        '--project', (Join-Path $repositoryRoot 'tests/Restoration.Tests/Restoration.Tests.csproj'),
        '--configuration', 'Release',
        '--no-build',
        '--no-restore',
        '--no-progress',
        '--timeout', '30m',
        '--verbosity', 'minimal'
    )
    if ($TestFilter) {
        $testArguments += @('--filter', $TestFilter)
    }
    elseif ($LongRunningTestsOnly) {
        $testArguments += @('--filter', 'Category=LongRunning')
    }
    elseif (-not $IncludeLongRunningTests) {
        $testArguments += @('--filter', 'Category!=LongRunning')
    }
    if ($MinimumExpectedTests -gt 0) {
        $testArguments += @('--minimum-expected-tests', $MinimumExpectedTests)
    }
    if ($TraceTestOutput) {
        $testArguments += @(
            '--output', 'Detailed',
            '--show-live-output', 'on',
            '--show-stdout', 'All'
        )
    }
    Invoke-CheckedDotnet -Arguments $testArguments
}
finally {
    if ($ShutdownBuildServersAfterRun) {
        Write-Host 'Stopping .NET build servers for the current user.'
        & dotnet build-server shutdown
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "dotnet build-server shutdown returned exit code $LASTEXITCODE."
        }
    }

    if ($lock) {
        $lock.Dispose()
    }
}
