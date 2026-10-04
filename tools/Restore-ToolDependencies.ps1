[CmdletBinding()]
param([switch] $NoRestore)
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false
$root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
if (-not $NoRestore) {
    Push-Location $root
    try {
        & npm ci --ignore-scripts
        if ($LASTEXITCODE -ne 0) { throw 'Locked npm tooling restore failed.' }
        $python = $env:EVIDENCE_PYTHON
        if (-not $python) {
            $environment = Join-Path $root 'artifacts/evidence-python'
            $relativePython = if ($IsWindows -or $env:OS -eq 'Windows_NT') { 'Scripts/python.exe' } else { 'bin/python' }
            $python = Join-Path $environment $relativePython
            if (-not (Test-Path -LiteralPath $python -PathType Leaf)) {
                # Many Linux and macOS installs provide only python3.
                $bootstrap = if (Get-Command python -CommandType Application -ErrorAction SilentlyContinue) { 'python' }
                    elseif (Get-Command python3 -CommandType Application -ErrorAction SilentlyContinue) { 'python3' }
                    else { throw 'Python 3.10+ is required (python or python3 on PATH), or set EVIDENCE_PYTHON.' }
                & $bootstrap -m venv $environment
                if ($LASTEXITCODE -ne 0) { throw 'Project-local Python environment creation failed.' }
            }
        }
        & $python -m pip install --require-hashes --only-binary=:all: -r (Join-Path $PSScriptRoot 'evidence/requirements.txt')
        if ($LASTEXITCODE -ne 0) { throw 'Hash-locked Python tooling restore failed.' }
    } finally { Pop-Location }
}
& node (Join-Path $PSScriptRoot 'tool-dependencies.mjs') verify
if ($LASTEXITCODE -ne 0) { throw 'Tooling dependencies are missing or mismatched; NoRestore never installs or falls back.' }
