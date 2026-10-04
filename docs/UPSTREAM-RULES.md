# Pinned Standard v1, Methodology and Protocol

`tools/upstream-lock.json` identifies exact upstream revisions, source paths and
SHA-256 digests for the unmodified Standard, Methodology, Protocol and MIT license.
The standard remains **v1**. Source snapshots live in `docs/upstream/`. Git
attributes disable EOL conversion there, so their exact bytes survive on every
platform. Configuration deliberately leaves this directory unchanged.

The checker is the npm package `@scientific-method/standard-checker`. CI runs the
toolkit's `check-documentation` action at a full commit SHA, which runs the checker
source at that commit. The lock's `checker` entry records that commit and the
package version it carries, and `package.json` pins exactly that version, so the
offline run and CI apply the same rules.

Use Node.js 22 or newer, after `pnpm install`:

```sh
node tools/upstream.mjs verify
node tools/upstream.mjs docs --check
node tools/upstream.mjs docs
node tools/upstream.mjs links
```

`links` checks that every link into the copy names a heading there and gives
that section's line range, so agents read only those lines; `links --write`
adds or corrects the ranges. The first command checks integrity, and that the CI
action pin, the lock and `package.json` agree, without network access. The
documentation runner also refuses an installed checker of another version, and
verifies before executing it;
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

`check-upstream` compares the four pinned files with the rules repository's
current main commit, and the pinned checker version with the one on the
toolkit's main branch: exit 0 means unchanged content, 2 means changed content,
and 1 means failure. It makes no changes. A new commit with identical files is reported but
does not require refresh. Review differences before selecting explicit revisions.

Refresh downloads all files, and the checker version the toolkit commit
carries, before writing any of them. The toolkit commit must be the one the
toolkit tagged `@scientific-method/standard-checker@<version>`: a later commit can
carry the same version with unreleased checker changes, which CI would run and
the published package would not. Refresh also requires the Standard's v1 declaration,
updates the CI checker pin and the `package.json` pin, and writes the lock last.
Run `pnpm install` afterwards to update `pnpm-lock.yaml`. Individual
files are replaced atomically; an interruption across files is detected by digest
verification. Restore the previous snapshot or rerun the explicit refresh before
using it. Review the diff and run the canonical gate before committing; run `node tools/upstream.mjs links --write` first, which rewrites the line range of every section link to match the new copy; the gate fails on a link whose section no longer exists or whose range is stale. Follow any change the new version makes to the rules in `AGENTS.md`, the skills and the documents that summarize them. Do not
patch the installed checker, broaden accepted formats locally, or promote spec
claims as a side effect of a rules/checker update.

The checker's [changelog](https://github.com/kibertoad/refurbished-dinosaurs-toolkit/blob/main/packages/standard-checker/CHANGELOG.md)
lists what each version checks. The license of the standard's text is retained
next to the copy. SHA-256 here identifies upstream bytes; spec builds and
captures continue to use the Standard's XXH3-128 hashes.

## Configuration-test prerequisites

The upstream tests require Git, Node.js 22+ and PowerShell 7+ (`pwsh`), including
on Windows. Their scratch copy includes tracked files and non-ignored untracked
files, then excludes the existing local-output directories. Deleted tracked files
are skipped. Ignored dependencies and caches are not copied.

Like the canonical repository checks, validation requires a Git checkout. For a
ZIP download, initialize a repository with `git init` before validating; the
non-ignored files are then visible as untracked. There is no recursive-copy
fallback that would reintroduce ignored local content.
