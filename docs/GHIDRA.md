# Ghidra setup for clean-room analysis

Ghidra is a recommended research tool when manuals, community research,
controlled play, and bounded data inspection cannot answer an exact rule,
format, state-transition, RNG, or timing question. Use it only against a legally
owned local executable. Projects, binaries, dumps, screenshots, and full
disassembly or decompiler output must never enter Git.

## Pin the local toolchain and oracle

Before analysis, replace this instructional section with:

- Ghidra version and absolute local installation path;
- JDK version and absolute local path;
- the exact owned executable's edition, path, length, SHA-256, and format;
- a narrow disposable-project pattern below `%TEMP%`.

Check documented local paths before searching or downloading tools. Isolated
processes may need `GHIDRA_HOME`, `JAVA_HOME`, and an explicit `PATH`.
If sandboxing prevents Ghidra from persisting user preferences, request only the
necessary user-level permission rather than reinstalling it.

Always verify executable length and SHA-256 before interpreting an address.
Findings from another version require a separate edition record and address map.

## When to use Ghidra

Start with a narrow player-visible question, such as a combat boundary, RNG
consumption order, producer/consumer relationship for a parsed field, quest
transition, timer, lookup-table dimension, sentinel, resource identifier, or a
reproducible defect needing a fidelity decision.

Prefer runtime observation for presentation and bounded inspection for
self-describing data. Do not begin with unrestricted decompilation or attempt to
recreate the original source tree. Static evidence is strongest when a focused
finding and controlled observation agree.

## Disposable headless workflow

Use task-specific variables rather than system option names:

```powershell
$projectGhidraHome = '<absolute-ghidra-directory>'
$projectJavaHome = '<absolute-jdk-directory>'
$ownedExecutable = '<absolute-owned-executable>'
$env:GHIDRA_HOME = $projectGhidraHome
$env:JAVA_HOME = $projectJavaHome
$env:Path = "$projectJavaHome\bin;$projectGhidraHome;$projectGhidraHome\support;$env:Path"
$analysisRoot = Join-Path $env:TEMP ('restoration-ghidra-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $analysisRoot | Out-Null
& "$projectGhidraHome\support\analyzeHeadless.bat" `
  $analysisRoot RestorationAnalysis `
  -import $ownedExecutable `
  -overwrite
```

Reuse the local project with `-process <executable-name> -noanalysis` and a
small script under `tools/ghidra`. Never redirect broad output into the
repository.

## Bounded query pattern

Prefer reusable scripts that accept explicit inputs and cap output:

- summaries for a small address list;
- references to explicit addresses or symbols;
- at most 256 bytes from one explicit address;
- scalar/string searches capped to reviewable results;
- decompiler literal matches within one selected function;
- one basic-block-sized decompile window, never stitched into a retained
  function;
- short instruction context that cannot cross the containing function;
- call-site filtering by an exact callee and known scalar arguments.

Script output is temporary navigation evidence, not proof or production input.
Ghidra pseudocode can misidentify types, reuse variables, and fold control flow;
inspect bounded instruction context when a conclusion depends on those details.

## Bounded reporting scripts

Every script under `tools/ghidra` is a navigation aid for a small, reviewable
question. Each caps its output so a mistake cannot dump the whole executable.
Their output is navigation metadata, never proof of a rule; trace each finding
and confirm it against controlled original-game observations before changing
compatibility logic. Never redirect broad output into the repository.

| Script | Arguments | Reports |
| --- | --- | --- |
| `ReportStringReferences.java` | case-insensitive string fragments | at most 100 matching defined strings and 100 references per match |
| `ReportSymbolReferences.java` | symbol-name fragments | bounded navigation for known imports or symbols |
| `ReportScalarConstants.java` | decimal or `0x`-prefixed scalars | at most 300 instructions containing them |
| `ReportReferences.java` | explicit addresses | references to them and their containing functions |
| `ReportDataBytes.java` | one address and a byte count (1-256) | the raw bytes at that address |
| `ReportFunctionSummary.java` | one or more function addresses | focused decompiler output for the selected addresses |
| `ReportDecompileMatches.java` | one function address then literal text | at most 240 lines with two lines of context |
| `ReportDecompileWindow.java` | one function address, one-based start line, count (1-160) | a selected basic-block-sized decompiler window |
| `ReportInstructionWindow.java` | one address and an instruction count (1-200) | a forward instruction listing |
| `ReportInstructionContext.java` | instruction addresses | at most eight instructions on either side within the function |
| `ReportCallArguments.java` | one callee address | the three nearest pushed arguments at each direct call |
| `ReportCallSitesWithScalars.java` | one callee address then exact scalars | calls whose preceding argument setup contains one of the values |
| `ReportRandomnessCandidates.java` | none | at most 100 candidate timing/random imports and 100 referencing functions each |
| `ReportCallPaths.java` | start function, target function, maximum depth (1-12) | bounded direct-call paths with fixed edge and result caps |
| `ReportConstantFirstArgumentCalls.java` | callee address and exact scalar | x86 cdecl calls whose immediately pushed first argument matches |
| `ReportFirstArgumentCallSummary.java` | one callee address | immediate x86 cdecl first-argument values and non-literal follow-ups |
| `ReportFunctionScalarConstants.java` | function address and exact scalars | at most 200 matching instructions inside that function |
| `ReportCallsToRange.java` | inclusive start and end addresses | at most 50 calls or jumps whose target lies in the selected range |
| `ReportFilePatternInMemory.java` | executable file offset and optional byte count | at most eight loaded-memory matches and ten references per match |
| `ReportMemoryBlockForFileOffset.java` | executable file offset | the matching loaded block and translated address, if any |
| `ReportJumpTable.java` | NE16 table address, count (1-128), optional dispatch | bounded word-indexed segmented jump targets |

Use the narrow scripts to locate line numbers and addresses, then request only
the explicitly selected decompiler or instruction windows. Do not stitch
adjacent windows together to reconstruct or retain a complete function.

### Cross-edition comparison

The four `Export*.java` scripts support reproducible local comparison of two
legally owned executable editions:

- `ExportEditionAnalysis.java` writes deterministic function, instruction, and
  reference inventories labelled with executable SHA-256 and Ghidra version;
- `ExportVersionTrackingMatches.java` records Ghidra Version Tracking matches;
- `ExportVersionTrackingAddressContexts.java` adds bounded address context to
  selected matches;
- `ExportFunctionAddressCorrelations.java` correlates explicitly supplied
  address pairs between editions.

Unlike the narrow reporting scripts, the first two can produce broad
whole-program inventories. They therefore reject output paths outside the
system temporary directory or an ignored `analysis/original/` directory. Their
TSV output is local navigation material: never commit it, cite it as proof, or
use it as production input. Record only independently worded, bounded findings
and corroborate them through controlled observation.

For segmented NE executables, prefer `segment:offset` addresses and the bounded
instruction, range, jump-table, and file-offset helpers when the decompiler
cannot recover a function. An empty or failed decompile is a tool limitation,
not evidence that the original behavior is absent.

## Checking cited addresses

`Restoration.Inspect citations` reads every Markdown file under a directory,
collects the addresses it cites, and checks each one against the owned
executable they came from. A mistyped address, or one copied from notes about
a different edition, fails the check before anyone builds on it.

```powershell
dotnet run --project tools/Restoration.Inspect -- citations `
  --executable analysis/original/<game>.exe `
  --docs docs `
  --sha256 <expected-sha256> `
  --build BLD-<alias> `
  --instructions <temp>/<edition>.instructions.tsv `
  --report docs/address-citations.csv
```

An address is cited when it is written the way the documentation standard
requires: `0x` and eight hex digits, or a neutral name such as `fn_00478CD0` or
`g_004C1F20`. Plain `0x` values count only within 16 MiB above the image base,
so file offsets and ordinary constants are left alone. The end of a half-open
range (`0x00401000..0x00401200`) is checked as the byte before it.

Without other options the check reports which section holds each address, and
fails for addresses outside every section. The options add:

- `--sha256` refuses an executable with a different hash;
- `--build` skips files whose front matter names other builds and not this one,
  so a repository that documents two editions can check each against its own
  executable;
- `--instructions` takes the `*.instructions.tsv` written by
  `ExportEditionAnalysis.java` for the same executable (the hash in its header
  must match). Addresses in code are then reported as function entries,
  instruction starts, inside an instruction, or not disassembled, and a
  `fn_` name that is not a function entry fails;
- `--report` writes one CSV row per address with its section, classification
  and every file and line that cites it. The report holds no bytes from the
  executable, so it may be committed.

The check needs the owned executable, so it runs locally and never in CI. Run it
before committing findings. It reads PE32 executables only. NE (16-bit Windows)
and LE/LX (DOS extender) executables use segmented or object-relative
addresses, which it rejects with a message saying so.

The check started as `tools/validate_native_citations.py` in the Enemy
Infestation restoration (`kibertoad/enemy-reinfestation`), which validated
about 700 addresses against the v1.195 `Ei.exe`. That script matched only
unprefixed `004xxxxx` addresses and wrote 16 original bytes per address into
its committed report. This version follows the documentation standard's
notation and leaves the bytes out.

## DOS-extender executables

DOS games built with a DOS extender (DOS/4GW, DOS16M and similar) ship a 32-bit
Linear Executable behind an MZ stub. Ghidra's importer loads the outer MZ
program and does not map the embedded LE objects correctly, so its default
disassembly of such a file is wrong and must not be used as evidence.

The Conqueror A.D. 1086 restoration (`kibertoad/reconqueror1086`) solves this
without Ghidra. `src/Conqueror.Resources/LinearExecutableFixups.cs` finds the
nested MZ module that owns the LE header, applies module-relative page offsets,
maps LE virtual addresses through the object and page tables, and decodes the
fixup tables. `tools/Conqueror.Inspect` then disassembles selected addresses
with the [Iced](https://github.com/icedland/iced) decoder and reports data
references found through the fixups. Its `docs/ghidra.md` records the offsets
for the GOG build and the one easy mistake: adding the page offset to the LE
header position instead of the module start puts every page `0x2AA8` bytes off
in that build.

This code is not in the template yet. Copy it from that repository when a
second DOS-extender game needs it, and move it here at that point.

## Watching the original run

Some questions are answered faster by watching the original than by reading it:
the value of a global after the generator runs, the order of calls during a
load, what a seed produces. The general-purpose runtime tools are still being
compared (see
[Methodology](https://dinorefurb.com/methodology/#studying-the-original)), so
the template does not ship one.

The Magic & Mayhem restoration (`kibertoad/magic-and-mayhem-again`) has a
working example in `tools/MagicMayhemAgain.OriginalCapture`, documented in its
`docs/ORIGINAL-RUNTIME-CAPTURE.md`. It checks the SHA-256 of the owned
executable before launch, starts the game as its own child under the Windows
debugging API, places INT3 breakpoints at chosen addresses, reads the child's
memory when they hit, writes the result as JSON, and ends the process. It never
attaches to another process or changes the executable on disk, and CI never
runs it. The breakpoints and memory layouts in it are specific to that game;
the launch, hash check and breakpoint loop are the parts worth copying.

## Evidence record

For each useful finding record:

- a stable ID and the exact question;
- executable edition, length, and SHA-256;
- Ghidra/JDK versions and load settings;
- virtual/file address or bounded range and call relationship;
- constants, comparisons, reads/writes, and operation order in independent words;
- competing interpretations and rejected hypotheses;
- confidence: `unknown`, `low`, `medium`, `high`, or `verified`;
- controlled runtime/data corroboration;
- production entry point and synthetic test once implemented.

An interpretation remains provisional until independent evidence supports its
semantics. Production code uses repository-owned names and architecture, never
addresses or copied decompiled structure.

## Clean-room boundary

- Keep executables, projects, dumps, listings, and captures under ignored
  `analysis/original/`, the documented temporary-project pattern, or another
  local-only location.
- Commit only independently written findings, bounded reusable scripts, and
  synthetic tests.
- Never copy decompiled implementation or raw disassembly into production or
  documentation.
- Never make production load, execute, or depend on the original binary.
