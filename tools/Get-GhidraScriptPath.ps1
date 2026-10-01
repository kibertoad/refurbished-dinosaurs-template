[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$shared = & node (Join-Path $PSScriptRoot 'tool-dependencies.mjs') ghidra
if ($LASTEXITCODE -ne 0) { throw 'Packaged Ghidra scripts are unavailable; restore tooling dependencies.' }
# Ghidra uses semicolons between script directories on every platform.
"$shared;$(Join-Path $PSScriptRoot 'ghidra')"
