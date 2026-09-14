# Ghidra setup for clean-room analysis

Ghidra is used only as a research tool against a legally owned local copy of the
original game. Ghidra projects, proprietary binaries, byte dumps, and full
disassembly or decompiler output must never be added to Git. Pin the Ghidra
version and the executable SHA-256 in `docs/SOURCE-EDITIONS.md`, and keep the
projects and binaries under ignored `analysis/original`.

## Headless workflow

Set `GHIDRA_HOME` and `JAVA_HOME` to the installed tools, prepend both tool
directories to `PATH`, and create each project in a unique directory under the
system temporary directory. Import the owned executable directly:

```powershell
$env:GHIDRA_HOME = '<path to Ghidra>'
$env:JAVA_HOME = '<path to a compatible JDK>'
$env:Path = "$env:JAVA_HOME\bin;$env:GHIDRA_HOME;$env:GHIDRA_HOME\support;$env:Path"
$projectRoot = Join-Path $env:TEMP ('ghidra-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $projectRoot | Out-Null
& "$env:GHIDRA_HOME\support\analyzeHeadless.bat" `
  $projectRoot Analysis `
  -import 'C:\path\to\Original Game.exe' `
  -overwrite
```

Reuse the resulting temporary project for focused scripts without reimporting:

```powershell
& "$env:GHIDRA_HOME\support\analyzeHeadless.bat" `
  $projectRoot Analysis `
  -process 'Original Game.exe' `
  -noanalysis `
  -scriptPath "$PWD\tools\ghidra" `
  -postScript ReportRandomnessCandidates.java
```

Isolated processes may not inherit the user's environment. A sandboxed process
that cannot write Ghidra's persisted Java home or preferences will fail before
analysis; rerun the same narrowly scoped analyzer command with the required
user-level permission rather than reinstalling either tool.

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
| `ReportRandomnessCandidates.java` | none | candidate timing/random imports and their referencing functions |

Use the narrow scripts to locate line numbers and addresses, then request only
the explicitly selected decompiler or instruction windows. Do not stitch
adjacent windows together to reconstruct or retain a complete function.

## Evidence discipline

- Record the executable hash, Ghidra version, virtual address, call
  relationship, observed constants, and an independent behavioral description.
- Never copy decompiled implementation into production. Reimplement factual
  behavior independently using project naming and structure.
- Store stable findings in the format and rules documents, not in scripts.
- Mark an interpretation Provisional until static evidence and a controlled
  observation agree.
- Do not commit temporary Ghidra projects, proprietary resources, executable
  bytes, full disassemblies, or decompiler dumps.
