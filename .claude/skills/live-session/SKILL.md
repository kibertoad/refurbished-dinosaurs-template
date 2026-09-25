---
name: live-session
description: Request, prepare and ingest a live session, in which a person runs the original game and the agent measures the running process at the points the person signals. Use when Live session items can be taken up, when the owner accepts a request in docs/live-sessions/, during the session itself, or when captures, saves or notes from one arrive.
---

# Live session

The rules are in the [work protocol](https://dinorefurb.com/work-protocol/#live-sessions).
The maintainer's time is the scarcest resource the project has: prepare it so
nobody needs to ask a question during the session. Never wait idle for one.

## Request

1. Runs are the last resort. Request a session only when no item under
   `Static` in any `queue/<AREA>.md` can be worked on, and each item it would
   settle has a static attempt recorded under `Tried:`. The items must also
   block a slice or be enough to fill a sitting.
2. Collect those `Live session` items. Leave out any whose starting state
   cannot be reached yet (for example, a save patch whose fields are not yet
   `supported`), and say why.
3. Write `docs/live-sessions/<name>.md` from `docs/live-sessions/README.md`:
   `Status: requested`, the build (by `BLD-` ID) and the machine, the items,
   the slices they block, the expected length, and the script (next section).
   Do not repeat a request the owner declined unless something the request did
   not have has changed.
4. List it in the handover's live session requests, commit, and carry on with
   work that needs no run. The owner answers by editing the Status line.

## Script

Order the steps so those from the same starting state follow each other, and
the items that raise the most entries come first. Each step gives: the entries
it concerns; how to reach the starting state (the save patch and base save, or
every choice on the way into a new game); the one input to vary and how many
times; the moment the maintainer signals; what the agent measures then (the
address to read, the breakpoint, the structure to dump, the frame to capture)
and in what form; and where captures go (`GAME_DIR/captures/`, named by their
xxh3, taken at the screen's native resolution with scaling and filtering off).
Write and try each measurement beforehand as far as the original allows
without a person, from the static readings.

## Run

Once the Status is `accepted`, hold the run lock
(`~/.refurbished-dinosaurs/run.lock`) for the whole session. Follow the
script; at each signal take the measurement, confirm it, and tell the
maintainer to carry on. Attach only to the process the maintainer started for
the session. Remove the lock at the end.

## Ingest

1. For each step, write a dynamic finding or an experiment with its fixture
   under the standard, recording the environment and the hashes of captures
   and saves. Nothing that holds the game's content is committed.
2. Give the entries the status the evidence supports for everything they
   say, as `research-item` step 5 describes, and make the parity changes of
   `research-item` step 7.
3. Delete the settled items from the queue; add `Tried:` to any step that did
   not settle its item, and new items for new questions. Delete the request
   file in the same change, and put what the session showed about the tools
   into `docs/RUNTIME.md`.
4. Run the documentation check and commit, with a `Spec:` trailer, one commit
   per area, adding `Parity:` for the rows whose status changed. Print the
   status block from `research-item` for each.
