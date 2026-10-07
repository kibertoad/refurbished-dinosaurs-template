import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { decide } from "../../tools/goal-stop-hook.mjs";

const hook = resolve(import.meta.dirname, "../../tools/goal-stop-hook.mjs");

function repository(t, branch, goalFile) {
  const dir = mkdtempSync(join(tmpdir(), "goal-stop-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const git = (...args) => execFileSync("git", args, { cwd: dir, stdio: "ignore" });
  git("init", "-q");
  git("config", "user.email", "test@example.invalid");
  git("config", "user.name", "Test");
  git("checkout", "-q", "-b", branch);
  writeFileSync(join(dir, "README.md"), "test\n");
  if (goalFile) {
    mkdirSync(join(dir, "docs", "goals"), { recursive: true });
    writeFileSync(join(dir, "docs", "goals", goalFile), "# goal\n");
  }
  git("add", "-A");
  git("commit", "-q", "-m", "start");
  return dir;
}

function run(dir, input) {
  return spawnSync(process.execPath, [hook], {
    input: typeof input === "string" ? input : JSON.stringify(input),
    encoding: "utf8",
    env: { ...process.env, CLAUDE_PROJECT_DIR: dir },
  });
}

test("blocks the first stop on a goal branch whose goal file exists", (t) => {
  const dir = repository(t, "goal/combat-static", "combat-static.md");
  const result = run(dir, { hook_event_name: "Stop", stop_hook_active: false });
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.decision, "block");
  assert.match(output.reason, /docs\/goals\/combat-static\.md/);
  assert.match(output.reason, /docs\/goals\/README\.md/);
});

test("lets a second stop in a row through", (t) => {
  const dir = repository(t, "goal/combat-static", "combat-static.md");
  const result = run(dir, { hook_event_name: "Stop", stop_hook_active: true });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "");
});

test("lets the stop through off a goal branch, without the goal file, or on bad input", (t) => {
  const main = repository(t, "main", "combat-static.md");
  assert.equal(run(main, { stop_hook_active: false }).stdout, "");
  const missing = repository(t, "goal/combat-static", "other.md");
  assert.equal(run(missing, { stop_hook_active: false }).stdout, "");
  const goal = repository(t, "goal/combat-static", "combat-static.md");
  const bad = run(goal, "not json");
  assert.equal(bad.status, 0);
  assert.equal(bad.stdout, "");
  const notRepository = mkdtempSync(join(tmpdir(), "goal-stop-none-"));
  t.after(() => rmSync(notRepository, { recursive: true, force: true }));
  assert.equal(decide({ stop_hook_active: false }, notRepository), null);
});
