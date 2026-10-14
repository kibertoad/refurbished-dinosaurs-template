# Headless analysis output retention

Headless transcripts, instruction/decompiler reports and intermediate exports
are temporary working material. After their useful evidence has been recorded
and committed, remove regenerable output. Repeated exports must not fill the
workstation. An ignored path alone does not make its contents disposable.

## Give each run a boundary

Put one invocation's generated files in a new, dedicated ignored directory,
for example `analysis/original/headless-runs/<run-id>/`. Keep the canonical
analysis project, input executable, media and durable captures outside it.
Give large runs an explicit output/size limit and inspect free space first.
Avoid duplicate redirected transcripts and unrestricted whole-program dumps.

Retain small run metadata with:

- script and exact arguments, tool versions and outcome;
- build ID, input file length/fingerprint and canonical project identity;
- transient function/body repairs needed to reproduce the query;
- requested targets, generated paths and start/finish times;
- owning process identity and an active marker until the invocation ends.

These are regeneration metadata, never original code or content for Git.
Version the scripts and configurations; keep original bytes/reports ignored.
Record script-level failures even when headless exits zero.

## Consume, record, commit, clean

1. Review all requested targets and success markers. Record incomplete or failed
   attempts and their limits rather than treating partial output as complete.
2. Write independently worded findings with addresses, build, method and
   confidence in `spec/`; update the queue/parity/coverage only as warranted.
   Preserve unresolved output still needed for the next reading.
3. Record the reproduction command, versions, repairs and validation limits in
   the finding or detailed validation. A local report filename alone is not a
   reproduction method. Preserve hashes/provenance even when the report expires.
4. Run the required checks and commit the durable records. After that, review
   the run directory's file count/bytes and remove that specific consumed run.
   Record a small cleanup receipt with its regeneration metadata, evidence commit,
   record IDs/paths and bytes removed when useful.

Apply this after each consumed batch. An old report mentioned in historical
validation need not remain indefinitely if its conclusion and regeneration
procedure are durable. Do not promote a claim or parity status from cleanup.

## Windows deletion boundary

Use one PowerShell invocation from validation through deletion. Resolve an
absolute target; require an individual child of the dedicated output root;
refuse the root itself, active runs, unknown ownership and links/junctions.
Do not enumerate paths in PowerShell and pass them to `cmd`, batch builtins or
another shell. Use `Remove-Item -LiteralPath` only after those checks.

This example previews by default. Set the final removal switch only after the
consumption/commit steps above. A project helper should also validate its run
manifest and record the evidence commit/paths in a cleanup receipt.

```powershell
$repositoryRoot = (Resolve-Path -LiteralPath '.').Path
$outputRoot = [IO.Path]::GetFullPath((Join-Path $repositoryRoot 'analysis/original/headless-runs'))
$runDirectory = [IO.Path]::GetFullPath((Resolve-Path -LiteralPath '<one-reviewed-run>').Path)
if (-not $runDirectory.StartsWith($outputRoot + [IO.Path]::DirectorySeparatorChar,
        [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Select one child run directory, never the mixed analysis root.'
}
for ($ancestor = $runDirectory; $ancestor; $ancestor = Split-Path -Parent $ancestor) {
    if ((Get-Item -LiteralPath $ancestor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) {
        throw 'Refusing linked output storage.'
    }
}
if (Test-Path -LiteralPath (Join-Path $runDirectory '.active')) {
    throw 'Finish the owning invocation first.'
}
$items = @(Get-ChildItem -LiteralPath $runDirectory -Force -Recurse)
if (@($items | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }).Count) {
    throw 'Refusing a run containing a link or junction.'
}
$files = @($items | Where-Object { -not $_.PSIsContainer })
[pscustomobject]@{ Directory = $runDirectory; Files = $files.Count;
    Bytes = ($files | Measure-Object -Property Length -Sum).Sum }
$removeReviewedOutput = $false
if ($removeReviewedOutput) {
    Remove-Item -LiteralPath $runDirectory -Recurse -Force
}
```

Test a project cleanup helper on synthetic data: preview leaves files intact;
active/protected/root/junction targets are refused; a reviewed child is removed
without changing its parent or protected inputs. Do not discover safety by
testing deletion against real evidence.

## Protected material

Preserve original executables, patches, media/assets, the validated canonical
project, committed function inventories and active/unreviewed evidence. Preserve
durable original captures/save fixtures referenced by experiments, including
`GAME_DIR/captures/`, and the currently validated Windows setup/checkpoints.
Keep a checkpoint's state and disk sidecars together. Disposable analysis
projects need separate explicit ownership/path checks after their process ends.

Older loose reports need exact-file review: establish committed evidence and
regeneration, then delete only those named files. Never clear mixed
`analysis/original/`, `GAME_DIR`, `.artifacts/` or `%TEMP%` roots recursively, or
delete by extension/age alone. For probes, remove superseded run disks/states/
captures only after their results and replay method are recorded; retain current
checkpoints and unresolved failures/divergences. Reuse read-only media instead
of copying a CD for every probe.
