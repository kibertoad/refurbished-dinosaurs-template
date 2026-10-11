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
synthetic files, the tests over synthetic state that an implementation batch
writes for each branch of an entry, tests that compare the rebuild with an
earlier version of itself, and the tests in a deviation's Tests item are still
required but are left out of that column; a row with only those has Tests
`None`. Manual play never counts.

## Tests against the original

Tests that need the original's files find them under the directory named by the
`GAME_DIR` environment variable, which holds one directory per build, named by
its build ID, with the files laid out as the build manifest's paths give them:
`GAME_DIR/BLD-GOG-EN-1.1/GAME.EXE`, with a file from a disc under a directory
named after the disc (`CD`, `CD2`). `GAME_DIR/captures/` holds the dumps,
captures, recordings, and saves that cannot be committed, each named by its
hash. That includes the base save an experiment's patch applies to, and the
save after patching. Every hash in the spec is the 128-bit xxHash3 the standard
specifies (`xxhsum -H2`); `FileFingerprint` in RefurbishedDinosaurs.Core computes it, and
`Restoration.Inspect --source <dir>` prints it for every file of a source.
`OriginalGameFiles` in the test project resolves both kinds of path, checks
each file's hash before a test reads it, and skips the test when the file is
absent. A test file that reads the original through `OriginalGameFiles` or
`GAME_DIR` carries the comment `// needs: GAME_DIR`, and only such a file does.
`tools/Test-TemplateInfrastructure.ps1` fails a test file that uses
`OriginalGameFiles` without it, and the documentation check fails a listed test
file that mentions `GAME_DIR` without it. Every other listed test file names
by ID an experiment that the row's entry lists in its `evidence`, or that a
bug whose `related` field names the entry lists, and replays that experiment's
fixture or compares with the distribution measured in it, such as a test that
replays the fixture of an emulated call. It needs nothing from the original
and runs in CI like any other test. The check fails a listed test file that
neither carries the comment nor names such an experiment. Listed tests run with every deviation that has a setting switched off.
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
was skipped, record the run with the pinned documentation check, naming the
builds the run used, and commit what it writes in `validation/`:

```sh
node tools/upstream.mjs docs --record-validation BLD-GOG-EN-1.1
git add validation/
```

Each run gets a file of its own, named after the day and the first 12 hex
digits of the commit it tested, such as `validation/2026-09-26-3f9c2d4e8a1b.md`.
It holds the commit, the date, the builds, and the hash of each marked test
file of a `validated` row, and nobody edits it afterwards. Recording a run also
deletes every run file none of whose rows matches a marked test file of a
`validated` row as it is now. A run file can come to match nothing without a
new run, such as after a merge of two branches that between them changed every
file it matched; delete it by hand. Two branches that record runs add two
files, so they do not conflict.

The check, in CI as well, fails a `validated` row whose marked test file no run
file records with the hash it has now, a run file that matches nothing or whose
name does not give its date and commit, any other file in `validation/`, and a
`VALIDATION.md` at the root, which older versions of the check wrote; move such
a record into a run file. A change to a marked test therefore needs a new local
run before it merges. A change to code that a marked test exercises needs one
too, which the check cannot see. The copy never goes in the repository or a
published build artifact.

## Local automated checks

`tools/Invoke-Validation.ps1` is the canonical local entry point. It serializes
runs for the checkout (one lock per checkout path), caps MSBuild at two workers
by default, and stops only a `<Project>.Game` process whose executable lives
inside this checkout; installed copies and unrelated `dotnet` processes are left
alone. It runs `Verify-Repository.ps1` and `Verify-Configuration.ps1`, then
restores (unless `-NoRestore` is given), builds in Release, and runs the test suite with a 30-minute safety
timeout.

Locally, run it only with `-TestFilter`, for the tests the change touches. The
full gate runs in CI on every pull request and is never run locally (`AGENTS.md`, Commands).

The default gate excludes tests tagged `Category=LongRunning`. Run every test,
including the long tier, only when the user asks for it:

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
`-NoRestore` skips only the restore step, for a rerun of a checkout already
restored by a normal run; see [Explicit rerun without restore](#explicit-rerun-without-restore).

## Reference capture

`tools/Capture-OriginalWindow.ps1` captures the selected original window's
client area in burst frames into a `checkpoint.json` plus an `index.jsonl`, for
evidence records rather than committed assets. Each frame is named by its `xxh3`,
the hash the spec cites it by, computed after the burst by `tools/evidence/xxh3.mjs`
(the executable reader's `sourceXxh3`), so the script needs Node.js and `pnpm install`
and checks for both before it captures anything. It supports
interactive, one-shot, and hotkey (Ctrl+Shift+F12) modes, and `-ListWindows` to
discover the correct process and title. The helper renders the window's client
through `PrintWindow` with full-content rendering, rather than copying its
rectangle from the desktop, so a hidden or covered window never produces pixels
from another application. Its `checkpoint.json` (schema version 3, which
replaced each frame's `sha256` with `xxh3`) records the
target process, window title, and client size, but not the desktop layout,
which does not affect the pixels. Each frame runs in an isolated worker with a
10-second deadline (adjustable with `-CaptureTimeoutSeconds`); a timeout kills
only that worker and rejects the checkpoint, leaving the listener available.
The worker measures and renders in per-monitor DPI-aware physical pixels, and
the caller restores its previous thread DPI context after measuring. Worker
startup adds to the time between burst frames; the interval is a minimum pause.
There is no desktop fallback. An unsupported window or
a uniform frame fails the whole checkpoint and leaves no frames behind. A
successful capture still needs inspection: a launcher or emulator shell frame
does not prove that the game reached a requested state. It writes to
`reference/original/captures` unless `-OutputRoot` says otherwise; keep captured
pixels under ignored `reference/original`, which the repository policy also
denies, and never commit them.

A capture that a test compares with the rebuild pixel for pixel has to be taken
at the size of the screen entry's `resolution`, with no scaling, filtering, or
aspect correction, and in the colors the game set in its palette. A capture
from this helper meets that only when the game runs unscaled in its
window, for example with DxWnd's scaling and filtering off. DOSBox's own
screenshot saves the emulated video memory and meets it directly. The finding
or experiment that cites a capture says which tool took it and with what
settings, and gives its xxh3. A test reads a copy from
`GAME_DIR/captures/<xxh3>`.

## Static binary research

`scientific-method-engine ghidra-scripts` prints the directory of the bounded,
clean-room Ghidra scripts the engine ships for navigating a legally owned
original executable; `tools/ghidra/` holds the few the engine does not ship.
`docs/GHIDRA.md` documents the headless
workflow and each script's arguments and output caps. Results are written up as
finding entries in `spec/findings/`; decompiler output is never committed.

## Spec checks

The `Documentation standard` job in `.github/workflows/ci.yml` runs the
`check-documentation` action from
[refurbished-dinosaurs-toolkit](https://github.com/kibertoad/refurbished-dinosaurs-toolkit),
pinned to a full commit SHA, on every pull request. It checks `spec/`, `parity/`
and `deviations/` against the standard's list of
[checks](upstream/documentation-standard.md#checks) (lines 1157-1214), compiles each
`.ksy` file with the Kaitai Struct compiler, checks that every spec and
deviation ID cited in `src/`, `tests/` and `tools/` exists and is not
superseded, fails a spec file that names a path under `src/` or `tests/` (the
action's `rebuild` input) or the file name of a source file there, fails a
pull request that edits, adds or removes a file in `spec/index/` or
`PARITY.md` (see below), and fails a `validated`
row whose marked tests no run file in `validation/` records as they are now (see
[Tests against the original](#tests-against-the-original)). It fetches
the full history so it can fail a pull request that deletes a spec ID, area or
deviation that exists where it forked from `main`, and one that adds an ID the
tip of `main` already holds with other content, so the branch renumbers before
it merges. A change that squashes superseded entries into their replacements,
as the standard's [IDENTIFIERS-7](upstream/documentation-standard.md#identifiers-7) (lines 148-154) allows before anyone
outside the repository relies on the IDs, lists them in the action's
`squashed` input (`FND-AI-008=FND-AI-064`, `+` between several replacements,
`,` between items); a local run passes the same list as
`node tools/upstream.mjs docs --squashed <list>`. The toolkit's
[setup guide](https://github.com/kibertoad/refurbished-dinosaurs-toolkit/blob/main/docs/documentation-standard-check.md)
lists its inputs.

The check also fails when a code comment gives an address that no entry the
comment cites records, in its locations or text or in the evidence of an entry
it cites, and when the code itself uses one, as a number or inside a string,
that neither the comment trailing its line nor the nearest comment above it
cites an entry for. It reads C#, TypeScript, JavaScript and PowerShell (`#` and
`<# … #>`) comments. A neutral name (`fn_…`, `g_…`) is always an address. A
plain `0x…` value is one only inside an image the job gives with the action's
`images` input, so colours, masks and offsets are left alone; the template
cannot know the original's image, so `ci.yml` only explains how to add it. Take
the base and size from the finding that records them. A range larger than
`max-range` (64 KiB by default), such as a whole section, records only its two
ends, nothing inside it. When a comment or a use in `src/` fails, the comment
cites the rule, format, screen or bug the code implements, which passes where
that entry or a finding or experiment in its `evidence` records the address;
it never cites a finding to pass the check, even where the message suggests
one. Where no such entry records it, the address comes out, and code that
needs it is a spec gap (`.claude/skills/implement-rows/SKILL.md`). Elsewhere,
cite the finding that records the address, or write one. A test that needs addresses of its own, such
as a synthetic executable, places them where no executable of the period loads
(the template's use `0x7F000000`) and builds any neutral name at run time, so
nothing in it reads as an address of the original. The commit-msg hook in
`.githooks/` runs the same rule over a commit message
(`node tools/upstream.mjs docs --message <file>`).

The verified offline runner and explicit refresh procedure are documented in
[UPSTREAM-RULES](UPSTREAM-RULES.md). The canonical gate checks snapshot hashes,
that the CI pin and the checker package agree, documentation, and synthetic
evidence/snapshot tests.

### Generated files on the main branch

The checker writes `spec/index/` and `PARITY.md`; nobody edits them by hand.
The CI step sets the action's `scheduled-generation` input, so they change on
the main branch only, as the standard's
[Where it lives](upstream/documentation-standard.md#where-it-lives) (lines 24-104)
allows. On a pull request the check neither writes them nor compares them with
the spec, and fails the change if it edits, adds or removes one of them since
it forked from `main`. A branch therefore never changes them and never has a
merge conflict in them, and its copies are as old as the `main` it last took
in.

The job in `.github/workflows/nightly-generated.yml` brings them up to date.
It runs daily, and on a manual dispatch from `main`. A scheduled run looks up
the `main` commit of the job's last successful run and stops, saying so, when
no commit since then touches `spec/`, `parity/` or `deviations/` outside
`spec/index/`. A failed or missed run does not move that commit, so its
changes are picked up by the next run. With no earlier successful run, or when
that commit is no longer on `main`, the run regenerates. Otherwise it runs
`node tools/upstream.mjs docs --generate --no-ksy` on `main`, commits nothing
when the check fails or the files are already current, and otherwise commits
them as `github-actions[bot]` and pushes to `main`. It tries the push up to
three times, fetching `main` and regenerating after each rejection.

The job pushes with the workflow's own token. Where `main` requires pull
requests (a ruleset or branch protection), that push is rejected, and the
files on `main` stop changing, until the repository lets the job through: add
GitHub Actions to the ruleset's bypass list, or store a token that may bypass
the rule as a secret and use it in place of `github.token` in the workflow.
The workflow changes no repository settings itself.

To read current copies on a branch, run the checker package the workflow's
commit carries, with Node.js 22 or newer after `pnpm install`, with
`--generate`, and do not commit what it writes:

```sh
node tools/upstream.mjs docs --generate
git restore spec/index PARITY.md   # before committing
```

A restoration that removes `scheduled-generation` from the CI step goes back
to committing them: every change runs `node tools/upstream.mjs docs` and
commits what it writes, the check fails a change that leaves them stale, and a
merge conflict in them is resolved by taking either side and running the check
again. Remove the nightly workflow in the same change.

### Local runs

`tools/upstream.mjs docs` passes the checker the inputs the CI step gives
under `with:` (`code`, `references`, `images`, `max-range`, `data-dirs`,
`rebuild` and `scheduled-generation`), so a local run checks what CI checks; an
option given on its command line wins, and `--generate` drops
`scheduled-generation`. `--check` reports problems without writing anything. `tools/Test-TemplateInfrastructure.ps1`
fails if the workflow stops running the check or pins it to anything but a full
commit SHA, and, while the step sets `scheduled-generation`, if the nightly
workflow is missing. The script does not check some items on the standard's list, such as
the fixture schema and the hashes of saves and recordings; its guide lists them,
and reviewers check those by hand. A save-patch write is given as a byte offset
and value in the experiment's Setup section.

`.githooks/pre-commit` runs the gate's node checks, listed once in
`tools/Invoke-NodeChecks.mjs`, before each commit once a clone enables it with
`git config core.hooksPath .githooks`. It copies the index to a temporary
directory and checks that, so it judges what is being committed: unstaged edits
neither hide a problem nor block a clean commit. The documentation check runs
there with `--no-ksy`, so `.ksy` compile errors still surface only in the gate
and CI. Without `node` the hook prints a warning and lets the commit through.

## Repository policy

`tools/Verify-Repository.ps1` applies `tools/repository-policy.json` to tracked
files. It rejects local/imported roots, JVM crash, replay and heap-dump files
at any depth, original-media extensions outside explicit clean-room or
synthetic fixture roots, and unreviewed files larger than 1 MiB. The publisher scripts invoke the same check before deleting or
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

## Capture review validation (2026-10-01)

Windows synthetic acceptance (`node --test tests/upstream/capture-window.test.mjs`)
reproduced the synchronous wait with a target UI thread blocked for five seconds.
The isolated worker failed within its two-second test deadline and a later capture
succeeded. The bitmap retained the right and bottom client edges with the caller
set DPI-unaware. This machine reports 96 DPI: cropping at 125% or higher and moving
between monitors with different scale factors remain unconfirmed locally.

The canonical `tools/Invoke-Validation.ps1` fast gate passed using a temporary
portable PowerShell 7 runtime, including the Windows acceptance tests and Release
solution build. No original game or proprietary assets were used.

Signing workflow acceptance uses `tests/upstream/release-signing.test.mjs` synthetic tag API and certificate tests. Signed release setup requires `ES_CERTIFICATE_THUMBPRINT` and main-only deployment branches in the protected `release-signing` environment. Live signing is not exercised by synthetic acceptance.

## Explicit rerun without restore

After normal validation has restored this checkout, run
`./tools/Invoke-Validation.ps1 -NoRestore` to rerun using the existing restored
lock/assets state when NuGet is unavailable. Normal invocation and CI still
restore. The switch skips restore only; all policy/configuration/infrastructure,
Python/Node checks, builds and tests remain required. It never retries a failed
build or test by restoring automatically. Missing assets/packages fail through
.NET diagnostics. Cached restore freshness is a caller prerequisite, not inferred
by this switch: rerun normal validation after changing dependency inputs,
lockfiles, SDK or build paths. Filters still mean partial test acceptance.
