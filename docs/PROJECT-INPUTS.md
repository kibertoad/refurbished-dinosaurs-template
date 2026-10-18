# Project-local original inputs

Each checkout keeps its machine-specific paths in ignored
`.artifacts/local-inputs.json`. Copy `tools/local-inputs.example.json` there and
set `gameDirectory` to the project's original-input store, or `null` when absent.
Paths may be absolute or relative to the checkout root; they never depend on the
caller's current directory. Keep the store's build subdirectories and captures
separate from the actual installation listing. Do not commit local paths or originals.

```json
{
  "version": 1,
  "gameDirectory": "../local-originals/this-project"
}
```

No account-wide `GAME_DIR` is consulted. Missing local configuration, or a null
directory, means no originals are configured. Malformed configuration fails
explicitly. There is no fallback to another project's global variable.

`tools/Invoke-Validation.ps1` and `tools/Run-ValidationCheck.mjs` apply this
configuration. For another command use:

```sh
node tools/Project-Inputs.mjs -- dotnet test --project tests/Restoration.Tests/Restoration.Tests.csproj
```

The launcher gives only its child process a `GAME_DIR` bridge for the existing
standard's `needs: GAME_DIR` tests. It does not change the shell, user or machine
environment. Direct commands that bypass the launcher are outside this isolation
boundary: migrate research scripts that read the variable to the launcher too.
Tests still verify each file against the build or finding fingerprint and skip
when their required copy is missing. Selecting a directory never proves edition
identity or parity.

Receipt identities include the local configuration even though it is ignored,
the selected directory, and all its file contents. Changes during validation
refuse receipt creation. Other external directories still require explicit
`externalEnvironment` declarations; this change does not drop their hashing.
CI has no local input configuration and keeps original-dependent tests skipped.
