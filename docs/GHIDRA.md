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
