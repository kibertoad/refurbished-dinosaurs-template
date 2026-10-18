# Project-local input configuration acceptance (2026-10-19)

Follow-up to [issue 81](https://github.com/kibertoad/refurbished-dinosaurs-template/issues/81).
An inherited machine-level `GAME_DIR` can select a different restoration's
actively changing probe store. Receipt checks correctly refuse changed input
contents, but the implicit global selection makes unrelated work interfere.

`tools/Project-Inputs.mjs` now reads ignored `.artifacts/local-inputs.json` from
its own checkout. The validation launcher and receipt runner use that selection;
neither consumes the inherited global value. Missing/null settings remove the
child bridge, invalid settings fail, and relative paths resolve against the
checkout. The parent environment is unchanged. Receipts include local config
identity and continue hashing selected external contents. A changing input
refusal names changed component categories without printing environment values.

Synthetic acceptance: all 17 project-input, receipt and offline-gate controls
pass, with no skips. These cover two independent checkouts, child arguments and
exit status, malformed config, global isolation, input/config/tool/command
invalidation, failure and mutation refusal, and retained restore/filter checks.

An initial broad fast gate passed policy, configuration, infrastructure and
text/docs/citations/Kaitai/queue checks, then reported 108/109 Node controls passed.
Its sole failure was the Windows direct-capture fixture's `Blank result
accepted` assertion, also reproduced alone. See existing
[capture readiness issue 73](https://github.com/kibertoad/refurbished-dinosaurs-template/issues/73).
The [separate capture prerequisite](20261019-offscreen-capture.md) resolves this
fixture condition. A subsequent run exposed the already documented worker timing
failure under host load; its rejection checks and deadlines were retained.
With the concurrent owned builds finished, the final canonical fast gate passes
all 109 Node controls and 11 filtered original-file resolver tests, with zero
failures/skips and zero build warnings/errors. Policy, configuration,
infrastructure, docs/citations/Kaitai/queue and text checks pass freshly.

The original-file .NET controls also independently pass all 11 tests through the
local-input launcher. No original files, captures or native code
are used by these synthetic controls. Direct tools that bypass the launcher
remain a consumer migration task; this change does not claim arbitrary script
isolation or whole-game parity.
