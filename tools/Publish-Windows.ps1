[CmdletBinding()]
param(
    [string] $OutputDirectory,
    [switch] $SkipArchive
)

$ErrorActionPreference = 'Stop'
$repositoryRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$artifactsRoot = [IO.Path]::GetFullPath((Join-Path $repositoryRoot 'artifacts'))
if (-not $OutputDirectory) {
    $OutputDirectory = Join-Path $artifactsRoot '{{PACKAGE_ID}}-win-x64'
}
$packageRoot = [IO.Path]::GetFullPath($OutputDirectory)
$artifactsPrefix = $artifactsRoot.TrimEnd([IO.Path]::DirectorySeparatorChar) +
    [IO.Path]::DirectorySeparatorChar
if (-not $packageRoot.StartsWith($artifactsPrefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Package output must remain below '$artifactsRoot'."
}

& (Join-Path $PSScriptRoot 'Verify-Repository.ps1') -RepositoryRoot $repositoryRoot
if ($LASTEXITCODE -ne 0) { throw 'Repository policy verification failed.' }

if (Test-Path -LiteralPath $packageRoot) {
    $resolvedPackage = (Resolve-Path -LiteralPath $packageRoot).Path
    if (-not $resolvedPackage.StartsWith($artifactsPrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to remove package path outside '$artifactsRoot'."
    }
    Remove-Item -LiteralPath $resolvedPackage -Recurse -Force
}

$gameOutput = Join-Path $packageRoot 'Game'
$toolOutput = Join-Path $packageRoot 'Tools'
$buildRoot = Join-Path $packageRoot '.build'
New-Item -ItemType Directory -Path $gameOutput, $toolOutput -Force | Out-Null

$common = @(
    '--configuration', 'Release',
    '--runtime', 'win-x64',
    '--self-contained', 'true',
    '-p:DebugType=None',
    '-p:DebugSymbols=false',
    '-p:UseSharedCompilation=false',
    '-m:1',
    '--artifacts-path', $buildRoot,
    '--verbosity', 'minimal'
)
& dotnet publish (Join-Path $repositoryRoot 'src/Restoration.Game/Restoration.Game.csproj') @common --output $gameOutput
if ($LASTEXITCODE -ne 0) { throw 'Game publish failed.' }
& dotnet publish (Join-Path $repositoryRoot 'src/Restoration.Extractor/Restoration.Extractor.csproj') @common '-p:PublishSingleFile=true' --output $toolOutput
if ($LASTEXITCODE -ne 0) { throw 'Asset Extractor publish failed.' }
Remove-Item -LiteralPath $buildRoot -Recurse -Force

Copy-Item -LiteralPath (Join-Path $repositoryRoot 'README.md') -Destination $packageRoot
Copy-Item -LiteralPath (Join-Path $repositoryRoot 'LICENSE') -Destination $packageRoot
Copy-Item -LiteralPath (Join-Path $repositoryRoot 'NOTICE') -Destination $packageRoot
Copy-Item -LiteralPath (Join-Path $repositoryRoot 'packaging/windows/Extract Original Resources.bat') -Destination $packageRoot

if (Test-Path -LiteralPath (Join-Path $packageRoot 'UserContent')) {
    throw 'The portable package contains imported original content.'
}
# A software rasterizer belongs to CI and nowhere else. If one ever reached a package, every player
# who installed it would be rendering through the CPU and would read the game as broken, so the
# package is checked for one rather than trusted not to have picked one up.
$softwareDrivers = @('opengl32.dll', 'libgallium_wgl.dll', 'libglapi.dll', 'osmesa.dll')
$leaked = @(Get-ChildItem -LiteralPath $packageRoot -Recurse -File |
    Where-Object { $softwareDrivers -contains $_.Name })
if ($leaked.Count) {
    throw ("The package contains an OpenGL driver, which would override the player's own: " +
        (($leaked | ForEach-Object { $_.FullName }) -join ', '))
}

# PowerShell does not wait for a GUI-subsystem process launched with the call operator, so the
# checks below ran as `&` were reporting a stale $LASTEXITCODE and passing no matter what the game
# did. Start-Process with an explicit, bounded wait is what actually verifies the packaged build.
function Invoke-PackagedGame([string] $executable, [string[]] $gameArguments, [string] $failure) {
    $stdout = [IO.Path]::GetTempFileName()
    $stderr = [IO.Path]::GetTempFileName()
    try {
        $process = Start-Process -FilePath $executable -ArgumentList $gameArguments -PassThru `
            -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr
        $exited = $process.WaitForExit(120000)
        if (-not $exited) {
            $process.Kill($true)
            throw "$failure The packaged game did not exit within 120 seconds."
        }
        # Always surface stderr: it is empty on an ordinary run and carries the software-renderer
        # banner otherwise, which is the only record of which renderer a passing run exercised.
        if ((Test-Path -LiteralPath $stderr) -and (Get-Item -LiteralPath $stderr).Length -gt 0) {
            Get-Content -LiteralPath $stderr | Write-Host
        }
        if ($process.ExitCode -ne 0) {
            if ((Test-Path -LiteralPath $stdout) -and (Get-Item -LiteralPath $stdout).Length -gt 0) {
                Get-Content -LiteralPath $stdout | Write-Host
            }
            throw "$failure It exited with $($process.ExitCode)."
        }
    }
    finally {
        Remove-Item -LiteralPath $stdout, $stderr -Force -ErrorAction SilentlyContinue
    }
}

$gameExecutable = Join-Path $gameOutput 'Restoration.Game.exe'
Invoke-PackagedGame $gameExecutable @('--smoke-test') 'Packaged game smoke check failed.'

# A machine with a real OpenGL driver needs nothing extra; a runner without one supplies a software
# driver through the environment variable, which is the only thing that unlocks --software-renderer.
$platformArguments = @('--platform-smoke-test')
if ($env:PLATFORM_SMOKE_TEST_GL_DRIVER) { $platformArguments += '--software-renderer' }
Invoke-PackagedGame $gameExecutable $platformArguments `
    'Packaged game could not initialize its native platform libraries.'
foreach ($nativeLibrary in @('SDL2.dll', 'openal.dll')) {
    if (-not (Test-Path -LiteralPath (Join-Path $gameOutput $nativeLibrary) -PathType Leaf)) {
        throw "Packaged game is missing native library '$nativeLibrary'."
    }
}
if (-not (Test-Path -LiteralPath (Join-Path $toolOutput 'Restoration.Extractor.exe') -PathType Leaf)) {
    throw 'Packaged Asset Extractor is missing.'
}

if (-not $SkipArchive) {
    $archivePath = "$packageRoot.zip"
    if (Test-Path -LiteralPath $archivePath) {
        Remove-Item -LiteralPath $archivePath -Force
    }
    Compress-Archive -LiteralPath $packageRoot -DestinationPath $archivePath -CompressionLevel Optimal
    Write-Host "Created $archivePath"
}
Write-Host "Self-contained Windows package verified at $packageRoot"
exit 0
