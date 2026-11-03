# Bounded instruction reports

The instruction-derived reports come from two published packages:
`@scientific-method/executable-reader` (npm) reads and hash-checks the original and
prepares each query, and `scientific-method-engine` (PyPI) decodes the instructions
and builds the report. Their command reference, input contract, supported subset
and limits are in the toolkit's
[bounded evidence reporter guide](https://github.com/kibertoad/refurbished-dinosaurs-toolkit/blob/main/docs/bounded-evidence-reporters.md).
Read the guide at the versions this repository pins: `package.json` pins the reader
and `requirements-evidence.txt` pins the engine.

## Setup

Node 22 or later, pnpm and Python 3.12 or later are required.

```sh
pnpm install
python -m pip install -r requirements-evidence.txt
```

The engine pins its own decoders (Capstone 5.0.9 and pypcode 4.0.1 for engine
19.9.0), which pip installs with it. The reader runs `pointers`, `table`,
`bodies`, `imports` and `unpack` in Node and needs no engine for them.
Where only `python3` is Python 3.12 or later, install with `python3 -m pip`.
`EVIDENCE_PYTHON` selects the Python executable, which must have the engine
installed. Without it, `tools/evidence/report.mjs` and the evidence tests use the
first of `python` and `python3` that starts as Python 3.12 or later, and `python`
when neither does. The reader refuses an engine that speaks another
prepared-config protocol; update the older of the two.

## Running a report

`tools/evidence/report.mjs` runs each reporter command under an `x86-` prefix,
next to this template's own `operand`, `incoming`, `flow`, `table`, `inventory`
and `inventory-check` commands. `pnpm exec scientific-method <command>` runs the
same report directly. Reports and their configurations stay in `GAME_DIR` and are
not committed; save redirected output there too. For example, from PowerShell:

```powershell
node tools/evidence/report.mjs x86-trace "$env:GAME_DIR/analysis/query.json"
```

A reporter never runs the original program, invokes DOSBox or changes a spec
status. A limit never turns a partial search into an absence claim, and
`completeWithinModel` means every explored path reached a return within the
model's assumptions, not a complete reading under the documentation standard.

## Choose the command

| Question | Command |
|---|---|
| Which import is in an IAT slot? | `imports` |
| Which calls reach an address? | `incoming` |
| Which instructions access one memory offset? | `uses` |
| What does one bounded path do, and what does it return or change? | `trace`, `effects`, `returns`, `arguments`, `guards` |
| How far does a body reach, and which entries own a site? | `bounds`, `owner` |
| What does an entry call, and what does it reach? | `callees`, `reach` |
| Which target does an input select in a jump table? | `dispatch` |
| Which encoded operands, displacements or calls equal a value? | `scan-index` |
| What does one pointer table hold? | `table` |

Use a command before writing a decoder. The command's section in the toolkit
guide gives its controls, limits and refusal cases; a command that cannot answer
the question is a reporter request under the next heading, not a reason to write
a second decoder in the game repository.

## Requests and updates

A reporter need not support every query. When one cannot answer a question the
research needs, record the request with its synthetic case and hand it to the
toolkit; it stays open in this repository until a released reader or engine
passes that case here. Passing synthetic cases or adopting review guidance alone
does not close it.

Take a fix by moving the pin in `package.json` or `requirements-evidence.txt`,
then run the validation gate. `tests/evidence/evidence.test.mjs` runs an `x86-`
command through the installed reader and engine on a synthetic executable. The
packages carry their own acceptance tests, so none are copied here.
