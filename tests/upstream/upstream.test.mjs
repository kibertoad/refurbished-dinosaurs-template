import { verify as verifyReporter } from "../../tools/evidence/sync-x86.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, cpSync, rmSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { verifySnapshot, validateLock, prepareSnapshot, checkUpstream } from "../../tools/upstream.mjs";
import { copyWorkingTree, includedPath } from "./copy-working-tree.mjs";
import { checkLinks, linkFile, sections } from "../../tools/upstream-sections.mjs";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const lock = JSON.parse(readFileSync(resolve(root, "tools/upstream-lock.json")));
function fixture(t) {
  const dir = mkdtempSync(resolve(tmpdir(), "v1-snapshot-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const path of [...lock.files.map(f => f.path), "tools/upstream-lock.json", ".github/workflows/ci.yml"]) {
    mkdirSync(dirname(resolve(dir, path)), { recursive: true }); cpSync(resolve(root, path), resolve(dir, path));
  }
  return dir;
}
test("pinned bytes and active CI action agree offline", () => assert.equal(verifySnapshot(root).standardVersion, 1));
test("edited source or checker is rejected before execution", t => {
  const dir = fixture(t); writeFileSync(resolve(dir, lock.files[0].path), "edited");
  assert.throws(() => verifySnapshot(dir), /digest mismatch/);
});
test("v2, duplicate mappings, traversal, short commits and inconsistent revisions fail", () => {
  for (const mutate of [x => x.standardVersion = 2, x => x.files[1] = x.files[0],
    x => x.files[0].path = "../escape", x => x.files[0].revision = "abc",
    x => x.files[0].revision = "a".repeat(40)]) {
    const copy = structuredClone(lock); mutate(copy); assert.throws(() => validateLock(copy));
  }
});
test("CI drift is rejected", t => {
  const dir = fixture(t), path = resolve(dir, ".github/workflows/ci.yml");
  const sha = lock.files.find(f => f.path.includes("check-documentation")).revision;
  writeFileSync(path, readFileSync(path, "utf8").replace(sha, "b".repeat(40)));
  assert.throws(() => verifySnapshot(dir), /CI checker revision/);
});
test("refresh stages exact explicit revisions and rejects lost v1 declaration or failed download", async () => {
  const rules = "a".repeat(40), toolkit = "b".repeat(40);
  const fetcher = async url => Buffer.from(url.endsWith("documentation-standard.md") ? "follows version 1" : "synthetic");
  const result = await prepareSnapshot(rules, toolkit, fetcher);
  assert.equal(result.staged.length, 6); validateLock(result.lock);
  assert.equal(result.lock.files.at(-1).revision, toolkit);
  await assert.rejects(prepareSnapshot("main", toolkit, fetcher), /full/);
  await assert.rejects(prepareSnapshot(rules, toolkit, async () => Buffer.from("version 2")), /Standard v1/);
  await assert.rejects(prepareSnapshot(rules, toolkit, async () => { throw Error("offline"); }), /offline/);
  verifySnapshot(root);
});
test("freshness distinguishes unchanged bytes, changed content and unavailable network", async t => {
  const dir = fixture(t);
  const fetcher = async url => {
    if (url.includes("api.github.com")) return Buffer.from(JSON.stringify({ sha: "c".repeat(40) }));
    const f = lock.files.find(f => url.endsWith("/" + f.source) && url.includes(f.repository + "/"));
    return readFileSync(resolve(dir, f.path));
  };
  assert.ok((await checkUpstream(dir, fetcher)).every(r => !r.changed));
  const changed = await checkUpstream(dir, async url => url.endsWith("work-protocol.md") ? Buffer.from("changed") : fetcher(url));
  assert.equal(changed.filter(r => r.changed).length, 1);
  await assert.rejects(checkUpstream(dir, async () => { throw Error("network unavailable"); }), /network unavailable/);
  verifySnapshot(dir);
});
test("project configuration preserves upstream and reporter bytes and licenses", t => {
  const dir = fixture(t);
  copyWorkingTree(root, dir);
  // Upstream currently has no replaceable tokens. Make the scratch snapshots
  // sensitive to configuration without changing the real pinned files.
  const scratchLockPath = resolve(dir, "tools/upstream-lock.json");
  const scratchLock = JSON.parse(readFileSync(scratchLockPath));
  for (const path of ["docs/upstream/documentation-standard.md", "vendor/LICENSE"]) {
    const target = resolve(dir, path);
    const bytes = Buffer.concat([readFileSync(target), Buffer.from("\n{{DISPLAY_NAME}}\n")]);
    writeFileSync(target, bytes);
    scratchLock.files.find(f => f.path === path).sha256 = createHash("sha256").update(bytes).digest("hex");
  }
  writeFileSync(scratchLockPath, JSON.stringify(scratchLock));
  verifySnapshot(dir);
  const reporterLockPath = resolve(dir, "tools/evidence/x86-lock.json");
  const reporterLock = JSON.parse(readFileSync(reporterLockPath));
  for (const path of ["tools/evidence/x86-reporter/NOTICE.md", "docs/BOUNDED-EVIDENCE-REPORTERS.md"]) {
    const target = resolve(dir, path);
    const bytes = Buffer.concat([readFileSync(target), Buffer.from("\n{{DISPLAY_NAME}}\n")]);
    writeFileSync(target, bytes);
    reporterLock.files.find(f => f.path === path).sha256 = createHash("sha256").update(bytes).digest("hex");
  }
  writeFileSync(reporterLockPath, JSON.stringify(reporterLock));
  verifyReporter(dir);
  const configured = spawnSync("pwsh", ["-NoProfile", "-File", resolve(dir, "tools/Configure-Project.ps1"),
    "-ProjectName", "EvidenceSample", "-DisplayName", "Evidence Sample", "-AppId", "00000000-0000-0000-0000-000000000001",
    "-CopyrightYear", "2026", "-Force"], { cwd: dir, encoding: "utf8" });
  assert.equal(configured.status, 0, configured.error?.message ?? configured.stdout + configured.stderr);
  assert.equal(JSON.parse(readFileSync(resolve(dir, "tools/project-config.json"))).projectName, "EvidenceSample");
  verifySnapshot(dir);
  verifyReporter(dir);
});

test("configuration copy includes Git-visible files and excludes ignored or local output", t => {
  const source = mkdtempSync(resolve(tmpdir(), "v1-copy-source-"));
  const destination = mkdtempSync(resolve(tmpdir(), "v1-copy-target-"));
  t.after(() => { rmSync(source, { recursive: true, force: true }); rmSync(destination, { recursive: true, force: true }); });
  const put = (path, text) => { mkdirSync(dirname(resolve(source, path)), { recursive: true }); writeFileSync(resolve(source, path), text); };
  assert.throws(() => copyWorkingTree(source, destination), /requires a Git checkout/);
  const git = (...args) => { const result = spawnSync("git", args, { cwd: source, encoding: "utf8" }); assert.equal(result.status, 0, result.stderr); };
  git("init", "--quiet");
  put(".gitignore", "node_modules/\n");
  put("tracked.md", "tracked"); put("deleted.md", "deleted"); git("add", ".");
  rmSync(resolve(source, "deleted.md"));
  put("new.md", "Restoration.Core"); put("node_modules/ignored.md", "ignored");
  put("artifacts/local.md", "excluded even if untracked and not ignored");
  put(".github/workflows/test.yml", "workflow"); put("Start {{SHORTCUT_NAME}}.bat", "launcher");
  copyWorkingTree(source, destination);
  for (const path of ["tracked.md", "new.md", ".github/workflows/test.yml", "Start {{SHORTCUT_NAME}}.bat"]) {
    assert.equal(readFileSync(resolve(destination, path), "utf8"), readFileSync(resolve(source, path), "utf8"));
  }
  for (const path of ["deleted.md", "node_modules", "artifacts", ".git"]) assert.equal(existsSync(resolve(destination, path)), false, path);
  assert.equal(includedPath("nested\\obj\\output.txt"), false);
  assert.equal(includedPath("nested/obj/output.txt"), false);
  assert.equal(includedPath(".github\\workflows\\test.yml"), true);
});

test("links to the standard reach a heading of the local copy and state its lines", () => {
  assert.deepEqual(checkLinks(root).problems, []);
});

test("section ranges run from the heading to the next heading of the same level", () => {
  const ranges = sections("---\ntitle: x\n---\n\n## A\ntext\n\n### B\n```\n# not a heading\n```\n\n## C\nlast\n");
  assert.deepEqual(ranges.get("a"), { start: 5, end: 11 });
  assert.deepEqual(ranges.get("b"), { start: 8, end: 11 });
  assert.deepEqual(ranges.get("c"), { start: 13, end: 14 });
  assert.equal(ranges.has("not-a-heading"), false);
});

test("link check reports misplaced, missing or stale ranges and rewrites them", () => {
  const pages = new Map([["work-protocol", new Map([["batches", { start: 10, end: 20 }]])], ["methodology", new Map()], ["documentation-standard", new Map()]]);
  const check = (text, write) => linkFile(root, "AGENTS.md", text, pages, write);
  assert.deepEqual(check("[B](docs/upstream/work-protocol.md#batches) (lines 10-20).").problems, []);
  assert.match(check("[B](docs/upstream/work-protocol.md#batches).").problems[0], /needs \(lines 10-20\), not no range/);
  assert.match(check("[B](docs/upstream/work-protocol.md#batches) (lines 9-20).").problems[0], /not \(lines 9-20\)/);
  assert.match(check("[B](docs/upstream/work-protocol.md#batchez)").problems[0], /names no heading/);
  assert.match(check("[B](docs/standard/work-protocol.md#batches)").problems[0], /misses docs\/upstream/);
  assert.match(check("[P](docs/upstream/work-protocol.md) (lines 1-2)").problems[0], /names no section/);
  assert.match(check("see https://dinorefurb.com/work-protocol/").problems[0], /published page/);
  const written = check("[B](docs/upstream/work-protocol.md#batches) (lines 9-20) and [B](docs/upstream/work-protocol.md#batches).", true);
  assert.equal(written.text, "[B](docs/upstream/work-protocol.md#batches) (lines 10-20) and [B](docs/upstream/work-protocol.md#batches) (lines 10-20).");
  assert.deepEqual(written.problems, []);
  assert.match(linkFile(root, "docs/upstream/methodology.md", "[x](/work-protocol/#batchez)", pages).problems[0], /names no heading/);
});
