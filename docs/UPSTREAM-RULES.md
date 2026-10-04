# Pinned Standard v1, Methodology and Protocol

`tools/upstream-lock.json` identifies exact upstream revisions, source paths and
SHA-256 digests for the unmodified Standard, Methodology, Protocol and MIT license.
The standard remains **v1**. Source snapshots live in `docs/upstream/`. Git attributes
disable EOL conversion there, so their exact bytes survive on every platform.
Configuration deliberately leaves this directory unchanged.

The checker is not copied. It is the `@scientific-method/standard-checker` npm
package, pinned in `package.json`, and CI runs the toolkit's `check-documentation`
action pinned to the toolkit commit that released that version. Update both
together. Use Node.js 22 or newer and run `pnpm install` once:

```sh
node tools/upstream.mjs verify
node tools/upstream.mjs docs --check
node tools/upstream.mjs docs
node tools/upstream.mjs links
```

`links` checks that every link into the copy names a heading there and gives
that section's line range, so agents read only those lines; `links --write`
adds or corrects the ranges. The first command checks the snapshot's integrity and that CI runs the checker
action once, pinned to a full commit SHA, without network access. The documentation runner verifies before executing the checker;
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
node tools/upstream.mjs refresh --rules <full-40-character-commit>
```

`check-upstream` compares the four pinned files with each repository's current
main commit: exit 0 means unchanged content, 2 means changed content, and 1 means
failure. It makes no changes. A new commit with identical files is reported but
does not require refresh. Review differences before selecting explicit revisions.

Refresh downloads all files before writing any of them, requires the Standard's
v1 declaration, and writes the lock last. Individual
files are replaced atomically; an interruption across files is detected by digest
verification. Restore the previous snapshot or rerun the explicit refresh before
using it. Review the diff and run the canonical gate before committing; run `node tools/upstream.mjs links --write` first, which rewrites the line range of every section link to match the new copy; the gate fails on a link whose section no longer exists or whose range is stale. Follow any change the new version makes to the rules in `AGENTS.md`, the skills and the documents that summarize them. Do not
edit the snapshot, broaden accepted formats locally, or promote spec claims as
a side effect of a rules or checker update. The license is retained next to the
copy. SHA-256 here identifies upstream bytes; spec builds and captures continue
to use the Standard's XXH3-128 hashes.

## Update the checker

The checker is updated like any other dependency, when the owner asks or a
Dependabot pull request proposes it. Set the new
`@scientific-method/standard-checker` version in `package.json`, run
`pnpm install`, and move the `check-documentation` action in
`.github/workflows/ci.yml` to the toolkit commit tagged
`@scientific-method/standard-checker@<version>`, so CI and local runs apply the
same checks. Change the tag named in the comment above that step too:
`tests/upstream/upstream.test.mjs` fails until it names the installed version,
so a Dependabot pull request that moves only `package.json` stays red. Its changes are in the package's
[changelog](https://github.com/kibertoad/refurbished-dinosaurs-toolkit/blob/main/packages/standard-checker/CHANGELOG.md).

## Configuration-test prerequisites

The upstream tests require Git, Node.js 22+ and PowerShell 7+ (`pwsh`), including
on Windows. Their scratch copy includes tracked files and non-ignored untracked
files, then excludes the existing local-output directories. Deleted tracked files
are skipped. Ignored dependencies and caches are not copied.

Like the canonical repository checks, validation requires a Git checkout. For a
ZIP download, initialize a repository with `git init` before validating; the
non-ignored files are then visible as untracked. There is no recursive-copy
fallback that would reintroduce ignored local content.
