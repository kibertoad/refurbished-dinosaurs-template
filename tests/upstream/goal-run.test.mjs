import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { MAX_BLOCKS, decide, start, stop } from "../../tools/goal-run.mjs";

const tool = resolve(import.meta.dirname, "../../tools/goal-run.mjs");
const git = (dir, ...args) => execFileSync("git", args, { cwd: dir, stdio: "ignore" });
const commit = (dir, message) => git(dir, "-c", "commit.gpgsign=false", "commit", "-q", "--no-verify", "--allow-empty", "-m", message);

function repository(t, goalFile = "combat-static.md") {
  const dir = mkdtempSync(join(tmpdir(), "goal-run-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  git(dir, "init", "-q");
  git(dir, "config", "user.email", "test@example.invalid");
  git(dir, "config", "user.name", "Test");
  writeFileSync(join(dir, "README.md"), "test\n");
  if (goalFile) {
    mkdirSync(join(dir, "docs", "goals"), { recursive: true });
    writeFileSync(join(dir, "docs", "goals", goalFile), "# goal\n");
  }
  git(dir, "add", "-A");
  commit(dir, "start");
  return dir;
}

function run(cwd, args, input, env = {}) {
  return spawnSync(process.execPath, [tool, ...args], {
    cwd,
    input: input === undefined ? "" : typeof input === "string" ? input : JSON.stringify(input),
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

test("blocks every stop of the session that started the goal, until it stops the goal", (t) => {
  const dir = repository(t);
  assert.equal(decide({ session_id: "a" }, dir), null);
  assert.equal(run(dir, ["start", "combat-static"]).status, 0);
  const first = run(dir, ["hook"], { session_id: "a", cwd: dir, stop_hook_active: false });
  assert.equal(first.status, 0, first.stderr);
  const output = JSON.parse(first.stdout);
  assert.equal(output.decision, "block");
  assert.match(output.reason, /docs\/goals\/combat-static\.md/);
  assert.match(output.reason, /goal-run\.mjs stop/);
  commit(dir, "batch");
  assert.equal(decide({ session_id: "a", stop_hook_active: true }, join(dir, "docs"))?.decision, "block");
  assert.equal(decide({ session_id: "b" }, dir), null);
  assert.equal(run(dir, ["stop"]).status, 0);
  assert.equal(decide({ session_id: "a" }, dir), null);
});

test("lets stops through once HEAD has not moved over the block limit, until the next commit", (t) => {
  const dir = repository(t);
  start(dir, "combat-static");
  for (let i = 0; i < MAX_BLOCKS; i += 1) assert.equal(decide({ session_id: "a" }, dir)?.decision, "block");
  assert.equal(decide({ session_id: "a" }, dir), null);
  commit(dir, "batch");
  assert.equal(decide({ session_id: "a" }, dir)?.decision, "block");
});

test("start binds the goal anew, and a deleted goal file ends the blocking", (t) => {
  const dir = repository(t);
  start(dir, "combat-static");
  decide({ session_id: "a" }, dir);
  start(dir, "combat-static");
  assert.equal(decide({ session_id: "b" }, dir)?.decision, "block");
  rmSync(join(dir, "docs", "goals", "combat-static.md"));
  assert.equal(decide({ session_id: "b" }, dir), null);
});

test("a worktree's goal does not block sessions in another checkout", (t) => {
  const main = repository(t);
  const worktree = `${main}-worktree`;
  t.after(() => rmSync(worktree, { recursive: true, force: true }));
  git(main, "worktree", "add", "-q", "-b", "goals/combat", worktree);
  start(worktree, "combat-static");
  const fromWorktree = run(main, ["hook"], { session_id: "a", cwd: worktree }, { CLAUDE_PROJECT_DIR: main });
  assert.equal(JSON.parse(fromWorktree.stdout).decision, "block", fromWorktree.stderr);
  assert.equal(decide({ session_id: "b" }, main), null);
});

test("start refuses an unknown goal, and the hook passes on bad input or outside Git", (t) => {
  const dir = repository(t, "other.md");
  const missing = run(dir, ["start", "combat-static"]);
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /docs\/goals\/combat-static\.md/);
  assert.throws(() => start(dir, "../other"));
  assert.equal(run(dir, ["start", "other"]).status, 0);
  for (const input of ["not json", "null"]) {
    const result = run(dir, ["hook"], input, { CLAUDE_PROJECT_DIR: dir });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, "");
  }
  stop(dir);
  const notRepository = mkdtempSync(join(tmpdir(), "goal-run-none-"));
  t.after(() => rmSync(notRepository, { recursive: true, force: true }));
  assert.equal(decide({ session_id: "a" }, notRepository), null);
  assert.equal(run(dir, []).status, 2);
});
