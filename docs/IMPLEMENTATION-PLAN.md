# Implementation plan

> Fill this document in before writing implementation code. Replace the italic
> guidance with real content and delete nothing structural.

## Game profile

| | |
|---|---|
| Original title | {{ORIGINAL_TITLE}} |
| Developer | {{ORIGINAL_DEVELOPER}} |
| Publisher | {{ORIGINAL_PUBLISHER}} |
| Release year | {{ORIGINAL_RELEASE_YEAR}} |
| Genre | {{ORIGINAL_GENRE}} |
| Eligibility | _released in 2004 or earlier, and no official remake or remaster on sale: the outcome, the evidence, and the date checked. Checked once; settled from then on unless the owner asks for a re-check._ |
| Editions available for validation | _their `BLD-` IDs; `docs/SOURCE-EDITIONS.md` holds the detail_ |
| Existing research relied on | _their `SRC-` IDs: manuals, community documentation, prior analysis_ |

## Scope

_What this project intends to reproduce, in the player's terms._

**Non-goals.** _What it deliberately will not do: remakes of cut content,
multiplayer, editors, engine features the original never had. An explicit
non-goal is cheaper than a half-finished system._

## Slices

Organize the work as playable vertical slices, ordered so that each one leaves
the game runnable. A workable default order is source identification and extraction,
separate asset extraction plus assetless startup and diagnostics, native resolution and scaling,
title-to-first-interaction flow, deterministic state and replay, and only then
breadth.

| # | Slice | Player-visible outcome | Depends on | Status |
|---|---|---|---|---|
| 1 | _name_ | _what a player can do afterwards_ | — | planned |
| 2 | | | | |

### Slice 1 — _name_

- **Outcome.** _What the player can do when it is finished._
- **Evidence.** _The manual sections, observations, or data-file facts it rests
  on, by their IDs in `spec/`._
- **Acceptance — rules.** _Deterministic behavior that must hold._
- **Acceptance — presentation.** _Resolution, scaling, timing, audio._
- **Acceptance — original content.** _What is extracted, and how a missing or
  unsupported source behaves._
- **Extractor boundary.** _Which exact licensed source is accepted, which bounded
  transformations produce the versioned local pack, how complete staged output is
  verified and promoted transactionally, and how the runtime rejects missing,
  incomplete, stale, or foreign packs without reading the original installation._
- **Automated tests.** _The tests that prove it. Tests that compare against the
  original read it from `GAME_DIR` and skip without it; the rest need no
  original content._
- **Observed parity.** _The `PARITY.md` rows the slice should make `validated`,
  and the experiments or captures their tests compare against._

_Repeat this block per slice. Keep finished slices here with their status
updated; the plan is the record of what was decided, not only of what is next._

## Open questions

Track every uncertainty here until it is settled by evidence. A question is
closed by a document update, not by a plausible assumption in code.

| ID | Question | Blocks | Owner | Status |
|---|---|---|---|---|
| Q1 | _…_ | slice _n_ | _who_ | open |

## Risks

_Formats that may resist clean-room description, editions that differ in ways
that break a shared extraction path, timing or audio behavior that may not be
reproducible on modern hardware, and what the fallback is for each._

## Done when

_The release-shaped definition of finished for this plan: which slices, which
parity matrix rows validated, which platforms packaged and smoke-tested._
