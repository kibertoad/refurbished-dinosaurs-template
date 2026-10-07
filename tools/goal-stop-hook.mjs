#!/usr/bin/env node
// Claude Code Stop hook for goals that run on a `goal/<name>` branch.
//
// When the agent ends its turn on a branch named `goal/<name>` whose tip has
// `docs/goals/<name>.md`, the hook blocks that stop once and tells the agent to
// start the next item unless one of the stop reasons in docs/goals/README.md
// applies. A second stop in a row (`stop_hook_active` in the hook's input) is let
// through, so an agent that has a reason to stop can always stop, and so can a
// person, by interrupting. On any other branch, without the goal file, or when
// Git or the input cannot be read, the hook lets the stop through and prints
// nothing.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function goalFor(directory) {
  let branch;
  try {
    branch = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      cwd: directory,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
  const match = /^goal\/([A-Za-z0-9._-]+)$/.exec(branch);
  if (!match) return null;
  const file = join("docs", "goals", `${match[1]}.md`);
  return existsSync(join(directory, file)) ? file.replaceAll("\\", "/") : null;
}

export function decide(input, directory) {
  if (input?.stop_hook_active) return null;
  const goal = goalFor(directory);
  if (!goal) return null;
  return {
    decision: "block",
    reason:
      `The goal in ${goal} is running on this branch. Finishing a batch, writing the handover ` +
      "or a long conversation is not a reason to stop. Unless a stop reason in " +
      "docs/goals/README.md applies, start the next item now (run start-session if the " +
      "session's handover was just committed). If one applies, say which and stop.",
  };
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? "")).href) {
  let input = {};
  try {
    const text = readFileSync(0, "utf8");
    if (text.trim()) input = JSON.parse(text);
  } catch {
    process.exit(0);
  }
  const directory = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
  const result = decide(input, directory);
  if (result) process.stdout.write(`${JSON.stringify(result)}\n`);
}
