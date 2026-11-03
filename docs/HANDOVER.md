# Handover

## State

- Project-local original inputs are implemented for issue 81. See
  [PROJECT-INPUTS.md](PROJECT-INPUTS.md) and the
  [fresh acceptance record](validation/20261019-project-local-inputs.md).
- Validation improvements are proposed in [PR146](https://github.com/kibertoad/refurbished-dinosaurs-template/pull/146),
  tracked by issue 145. See [acceptance and benchmark results](VALIDATION-OPTIMIZATION-RESULTS.md).
- Final implementation gate: 2026-11-03, fresh integration passed 120 Node
  controls and 55 .NET tests with no skips, warnings or errors. Final policy,
  infrastructure, documentation/citation and staged hooks passed. CI passed
  documentation and Ubuntu validation, then exposed the installer verification
  defaulting to latest. Both workflows now verify their explicit download tag;
  the packaging rerun is pending.
- Stage: unconfigured template; no game intake has started.
- Shared signing/release safeguards are ready for review: main-only preparation, bounded jobs, expected certificate verification and same-commit tag reuse. Synthetic tag/certificate controls and canonical validation pass.
- PR 35 capture tooling retains its prior Windows timeout, recovery and physical client-edge coverage.

## Unfinished

Merge process [PR128](https://github.com/kibertoad/refurbished-dinosaurs/pull/128)
before adopting the selected gate downstream. Refresh its rule snapshot in PR146
once merged; current snapshots include fixture guidance PR127, checker 6.0.1.
Toolkit preflight PR549 remains separate editing feedback.

Project-local input changes await review and consumer adoption. Direct research
scripts must use the checkout launcher instead of inherited global variables.
Live signing and environment protection remain release-time checks.

## Blockers

High-DPI and mixed-monitor capture acceptance needs a Windows desktop configured above 96 DPI. This session's desktop reports 96 DPI.

## Next

- Complete PR 35 capture acceptance at 125% or higher and across monitors with different scale factors; see `docs/VALIDATION.md`.
- Resume the template's game-intake slice when an owner selects a game.
