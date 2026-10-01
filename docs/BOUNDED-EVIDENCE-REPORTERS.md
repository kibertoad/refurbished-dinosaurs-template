# Bounded instruction reports

Install locked tooling with `./tools/Restore-ToolDependencies.ps1`. The default
Python environment is `artifacts/evidence-python`; `EVIDENCE_PYTHON` selects an
explicit interpreter. Node 22+ and Python 3.10+ are required.

The shared input contract, supported instruction model, limits and examples are
maintained in the [engine guide](https://github.com/kibertoad/refurbished-dinosaurs-toolkit/blob/eab782d744ea63fce1173f1bebdcfa60508b4645/docs/bounded-evidence-reporters.md).
Use this repository's `node tools/evidence/report.mjs x86-<command> <config>`
wrapper. Keep configurations and reports under `GAME_DIR`, outside Git.

The executable reader and engine verify their prepared protocol, source identity
and bounded inputs. Reports never run the game or establish a spec status.
Unsupported routes, caps and assumptions remain explicit. Synthetic package
success does not close a game request: rerun its complete source-case controls
when adopting a new release. Shared implementation and tests live upstream;
local tests cover package routing, exact versions and actionable errors.

`package-lock.json` pins npm archives. `tools/evidence/requirements.txt` pins
engine and Capstone wheel hashes. `./tools/Restore-ToolDependencies.ps1 -NoRestore`
checks existing installations without installing or using a network fallback.

Engine 0.4.0 adds caller-local x86-call-order, width-preserving result flow
and ordered effect paths. These summaries retain unresolved callee effects,
conditional return models, stopped paths and caps. A local restoration witness
does not establish whole-call rollback or transactionality.
