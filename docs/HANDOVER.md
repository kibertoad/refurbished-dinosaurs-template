# Handover

## State

- Project-local original inputs are implemented for issue 81. See
  [PROJECT-INPUTS.md](PROJECT-INPUTS.md) and the
  [fresh acceptance record](validation/20261019-project-local-inputs.md).
- Checker 6.1.0 and merged process PR128 adoption are in PR147.
  [The adoption plan](CHECKER-PREFLIGHT-PLAN.md) records acceptance and limits.
  Optional `node tools/upstream.mjs docs --preflight` is editing feedback only.
- Canonical focused gate passed 111 Node controls and 5 .NET address-citation
  tests, no skips or build warnings/errors. Final policy, documentation/citation,
  queue and staged hooks passed. CI full acceptance is pending.
- Stage: unconfigured template; no game intake has started.
- Shared signing/release safeguards are ready for review: main-only preparation, bounded jobs, expected certificate verification and same-commit tag reuse. Synthetic tag/certificate controls and canonical validation pass.
- PR 35 capture tooling retains its prior Windows timeout, recovery and physical client-edge coverage.

## Unfinished

PR147 now pins merged process PR128 at e5ccb6e7f34a83a0495cd0004c215a3737bdb5b1.
Its refreshed local gate passed; CI is rerunning. Checker adoption awaits review. Validation-domain suites remain
separate in PR146, coordinated with process PR128. The installer-tag and CRLF
fixture fixes shared with PR146 let these branches merge independently.

Project-local input changes await review and consumer adoption. Direct research
scripts must use the checkout launcher instead of inherited global variables.
Live signing and environment protection remain release-time checks.

## Blockers

High-DPI and mixed-monitor capture acceptance needs a Windows desktop configured above 96 DPI. This session's desktop reports 96 DPI.

## Next

- Complete PR 35 capture acceptance at 125% or higher and across monitors with different scale factors; see `docs/VALIDATION.md`.
- Resume the template's game-intake slice when an owner selects a game.
