# Checker preflight adoption

Adopt the published checker release containing toolkit PR549, with the same
release-tag commit pinned for CI and the exact package version locked locally.
This tooling change provides faster optional editing feedback. Complete
validation, citation, schema, queue and staged checks remain acceptance gates.
No game behavior, evidence status or asset-pack contract changes.

The wrapper accepts `docs --preflight`, removes only its implicit CI
`--scheduled-generation` flag in this mode, and preserves explicit caller
arguments so the checker rejects incompatible requests. Preflight never
writes generated files. Keep its partial-pass message and skipped-check list.
Ordinary docs/check/generate behavior and explicit failures remain unchanged.

Acceptance uses the actual installed checker against small synthetic spec
metadata: preflight succeeds with stale generated output and does not rewrite
it, invalid entries fail, incompatible explicit flags fail, and ordinary full
checking still rejects uncited source addresses. Run focused wrapper controls,
offline pin/link checks and the repository-required acceptance gate. Record
unavailable schema compilation and preflight skips without claiming a full pass.
Publish the template adoption as a separate PR from validation-suite changes.

## Acceptance result

Checker 6.1.0 is published; its release tag points to
`98e2e2000e365537c85ffa7605e4813a82a46cb4`. CI, package and lock pins agree.
The canonical focused gate passed 111 Node tests and 5 address-citation .NET
tests, with no skips or build warnings/errors. Complete documentation, policy,
configuration, infrastructure and queue checks passed. Preflight controls run
the actual checker and retain its partial-pass/skipped-check output.

The CI installer verification explicitly names its downloaded Inno Setup tag,
using the same fix and regression control as PR146, so this adoption can merge
independently. The negative image-option fixture also retains PR146's CRLF-safe
YAML mutation and checks that the failure control was actually configured.
The broader domain-suite optimization is not part of this adoption. CI retains
full acceptance. The rules snapshot includes merged process PR128 at
`e5ccb6e7f34a83a0495cd0004c215a3737bdb5b1`. Existing stricter gate instructions
remain in force; domain selection is separately proposed in PR146. No evidence
status changes.
