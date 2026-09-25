---
name: maintainer-session
description: Prepare a script for a person to run the original game and record evidence, or turn the recordings from such a session into spec findings and experiments. Use when queue items need a human run, when the owner offers time with the original, or when captures, saves or notes from a run arrive.
---

# Maintainer session

The rules are in the [work protocol](https://dinorefurb.com/work-protocol/#maintainer-sessions).
The maintainer's time is the scarcest resource the project has: prepare it so
nobody needs to ask a question during the session.

## Prepare

1. Collect the items under `Maintainer run` in every `queue/<AREA>.md`. Leave
   out any whose starting state cannot be reached yet (for example, a save
   patch whose fields are not yet `supported`); say why.
2. Order them so steps from the same starting state follow each other, and
   put the items that raise the most entries first.
3. For each step write: the entries it concerns; the build (by `BLD-` ID); how
   to reach the starting state (the save patch and base save, or every choice
   on the way into a new game); the one input to vary and how many times; what
   to record and in what form; and where captures go (`GAME_DIR/captures/`,
   named by their xxh3, taken at the screen's native resolution with scaling
   and filtering off).
4. Write the script to `artifacts/maintainer-session-<date>.md` (ignored), give
   the owner its path and an estimate of how long it takes, and stop.

## Ingest

1. For each step the owner ran, write a dynamic finding or an experiment with
   its fixture under the standard, recording the environment and the hashes of
   captures and saves. Nothing that holds the game's content is committed.
2. Give the entries the status the evidence supports; a run beside an existing
   static finding usually makes an entry `established`.
3. Delete the settled items from the queue; add `Tried:` to any step that did
   not settle its item, and new items for new questions.
4. Run the documentation check and commit, with a `Spec:` trailer, one commit
   per area. Print the status block from `research-item` for each.
