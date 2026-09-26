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
acceptance criteria, the risks, and the questions only the owner can answer.

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
table and the parity files to match what is actually true, and tick off
`docs/BOOTSTRAP-CHECKLIST.md` as decisions are captured elsewhere.

## The local copy of the standard

`docs/standard/` holds the methodology, the documentation standard and the
work protocol as published at dinorefurb.com, and its README names the commit
they were copied from. Every reference to those pages in this repository
points at that copy.

- Read the local copy. Do not fetch dinorefurb.com, or the website's source
  repository, to read the methodology, the standard or the protocol.
- Assume the local copy is up to date and rely on it. A difference between it
  and the published pages is not a reason to go online during a task.
- A link such as `work-protocol.md#batches` names one section. Read only that
  section: search the page for its heading (`## Batches`) to get its line
  number, and read from there to the next heading of the same level. Read a
  whole page at most once per session, and never again for a section already
  in context.
- Checking whether a newer version has been published, and refreshing the
  copy, is always started by a person. Do it only when the owner asks for it
  in the current task, and then follow `docs/standard/README.md`.

## Planning and tracking work

Work is planned, tracked and handed on under the
[work protocol](docs/standard/work-protocol.md). Read the section a task needs
there; this list only gives where each thing lives in this repository.

- Stage: `docs/IMPLEMENTATION-PLAN.md`
  ([Stages](docs/standard/work-protocol.md#stages)). What can be done with the
  original running, and by whom: `docs/RUNTIME.md`
  ([Runtime access](docs/standard/work-protocol.md#runtime-access)).
- Open questions: `queue/<AREA>.md`, with IDs such as `Q-COMBAT-012`
  ([The queue](docs/standard/work-protocol.md#the-queue),
  [Order of work](docs/standard/work-protocol.md#order-of-work)).
- Runs of the original take the machine's run lock, whose path
  `docs/RUNTIME.md` gives
  ([Running the original](docs/standard/work-protocol.md#running-the-original)).
  Requests for a person's run go in `docs/live-sessions/`
  ([Live sessions](docs/standard/work-protocol.md#live-sessions)).
- Emulated calls use the harness in `tools/emu/`; any agent may build it and
  make them, whatever limits on runs of the game say
  ([Emulated calls](docs/standard/work-protocol.md#emulated-calls)).
- Reports from testers: `docs/reports/`, recorded with the `triage-report`
  skill. Screenshots of the rebuild go in `GAME_DIR/reports/`, of the original
  in `GAME_DIR/captures/`, never in Git
  ([Reports from testing](docs/standard/work-protocol.md#reports-from-testing)).
- Batches, commits and their `Spec:`, `Parity:` and `Queue:` trailers:
  [Batches](docs/standard/work-protocol.md#batches). Statuses and how a claim
  moves between them:
  [The life of a claim](docs/standard/work-protocol.md#the-life-of-a-claim).
- Handover: `docs/HANDOVER.md`, running goals in `docs/goals/`, the owner's
  decisions in `docs/DECISIONS.md`
  ([Sessions](docs/standard/work-protocol.md#sessions),
  [Coding agents and long-running goals](docs/standard/work-protocol.md#coding-agents-and-long-running-goals)).
- Progress is what scripts compute, never a hand-written percentage. Function
  inventories are committed as `coverage/<build ID>/<manifest path>.tsv`
  ([Measuring progress](docs/standard/work-protocol.md#measuring-progress)).

The procedures are skills in `.claude/skills/`: `runtime-access`,
`plan-work`, `start-session`, `research-item`, `implement-rows`,
`triage-report`, `live-session` and `end-session`. For a `/goal`, write the goal file with
`plan-work`, keep to its scope, and end every batch with the status block the
skills print.

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
  of the game. Tests that read the original find it through `GAME_DIR`,
  report themselves skipped when it is absent, and carry the comment
  `// needs: GAME_DIR`. They run on a maintainer's machine, and the run is
  recorded in `VALIDATION.md` (`docs/VALIDATION.md`).
- **Parse defensively.** Original files are untrusted input: bound every length,
  reject path traversal, and fail with a diagnosable error instead of throwing
  from deep inside a reader.

## Reverse-engineering discipline

The [methodology](docs/standard/methodology.md) and the
[documentation standard](docs/standard/documentation-standard.md) govern the
spec. Read the section a task needs; the points below are the ones every
session relies on.

- The executable has the final word on what the shipped game does; the manual
  and fan sources are leads
  ([Ground rules](docs/standard/methodology.md#ground-rules)).
- Use the standard's statuses and no other scale, and never promote a
  plausible interpretation
  ([Status](docs/standard/documentation-standard.md#status)).
- Unidentified functions and globals keep neutral names (`fn_00478CD0`,
  `g_004C1F20`) until evidence shows what they do
  ([Notation](docs/standard/documentation-standard.md#notation)).
- The spec describes the original only, never names a class, file or setting
  of this repository, and never copies the game's writing, art or code
  ([Where it lives](docs/standard/documentation-standard.md#where-it-lives),
  [Licence](docs/standard/documentation-standard.md#licence)). Blank entries
  of each kind are in `docs/SPEC-ENTRY-TEMPLATES.md`; tool procedure is in
  `docs/GHIDRA.md`.
- Never commit broad decompiler, instruction or Version Tracking exports. The
  function inventories in `coverage/` are the one export that is committed.

## Fidelity

What the rebuild keeps and what it may change is set by
[Where fidelity stops](docs/standard/methodology.md#where-fidelity-stops).
Every departure from the spec is a `DEV-AREA-NNN` file in `deviations/`
([Deviation log](docs/standard/documentation-standard.md#deviation-log)). The
validation suite runs with every setting switched off, and a test that reaches
a mandatory deviation cites its ID. Rebalancing and new features belong in a
separate mode or project.

## Citing the spec

Code comments and tests cite the spec IDs they implement or check. A guessed
formula carries a `PLACEHOLDER: <spec ID>` comment, and that parity row cannot
be `complete` while it does. `PARITY.md` holds the totals and `parity/` the
rows ([Parity matrix](docs/standard/documentation-standard.md#parity-matrix));
behavior without a spec entry gets an `unknown` entry before any code. Manual
play never counts as a test.

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

**Rules live in `Core`; screens map them.** Every decision the original makes —
a flag cascade, a gate, a branch table, an outcome selector, a state
transition — lives in `Core` as a pure function of the serializable state and
its inputs, even when only `Game` calls it. `Game` translates those decisions
into screens, art, input, and timing; a rule may not have `Game` as its only
home, and a rule already written inline in a screen handler is extracted the
first time it is touched. The placement test: if demonstrating a behavior needs a
window, a graphics device, or the asset pack, the rule is not in `Core` yet.

Implement each entry's branch table whole: every branch the entry describes
is handled by its Core function and has its own test, including the branches
`Game` cannot reach yet and the "impossible" arms of a guard. The branch that
lives only in a code comment is the one that gets implemented inverted. A
branch no entry describes is never a guess: it becomes a question in the
entry's Open questions and a `Spec gap:` note on the parity row, as the
`implement-rows` skill says.

Each rule ships with fast-gate tests over synthetic state. The rule itself is
usually a static class over the serializable state type, called by `Game`.
When a bug is traced to branch logic in `Game`, extract the rule into `Core`,
pin every branch with a test, and fix it there.

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
behavior has tests that exercise every branch its entry describes directly,
not only the branches a play session reaches, the spec entries it relies on
exist with the status their evidence supports, the documents that assert status
(`README.md`, `PARITY.md`, `parity/`, `deviations/`) match reality, and
`queue/` has been updated with whatever the work settled or newly raised.

Commits describe the change and its evidence, not the tooling that produced it.

## Evidence review and offline rules

Apply the claim-relevant procedure in [EVIDENCE-REVIEW](docs/EVIDENCE-REVIEW.md)
before asserting a complete reading. Verified offline copies and explicit
refresh instructions are in [UPSTREAM-RULES](docs/UPSTREAM-RULES.md). These
procedures retain Standard v1 and the published pages' authority.
