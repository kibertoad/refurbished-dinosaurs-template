# Validation inputs and final records

Finish implementation and evidence edits before running expensive checks. Write
the final validation record afterwards, then run the documentation, citations,
queue, schema, text policy and staged hook checks on the final text. A record
distinguishes a fresh run from a reused passing run and links its original date.

`tools/Run-ValidationCheck.mjs CHECK -- EXECUTABLE ARG...` runs a check and can
retain a local passing receipt under ignored `.artifacts/validation-receipts/`.
The gate uses it for `node-tests`. Without a declaration in
`validation-inputs.json`, it always runs fresh. CI always runs fresh. The helper
does not authorize a narrower test selection or replace any required gate.

A project may declare a check's inputs after reviewing what the command reads:

```json
{
  "version": 1,
  "checks": {
    "node-tests": {
      "exclude": ["docs/validation/", "docs/VALIDATION.md"],
      "tools": [["node", "--version"], ["pwsh", "--version"]],
      "externalEnvironment": []
    }
  }
}
```

This is an example, not the template's configured contract. Exclude a final record
only when the check does not read it. Everything tracked or untracked and not
ignored is an input by default, including missing tracked files. New files enter
the identity. Configuration, tools, hooks, lock files, JSON and MSBuild properties
cannot be excluded. Commands and arguments, the checkout path, Node version,
declared tool version output, all environment values and all `GAME_DIR` file
contents enter the identity. Declare any other external input directory by its
environment variable. An absent external variable is distinct from a populated
one. Symlinks are refused. Ignored files other than declared external inputs are
not covered: a check that reads them must declare that directory or remain
unconfigured. A tool that depends on more than its version output must declare
those files too. Receipts contain digests, never environment values or originals.

A changed command, tool, configuration, original input or included file reruns
the check. Failure removes an earlier receipt; a change during a run fails without
recording success. Receipts are local optimizations, not parity evidence or
portable attestations. Do not commit, copy between checkouts or edit them.

The pre-commit hook still checks the staged snapshot freshly. This helper never
reuses a working-tree receipt for staged content. Keep policy, configuration,
documentation, citation, schema and queue checks outside the receipt wrapper.
When no reviewed narrower contract exists, a final record changes the whole-tree
identity and the expensive check must run again.
