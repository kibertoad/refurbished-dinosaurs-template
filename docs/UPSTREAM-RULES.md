# Pinned Standard v1, Methodology and Protocol

`tools/upstream-lock.json` identifies exact upstream revisions, source paths and
SHA-256 digests for the unmodified Standard, Methodology, Protocol, checker and MIT licenses.
The standard remains **v1**. Source snapshots live in `docs/upstream/`; the checker
is in `vendor/`, outside the `--code` roots so the offline run and the CI action (which
runs its own copy) scan the same files. Git attributes disable EOL conversion there, so
their exact bytes survive on every platform.
Configuration deliberately leaves these directories unchanged.

Use Node.js 22 or newer:

```sh
node tools/upstream.mjs verify
node tools/upstream.mjs docs --check
node tools/upstream.mjs docs
node tools/upstream.mjs links
```

`links` checks that every link into the copy names a heading there and gives
that section's line range, so agents read only those lines; `links --write`
adds or corrects the ranges. The first command checks integrity and agreement with the CI action pin without
network access. The documentation runner verifies before executing the checker;
without `--check` it regenerates the usual indexes and parity totals. The canonical
validation gate runs these offline checks. Kaitai and other dependencies required
by the checker must already be installed for applicable entries; a snapshot does
not install them or make the entire build network-independent.

The snapshots are the rules this repository follows, and agents read them
instead of the published pages: `AGENTS.md` ("The local copy of the standard")
says how. The template is updated when the website changes, so nobody checks
for a newer version during routine work. Owner instructions and explicit
repository adaptations still apply.

## Check or refresh explicitly

Only when the owner asks for it in the current task:

```sh
node tools/upstream.mjs check-upstream
node tools/upstream.mjs refresh --rules <full-40-character-commit> --toolkit <full-40-character-commit>
```

`check-upstream` compares the six pinned files with each repository's current
main commit: exit 0 means unchanged content, 2 means changed content, and 1 means
failure. It makes no changes. A new commit with identical files is reported but
does not require refresh. Review differences before selecting explicit revisions.

Refresh downloads all files before writing any of them, requires the Standard's
v1 declaration, updates the CI checker pin, and writes the lock last. Individual
files are replaced atomically; an interruption across files is detected by digest
verification. Restore the previous snapshot or rerun the explicit refresh before
using it. Review the diff and run the canonical gate before committing; run `node tools/upstream.mjs links --write` first, which rewrites the line range of every section link to match the new copy; the gate fails on a link whose section no longer exists or whose range is stale. Follow any change the new version makes to the rules in `AGENTS.md`, the skills and the documents that summarize them. Do not
edit vendored files, broaden accepted formats locally, or promote spec claims as
a side effect of a rules/checker update.

The current checker includes toolkit PRs [10](https://github.com/kibertoad/refurbished-dinosaurs-toolkit/pull/10),
[11](https://github.com/kibertoad/refurbished-dinosaurs-toolkit/pull/11)
[12](https://github.com/kibertoad/refurbished-dinosaurs-toolkit/pull/12)
and [13](https://github.com/kibertoad/refurbished-dinosaurs-toolkit/pull/13):
superseded rules do not own active procedures, executable location kinds are
validated against the explicit v1 format list, build entries have a Code ranges
section that every overlay offset lies inside, a long list of a build's
other files is checked, and each draw in a fixture's runs is `{ rule, bound,
result }` naming a rule entry. Both licenses are retained next
to their respective copies. SHA-256 here identifies upstream tooling bytes; spec
builds and captures continue to use the Standard's XXH3-128 hashes.

## Configuration-test prerequisites

The upstream tests require Git, Node.js 22+ and PowerShell 7+ (`pwsh`), including
on Windows. Their scratch copy includes tracked files and non-ignored untracked
files, then excludes the existing local-output directories. Deleted tracked files
are skipped. Ignored dependencies and caches are not copied.

Like the canonical repository checks, validation requires a Git checkout. For a
ZIP download, initialize a repository with `git init` before validating; the
non-ignored files are then visible as untracked. There is no recursive-copy
fallback that would reintroduce ignored local content.
