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

Work in this order.

**0. Establish the facts.** Identify the original game, its developer, release
year, genre, and the editions the owner legally has. Record which storefronts or
media they came from, and what research already exists (manuals, community
documentation, prior reverse-engineering). Ask the owner for anything you cannot
determine; never invent an edition, a fingerprint, or a file format.

Confirm once that the game qualifies: it was released in 2004 or earlier, and no
official remake or remaster of it is on sale. If either fails, stop and tell the
owner. Record the outcome and its evidence in the Eligibility row of
`docs/IMPLEMENTATION-PLAN.md`.

Refusal gates (eligibility, and the latest-version gate below) are checked once.
After the outcome is recorded, treat it as established truth: do not re-check
it in later sessions or before later operations unless the owner asks for it.

Before any executable analysis, conclusively determine the latest official
patch/version from authoritative release media, publisher/developer material, or
corroborated archival evidence. Patch the legally owned analysis copy to that
version, fingerprint it, and record the version, patch provenance, file length,
and SHA-256 in `tools/project-config.json`, `docs/SOURCE-EDITIONS.md`, and
`docs/GHIDRA.md`, and write its build entry, `spec/builds/BLD-<alias>.md`.
Refuse analysis of an older build: doing so creates avoidable address maps and
later version-migration work. Once the latest-version status is recorded
(`patchStatusEstablished: true`), it is settled: do not repeat the
investigation unless the owner asks for it.

**1. Write the implementation plan.** Fill in `docs/IMPLEMENTATION-PLAN.md`: the
game profile, the scope and non-goals, the ordered vertical slices with
acceptance criteria, the risks, and the open questions.

**2. Configure the project identity.** Fill in `tools/project-config.json` and
run `./tools/Bootstrap-Project.ps1`; it enforces the plan and latest-version
gates, invokes configuration, and verifies the result.
`docs/CUSTOMIZATION.md` documents every field and every derived default. Do not
hand-edit placeholders the script can substitute.

**3. Record what is known about the original.** Fill in `spec/README.md` (scope
and area list) and start the spec: a build entry per edition, a source entry per
manual, FAQ, or earlier tool relied on, and `unknown` rule, format, and screen
entries for what the first slice needs. `docs/SPEC-ENTRY-TEMPLATES.md` has a
blank entry of each kind. Give each entry the status its evidence supports;
`unknown` is a valid answer and a plausible-sounding guess is not.

**4. Make extraction real.** Replace the sample manifest under
`src/<Project>.Extractor/source-manifests/` with one fingerprint manifest per
supported edition, extend `tools/repository-policy.json` with the extensions the
original actually uses, and make a missing or unsupported source produce an
actionable error rather than a crash. The separately runnable Extractor verifies
a licensed source and transactionally creates a complete local asset pack; the
Game consumes only that verified pack.

**5. Build the first vertical slice.** Follow the plan. Prefer a thin
end-to-end slice — identify, extract, start, show something real, quit cleanly —
over broad but unplayable systems.

**6. Verify and hand over.** Run the commands below, update the README status
table and `PARITY.md` to match what is actually true, and tick off
`docs/BOOTSTRAP-CHECKLIST.md` as decisions are captured elsewhere.

## Rules that never bend

- **No original content in Git, ever.** No assets, executables, archives,
  screenshots, video or audio captures, or data extracted from them, and no save
  or recording that holds any of the game's content. `UserContent/`,
  `analysis/original/`, and `reference/original/` are local-only, and
  `tools/Verify-Repository.ps1` enforces this. Synthetic fixtures go under
  `tests/fixtures/synthetic/`.
- **Clean room.** Do not copy original source, decompiler output, disassembly,
  byte dumps, or analysis databases into this repository. Describe behavior and
  data formats in your own words in `spec/`, and write the implementation from
  that description. Do not translate the original machine code into matching
  source, and do not patch the original executable one function at a time.
- **Evidence before claims.** Every spec entry cites the findings, experiments,
  and sources its status requires. Evidence from the original that contradicts
  an entry makes it `disputed`, with both sides cited, until new evidence
  settles it.
- **CI never needs proprietary content.** Every packaging check, and every test
  that does not compare against the original, passes on a machine with no copy
  of the game. Tests that read the original find it through `GAME_DIR` and
  report themselves skipped when it is absent.
- **Parse defensively.** Original files are untrusted input: bound every length,
  reject path traversal, and fail with a diagnosable error instead of throwing
  from deep inside a reader.

## Reverse-engineering discipline

The project follows the [methodology](https://dinorefurb.com/methodology/) and
the [documentation standard](https://dinorefurb.com/documentation-standard/)
published at dinorefurb.com. This section and the next two summarize them;
where they differ, the published pages win.

Start with one narrow player-visible question. The executable has the final word
on what the shipped game does. The manual says what the designers intended and
is often wrong about what shipped, and FAQs, wikis, and other fans' tools are
leads to credit and re-check. For a non-trivial rule: state the question, locate
evidence, form competing hypotheses, seek falsifying evidence, corroborate
against the original running, then implement it with a deterministic test.

An experiment starts from a saved state, usually a save patch, changes one
input, and records what follows. It is repeated from the same state with the
random number generator's state varied between runs. Anything random gets
enough repetitions for a recorded distribution, because a formula inferred from
one roll is a guess.

Use the standard's statuses and no other scale. Rules, formats, screens, and
bugs are `unknown`, `sourced` (outside sources only), `supported` (one kind of
evidence from the original), `established` (a reading of the files and a run of
the original agree), `disputed`, or `superseded`. Findings and experiments are
`recorded`, `reproduced`, or `superseded`. A part of an entry that is less
certain than the rest goes in its own entry or in its Open questions section.
Never silently promote a plausible interpretation.

Unidentified functions, globals, fields, and scripts keep neutral names
(`fn_00478CD0`, `g_004C1F20`, `unk_2A`) until a finding or experiment shows what
they do, because a wrong name given early steers every later reading. Decompiler
output is not source: inferred names, types, signedness, casts, and control flow
can be wrong, so inspect bounded instruction context when the distinction
matters.

Durable findings go in `spec/`, one entry per file named after its ID, and not
in conversation history or large retained dumps. IDs are never reused or
renumbered, and an entry that turns out wrong becomes `superseded`. The spec
describes the original only and never names a class, file, or setting from this
repository. It never reproduces content: texts, images, sounds, maps, scripts,
the per-unit or per-item statistics a designer filled in, or the names of
individual things a designer made, such as a unit, an item, a site, or a
character (an enumeration of those is named `UNIT_TYPE_3`, not by the unit's
name). The names the game gives its concepts and mechanics are terms the spec
uses, and constants the code does arithmetic with are written down in full. Tool procedure stays in `docs/GHIDRA.md`. Never commit broad
decompiler, instruction, or Version Tracking exports.

## Fidelity

The spec records the original exactly, bugs included. The rebuild keeps the
rules, balance, content, AI, and pacing, including asymmetries, rounding,
ordering, timing, overflow behavior, and quirks players built strategies
around. Crashes, corrupted saves, game speed tied to the CPU clock, and logic
that plainly does not do what it was written to do may be fixed. An interface
change may add information or remove friction, and may not change what the
player can do or what the rules produce. Screens match the original pixel for
pixel except where a documented interface change draws something new. When a
bug cannot be told from a design decision, the original behavior stays and any
fix becomes a setting.

Every departure from the spec is a `DEV-AREA-NNN` entry in `DEVIATIONS.md`,
with a Default of `off`, `on` or `mandatory`. A setting starts `off`, with the
original's behavior, unless the entry's Justification argues that the rebuild's
behavior is strictly better: then it starts `on`, and a player who wants the
original switches it off. A deviation with no setting is `mandatory`, and its
Justification also says why the original's behavior is not worth a setting. The
fix of an unintended bug that players do not rely on is `on` without one. A
quirk that may be deliberate or that players rely on is never strictly better,
so its deviation starts `off`. The validation suite runs with every setting
switched off, and a test that reaches a mandatory deviation cites its ID and
allows for it. Rebalancing and new features belong in a separate mode or
project.

## Citing the spec

Code comments and tests cite the spec IDs they implement or check, so a search
for an ID finds everything that depends on it. A placeholder in the code, such
as a guessed formula, carries a `PLACEHOLDER: <spec ID>` comment, and the
`PARITY.md` row for that ID cannot be `complete` while it does. `PARITY.md` has
one row per rule, format, and screen entry that is not superseded, so behavior
without a spec entry gets an `unknown` entry before any code. Manual play never
counts as a test.

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
behavior has tests, the spec entries it relies on exist with the status their
evidence supports, the documents that assert status (`README.md`, `PARITY.md`,
`DEVIATIONS.md`) match reality, and the plan's open questions have been updated
with whatever the work settled or newly raised.

Commits describe the change and its evidence, not the tooling that produced it.
