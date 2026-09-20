# Agent instructions

> **Provisional template policy.** During bootstrap, review this entire file,
> preserve the universal safety and evidence rules, replace template terminology
> and commands with game-specific details, add the canonical owned-edition and
> local-tool facts, and record that review in `docs/BOOTSTRAP-CHECKLIST.md`.

These instructions apply to the whole repository and to humans and coding agents
alike. Read them before changing anything.

This repository is a template for clean-room MonoGame restorations of classic
games. A checkout is in one of two states, and
`tools/project-config.json` says which:

- **Unconfigured template** (`"configured": false`): generic scaffolding with
  `{{PLACEHOLDER}}` tokens and `Restoration.*` project names. Changes here must
  stay game-agnostic and keep working for every future project.
- **Configured project** (`"configured": true`): a restoration of one specific
  game. Changes here are game-specific and must keep the evidence trail intact.

## Specializing this template for a game

Work in this order. Steps 2 onward start only after the plan is approved.

**0. Establish the facts.** Identify the original game, its developer, release
year, genre, and the editions the owner legally has. Record which storefronts or
media they came from, and what research already exists (manuals, community
documentation, prior reverse-engineering). Ask the owner for anything you cannot
determine; never invent an edition, a fingerprint, or a file format.

Before any executable analysis, conclusively determine the latest official
patch/version from authoritative release media, publisher/developer material, or
corroborated archival evidence. Patch the legally owned analysis copy to that
version, fingerprint it, and record the version, patch provenance, file length,
and SHA-256 in `tools/project-config.json`, `docs/SOURCE-EDITIONS.md`, and
`docs/GHIDRA.md`. Refuse analysis of an older build: doing so creates avoidable
address maps and later version-migration work. Once the latest-version status is
conclusively established and documented, treat it as a durable fact; do not
repeat the same investigation unless new contradictory evidence appears.

**1. Write the implementation plan.** Fill in `docs/IMPLEMENTATION-PLAN.md`: the
game profile, the scope and non-goals, the ordered vertical slices with
acceptance criteria, the risks, and the open questions.

**2. Configure the project identity.** Fill in `tools/project-config.json` and
run `./tools/Bootstrap-Project.ps1`; it enforces the plan and latest-version
gates, invokes configuration, and verifies the result.
`docs/CUSTOMIZATION.md` documents every field and every derived default. Do not
hand-edit placeholders the script can substitute.

**3. Record what is known about the original.** Replace the instructional text in
`docs/SOURCE-EDITIONS.md`, `docs/ORIGINAL-FORMATS.md`,
`docs/RULES-AND-EVIDENCE.md`, `docs/UI-ATLAS.md`, and `docs/FIDELITY.md` with
game-specific content, keeping each document's structure and confidence
vocabulary. State confidence honestly; `unknown` is a valid answer and a
plausible-sounding guess is not.

**4. Make extraction real.** Replace the sample manifest under
`src/<Project>.Extractor/source-manifests/` with one fingerprint manifest per
supported edition, extend `tools/repository-policy.json` with the extensions the
original actually uses, and make a missing or unsupported source produce an
actionable error rather than a crash. The separately runnable Extractor verifies
a licensed source and transactionally creates a complete local asset pack; the
Game consumes only that verified pack.

**5. Build the first vertical slice.** Follow the approved plan. Prefer a thin
end-to-end slice — identify, extract, start, show something real, quit cleanly —
over broad but unplayable systems.

**6. Verify and hand over.** Run the commands below, update the README status
table and `docs/PARITY-MATRIX.md` to match what is actually true, and tick off
`docs/BOOTSTRAP-CHECKLIST.md` as decisions are captured elsewhere.

## Rules that never bend

- **No original content in Git, ever.** No assets, executables, archives, save
  files, screenshots, or data extracted from them. `UserContent/`,
  `analysis/original/`, and `reference/original/` are local-only, and
  `tools/Verify-Repository.ps1` enforces this. Synthetic fixtures go under
  `tests/fixtures/synthetic/`.
- **Clean room.** Do not copy original source, decompiler output, or
  disassembly into this repository. Describe behavior and data formats in your
  own words, with the evidence recorded in `docs/RULES-AND-EVIDENCE.md` and
  `docs/GHIDRA.md`.
- **Evidence before claims.** A rule, format field, or parity claim needs a
  reproducible test or a recorded observation. Conflicting sources are preserved
  as a conflict, not silently resolved.
- **CI never needs proprietary content.** Every test and packaging check must
  pass on a machine that has no copy of the original game.
- **Parse defensively.** Original files are untrusted input: bound every length,
  reject path traversal, and fail with a diagnosable error instead of throwing
  from deep inside a reader.

## Reverse-engineering discipline

Start with one narrow player-visible question. Prefer manuals, controlled play,
and bounded data inspection before executable analysis. For a non-trivial rule:
state the question, locate evidence, form competing hypotheses, seek falsifying
evidence, corroborate against observable behavior, record the conclusion and
confidence, then implement it under the approved plan with a deterministic test.

Use the repository vocabulary `unknown`, `low`, `medium`, `high`, and
`verified`. Never silently promote a plausible interpretation. Decompiler output
is not source: inferred names, types, signedness, casts, and control flow can be
wrong, so inspect bounded instruction context when the distinction matters.

Faithfulness beats cleanup. Preserve meaningful asymmetries, rounding,
ordering, timing, overflow behavior, and bugs unless the approved fidelity
policy explicitly chooses otherwise. Separate verified reconstruction from
speculative enhancements.

Durable findings belong in the evidence ledgers, not conversation history or
large retained dumps. A configured project should customize a concise
`docs/re/` structure for findings, systems, hypotheses, unresolved questions,
and address/name mappings while keeping rules in `RULES-AND-EVIDENCE.md`, formats
in `ORIGINAL-FORMATS.md`, and tool procedure in `GHIDRA.md`. Never commit broad
decompiler, instruction, or Version Tracking exports.

## Context and process hygiene

Treat logs, analysis listings, and experiments as a temporary working set.
Summarize reusable conclusions into durable documentation, record remaining
unknowns, then discard obsolete intermediate state. Avoid unrelated refactors
during evidence-driven work. After commands that start games, servers, analyzers,
or compiler services, check for orphaned processes and stop only the processes
created by the current task.

## Architecture boundaries

- `<Project>.Core`: deterministic rules and serializable state. No MonoGame, no
  file-format parsing, no I/O.
- `<Project>.Resources`: bounded binary parsing and original-content contracts.
  No MonoGame.
- `<Project>.Game`: MonoGame DesktopGL presentation, and the only project that
  may depend on both of the above.
- `<Project>.Extractor`: separately runnable licensed-source verification and
  transactional asset extraction over `Resources`.
- `<Project>.Inspect`: read-only tooling over `Resources`.
- `<Project>.Tests`: architecture, safety, and behavioral tests.

Determinism is a feature: identical commands and seed must produce identical
state, because saves, replays, and parity validation depend on it. Every
compiled C# file is limited to 1,000 lines; split responsibilities instead of
raising the limit.

## Commands

```powershell
./tools/Verify-Configuration.ps1   # placeholders and template leftovers
./tools/Verify-Repository.ps1      # original-content and large-file policy
./tools/Invoke-Validation.ps1      # policy checks plus build and tests (fast gate)
dotnet build <Project>.slnx        # full solution
dotnet run --project src/<Project>.Game -- --smoke-test
```

`Invoke-Validation.ps1` is the canonical local validation entry point. Its
default fast gate skips tests tagged `Category=LongRunning`; run
`-IncludeLongRunningTests` only when the user asks for it or a change to that
coverage needs it. Add `-TestFilter` to narrow a run and `-MinimumExpectedTests`
to fail when discovery drops below an expected count.

## Definition of done

A change is finished when the solution builds, `./tools/Invoke-Validation.ps1` passes, new
behavior has tests that do not need original content, the documents that assert
status (`README.md`, `docs/PARITY-MATRIX.md`, `docs/FIDELITY.md`) match reality,
and the plan's open questions have been updated with whatever the work settled
or newly raised.

Commits describe the change and its evidence, not the tooling that produced it.
