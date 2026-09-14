# Validation

Accuracy is established separately at four layers, and a pass at one layer does
not imply a pass at the next:

1. **Source identity** - original input files match known cryptographic hashes.
2. **Decode fidelity** - bytes are consumed at exact offsets into exact values.
3. **Behavioral parity** - controlled inputs produce matching state transitions.
4. **Presentation parity** - the same state produces equivalent screens/media.

## Local automated checks

`tools/Invoke-Validation.ps1` is the canonical local entry point. It serializes
runs for the checkout (one lock per checkout path), caps MSBuild at two workers
by default, and stops only a `<Project>.Game` process whose executable lives
inside this checkout; installed copies and unrelated `dotnet` processes are left
alone. It runs `Verify-Repository.ps1` and `Verify-Configuration.ps1`, then
restores, builds in Release, and runs the test suite with a 30-minute safety
timeout.

The default gate excludes tests tagged `Category=LongRunning`. Run every test,
including the long tier:

```powershell
./tools/Invoke-Validation.ps1 -IncludeLongRunningTests
```

Run only the long category with live output:

```powershell
./tools/Invoke-Validation.ps1 -LongRunningTestsOnly -TraceTestOutput
```

`-TestFilter` selects any narrower slice; `-TraceTestOutput` exposes captured
test output and completed-case names. `-TestFilter`, `-IncludeLongRunningTests`,
and `-LongRunningTestsOnly` are mutually exclusive. `-MinimumExpectedTests`
fails the gate when fewer tests than expected are discovered, guarding against
accidental exclusion or a broken filter. `-ShutdownBuildServersAfterRun` stops
the user's .NET build servers after a run; it is off by default because it also
cools the build of any open IDE. Avoid running raw `dotnet build` and
`dotnet test` concurrently in the checkout; use the serialized entry point.

## Reference capture

`tools/Capture-OriginalWindow.ps1` captures the original game's visible client
area in burst frames with SHA-256 metadata into a `checkpoint.json` plus an
`index.jsonl`, for evidence records rather than committed assets. It supports
interactive, one-shot, and hotkey (Ctrl+Shift+F12) modes, and `-ListWindows` to
discover the correct process and title. The helper deliberately captures the
visible desktop client area because a legacy DirectDraw window may not produce
reliable window-only captures on modern systems. Keep captured pixels under
ignored `reference/original`; never commit them.

## Static binary research

`tools/ghidra/` holds bounded, clean-room Ghidra scripts for navigating a
legally owned original executable. `docs/GHIDRA.md` documents the headless
workflow and each script's arguments and output caps. Findings feed the format
and rules documents; decompiler output is never committed.

## Repository policy

`tools/Verify-Repository.ps1` applies `tools/repository-policy.json` to tracked
files. It rejects local/imported roots, original-media extensions outside
explicit clean-room or synthetic fixture roots, tracked paths missing from the
worktree, and unreviewed files larger than 1 MiB. The publisher scripts invoke
the same check before deleting or creating package output.

## Installer acceptance

Pull requests run only the Windows installer and the zizmor security audit. The
full multi-platform matrix (build, test, and smoke-test on Windows, Linux, and
both macOS architectures) runs on manual dispatch. Installer jobs verify the
installed filesystem layout; Windows additionally validates the generated Start
menu shortcut, the presence of the adjacent SDL2 and OpenAL libraries, and silent
uninstall cleanup. CI never requires proprietary content.

## Failure triage

Classify mismatches as source/version, decode/offset, state initialization,
command legality, resolution/order, RNG, presentation-only, manual-versus-binary,
or intentional modernization leaking into compatibility mode. Reduce a failure
to the earliest mismatching phase or fixture, and preserve the smallest replay
and all source identities needed to reproduce it.
