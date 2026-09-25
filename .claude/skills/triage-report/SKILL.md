---
name: triage-report
description: Record and triage a report from someone who played the rebuild - words, steps and screenshots of something that did not work as they expected. Use whenever a tester's report, bug description or screenshot arrives, on either side of the clean room, and for open files in docs/reports/ at the start of a research session.
---

# Report from testing

The rules are in the [work protocol](https://dinorefurb.com/work-protocol/#reports-from-testing).
Reports arrive when they happen to. Never wait for one, never ask for testing
as a step of your own work, and never count a row as checked because someone
might play it.

## Record (any session)

1. Take the ID from `Next ID:` in `docs/reports/README.md` and raise it.
2. Save each screenshot outside the repository, named by its xxh3 hash:
   screenshots of the rebuild in `GAME_DIR/reports/`, of the original in
   `GAME_DIR/captures/`, adding an `index.tsv` line there (hash, build,
   screen entry, the state it shows). Never commit a screenshot.
3. Write `docs/reports/R-NNN.md` from the README's layout: who and when, the
   commit or release played, their words, their steps, the screenshots by
   hash. Commit it on its own.
4. On the implementation side, stop there unless the spec already says what
   the rebuild should do: then fix it as an `implement-rows` batch. Never look
   at screenshots of the original. Everything else waits for research.

## Triage (research session)

Take a report only if your goal claims the areas it concerns, or you are
under no goal. One research batch per report:

1. Find the entries and parity rows it concerns. Compare a rebuild screenshot
   with the capture of the same screen in `GAME_DIR/captures/` (find it
   through `index.tsv`). A tester's screenshot is rarely at canvas size with
   scaling off, so compare what is shown, not pixels.
2. Decide which case it is and act:
   - **The rebuild departs from the spec**: set the row's Code from
     `complete` to `partial` and start its Notes with `Defect (R-NNN):` and
     what the rebuild does against what the entry says, in the spec's terms
     only.
   - **The spec is silent or may be wrong**: add an open question to the
     entry (or create an `unknown` entry with its parity row) and a queue
     item that names the report. What a tester remembers is a lead, not
     evidence.
   - **It brings a screenshot or recording of the original** of a known
     build, with how the game got there: record a dynamic finding with the
     capture's hash, as `research-item` step 5 does, and check it against
     the `Live session` and `Agent run` items it could settle.
   - **A deviation that is on explains it**: change nothing.
   - **Not enough to tell**: add a `## Missing` section saying what would
     decide it, leave the file, and carry on.
3. Delete the report file unless it is waiting on what it is missing. Run the
   documentation check, and commit with `Spec:`, `Parity:` and
   `Report: R-NNN` trailers.
4. Tell the reporter what happened, naming the IDs, and print the status
   block from `research-item` with `Batch: report R-NNN`.
