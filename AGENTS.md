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

Plans document authorized work; they do not require a separate explicit owner approval before implementation or tooling proceeds. Ask only for missing owner decisions that block the requested scope.

**2. Configure the project identity.** Fill in `tools/project-config.json` and
run `./tools/Bootstrap-Project.ps1`; it enforces the identity facts and latest-version
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

`docs/upstream/` holds the methodology, the documentation standard and the
work protocol exactly as published at dinorefurb.com, and
`tools/upstream-lock.json` names the commit they were copied from. Every
reference to those pages in this repository points at that copy.

- Read the local copy. Do not fetch dinorefurb.com, or the website's source
  repository, to read the methodology, the standard or the protocol, and do
  not go online because the published rules might have changed.
- Assume the local copy is up to date and rely on it. The template is updated
  when the website changes; until then the copy is the rules.
- Links inside the copy are the site's own: `/work-protocol/#emulated-calls`
  is `docs/upstream/work-protocol.md#emulated-calls`, and the same for
  `/methodology/` and `/documentation-standard/`. Only links to other pages of
  the site lead outside the copy.
- A link to a section gives its lines, such as
  `work-protocol.md#batches (lines 137-183)`. Read only those lines (with an
  offset and a limit), never the whole page for one section, and never a
  section again once it is in context. The lines include the section's
  subsections, so a link to a subsection inside one already read adds
  nothing. The upstream tests keep every range right; after a refresh,
  `node tools/upstream.mjs links --write` rewrites them.
- Skills and summaries in this repository are enough to do the work. Open a
  linked section only when a step leaves a question it answers.
- Checking whether a newer version has been published, and refreshing the
  copy, is always started by a person. Do it only when the owner asks for it
  in the current task, and then follow `docs/UPSTREAM-RULES.md`.

## Planning and tracking work

Work is planned, tracked and handed on under the
[work protocol](docs/upstream/work-protocol.md); where this section and
that page differ, the page wins.

- The project moves through the stages Intake, Runtime access, Survey, Slices
  and Audit, and `docs/IMPLEMENTATION-PLAN.md` records which one it is in.
  `docs/RUNTIME.md` records what can be done with the original running, and
  whether an agent, only a person, or nobody can do it.
- Survey lists the installation and the media the game reads in full, and
  records how the listing was made, in a listing record
  (`BLD-<alias>.listing.yaml`, named by the build's `listing` field) where the
  build keeps one. Every path in that listing, other than a member of an
  archive the listing went inside, is in the build's manifest, which holds
  every file the game uses, studied or not, or in the build entry's Other
  files section with the reason it is left out (in
  `BLD-<alias>.other-files.yaml` beside the manifest when the list is long).
  A path there that ends in `/` excludes every file under that directory, for
  directories that ship empty or that something fills later. A file whose use
  is unknown stays in the manifest. A file that ships only inside an archive
  is listed in the archive's `members` and cited as `ARCHIVE|MEMBER`. Checking the
  format definitions against the few files whose hashes identify the release
  does not end Survey; until every path is accounted for, the plan says what
  is missing.
- Static analysis comes first, and runs of the original are the last resort
  for each question: an `Agent run` or `Live session` item is taken up only
  after its own static attempt is under `Tried:`, or when it asks for the run
  that confirms a static reading. Runs take their place in the order of work
  (a run that blocks the current slice comes before static work that does
  not), and within each step of it `Static` items come first, then
  `Emulated call` items.
- An emulated call runs one function of the original in the Unicorn harness
  in `tools/emu/`, with no window, timer or input, and needs no run lock. It
  is an experiment with `starting_state: emulated-call`, names arguments and
  memory by parameter, field path or glossary name, and establishes an entry
  only when its cases reach every branch the entry describes and the reading
  of the function's callers and inputs is complete. It never confirms what
  depends on interrupts (`# may run:`), timing, the operating system or the
  hardware. Every import, interrupt or port access the function reaches has
  an explicit stub, anything else stops the run with an error naming it, and
  a PE loader fills each import address table slot with the stub for the
  import the file's import tables name there (a slot with no import holds no
  stub, and a call through it stops the run), and
  an experiment names in its Setup every stub, port model and video memory
  mapped as ordinary RAM, and gives each port value by its glossary name. A
  copy into video memory that ran to the end shows the bytes written, never
  the pixels. Any
  agent may build the harness and make emulated calls, whatever
  `docs/RUNTIME.md` says about runs of the game and whatever this file adds
  to keep agents from running the original: such limits cover runs of the
  game only, and emulated calls need no decision from the owner.
- Several agents work on different games on the same machine at once, under
  one account or several. Run an original only while holding the machine's
  run lock, whose path `docs/RUNTIME.md` gives; take it with an exclusive
  create that fails if the file exists, and delete only a lock you created or
  one the protocol calls abandoned. If another agent holds it, do not wait.
  Outside a live session, never attach to, send input to or stop a process
  you did not start.
- Evidence from runs comes mostly from people. Runs an agent drives are the
  most fragile evidence there is, so they are scripted, start from a fixed
  state and are kept to questions nothing else answers.
- Where `docs/RUNTIME.md` says an agent can start the original without a
  person, read its memory and set breakpoints, runs are recorded runs: a
  script (the probe) records the seed and every draw from the random number
  generator under the ID of the rule whose function made it, with its bound
  and result, and a test replays the run against the rebuild draw by draw.
  No address of the original reaches a fixture or a test. The probe reaches
  its state by memory writes to `supported` or `established` fields and
  waits on a state it can read, never on a fixed time. A divergence is
  explained by a copy of memory at the draw that differs, kept in
  `GAME_DIR/captures/` and never committed, and the finding changes the
  entry; the rebuild follows the entry, never the recording. In a live
  session only the draw recording and memory copies apply.
- People test the rebuild when they happen to and report in words and
  screenshots. Never wait for a report or plan around one. Record one at once
  in `docs/reports/` with the `triage-report` skill; a research session
  triages it into a `Defect (R-...)` parity note, a queue item or a finding.
  Screenshots are never committed: the rebuild's go in `GAME_DIR/reports/`,
  the original's in `GAME_DIR/captures/`, the durable local reference store.
- Competing readings of an open question are written in the entry's Open
  questions section with the evidence for and against each, never kept only
  in a session, and never implemented until an entry says them.
- A run that needs a person is a live session, requested in a file in
  `docs/live-sessions/` that the owner answers there. Never wait idle for one.
- Open research questions live in `queue/<AREA>.md`, grouped by the evidence
  they need, in the area of the first entry they name, each with an ID
  (`Q-COMBAT-012`) that everything outside the queue refers to it by. An item
  is closed by recording its answer in `spec/` and deleting it in the same
  commit. Each attempt that does not settle an item adds one `Tried:` note,
  and the item is taken up again only with new evidence, a new tool or a new
  reading. An attempt ends in a new place only if a finding it recorded took
  part of the item's Settles it out, or moved a part into an item of its own;
  reading more code, or naming a caller one step further on, does not count.
  After two attempts in a row end in the same place, the batch that made the
  second splits the item into parts that can be answered separately (the part
  that still asks the item's question keeps the ID) or, for one question,
  moves it to the section of the evidence that would settle it, or to
  `Blocked` when that evidence is out of reach.
- A question whether the original ever does something, such as start another
  program, starts with a census of every site of the mechanism that
  capability has to pass through, with a positive control for each kind of
  site, and traces further only what the census leaves undecided.
- A batch is one commit, and is research, implementation or tooling, never
  more than one. A session keeps to one side of the clean room. An
  implementation batch works from the spec alone, never opens analysis output
  or `queue/`, and under `spec/` only adds open questions and `unknown`
  entries; a gap becomes a `Spec gap:` note on the parity row, which the next
  research session turns into a queue item and removes once it is answered. A research batch makes the parity
  and citation changes the work protocol's "Research batches" section lists,
  and changes no other code apart from `tools/`: citations of an entry it
  supersedes move in code, parity rows, deviations, `docs/HANDOVER.md` and the
  goal files; a rule, format, screen or bug entry it changes in place gives an
  implemented row Code `partial` and a `Defect (FND-...)` note; and a queue
  item it closes stops being cited in `parity/` and deviations and in live
  session requests. An implementation session first settles each citation of
  a finding or experiment in `src/`: it moves to the entries that list that
  evidence (their rows become `partial` with a note), and only code that no
  entry describes is removed. A tooling batch
  (extractor, Ghidra scripts, inventory export, the emulator harness in
  `tools/emu/`, live session measurements, headless runner, fixture harness)
  needs no decision.
- `spec/index/` and `PARITY.md` change on the main branch only. The job in
  `.github/workflows/nightly-generated.yml` regenerates them there and
  commits the result; no batch or other branch changes them, and the
  documentation check fails a change that edits, adds or removes one. A
  branch's copies are as old as the main branch it last took in. To read
  current ones, run `node tools/upstream.mjs docs --generate` and leave
  what it writes uncommitted.
- Commit messages end with a `Spec:` trailer naming the entries created or
  changed, any commit that changes a row's status adds `Parity:`, and any
  that closes queue items adds `Queue:` with their IDs. `Queue:` lists only
  the items the batch closed; an item worked on and left open (given
  `Tried:`, split or moved) stays out of it.
- A claim moves from an `unknown` listing (or `sourced` from a document),
  through competing readings kept in its entry's Open questions, each with a
  queue item, to a description at `supported` once direct evidence (the code
  that produces the behaviour) settles it, then `established` by a complete
  reading of the code, or, only where it depends on something the code does
  not decide, when a run or a tester's capture of the original agrees.
  Circumstantial evidence never raises a status. Contradicting evidence makes
  it `disputed`, and a wrong claim is superseded, never deleted. The
  protocol's "The life of a claim" section has the details.
- `docs/HANDOVER.md` is the current state of work outside any goal, at most
  200 lines, rewritten at the end of every session that works under no goal,
  added to by the commit that deletes a goal file, and otherwise changed only
  where a research batch moves a citation of an entry it supersedes. It names
  items and entries by ID without saying what research found.
  `docs/goals/` holds one file per running goal, which claims its areas and
  has a handover of its own for sessions under it. The batch that meets a
  goal leaves its file in place, and a later commit deletes it. Commits that
  create, re-scope or delete a goal file, like the handover commit, are not
  batches: they touch only `docs/HANDOVER.md` and `docs/goals/` and carry no
  trailers. A goal file may name its side, research or implementation, and
  then a goal on the other side may claim the same areas. Where no session can
  push to the main branch, one goal runs at a time on a `goal/` branch; where
  only some sessions may, a goal keeps the form the session that started it
  could use, and claims are checked in both places (`docs/goals/README.md`). `docs/DECISIONS.md`
  records the owner's decisions and moves its oldest entries to
  `docs/decisions/` before it passes 1,000 lines. A session ends by
  committing its handover on its own and pushing the branch; half-done work
  never goes into a batch commit. Under a goal whose condition does not
  hold, the end of a session is a checkpoint: the next session starts at once,
  in the same conversation, and `docs/goals/README.md` lists the only reasons
  to stop. When the owner asks to wrap up, no new agent or item starts: the
  batch in progress is finished, documented, committed and pushed to the main
  branch, and the goal stops, as that file's "Wrapping up" says.
- Progress is what scripts compute: parity totals, entries by status,
  executable and file coverage, queue sizes. Never a hand-written percentage.
  Executable coverage is measured against the function inventories,
  `coverage/<build ID>/<manifest path>.tsv` (a `CD:` prefix becomes an `@CD`
  directory, and a member of an archive goes under `<archive path>@/`), one
  for each file the analysis reads. An inventory holds only each function's start address, its size,
  optionally a name the researcher gave it and why it is out of scope, and,
  for a body that is not one range from its start, its ranges; never
  code, bytes, strings, constants or names that came from the original, so it
  is committed. Each start is written in the standard's notation for its
  file: `SSSS:OOOO` in an MZ load image, an eight-digit file offset inside a
  row of the build's Code ranges for overlay code, and an eight-digit address
  for PE, LE and LX. `tools/evidence/report.mjs inventory` writes the MZ, FBOV
  overlay and PE32 forms and refuses LE and LX files (`docs/EVIDENCE-TOOLS.md`). `pnpm exec standard-coverage` prints how much of
  each file the spec's locations cite; run it when the figures are needed,
  and commit none of its output.

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
  recorded in a run file in `validation/` (`docs/VALIDATION.md`).
- **Parse defensively.** Original files are untrusted input: bound every length,
  reject path traversal, and fail with a diagnosable error instead of throwing
  from deep inside a reader.

## Reverse-engineering discipline

The project follows the [methodology](docs/upstream/methodology.md) and
the [documentation standard](docs/upstream/documentation-standard.md). This
section and the next two summarize them; where they differ, the pages win.

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
direct evidence from the original), `established` (a complete reading of the
code, or a reading and a run of the original that agree where the code does
not decide the outcome), `disputed`, or `superseded`. Findings and experiments are
`recorded`, `reproduced`, or `superseded`. A part of an entry that is less
certain than the rest goes in its own entry or in its Open questions section.
Never silently promote a plausible interpretation.

A complete reading also covers what the standard's
[Complete readings](docs/upstream/documentation-standard.md#complete-readings) (lines 199-299)
and [Findings](docs/upstream/documentation-standard.md#findings) (lines 739-823) sections
list, among them: two addresses are the same storage only where the reading
shows the segment each is formed in and accessed through (a BP offset read
through DS is the caller's stack only where DS equals SS there); a stored
call target is followed through every part it carries, such as an object
adjustment or two words that form one far pointer; a byte stored into a word
read whole names what writes the other byte; an allocation keeps apart the
bytes requested, the width they are computed in, the allocator's unit, the
header's size and the range later written, and a failed request may leave
state changed; the number of outputs a procedure can produce is bounded on
its own, apart from each input's bound; a return value is followed into each
caller at the width it is tested; cleanup is read once per path into it; and
an error passed back through recursion is traced to what can produce it. A
finding that a function has no other callers checks the analyzer's list with
a second search that does not depend on function boundaries, and one about a
dispatch table reads how the input becomes an index and what bounds it before
naming which input selects which entry. An `offset` into overlay code lies
wholly inside a row of its build's Code ranges section. Bytes in an executable
that are read as data, such as its header or a packer's header, are located
with `kind: file-data` and an `offset` into the file as it ships; bytes the
unpacker writes outside the load image add `unpacked: true` and take an offset
into the unpacked file. A file-data location never locates code, so it cannot
support a Code ranges row. Every range is half-open, in locations, entry text
and Code ranges rows: its end is the byte after the last one it covers, never
the last byte that Ghidra reports as a function's or block's maximum address.
Where `coverage/` has inventories, the check fails a range that ends on an
inventoried function's last byte, unless the entry lists it in
`ends_on_last_byte` because it stops just before a one-byte final instruction.

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
repository; the documentation check fails a spec file that names a path under
`src/` or `tests/`, or the file name of a source file there. It holds names, numbers, formulas, and tables in full, as a strategy
guide would: the names of concepts and of the things a designer made (an
enumeration value may be named `UNIT_ARCHER`), constants, and the per-unit or
per-item statistics a designer filled in, with a table of more than 64 values in
a value file. It never keeps a substantial copy of the game's writing (dialogue,
descriptions, messages, the manual's prose; quote a short passage at most and
refer to the rest by resource), its art (images, sounds, music, video, maps), or
a meaningful slice of its code or scripts. Tool procedure stays in `docs/GHIDRA.md`. Never commit broad
decompiler, instruction, or Version Tracking exports. The function inventories
in `coverage/` are the one export that is committed, and only with the columns
the planning section above allows.

Evidence lives in the spec, not in the code that relies on it. An address,
offset or constant that a code comment, test or commit message gives as evidence
must already be recorded in an entry it cites, directly or in the evidence of an
entry that one cites; when none records it, write that finding first, in the
same research batch. Code in `src/` cites the rule, format, screen or bug it
implements, never a finding, even where the check's message suggests one; an
address that no entry the code implements backs is a spec gap, and the code
leaves it out. The documentation check enforces this for the addresses a
code comment gives and for those the code uses, as numbers or inside strings,
which the comment trailing the line or the nearest comment above it must cite.
It reads C#, TypeScript, JavaScript and PowerShell comments, treats a neutral
name (`fn_…`, `g_…`) as an address always and a plain `0x…` value only once the
CI job gives the image's range (see `docs/VALIDATION.md`), and the commit-msg
hook applies the same rule to a commit message. Before taking a
new ID, look for it on the open pull request branches as well as `main`,
because parallel branches each take the next free number and the check sees
only one branch:

```sh
git fetch origin
git grep -l <ID> $(git for-each-ref --format='%(refname)' refs/remotes/origin)
```

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

Every departure from the spec is a `DEV-AREA-NNN` file in `deviations/`,
with a Default of `off`, `on` or `mandatory`. A deviation may be `on` or
`mandatory` when its Justification argues that the rebuild's behavior is
strictly better, or that it is a small judgement call that makes the game
better to play, such as keeping precision the original threw away or pacing by
a fixed clock where the original followed the speed of the machine, and that
touches nothing players build strategies around. A change some players would
reasonably prefer the original's way, as a matter of taste or because it
changes results players notice, gets a setting that starts `off`, with the
original's behavior. A deviation with no setting is `mandatory`, and its
Justification also says why the original's behavior is not worth a setting.
The fix of an unintended bug that players do not rely on is `on` without one.
A quirk that may be deliberate or that players rely on never qualifies, so its
deviation starts `off`. The validation suite runs with every setting
switched off, and a test that reaches a mandatory deviation cites its ID and
allows for it. Rebalancing and new features belong in a separate mode or
project.

## Citing the spec

Code comments and tests cite the spec IDs they implement or check, so a search
for an ID finds everything that depends on it. A placeholder in the code, such
as a guessed formula, carries a `PLACEHOLDER: <spec ID>` comment, and the
parity row for that ID cannot be `complete` while it does. The parity matrix
(`PARITY.md` for the totals, `parity/` for the rows) has one row per rule,
format, and screen entry that is not superseded, so behavior
without a spec entry gets an `unknown` entry before any code. Manual play never
counts as a test.

## Durable narrative documentation

Keep changing inventory totals out of narrative documentation: test-case, file,
line and imported-asset counts belong in generated reports or validation logs.
Keep numbers that define behavior, constrain validation, support evidence or
justify a decision. A dated measurement belongs in prose only when that context
needs it. Refer to the generating command instead of maintaining a copied total.

## Git ownership in the Windows sandbox

The Windows sandbox may run Git as a different account from the checkout owner.
For an authorized, trusted checkout, use a command-scoped exception from the
first Git command: `git -c safe.directory=<resolved-absolute-checkout-path> ...`.
Use forward slashes in the Windows path and quote the whole
`safe.directory=<path>` argument if it contains spaces. In a separate worktree,
use that worktree's path; with `git -C`, use the target checkout's path.

Keep the exception scoped to the known checkout. Do not use `safe.directory=*`
or change global Git configuration. The exception does not authorize a remote
change or a push; verify the configured push destination under the project's
repository instructions before pushing.

## Pushing a branch

Push with the configured remote name (`origin` in the commands below) and an
explicit refspec that names the destination branch:
`git push origin HEAD:<branch>`, where `<branch>` is the branch the work
belongs on: the pull request's head branch, a `wip/` or `goal/` branch, or the
main branch where a push to it is allowed. Never run a bare `git push` or
`git push origin`. A branch created from `origin/main`, as
`git worktree add -b <branch> <path> origin/main` creates one, tracks
`origin/main`, so a bare push is refused or, under `push.default=upstream`,
updates the main branch, and with `-q` nothing says which branch it updated.
A branch checked out without `-b` may track nothing. When you create the
branch yourself, add `--no-track`
(`git worktree add --no-track -b <branch> <path> origin/main`) so it starts
with no upstream; tools that create worktrees for you may not, so the
explicit refspec is still required. Give `-u` on the first push
(`git push -u origin HEAD:<branch>`) so the branch tracks its own remote branch
from then on.

After every push, confirm that it landed before reporting it or reading CI:
the commit hash `git ls-remote origin refs/heads/<branch>` prints must be the
one `git rev-parse HEAD` prints, and for a pull request
`gh pr view <number> --json headRefOid --jq .headRefOid` must print the same
hash. GitHub can take a few seconds to move a pull request's head after a
push, so a `gh` mismatch right after an `ls-remote` match is checked again
before it counts as a failed push. CI results and mergeability belong to the
pull request's head commit; until that is the local commit, they describe an
older one.

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
- `<Project>.Inspect`: read-only tooling over the original's media.
- `<Project>.Tests`: architecture, safety, and behavioral tests.

Game-independent readers and runtime helpers come from the `RefurbishedDinosaurs.*`
NuGet packages, pinned at an exact version: media sources and legacy formats from
`RefurbishedDinosaurs.LegacyFormats`, asset-pack staging, safe paths, per-user
locations and startup failure reporting from `RefurbishedDinosaurs.Core`. Use a
package type before writing a local one, and keep game-specific formats, names and
rules in the projects above; the
[shared runtime libraries guide](https://github.com/kibertoad/refurbished-dinosaurs-toolkit/blob/main/docs/runtime-libraries.md)
says what each package covers.

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

Where `Core` computes a rule with a different algorithm from the entry's
procedure, tests compare the state and outputs a later call reads, not only
the result: for a search with a work queue, a node queued twice, a stored
score that improves while an older queue entry waits, and a search stopped at
its step limit and resumed. Wiring a rule into `Game` is tested through its
intermediate states: one shared value followed through input, `Core`
updates, presentation, and a save and restore, with distinct values per axis;
what a second actor sees at each `# visible:` point; reservations across a
table refresh and a save; a requester's rejection apart from a failed route.
A checkpoint or replay API states what its identity covers (every field and
behaviour-driving resource that decides how play continues, hashed in a
stated, versioned encoding), rejects a mismatched checkpoint without changing
the host, says whether a snapshot may be restored more than once, and never
drops unsaved state such as a paused path search silently. Where the state
that decides how play continues sits in several components at once, such as
a task record, a movement record, an actor and a paused search, the tests
also cover how those parts compose: a helper changing a field that several
components copy, checked in the next consumer and after a restore; a
checkpoint taken between two steps of a rule accepted, while a value no step
produces is rejected; each required field removed on its own, and an
explicit null apart from a missing field; state published on a path that
returns zero or fails; integer identities in different roles given different
values (army 2, slot 4, entity 7); and input that names one thing twice, such
as numeric keys `11` and `011` read as decimal, rejected before anything is
built; a decision taken from a value read before a call not taken again after
it, and each read of a value the entry reads more than once changed between
reads; a failure whose leftover state changes the next call; and the source a
request reads kept apart from the request and its destination. These tests compare the rebuild with the spec or with itself, so none
of them validates a parity row or is listed in its Tests column; see the protocol's
[Implementation batches](docs/upstream/work-protocol.md#implementation-batches) (lines 206-224)
[Checkpoints and replay](docs/upstream/work-protocol.md#checkpoints-and-replay) (lines 308-316)
and [Continuation cases](docs/upstream/work-protocol.md#continuation-cases) (lines 318-350).

The protocol adds test cases for four more shapes of rule, which also
compare the rebuild with the spec and validate no row. A caller that combines
its callees' results (stops at the first event, keeps the last result, ORs
statuses, or calls a fallback on one exact status) is tested through the
consumer of its result as well as alone, with an earlier callee reporting and
a later one returning 0. A rule moved into the rules layer is tested directly
and again through its adapter, which hands back the same shared objects and
read-only collections, rejects no input the entry gives an outcome for, and
keeps what a rule did before a failure. Arithmetic the entry says wraps,
truncates or converts is tested at the edges of each type (largest and
smallest values, shift counts of 0 and 32, a divisor of -1, values outside
every narrower type through the adapter), including a value that passes a
guard and becomes 0 after the transformation that follows it, a loop that
runs its body before its test and wraps a count of 0, a loop limit its own
writes change, the bits of each `FLOAT32` intermediate the original stores,
and a copy that fits its record but runs into the next field. Allocation, removal and cleanup are
tested with a test-supplied allocator and release routine that record calls,
return null, fill blocks with a pattern, read or change the container when
called, and change a count the copy loads again after the check. Each caller
of one target is tested with the statuses its own comparison tells apart. See the protocol's
[Calls that combine results](docs/upstream/work-protocol.md#calls-that-combine-results) (lines 226-242),
[Rules behind an adapter](docs/upstream/work-protocol.md#rules-behind-an-adapter) (lines 244-260),
[Arithmetic at the original's widths](docs/upstream/work-protocol.md#arithmetic-at-the-originals-widths) (lines 262-282)
and [Allocation, containers and cleanup](docs/upstream/work-protocol.md#allocation-containers-and-cleanup) (lines 290-306).

Each rule ships with fast-gate tests over synthetic state. The rule itself is
usually a static class over the serializable state type, called by `Game`.
When a bug is traced to branch logic in `Game`, extract the rule into `Core`,
pin every branch with a test, and fix it there.

Determinism is a feature: identical commands and seed must produce identical
state, because saves, replays, and parity validation depend on it. The
generator takes the ID of the rule making each draw and offers a hook that
lets a test observe every draw; nothing but tests uses the hook. Every
compiled C# file is limited to 1,000 lines; split responsibilities instead of
raising the limit.

## Commands

```powershell
./tools/Verify-Configuration.ps1   # placeholders and template leftovers
./tools/Verify-Repository.ps1      # original-content and large-file policy
./tools/Invoke-Validation.ps1 -TestFilter <filter>   # policy checks, build, relevant tests
dotnet build <Project>.slnx        # full solution
dotnet run --project src/<Project>.Game -- --smoke-test
```

Never run the full validation gate (`Invoke-Validation.ps1` without
`-TestFilter`) or the full test suite locally. CI runs the gate on every pull
request. Locally, run only the tests directly relevant to the change: the
test classes that cover the code and spec entries it touches, through
`-TestFilter` or `dotnet test --filter`. Run more only when the user asks for
it. `-MinimumExpectedTests` fails a run when discovery drops below an expected
count.

Enable the hooks once in each clone, before the first commit, with
`git config core.hooksPath .githooks`, and do not bypass them with
`--no-verify`. The commit-msg hook checks the addresses a commit message
gives against the entries it cites. The pre-commit hook runs the gate's node checks (`tools/Invoke-NodeChecks.mjs`)
on the staged tree in under a second, so a spec, queue or checker-pin problem
fails before the commit instead of in CI.

## Definition of done

A change is finished when the solution builds, the tests relevant to it pass
locally and CI passes, new
behavior has tests that exercise every branch its entry describes directly,
not only the branches a play session reaches, the spec entries it relies on
exist with the status their evidence supports, the documents that assert status
(`README.md`, `PARITY.md`, `parity/`, `deviations/`) match reality, and
`queue/` has been updated with whatever the work settled or newly raised.

Commits describe the change and its evidence, not the tooling that produced it.

## Evidence review and offline rules

Apply the claim-relevant procedure in [EVIDENCE-REVIEW](docs/EVIDENCE-REVIEW.md)
before asserting a complete reading. How the local copy of the standard is
verified and, when the owner asks, refreshed is in
[UPSTREAM-RULES](docs/UPSTREAM-RULES.md). These procedures keep Standard v1.
