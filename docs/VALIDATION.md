# Validation

`tools/Test-TemplateInfrastructure.ps1` is part of the canonical validation
gate. It checks that signing helpers and workflow wiring, the smart root
launcher, package lock, latest-version bootstrap fields, and local-only guards
on broad Ghidra exporters remain present after template configuration.

Accuracy is established separately at four layers, and a pass at one layer does
not imply a pass at the next:

1. **Source identity** - original input files match the hashes in their build
   entries.
2. **Decode fidelity** - the decoders read every byte of every file a format
   entry lists into the value its Kaitai definition gives.
3. **Behavioral parity** - the same starting state and inputs produce the state
   changes and events an experiment fixture recorded in the original.
4. **Presentation parity** - the same state produces the screen a capture of the
   original shows, pixel for pixel, and starts the same sounds on the same tick.

The parity matrix records which rows have tests at these levels. A test counts there
only if it compares the rebuild with evidence from the original. Decoder tests on
synthetic files, and tests that compare the rebuild with an earlier version of
itself, are still required but are left out of that column. Manual play never
counts.

## Tests against the original

Tests that need the original's files find them under the directory named by the
`GAME_DIR` environment variable, which holds one directory per build, named by
its build ID, with the files laid out as the build manifest's paths give them:
`GAME_DIR/BLD-GOG-EN-1.1/GAME.EXE`, with a file from a disc under a directory
named after the disc (`CD`, `CD2`). `GAME_DIR/captures/` holds the dumps,
captures, recordings, and saves that cannot be committed, each named by its
hash. That includes the base save an experiment's patch applies to, and the
save after patching. Every hash in the spec is the 128-bit xxHash3 the standard
specifies (`xxhsum -H2`); `SpecHash` in `Restoration.Inspect` computes it, and
`Restoration.Inspect --source <dir>` prints it for every file of a source.
`OriginalGameFiles` in the test project resolves both kinds of path, checks
each file's hash before a test reads it, and skips the test when the file is
absent. A test file that reads the original through `OriginalGameFiles` or
`GAME_DIR` carries the comment `// needs: GAME_DIR`, and only such a file does.
`tools/Test-TemplateInfrastructure.ps1` fails a test file that uses
`OriginalGameFiles` without it, and the documentation check fails a listed test
file that mentions `GAME_DIR` without it. Every other listed test, such as one
that replays the fixture of an emulated call, needs nothing from the original
and runs in CI like any other test. Listed tests run with every deviation that has a setting switched off.
A `mandatory` deviation cannot be switched off, so a listed test that reaches
the behavior it changes cites the deviation's ID and leaves that case out or
compares with the original's result as the deviation changes it.

A test that compares a distribution with the original runs the rebuild from the
generator states the experiment fixture recorded, or from its `seeds` where the
original's state could not be read. It then gets the same result on every run,
so a correct rebuild never fails it by chance.

CI never has a copy of the original, which cannot be uploaded anywhere a
runner could fetch it, so the marked tests skip there, and a skipped test does
not fail the build. They run on a maintainer's machine with `GAME_DIR` set to a
copy the maintainer owns. After a run of `./tools/Invoke-Validation.ps1` in
which every test in every marked test file of a `validated` row passed and none
was skipped, record the run with the documentation check from the pinned
toolkit commit, naming the builds the run used, and commit the
`VALIDATION.md` it writes:

```sh
node artifacts/check-documentation.mjs --record-validation BLD-GOG-EN-1.1
git add VALIDATION.md
```

`VALIDATION.md` holds the commit, the date, the builds, and the hash of each
marked test file of a `validated` row. The check, in CI as well, fails a
`validated` row whose marked test file is missing from it or has changed since
it was recorded, so a change to such a test needs a new local run before it
merges. A change to code that a marked test exercises needs one too, which the
check cannot see. The copy never goes in the repository or a published build
artifact.

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
reliable window-only captures on modern systems. It writes to
`reference/original/captures` unless `-OutputRoot` says otherwise; keep captured
pixels under ignored `reference/original`, which the repository policy also
denies, and never commit them.

A capture that a test compares with the rebuild pixel for pixel has to be taken
at the size of the screen entry's `resolution`, with no scaling, filtering, or
aspect correction, and in the colors the game set in its palette. A desktop
capture from this helper meets that only when the game runs unscaled in its
window, for example with DxWnd's scaling and filtering off. DOSBox's own
screenshot saves the emulated video memory and meets it directly. The finding
or experiment that cites a capture says which tool took it and with what
settings, and gives its xxh3. A test reads a copy from
`GAME_DIR/captures/<xxh3>`.

## Static binary research

`tools/ghidra/` holds bounded, clean-room Ghidra scripts for navigating a
legally owned original executable. `docs/GHIDRA.md` documents the headless
workflow and each script's arguments and output caps. Results are written up as
finding entries in `spec/findings/`; decompiler output is never committed.

## Spec checks

The `Documentation standard` job in `.github/workflows/ci.yml` runs the
`check-documentation` action from
[refurbished-dinosaurs-toolkit](https://github.com/kibertoad/refurbished-dinosaurs-toolkit),
pinned to a full commit SHA, on every pull request. It checks `spec/`, `parity/`
and `deviations/` against the standard's list of
[checks](https://dinorefurb.com/documentation-standard/#checks), compiles each
`.ksy` file with the Kaitai Struct compiler, checks that every spec and
deviation ID cited in `src/`, `tests/` and `tools/` exists and is not
superseded, fails when `spec/index/` or `PARITY.md` is stale, and fails a `validated`
row whose marked tests are not in `VALIDATION.md` as they are now (see
[Tests against the original](#tests-against-the-original)). It fetches
the full history so it can fail a pull request that deletes a spec ID, area or
deviation that exists on `main`. The toolkit's
[setup guide](https://github.com/kibertoad/refurbished-dinosaurs-toolkit/blob/main/docs/documentation-standard-check.md)
lists its inputs.

The check writes `spec/index/` and `PARITY.md`; nobody edits them by hand. After
changing the spec, `parity/` or `deviations/`, run the script from the same
toolkit commit the workflow pins, with Node.js 20 or newer, and commit what it
writes:

```sh
curl -fsSL --create-dirs -o artifacts/check-documentation.mjs https://raw.githubusercontent.com/kibertoad/refurbished-dinosaurs-toolkit/<sha>/tools/check-documentation.mjs
node artifacts/check-documentation.mjs
git add spec/index PARITY.md
```

`--check` reports problems without writing anything. `tools/Test-TemplateInfrastructure.ps1`
fails if the workflow stops running the check or pins it to anything but a full
commit SHA. The script does not check some items on the standard's list, such as
the fixture schema and the hashes of saves and recordings; its guide lists them,
and reviewers check those by hand. A save-patch write is given as a byte offset
and value in the experiment's Setup section.

## Repository policy

`tools/Verify-Repository.ps1` applies `tools/repository-policy.json` to tracked
files. It rejects local/imported roots, original-media extensions outside
explicit clean-room or synthetic fixture roots, and unreviewed files larger
than 1 MiB. The publisher scripts invoke the same check before deleting or
creating package output.

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
