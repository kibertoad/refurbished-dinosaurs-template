# Spec entry templates

Blank entries for each kind in `spec/`, with the front matter fields and body
sections the [documentation standard](upstream/documentation-standard.md#entry-types) (lines 512-1155)
requires, in its order. Copy one into the directory for its kind, name the file
after the ID (`spec/rules/RULE-COMBAT-007.md`), and replace every `<...>`. The
standard defines what each field and section holds; this page does not repeat
it.

Rules, formats, screens and bugs may also have `complete_reading`, a list of
the static findings that together read all of the entry, which makes it
`established` without a run (see the standard's
[Complete readings](upstream/documentation-standard.md#complete-readings) (lines 199-299)).
Leave it out until such a reading exists.

A section with nothing to say is kept and says `None known.`, or `None.` where
it is certain that there is nothing. The documentation standard check from
[refurbished-dinosaurs-toolkit](https://github.com/kibertoad/refurbished-dinosaurs-toolkit)
runs on every pull request and reports what an entry is missing, as
`docs/VALIDATION.md` describes.

Each bullet in an Open questions section cites the queue item that tracks it
(`(Q-COMBAT-004)`). A bullet no item can settle yet, such as a neutral name the
standard requires the entry to list, or the observation that would confirm a
reading where no run is possible, ends with `(No item: <why>)` instead.
`tools/Check-ResearchTracking.mjs` fails any other bullet, and an exemption with
no reason.

Every Markdown file the standard defines, entries included, is at most 1,000
lines. An entry that would pass the limit is split by what it describes, as
the standard's [File size](upstream/documentation-standard.md#file-size) (lines 106-120)
section says. The documentation standard check and
`tools/Test-TemplateInfrastructure.ps1` both check the limit. Build manifests,
lists of a build's other files, listing records, value files, Kaitai definitions, fixtures and
save patches are not counted.

## Build

````markdown
---
id: BLD-<ALIAS>
title: <Game> <version>, <language>, <distribution>
superseded_by: []
developer: <the studio that made the game>
publisher: <the company that released the game>
publisher_version: "<version>"
distribution: <GOG, Steam, CD-ROM, ...>
languages: [<ISO 639-1 codes>]
int_width: <16 or 32>
manifest: BLD-<ALIAS>.files.yaml
listing: BLD-<ALIAS>.listing.yaml   # only where the build keeps a listing record
---

## Obtaining

## Compared with other builds

## Other files

## Code ranges
````

Other files says how the installation and the media the game reads were
listed, closely enough to repeat, and gives every path of that listing the
manifest leaves out with its reason. When that list would take the entry past
the line limit, it goes in `spec/builds/BLD-<ALIAS>.other-files.yaml`, whose
only key is `other_files`, and the section names that file:

```yaml
other_files:
  - path: <path as the manifest would write it>
    reason: <installer, wrapper, compatibility shim, ...>
```

No path is in the manifest and the list of other files both, and neither lists
a path twice. A path ending in `/` is a directory exclusion and stands for
every file under it, for a directory that ships empty or that something fills
after installation (DOSBox's `capture/`, saves); its reason says what fills
it. No manifest path lies under one, and a link or a stopped item under it is
still listed by its own path.

A build may keep the listing itself in
`spec/builds/BLD-<ALIAS>.listing.yaml`, named in the entry's `listing`
field. Other files then names the tool that wrote it and need not repeat what
its fields say. Each item has a `path` and exactly one of `size`, `link` (the
target as stored, not followed) or `stopped` (why the listing could not give
it as a file). A member of an archive the listing went inside is written
`<archive path>|<member path>`. Items are sorted by path compared byte by byte,
and no path appears twice. The checker compares the record with the manifest
and the list of other files as the standard's
[ENTRY-TYPES-18](upstream/documentation-standard.md#entry-types-18) (lines 671-681) says:

```yaml
tool: <program that made the listing, with its version or commit>
date: <YYYY-MM-DD>
links: <listed, followed or refused>
cycles: null              # how a followed link back into its own directory was stopped, or null
media:
  - prefix: ""            # the installation directory
    source: null
    layout: null
  - prefix: "CD:"
    source: <disc image path as the manifest or other files write it, or null>
    layout: "2048"        # 2048, MODE1/2352 or MODE2/2352
archives:                 # each archive the listing went inside, or []
  - path: <archive path>
    depth: 1
items:
  - path: <path>
    size: <bytes>
```

Code ranges is a table of the parts of each file that hold code located by
offset, or `None.` where all code is located by address. A range is half-open,
a location's `offset` into overlay code lies wholly inside one row, and each
row's finding has a location in that file that is not `kind: file-data`:

```markdown
| File | Range | Overlay | Finding |
|---|---|---|---|
| `<path>` | `0x<start>..0x<end>` | <overlay or bank number, or -> | `FND-<AREA>-<NNN>` |
```

A row for a member of an archive writes the file as `CD:INSTALL.LIB\|SETUP2.EXE`:
GitHub ends a table cell at any `|` that is not escaped, inside backticks too.

A build has one executable that runs the game's rules. An installation that
ships two, such as a DOS and a Windows version over the same data files, is two
builds, and both list the shared files.

The build's files go in its manifest, `spec/builds/BLD-<ALIAS>.files.yaml`,
whose only key is `files`. It lists every file the game uses, including files
not studied yet, not only those whose hashes identify the release. A path uses forward slashes and is relative to the
install directory, or starts with `CD:` (`CD1:`, `CD2:` for more than one disc)
for a file read from the disc and never installed. A name on an ISO 9660 disc
comes from the disc's primary volume, without its `;1` version suffix or the
dot that ends a name with no extension (`CD:SETUP.EXE`, `CD:README`), unless
dropping them would give two names one path. A packed executable adds
`packer` and `unpacked`. `Restoration.Inspect --source <dir>` prints each
file's size and `xxh3`.

An archive whose members an entry cites, such as an installer's second stage
that ships only inside a compressed library, lists them under `members`, each
with the `path` the archive stores it under, and the `size`, `xxh3` and
`format` of the expanded member and the `tool` that expanded it. A member is
then written `<archive path>|<member path>` wherever an entry names it
(`CD:INSTALL.LIB|SETUP2.EXE`), and its function inventory goes in
`coverage/<build ID>/@CD/INSTALL.LIB@/SETUP2.EXE.tsv`. A member has no
`packer`, `unpacked` or `members` of its own.

```yaml
files:
  - path: <path relative to the install directory, or CD:path>
    format: <MZ, COM, NE, PE, LE, LX, ELF, cdda or data>
    size: <bytes>
    xxh3: <32 lower-case hex digits, as `xxhsum -H2` prints>
    members:              # only for an archive whose members an entry cites
      - path: <path inside the archive, forward slashes>
        format: <format of the expanded member>
        size: <bytes>
        xxh3: <hash of the expanded member>
        tool: <expanding program and version>
```

## Source

````markdown
---
id: SRC-<ALIAS>
title: <title>
superseded_by: []
author: <who wrote it>
date: "<year or date>"
location: <URL or archive location>
xxh3: null
licence: null
---

## Use

## Known errors
````

## Finding

````markdown
---
id: FND-<AREA>-<NNN>
title: <one sentence>
status: recorded
builds: [BLD-<ALIAS>]
superseded_by: []
recorded_by: <GitHub username>
reproduced_by: []
method: <static or dynamic>
locations:
  - build: BLD-<ALIAS>
    file: <path from the build entry>
    address: <range in the notation for the file's format, or offset: for data files, overlays and kind: file-data>
tool: <tool and version>
environment: null
---

## Observation

## Interpretation

## Alternatives

## How to reproduce
````

`environment` stays `null` for a static finding. A dynamic finding gives it in
the form an experiment uses.

Every range is half-open and ends at the byte after the last one it covers,
where an analyzer usually gives the last byte. A function whose last byte
Ghidra reports as `0x0045E7CD` is `0x0045E04D..0x0045E7CE`, and a range ending
with a five-byte call at `0x00401010` ends at `0x00401015`. Where `coverage/`
has inventories, the check fails a range that ends on an inventoried
function's last byte. A range that does so on purpose, such as a body cited
without its one-byte return, is listed in the entry's `ends_on_last_byte`
field (`ends_on_last_byte: [0x00401000..0x0040103F]`), which any entry may
have and which is left out when it would be empty.

## Experiment

````markdown
---
id: EXP-<AREA>-<NNN>
title: <the question, as a sentence>
status: recorded
builds: [BLD-<ALIAS>]
superseded_by: []
recorded_by: <GitHub username>
reproduced_by: []
environment: <OS, compatibility layer or emulator, and settings>
starting_state: <saves/EXP-<AREA>-<NNN>.patch.json, a save, new-game, or null>
recording: null
repetitions: <count>
fixture: EXP-<AREA>-<NNN>.json
---

## Question

## Setup

## Procedure

## Observations

## Results

## Conclusion
````

## Format

````markdown
---
id: FMT-<AREA>-<NNN>
title: <what the format holds>
status: unknown
builds: [BLD-<ALIAS>]
superseded_by: []
files: []
byte_order: little
size: null
text: false
definition: null
evidence: []
conflicting: []
split_with: []
related: []
---

## Layout

| Offset | Size | Type | Name | Meaning | Status | Evidence |
|---|---|---|---|---|---|---|

## Enumerations and flags

None known.

## Differences between builds

None known.

## Coverage

## Open questions
````

A binary format with a status above `unknown` has a Kaitai definition next to
it, named after the ID in lower case (`fmt_data_002.ksy`), and `definition`
names it.

An enumeration table that would take the entry past 1,000 lines goes in a
value file beside it, named after the ID and the table
(`spec/formats/FMT-DATA-009.unit_class.csv`). Its `###` heading stays in the
entry, followed by a sentence naming the file. The file is CSV as RFC 4180
defines it, in UTF-8, with the table's columns as its header row:

```text
Value,Name,Meaning,Status,Evidence
0,<NAME>,<meaning>,<status>,<IDs>
```

## Rule

````markdown
---
id: RULE-<AREA>-<NNN>
title: <what the rule decides>
status: unknown
builds: [BLD-<ALIAS>]
superseded_by: []
evidence: []
conflicting: []
split_with: []
related: []
---

## Summary

## When it runs

## Parameters

None.

## Inputs

## Procedure

```text
```

## Outputs

## Edge cases

## What the sources say

## Differences between builds

None known.

## Open questions
````

Parameters is `None.` for a rule that takes none, or a list with one item per
parameter, in the order a `call` or an `emit` passes them, and nothing else.
Each item opens with one code span holding the name and type, written the way
`define` writes them, directly followed by a colon:

```markdown
- `attacker: FMT-DATA-005`: the gang that attacks.
- `defender: FMT-DATA-005`: the gang it attacks.
```

The checker counts these items against every `call` of the rule and every
`emit` of an event the rule handles. Any other form, `None known.` or an item
naming two parameters such as ``- `x`, `y`: the cell`` included, passes but
cannot be counted, and the checker names each call and `emit` it skipped.

A list of more than 64 values in a procedure is a `table` whose values come
from a value file in `spec/rules/`, named after the ID and the table:
`table sine: INT16[1024] from "RULE-MATH-003.sine.csv"`. The file has the
single column `value` and one row per element, in index order, so it has as
many rows as the type's count:

```text
value
<first element>
<second element>
```

## Bug

````markdown
---
id: BUG-<AREA>-<NNN>
title: <the symptom>
status: unknown
builds: [BLD-<ALIAS>]
superseded_by: []
impact: <crash, hang, save-corruption, rules, presentation or performance>
intent: <unintended or unclear>
player_reliance: <relied-on, not-relied-on or unknown>
evidence: []
conflicting: []
split_with: []
related: []
---

## Symptom

## Trigger conditions

## Mechanism

## Frequency

## Player reliance

## Fixes elsewhere

## Differences between builds

None known.

## Open questions
````

## Screen

````markdown
---
id: SCR-<AREA>-<NNN>
title: <screen, panel or dialog>
status: unknown
builds: [BLD-<ALIAS>]
superseded_by: []
resolution: <width>x<height>
evidence: []
conflicting: []
split_with: []
related: []
---

## Drawn elements

| Element | Resource | Shows | Position | Shown when | Evidence |
|---|---|---|---|---|---|

## Mouse input

| Region | Rectangle | Enabled when | Effect | Evidence |
|---|---|---|---|---|

## Keyboard input

| Key | Enabled when | Effect | Evidence |
|---|---|---|---|

## Other input

| Device | Input | Enabled when | Effect | Evidence |
|---|---|---|---|---|

## Sounds

| Sound | Resource | Played when | Evidence |
|---|---|---|---|

## States

| State | Entered when | Left when | Evidence |
|---|---|---|---|

## Timing

## Differences between builds

None known.

## Open questions
````

A Region cell names the region, a comma, then the event (`OK button, left
release`, `Map, Shift+left press`, or `pointer enter`, `pointer leave` and
`pointer move`); an event the list has no word for is written in plain words
after the comma, and a cell with no comma says the event is not known. A
region has a row for each event it responds to, and for each state in which
one event has a different effect.

## Glossary term

One file per term in `spec/glossary/`, named after the term as the pseudocode
spells it (`spec/glossary/turn_order.md`), opening with the term as a `#`
heading. A glossary file is not an entry, so it has no ID and no front matter,
and it is renamed along with its term. Two terms never differ only in case, and
no term is a name Windows reserves for a device (`con`, `prn`, `aux`, `nul`,
`com1` to `com9`, `lpt1` to `lpt9`, in any case).
The standard's [Where it lives](upstream/documentation-standard.md#where-it-lives) (lines 24-104)
section lists what each kind of term also gives. Every claim about the original
(an address, the order of a list, the order of handlers or of a queue, what an
outside value is read from) is followed by the IDs of its findings or
experiments in brackets, or by `(unknown)`.

````markdown
# <term>

<What the term means, and the name the game shows the player where there is
one. Then what the standard asks of this kind of term.>
````

## Deviation

One file per deviation in `deviations/` at the repository root, named after its
ID (`deviations/DEV-COMBAT-002.md`). Default is `off`, `on` or `mandatory`
(Setting `None`). Keep the Justification item, which argues that the rebuild's
behavior is strictly better than the original's, or that it is a small
judgement call that makes the game better to play, for a `mandatory` deviation
and for one that is `on` without being the fix of an unintended bug players do
not rely on, as the
[deviation log](upstream/documentation-standard.md#deviation-log) (lines 1220-1246)
section sets out. Delete it otherwise. Keep the Replaces item only on a
`mandatory` deviation that replaces some of the entries in Departs from
entirely, and name only those; keep the Tests item only when test files check
that the rebuild does what the Reason says. A row a Replaces item names becomes
`deviated` once every `mandatory` deviation it lists has a Tests item, and its
own Tests is `None`, since the tests of what the rebuild does in its place are
the deviation's Tests item. IDs are
never reused or renumbered, and a dropped deviation keeps its file.

````markdown
# DEV-<AREA>-<NNN>

- Departs from: <rule, format, screen or bug IDs>
- Replaces: <the rule, format or screen IDs of Departs from that a mandatory deviation replaces entirely>
- Reason: <what the original does and why the rebuild differs>
- Setting: <setting name, or None>
- Default: <off, on or mandatory>
- Justification: <why the rebuild's behaviour is strictly better, or what the judgement call improves and why no player would miss the original's>
- Tests: <test files that check the rebuild does what the Reason says, each citing this ID>
- Dropped: no
````

Any explanation follows the list in plain paragraphs.

## Parity area file

One file per area in `parity/` at the repository root, named after the area
(`parity/COMBAT.md`), opening with the area as a `#` heading, followed by one
table of the area's rows sorted by ID. An area whose file would pass 1,000
lines becomes a directory with one file per kind, and then one file per block
of 100 numbers (`parity/COMBAT/RULE/000.md`), each opening with its path under
`parity/` as its heading (`# COMBAT/RULE/000`). The check says which files the
rows belong in. It also writes the totals and the area links in `PARITY.md`.

````markdown
# <AREA>

| Spec ID | Title | Spec status | Code | Tests | Deviations | Status | Notes |
|---|---|---|---|---|---|---|---|
````

Tests lists only test files that compare the rebuild with the original: each
carries `// needs: GAME_DIR`, or names by ID an experiment that the row's entry
(or a bug whose `related` names it) lists in its `evidence`. Tests over
synthetic state and a deviation's Tests are not listed, and a row with no
other tests has Tests `None` (`docs/VALIDATION.md`).

## Reviewing a claim

Use [EVIDENCE-REVIEW](EVIDENCE-REVIEW.md) for checks relevant to the claim,
including synthetic worked examples. Record the reasoning in existing v1
sections and fields; this guidance adds no schema or confidence scale.
