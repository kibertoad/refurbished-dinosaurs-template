# Validation records and operational handovers

Keep `docs/VALIDATION.md` as the validation procedure and current-gate index.
Put complete dated result records in linked files under `docs/validation/`
before the index grows beyond its configured limit. The root `validation/`
directory remains reserved for the standard's original-test run records;
ordinary prose never goes there.

## Move records without losing evidence

Record the source revision and normalized-text hash before moving a long log.
Split at complete record boundaries, preserving each record's heading, date,
command, result, provenance, exclusions and unresolved gates. Keep records
together rather than cutting a paragraph at the line limit. Use numbered
files, such as `docs/validation/001.md`, filled below the limit, and retain
an index linking every moved record. Give each record a stable heading or
explicit anchor. Existing incoming fragment links must still resolve or be
updated in the same change.

Resolve relative links from each new file's directory. Check outgoing targets
and fragments, incoming references and any requirements retained in the old
file. Normalize line endings only for a content-preservation comparison;
after undoing the intentional link relocations and wrappers, the moved text
must reconstruct the original hash. Keep the audit and temporary backups
ignored. Commit the linked records themselves, not a second archive copy.

Historical results keep their original dates and scope. A current result names
the checks actually run against that state. A previous runtime or original-game
run is labelled previous and linked to its retained record. Moving validation
text neither repeats that run nor validates game parity.

## Keep the handover operational

`docs/HANDOVER.md`, or the active goal's own handover, names the current gate,
open queue IDs, blockers, retained process/checkpoint ownership and the next
action. Link the plan for scope, the queues for questions, the spec for findings
and the validation index for results. Replace stale session state. Preserve
unfinished requirements at their proper destinations before removing duplicate
narrative. Source-controlled history supplies previous handovers; do not create
archive copies of the plan or handover.

The template adopts a 200-line and 800-whitespace-word handover budget in
`tools/repository-policy.json`. Long paragraphs cannot evade the word budget.
These are explicit repository limits; a restoration preserves its own adopted
limits when taking this change. Goal files still contain the protocol's required
scope and handover sections and retain their configured file limit.

## Apply the same policy to the final tree

`textSizeRules` in `tools/repository-policy.json` is the shared authority for
human-document scopes, suffixes, exclusions and line/word limits.
`Check-TextPolicy.mjs` is called by the infrastructure check and the Node
checks. The pre-commit hook runs those Node checks inside the staged snapshot,
so final validation/handover edits are checked even when made after an earlier
passing gate. An unstaged repair cannot hide an oversized staged record.

```sh
node tools/Check-TextPolicy.mjs
```

Each rule has a unique `name`, `roots` and/or exact `files`, explicit text
`extensions`, optional `excludedRoots`/`excludedFiles`, and positive `maxLines`
and/or `maxWords`. Paths are canonical repository-relative paths with forward
slashes. Unknown fields, missing policies, invalid limits and selected symlinks
fail. Scoped files must decode as UTF-8. Binary suffixes outside the rule's
extensions are skipped.

Line counts match `ReadAllLines`: empty text has zero lines, a final line
terminator adds no extra line, and LF, CRLF and bare CR are handled equally.
Words are nonempty whitespace-separated spans. The same rule can therefore
run under Node, PowerShell's gate and the staged hook without a second counter.

The default documentation rule covers Markdown in the human-maintained roots
and the named root documents. `docs/upstream/` is explicitly excluded because
those immutable, hash-verified snapshots retain upstream bytes. Generated
tables covered by the standard keep its limit; another generated output is
excluded only when the repository's policy explicitly names that exception.

When adopting, copy the checker, policy entries, Node-gate registration and
infrastructure delegation together. Preserve existing repository-specific
scopes and exclusions. Validate final result-record edits through this same
policy and the documentation/citation/queue checks. Do not disable hooks,
raise a limit, or claim that the earlier tree's check covered a later edit.
