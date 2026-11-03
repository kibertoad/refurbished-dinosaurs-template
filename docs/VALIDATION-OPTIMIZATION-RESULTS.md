# Validation optimization evidence

This is tooling acceptance, not original-game evidence or validated parity.
The changes are still under review; no downstream adoption is implied.

## PowerShell startup benchmark

`node tools/Benchmark-Validation.mjs d0c880373f51cf3d2f43434ef6a68a7ce928f1f6`
ran the old and new diagnostic-policy acceptance tests three times each on the
same Windows host with Node v24.15.0 and the same PowerShell and Git on PATH.
The benchmark uses only synthetic Git repositories. It copies the baseline
script/test/policy from that commit and the candidate files from the working
tree. Each sample must pass before its time is recorded.

| Version | Sample 1 | Sample 2 | Sample 3 | Median |
|---|---:|---:|---:|---:|
| Before | 3973 ms | 3966 ms | 3914 ms | 3966 ms |
| After | 3288 ms | 3142 ms | 3160 ms | 3160 ms |

The median decreased by 806 ms (20.3%). PowerShell startups decreased from
seven to five, including the availability probe. This is a small sequential
local sample, not a CI or full-gate speed claim. No timing threshold is tested.

The same four diagnostic filenames still exercise ignore handling, forced
staging and policy rejection, including uppercase behavior. Every matrix case
removes its own file and checks a clean result afterwards. Ordinary logs still
pass. Real CLI passing runs surround the matrix and a forced diagnostic has a
real CLI failure control. Both the module and CLI use the same production
policy evaluator; no exits or source text are rewritten during tests.

## Checker fixture accounting

The image-option test retains default success, configured-image failure and
command-line override success. Its synthetic YAML now modifies the existing
input block and verifies image checking was configured, including on CRLF
checkouts. The generation test retains unchanged stale output in scheduled
mode, failure on explicit stale generation checking and successful rewrite.
Its expected output comes from the real checker on the synthetic spec.

Both tests use explicit empty spec/glossary/parity/deviation directories, a
synthetic spec README, the real spec license and the existing pinned snapshot
fixture. They no longer copy live entries, parity rows, deviations or generated
indexes. The separate configuration integration test still copies the Git-visible
checkout and verifies rule snapshot and license bytes after configuration.
A bounded stress benchmark supplied 3,000 unrelated synthetic files in addition
to the required metadata. Copying the old fixture took 1679/1478/1614 ms and
produced 3003 files (102091 bytes); the minimal builder took 2/2/2 ms and
produced 2 files (21061 bytes). Identical pinned snapshots are outside these
counts. This measures fixture setup on synthetic stress input, not checker or
full-gate speed. An empty template has fewer files and a smaller absolute gain.
The same invocation repeated the startup test: before 4635/4368/4191 ms,
after 4732/3661/3620 ms (medians 4368 and 3661 ms, 16.2% lower). The variation
reinforces that these are local measurements, not a timing guarantee.
Final implementation-tree integration passed 120 Node tests, a zero-warning
solution build and all 55 .NET tests, with no skipped tests, using
`./tools/Invoke-Validation.ps1 -Integration -NoRestore` after a successful
restoring integration run. Controls include configured manifest paths and
actual selected receipt dispatch. The template has zero Kaitai definitions,
so this does not establish compilation of game schemas.

## Selection and receipts

Focused controls passed for ownership, transitive dependencies, mixed/unknown
paths, new tests, explicit requests, missing/cyclic declarations and independent
staged/worktree changes. A real child test proves discovered unregistered tests
run and failures propagate. Gate controls retain fresh policy/checker execution,
NoRestore behavior and build-failure propagation, and reject filters that narrow
required integration. Receipt controls prove invalidation and fresh integration.
These targeted passes do not establish full integration or Kaitai compilation.


## Installer CI follow-up

Template CI passed documentation and Ubuntu validation/assetless smoke checks,
then failed while verifying the downloaded Inno Setup 7.1.0 installer against
the latest release, 7.1.1. `gh release verify-asset --help` documents the optional
release tag and the latest-release default. CI and release now pass the same
explicit tag used by the download. A regression test checks this relationship
in both workflows and retains attestation failure and Authenticode checks.
Fresh local integration passed 120 Node and 55 .NET tests after this fix.
The Windows packaging rerun must still pass; local validation is not packaging
acceptance.


## Final merged PR128 alignment

The selected gate now accepts explicit `-Research -ChangedSince BASE`. It
runs fresh checks and any affected tooling controls without rebuild tests,
rejects src/tests changes or explicit rebuild requests, and requires separate
integration for uncertain/shared inputs. In-place research changes retain the
existing Code partial/Defect handoff to implementation. Full integration stays
fresh in CI and before release. Suite receipt contracts live beside selection
inputs, tests and dependencies in `tools/validation-suites.json`; a declaration
change invalidates prior success.

Each diagnostic case now creates its own Git repository, working directory and
named Git environment in the shared host, restoring those environment names
afterwards. The real CLI controls are retained. A repeat of the committed
benchmark with this final isolation measured before 4001/3864/4003 ms and
after 3694/3447/3520 ms (medians 4001 and 3520 ms, 12.0% lower). Startup counts
remain seven and five. These supersede the earlier timings for the shared-case
version; the historical samples above are retained for transparency. Synthetic
fixture setup measured 1529/1418/1393 ms before and 2/2/2 ms after, with the same
3003/2 file and 102091/21061 byte counts. No timing threshold is asserted.

Final alignment integration passed 123 Node tests and 55 .NET tests, with no
skips and a zero-warning build. Fresh final documentation and staged hooks
remain required after this record.
