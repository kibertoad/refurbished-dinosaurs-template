# Handover

## State

- Project-local original inputs are implemented for issue 81. See
  [PROJECT-INPUTS.md](PROJECT-INPUTS.md) and the
  [fresh acceptance record](validation/20261019-project-local-inputs.md).
- Fresh focused controls: 17 passed, zero skips. Final canonical fast gate:
  109 Node controls and 11 filtered resolver tests pass, zero failures/skips
  or build warnings/errors. Earlier capture fixture/load failures and the
  separately tested prerequisite are retained in the acceptance record.
- Stage: unconfigured template; no game intake has started.
- Last gate: 2026-10-01, `tools/Invoke-Validation.ps1` fast gate and offline documentation check passed on Windows using temporary portable PowerShell 7.
- Shared signing/release safeguards are ready for review: main-only preparation, bounded jobs, expected certificate verification and same-commit tag reuse. Synthetic tag/certificate controls and canonical validation pass.
- PR 35 capture tooling retains its prior Windows timeout, recovery and physical client-edge coverage.

## Unfinished

Project-local input changes await review and consumer adoption. Direct research
scripts must use the checkout launcher instead of inherited global variables.
Live signing and environment protection remain release-time checks.

## Blockers

High-DPI and mixed-monitor capture acceptance needs a Windows desktop configured above 96 DPI. This session's desktop reports 96 DPI.

## Next

- Complete PR 35 capture acceptance at 125% or higher and across monitors with different scale factors; see `docs/VALIDATION.md`.
- Resume the template's game-intake slice when an owner selects a game.
