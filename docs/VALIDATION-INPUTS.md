# Validation inputs and final records

Project-local originals are configured through [Project inputs](PROJECT-INPUTS.md).
The runner ignores inherited global `GAME_DIR` and derives its child-only bridge
from ignored `.artifacts/local-inputs.json`, whose identity is always included.

Finish implementation and evidence edits before running expensive checks. Write
the final validation record afterwards, then run the documentation, citations,
queue, schema, text policy and staged hook checks on the final text. A record
distinguishes a fresh run from a reused passing run and links its original date.

`tools/Run-ValidationCheck.mjs CHECK -- EXECUTABLE ARG...` runs a check and can
retain a local passing receipt under ignored `.artifacts/validation-receipts/`.
The selected gate uses it per domain (`suite-ID`). Each suite's `receipt`
contract lives in `tools/validation-suites.json`, beside its test ownership,
source/spec inputs and dependencies. Missing contracts run freshly. CI and
explicit integration always run freshly. The helper does not replace required
gates or authorize selection by itself.

A reviewed suite entry can include:

```json
{
  "id": "text-policy",
  "inputs": ["tools/Check-TextPolicy.mjs"],
  "tests": ["tests/upstream/text-policy.test.mjs"],
  "dependencies": [],
  "receipt": {
    "exclude": ["docs/", "spec/"],
    "tools": [["node", "--version"], ["git", "--version"]]
  }
}
```

The template enables receipts for text-policy and goal-run. Their tests read
synthetic trees and production tools, not the excluded live documentation/spec.
Other suites remain uncached. The manifest itself is a protected identity input;
changing a receipt declaration invalidates prior success. The generic helper
also supports non-suite custom checks in `validation-inputs.json`, whose default
checks object is empty. A `suite-ID` always reads the suite map, never that file.
Exclude a final record only when the check does not read it.
Everything tracked or untracked and not ignored is an input by default, including
missing tracked files. New files enter the identity. An untracked nested
repository or worktree is refused until it is ignored or excluded. Configuration, tools, hooks, lock files, JSON and MSBuild properties
cannot be excluded. Commands and arguments, the checkout path, Node version,
declared tool version output, all environment values and all `GAME_DIR` file
contents enter the identity. Declare any other external input directory by its
environment variable. An absent external variable is distinct from a populated
one, and a path that does not exist is recorded as missing. Symlinks inside the
repository or an external directory are refused. Ignored files other than declared external inputs are
not covered: a check that reads them must declare that directory or remain
unconfigured. A tool that depends on more than its version output must declare
those files too. Receipts contain digests, never environment values or originals.

A changed command, tool, configuration, original input or included file reruns
the check. Failure removes an earlier receipt; a change during a run fails without
recording success. A receipt only lets a later run in the same checkout skip a
repeated check; it is never parity evidence. Do not commit, copy between
checkouts or edit them.

The pre-commit hook still checks the staged snapshot freshly. This helper never
reuses a working-tree receipt for staged content. Keep policy, configuration,
documentation, citation, schema and queue checks outside the receipt wrapper.
When no reviewed narrower contract exists, a final record changes the whole-tree
identity and the expensive check must run again.
