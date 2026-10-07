#!/usr/bin/env node
// Keeps a session working under a goal until it has a reason to stop.
//
//   node tools/goal-run.mjs start <name>   start-session, under the goal in docs/goals/<name>.md
//   node tools/goal-run.mjs stop           end-session, when a stop reason in docs/goals/README.md applies
//   node tools/goal-run.mjs hook           the Claude Code Stop hook in .claude/settings.json
//
// `start` writes a run marker, goal-run.json, into the Git directory of the worktree it runs in,
// so it is never committed and each worktree has its own. The first stop after `start` binds the
// marker to that conversation's session ID. From then on the hook blocks every stop of that
// session while the marker and the goal file exist. `stop` deletes the marker. When HEAD has not
// moved over MAX_BLOCKS blocked stops in a row, the hook lets stops through until a new commit,
// so an agent that makes no progress is not held in a loop. Other sessions, other worktrees,
// and stops when Git or the input cannot be read pass, and the hook prints nothing for them.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const MAX_BLOCKS = 3;
const NAME = /^[A-Za-z0-9._-]+$/;

const git = (directory, args) =>
  execFileSync("git", args, { cwd: directory, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
const markerPath = (directory) => join(git(directory, ["rev-parse", "--absolute-git-dir"]), "goal-run.json");
const goalPath = (directory, goal) => join(git(directory, ["rev-parse", "--show-toplevel"]), "docs", "goals", `${goal}.md`);

export function start(directory, goal) {
  if (!NAME.test(goal ?? "")) throw new Error(`Not a goal name: ${goal}`);
  if (!existsSync(goalPath(directory, goal))) throw new Error(`No goal file docs/goals/${goal}.md in this checkout`);
  const marker = { goal, session: null, head: null, blocks: 0 };
  writeFileSync(markerPath(directory), `${JSON.stringify(marker)}\n`);
  return marker;
}

export function stop(directory) {
  rmSync(markerPath(directory), { force: true });
}

export function decide(input, directory) {
  try {
    const path = markerPath(directory);
    if (!existsSync(path)) return null;
    const marker = JSON.parse(readFileSync(path, "utf8"));
    if (!NAME.test(marker?.goal ?? "") || !existsSync(goalPath(directory, marker.goal))) return null;
    const session = typeof input?.session_id === "string" ? input.session_id : null;
    if (marker.session && session && marker.session !== session) return null;
    marker.session ||= session;
    const head = git(directory, ["rev-parse", "HEAD"]);
    if (marker.head !== head) Object.assign(marker, { head, blocks: 0 });
    if (marker.blocks >= MAX_BLOCKS) return null;
    marker.blocks += 1;
    writeFileSync(path, `${JSON.stringify(marker)}\n`);
    return {
      decision: "block",
      reason:
        `This session runs the goal in docs/goals/${marker.goal}.md. Finishing a batch, writing the ` +
        "handover or a long conversation is not a reason to stop. Unless a stop reason in " +
        "docs/goals/README.md applies, start the next item now (run start-session if the " +
        "session's handover was just committed). If one applies, including a finished wrap-up or " +
        "the owner telling you to stop, run `node tools/goal-run.mjs stop`, say which reason " +
        "applies, and stop.",
    };
  } catch {
    return null;
  }
}

const invokedDirectly = (() => { try { return process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href; } catch { return false; } })();
if (invokedDirectly) {
  const [command, goal] = process.argv.slice(2);
  if (command === "hook") {
    let input = {};
    try {
      const text = readFileSync(0, "utf8");
      if (text.trim()) input = JSON.parse(text);
    } catch {
      process.exit(0);
    }
    if (input === null || typeof input !== "object") process.exit(0);
    // The session's own directory comes first: it may be a worktree while the project directory
    // is another checkout.
    const directory = input.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
    const result = decide(input, directory);
    if (result) process.stdout.write(`${JSON.stringify(result)}\n`);
  } else if (command === "start" || command === "stop") {
    try {
      if (command === "start") start(process.cwd(), goal);
      else stop(process.cwd());
    } catch (error) {
      process.stderr.write(`${error.message}\n`);
      process.exit(1);
    }
  } else {
    process.stderr.write("Usage: node tools/goal-run.mjs start <name> | stop | hook\n");
    process.exit(2);
  }
}
