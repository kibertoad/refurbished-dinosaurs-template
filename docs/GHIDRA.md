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
