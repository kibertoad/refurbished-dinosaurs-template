# Reports from testing

Next ID: R-001

People play the rebuild and report what does not work the way they expect, in
words and with screenshots, whenever they happen to. Nothing waits for them.
The [work protocol](https://dinorefurb.com/work-protocol/#reports-from-testing)
sets the rules, and the `triage-report` skill records and triages them.

One file per report that has not been triaged yet, or that waits for what it
is missing, named by its ID: `docs/reports/R-001.md`. Take the ID from the
`Next ID:` line above and raise it; an ID is never reused. The triage batch
deletes the file once its content is in the spec, the queue or a parity row;
git keeps it, and the commits that settle it carry a `Report:` trailer.

Screenshots are never committed. Screenshots of the rebuild go in
`GAME_DIR/reports/` and screenshots of the original in `GAME_DIR/captures/`,
each named by its xxh3 hash, and the report cites them by hash.

A report:

```markdown
# R-001

- From: the tester's name or handle, 2026-09-25.
- Played: commit 3f2a9c1 (or release 0.3.0).
- Screenshots: rebuild 9f1c2a7e4b3d5a61; original none.

## Report

In their own words: the combat panel shows the defender's name where the
attacker's should be, after a mutual attack from the second turn onwards.

## Steps

As they gave them, or `None given.`

## Missing

Only while waiting: what would decide it, such as a screenshot of the same
panel in the original, or the save they played from.
```
