---
name: live-session
description: Request, prepare and ingest a live session, in which a person runs the original game and the agent measures the running process at the points the person signals. Use when Live session items can be taken up, when the owner accepts a request in docs/live-sessions/, during the session itself, or when captures, saves or notes from one arrive.
---

# Live session

The rules are in the [work protocol](https://dinorefurb.com/work-protocol/#live-sessions).
The maintainer's time is the scarcest resource the project has: prepare it so
nobody needs to ask a question during the session. Never wait idle for one.

## Request

1. Runs are the last resort for each question. Request a session only for
   `Live session` items that have their own static attempt under `Tried:` or
   ask for the run confirming a static reading, and only when they block a
   slice or are enough to fill a sitting. Take only items your goal may take
   up (every entry they name is in an area it claims).
2. Collect those items by their IDs. Leave out any whose starting state
   cannot be reached yet (for example, a save patch whose fields are not yet
   `supported`), and say why.
3. Write `docs/live-sessions/<name>.md` from `docs/live-sessions/README.md`:
   `Status: requested`, the build (by `BLD-` ID) and the machine, the item
   IDs, the slices they block, the expected length, and the script (next section).
   Do not repeat a request the owner declined unless something the request did
   not have has changed.
4. Commit the request, and carry on with work that needs no run. The file is
   the record that the request is open; the owner answers by editing the
   Status line.

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

Once the Status is `accepted`, hold the run lock (path in `docs/RUNTIME.md`)
for the whole session, and add the ID of the process the maintainer started
to it. That process is the one you may attach to and read without having
started it; never send it input or stop it. Follow the script; at each signal
take the measurement, confirm it, and tell the maintainer to carry on. Delete
the lock at the end, and set the request's Status to `held, YYYY-MM-DD`.

## Ingest

1. For each step, write a dynamic finding or an experiment with its fixture
   under the standard, recording the environment and the hashes of captures
   and saves. Nothing that holds the game's content is committed.
2. Give the entries the status the evidence supports for everything they
   say, as `research-item` step 5 describes, and make the parity changes of
   `research-item` step 7.
3. Delete the settled items from the queue; add `Tried:` to any step that did
   not settle its item, and new items for new questions.
4. Work one research batch per area: run the documentation check and commit,
   with a `Spec:` trailer, adding `Parity:` for the rows whose status
   changed and `Queue:` for the items it closed, and print the status block from `research-item` for each. The
   first batch puts what the session showed about the tools into
   `docs/RUNTIME.md`, and the last one deletes the request file.
