# Spec entry templates

Blank entries for each kind in `spec/`, in the order the [documentation standard](upstream/documentation-standard.md#entry-types)
gives their fields and sections. Copy one into the directory for its kind, name the file after
the ID (`spec/rules/RULE-COMBAT-007.md`), and replace every `<...>`. What each field and
section holds, the file size limit and the value files are in the standard section linked under
each heading; this page does not repeat them.

## Build

See [Builds](upstream/documentation-standard.md#builds).

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
---

## Obtaining

## Compared with other builds

## Other files
````

The manifest, `spec/builds/BLD-<ALIAS>.files.yaml`. `Restoration.Inspect --source <dir>` prints each file's size and `xxh3`.

```yaml
files:
  - path: <path relative to the install directory, or CD:path>
    format: <MZ, COM, NE, PE, LE, LX, ELF, cdda or data>
    size: <bytes>
    xxh3: <32 lower-case hex digits, as `xxhsum -H2` prints>
```

## Source

See [Sources](upstream/documentation-standard.md#sources).

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

See [Findings](upstream/documentation-standard.md#findings).

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
    address: <range in the notation for the file's format, or offset: for data files and overlays>
tool: <tool and version>
environment: null
---

## Observation

## Interpretation

## Alternatives

## How to reproduce
````

## Experiment

See [Experiments](upstream/documentation-standard.md#experiments).

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

See [Formats](upstream/documentation-standard.md#formats).

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

A value file for an enumeration table, `spec/formats/<ID>.<table>.csv`.

```text
Value,Name,Meaning,Status,Evidence
0,<NAME>,<meaning>,<status>,<IDs>
```

## Rule

See [Rules](upstream/documentation-standard.md#rules).

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

A value file for a table in a procedure, `spec/rules/<ID>.<table>.csv`.

```text
value
<first element>
<second element>
```

## Bug

See [Bugs](upstream/documentation-standard.md#bugs).

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

See [Screens](upstream/documentation-standard.md#screens).

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

## Glossary term

See [Where it lives](upstream/documentation-standard.md#where-it-lives).

````markdown
# <term>

<What the term means, and the name the game shows the player where there is
one. Then what the standard asks of this kind of term.>
````

## Deviation

See [Deviation log](upstream/documentation-standard.md#deviation-log).

````markdown
# DEV-<AREA>-<NNN>

- Departs from: <rule, format, screen or bug IDs>
- Reason: <what the original does and why the rebuild differs>
- Setting: <setting name, or None>
- Default: <off, on or mandatory>
- Justification: <why the rebuild's behaviour is strictly better, or what the judgement call improves and why no player would miss the original's>
- Dropped: no
````

## Parity area file

See [Parity matrix](upstream/documentation-standard.md#parity-matrix).

````markdown
# <AREA>

| Spec ID | Title | Spec status | Code | Tests | Deviations | Status | Notes |
|---|---|---|---|---|---|---|---|
````

## Reviewing a claim

Use [EVIDENCE-REVIEW](EVIDENCE-REVIEW.md) for checks relevant to the claim,
including synthetic worked examples. Record the reasoning in existing v1
sections and fields; this guidance adds no schema or confidence scale.
