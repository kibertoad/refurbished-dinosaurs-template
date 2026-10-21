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
- the exact owned executable's edition, path, length, xxh3, and format;
- a narrow disposable-project pattern below `%TEMP%`.

Check documented local paths before searching or downloading tools. Isolated
processes may need `GHIDRA_HOME`, `JAVA_HOME`, and an explicit `PATH`.
If sandboxing prevents Ghidra from persisting user preferences, request only the
necessary user-level permission rather than reinstalling it.

Always verify executable length and xxh3 (`xxhsum -H2`, or `Restoration.Inspect --source`)
against its build entry before interpreting an address.
Another version of the executable is another build, with its own
`spec/builds/` entry, and a finding lists it only when it was checked there
too, with a location in each build. Addresses are written in the
[notation](upstream/documentation-standard.md#notation) (lines 387-428) for the
executable's format: the full virtual address at the header's image base for
PE, and `segment:offset` for MZ, COM, and NE, with the load segment the
standard fixes for each.

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
small bounded script. `scientific-method-engine ghidra-scripts` prints the
directory of the scripts the engine ships, and `tools/ghidra` holds the few it
does not; pass both to `-scriptPath`, separated by `;`:

```powershell
$scripts = "$(scientific-method-engine ghidra-scripts);$PWD\tools\ghidra"
& "$projectGhidraHome\support\analyzeHeadless.bat" `
  $analysisRoot RestorationAnalysis -process <executable-name> -noanalysis `
  -scriptPath $scripts -postScript ReportReferences.java 0x1234
```

Never redirect broad output into the repository.

Put each run's bounded transcript/exports in a dedicated ignored output
directory with provenance and an active marker. Once its findings, failure
limits and regeneration procedure are recorded and committed, remove that
reviewed directory under [ANALYSIS-OUTPUTS.md](ANALYSIS-OUTPUTS.md). Preserve
the canonical validated project, source executable and unresolved reports.

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

Every script is a navigation aid for a small, reviewable question. Each caps
its output so a mistake cannot dump the whole executable. Their output is
navigation metadata, never proof of a rule; trace each finding and confirm it
against controlled original-game observations before changing compatibility
logic. Never redirect broad output into the repository.

The engine's README lists the arguments and caps of every script it ships, in
its [Ghidra script catalog](https://github.com/kibertoad/refurbished-dinosaurs-toolkit/blob/main/packages/scientific-method-engine/README.md);
read it at the version `requirements-evidence.txt` pins. Report fixes to those
scripts to the toolkit rather than copying them here. `tools/ghidra` holds:

| Script | Arguments | Reports |
| --- | --- | --- |
| `ReportJumpTable.java` | NE16 table address, count (1-128), optional dispatch | bounded word-indexed segmented jump targets |
| `CorrectNearTransfers.java`, `ApplyDeclaredEntries.java`, `ApplyDeclaredFlows.java` | see [Near transfer targets in 16-bit code](#near-transfer-targets-in-16-bit-code) | changes the program; addresses and counts only |
| `ExportEditionAnalysis.java`, `ExportFunctionAddressCorrelations.java`, `ExportVersionTrackingAddressContexts.java`, `ExportVersionTrackingMatches.java` | see [Cross-edition comparison](#cross-edition-comparison) | local comparison exports |

Use the narrow scripts to locate line numbers and addresses, then request only
the explicitly selected decompiler or instruction windows. Do not stitch
adjacent windows together to reconstruct or retain a complete function.

### Cross-edition comparison

The four `Export*.java` scripts support reproducible local comparison of two
legally owned executable editions:

- `ExportEditionAnalysis.java` writes deterministic function, instruction, and
  reference inventories labelled with the executable's SHA-256 (the only file hash
  Ghidra records; `citations` checks it against the executable itself, so nobody
  copies it by hand) and Ghidra version;
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
  --docs spec `
  --xxh3 <xxh3 from the build manifest> `
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

- `--xxh3` refuses an executable whose xxh3 differs from the one its build
  entry gives;
- `--build` skips files whose front matter names other builds and not this one,
  so a repository that documents two editions can check each against its own
  executable. A finding that lists both builds has addresses from each, and
  those from the other build are checked against this executable too, so
  review failures in such files by hand;
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

## Near transfer targets in 16-bit code

A near relative call or jump (`E8`, `E9`, `EB`, `70`..`7F`, `E0`..`E3`,
`0F 80`..`0F 8F`) keeps `CS`, so its target is `CS:((IP after it +
displacement) & FFFF)`. Ghidra 12.1.3 adds the displacement to the
instruction's linear address and wraps the sum at that address's 64K linear
page instead. Where a segment straddles a linear `0x?0000` boundary, a
transfer whose target lies on the other side of the boundary gets a target 64K
away: Ghidra creates functions there from nothing, and the code the transfer
reaches stays undecoded or is cut off at a false start. Near indirect jumps
(`FF /4`) get computed targets outside their `CS` the same way. In a synthetic
MZ, `EB` short jumps across the boundary got the right target and `E8` calls
and `E9` jumps did not; the correction checks every form. In the Dark Sun restoration (`kibertoad/dark-sun-wake-redux`)
it hit 189 of about 30,800 near transfers and left 19,117 instructions that a
walk from the game's entries reaches outside the function inventory; with the
correction and the declared entries and flows below, 14 were left. A SLEIGH
fix is proposed on the `kibertoad/ghidra` fork. Until a project analyses with
a Ghidra that has it, run the correction on every 16-bit segmented view whose
code crosses a linear 64K boundary; an MZ load image of 64K or less loaded at
segment `0x1000` does not.

`CorrectNearTransfers.java` takes `CS` for each instruction from a segment map
the project supplies, finds the transfers whose flows lack the `CS` target,
and in `apply` mode replaces their references, decodes the real targets,
creates functions at real call targets and removes the functions that only
wrong targets named. `report` prints the same lines and changes nothing. Its
header comment lists every line it prints and every change it makes. A
declared entry is never removed. `ApplyDeclaredEntries.java` and
`ApplyDeclaredFlows.java` apply the function starts and control flow that
findings establish and Ghidra misses. All three take Ghidra-view
`segment:offset` addresses; converting overlay file offsets or another
loader's addresses to the view is the project's own step, done when the files
are written. `tests/upstream/near-transfers.test.mjs` covers the target
arithmetic and the readers of all three inputs.

### Segment map

The segment map names each code segment by the segment value the Ghidra view
uses, after relocation at the view's load segment, and the half-open span of
offsets its code occupies. The project derives it from what defines its
segments: the MZ relocations and the entry `CS`, a linker map, or an overlay
manager's segment table. The template reads none of those formats; a
project-owned script writes the map from them and its finding records how. A
`.json` file has the form of `tools/ghidra/segment-map.example.json`:

```json
{
  "schema": "restoration-segment-map-v1",
  "segments": [
    { "segment": "1F00", "start": "0000", "end": "10000" }
  ]
}
```

`segment` and `start` are one to four hex digits and `end` up to `10000`,
without a `0x` prefix; `about`, `build`, `file` and `evidence` at the top and
`name` and `evidence` on a row are notes. A `.tsv` file has the header
`segment`, `start`, `end` and one row per segment, and `#` lines are comments.
Spans that overlap in linear memory are refused, since a linear address would
then have two `CS` values. An instruction outside every span, or in an address
space other than the default one (an overlay block), takes the segment its
memory block starts at, and the summary counts those lookups as `block_cs`.

### Declared entries

`tools/ghidra/declared-entries.example.json` is the empty form. `entries` lists
function starts as `{ "at": "SSSS:OOOO" }`. `remove` lists false starts as
`{ "starts": [...], "clear": "SSSS:OOOO..SSSS:OOOO", "owner": "SSSS:OOOO" }`:
the functions at `starts` are removed, the half-open `clear` range is cleared,
and the optional `owner` function decodes it again from its own flows. Items
may carry `reason` and `evidence`; the top level may carry `about`, `build`,
`file` and `evidence`. Any other key is refused, so a misspelt field fails the
run.

### Declared flows

`tools/ghidra/declared-flows.example.json` is the empty form. Its four lists
are:

- `jumps`: `{ "site": ..., "targets": [...] }`, a computed jump and every
  target its table can give. Other computed targets of the site are removed.
  `table` and `bound` record where the table is and what bounds its index.
- `decode`: `{ "range": "A..B", "owner": ... }`, a run of code to decode as
  consecutive instructions from `A`, clearing what Ghidra decoded out of step
  there; the optional `owner` function has its body recomputed.
- `returns`: `{ "function": ..., "reason": ... }`, a function Ghidra marks as
  not returning that does return; calls to it get their fall-through back.
- `fallThroughs`: `{ "at": ..., "reason": ... }`, an instruction that falls
  through to the byte after it.

Items may carry `reason` and `evidence`. In both declared files an item with
`"view": "<name>"` applies only when the script is given that view name as its
last argument, so one file can serve a project's several views; an item
without `view` applies to every view.

Each declared item cites the finding that establishes it. The files hold
addresses, reasons and entry IDs only, like an inventory, so a project keeps
them in `tools/ghidra/` beside the finding that supports each item and changes
them, never the exported inventory, to add or drop a start or a flow.

### Where the procedure runs them

Run the scripts on a copy of the analysed snapshot, without `-readOnly`, after
any project-specific steps that add blocks or functions (overlay blocks,
trampolines) and before the inventory export:

```powershell
& "$projectGhidraHome\support\analyzeHeadless.bat" `
  $analysisRoot RestorationAnalysis -process <executable-name> -noanalysis `
  -scriptPath $scripts `
  -postScript CorrectNearTransfers.java apply $segmentMap $entries `
  -postScript ApplyDeclaredEntries.java $entries `
  -postScript ApplyDeclaredFlows.java $flows `
  -postScript CorrectNearTransfers.java apply $segmentMap $entries
```

The correction runs twice. The first run removes the false functions and
decodes the real targets before the declared entries and flows are applied, so
a declared range is not cleared against code that only a wrong target made.
The declared flows then decode new code, and Ghidra gives the near transfers in
it wrapped targets again, which the second run corrects. A `report` run after
the second lists any transfer still wrong, which can happen when the second
run's own decoding reaches new code; run `apply` again until `report` prints
`wrong=0` and `outside=0`. Pass the view name after
each declared file when the files name views. Keep the transcripts with the
export's provenance; they hold addresses and counts only.

## Watching the original run

Some questions are answered faster by watching the original than by reading it:
the value of a global after the generator runs, the order of calls during a
load, what a seed produces. The general-purpose runtime tools are still being
compared (see
[Methodology](upstream/methodology.md#studying-the-original) (lines 24-32)), so
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

Each useful result becomes a finding entry, `spec/findings/FND-<AREA>-<NNN>.md`,
in the form `docs/SPEC-ENTRY-TEMPLATES.md` gives. Its `builds` and `locations`
name the build entry, whose xxh3 identifies the executable, and give each
address range in the notation for the executable's format. `tool` gives the
Ghidra version, and `environment` stays `null` because the finding is static.
The Observation section states the constants, comparisons,
reads and writes, and the order of calls in independent words, the
Alternatives section the readings that were ruled out or not yet ruled out,
and How to reproduce the entry address and the string or constant that leads
to it. Decompiler line numbers are never a location.

A finding is evidence, not a claim. The rule or format it supports stays
`supported` until a run of the original agrees with it, which makes it
`established`. Production code uses repository-owned names and architecture,
never addresses or copied decompiled structure, and cites the spec IDs it
implements.

## Clean-room boundary

- Keep executables, projects, dumps, listings, and captures under ignored
  `analysis/original/`, the documented temporary-project pattern, or another
  local-only location.
- Commit only independently written findings, bounded reusable scripts, and
  synthetic tests.
- Never copy decompiled implementation or raw disassembly into production or
  documentation.
- Never make production load, execute, or depend on the original binary.


## Bounded evidence reports

Use [the evidence tooling guide](EVIDENCE-TOOLS.md) for MZ/FBOV operand
resolution, explicit control-flow review, bounded tables and function inventory
joins. The engine's `ExportFunctionInventory.java` writes a function inventory,
with its `.provenance.tsv` and `.regions.tsv`, to its `coverage/` path from one
view; its arguments are in the engine's catalog. For a 16-bit segmented view
whose code crosses a linear 64K boundary, run the near-target correction and
the declared entries and flows on the snapshot first, in the order
[Where the procedure runs them](#where-the-procedure-runs-them) gives. Ghidra gives a function's or a
block's maximum address as its last byte, while the standard writes every range
half-open, so a body whose last byte is `0x0045E7CD` is cited as
`..0x0045E7CE`. Raw operands and analyzer boundaries remain observations to verify.
The report tools do not promote spec status or establish native reachability.


## Large memory maps and JVM diagnostics

ReportMemoryBlocks.java accepts `page <zero-based-start> <count>` (count 1..512) or `name <exact-name>`. Page ordering is the current program's block order; repeat queries against the same unchanged analysis. The header reports total blocks, starting index, emitted count and whether the selection is partial; a page header also reports the requested count, so a page ending past the map is visibly clipped. Start equal to total emits an empty page. Whole-map requests above 512 fail rather than silently truncate. Exact names reject missing blocks, and ambiguous names list the matching indices to page to. Reports stay in GAME_DIR; no code or bytes are emitted.

JVM fatal-error/replay logs and heap dumps (`*.hprof`) are ignored and rejected by repository policy (`deniedFileNamePatterns` in `tools/repository-policy.json`) even when force-staged, at any directory depth. Start analysis with `-XX:ErrorFile=<local-only-dir>/hs_err_pid%p.log`, `-XX:ReplayDataFile=<local-only-dir>/replay_pid%p.log` and, when heap dumps are enabled, `-XX:HeapDumpPath=<local-only-dir>` in the analysis JVM options (`JAVA_TOOL_OPTIONS` for that invocation); choose GAME_DIR/analysis or a unique temporary directory, never a tracked output. Logs do not prove task ownership or a live process; inspect PID, command line and task provenance before any cleanup.
