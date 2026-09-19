[CmdletBinding()]
param(
    [ValidateRange(1, 16)]
    [int] $MaxCpuCount = 2,
    [switch] $ShutdownBuildServersAfterRun,
    [string] $TestFilter,
    [switch] $IncludeLongRunningTests,
    [switch] $LongRunningTestsOnly,
    [int] $MinimumExpectedTests,
    [switch] $TraceTestOutput
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

    & dotnet @Arguments
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

    Stop-CheckoutGame

    & (Join-Path $PSScriptRoot 'Verify-Repository.ps1') -RepositoryRoot $repositoryRoot
    if ($LASTEXITCODE -ne 0) { throw 'Repository policy verification failed.' }

    & (Join-Path $PSScriptRoot 'Verify-Configuration.ps1') -RepositoryRoot $repositoryRoot
    if ($LASTEXITCODE -ne 0) { throw 'Project configuration is incomplete.' }

    & (Join-Path $PSScriptRoot 'Test-TemplateInfrastructure.ps1') -RepositoryRoot $repositoryRoot
    if ($LASTEXITCODE -ne 0) { throw 'Template infrastructure verification failed.' }

    $msbuildArguments = @(
        "-maxCpuCount:$MaxCpuCount",
        '-nodeReuse:true',
        '--verbosity', 'minimal'
    )
    Invoke-CheckedDotnet -Arguments (@(
        'restore', (Join-Path $repositoryRoot 'Restoration.slnx')
    ) + $msbuildArguments)
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
