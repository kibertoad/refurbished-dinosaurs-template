#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, renameSync, statSync, realpathSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FILES = [
  ["kibertoad/refurbished-dinosaurs", "website/content/english/pages/documentation-standard.md", "docs/upstream/documentation-standard.md"],
  ["kibertoad/refurbished-dinosaurs", "website/content/english/pages/work-protocol.md", "docs/upstream/work-protocol.md"],
  ["kibertoad/refurbished-dinosaurs", "LICENSE", "docs/upstream/LICENSE"],
  ["kibertoad/refurbished-dinosaurs-toolkit", "tools/check-documentation.mjs", "tools/vendor/check-documentation.mjs"],
  ["kibertoad/refurbished-dinosaurs-toolkit", "LICENSE", "tools/vendor/LICENSE"],
];
const MAX_FILE = 2 * 1024 * 1024;
const V1 = /follows version 1(?![0-9]|\.[0-9])/;
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const revision = (x) => typeof x === "string" && /^[0-9a-f]{40}$/.test(x);
function read(path, max = MAX_FILE) {
  const stat = statSync(path);
  if (!stat.isFile() || stat.size > max) throw new Error(`Invalid or oversized snapshot file: ${path}`);
  return readFileSync(path);
}
export function validateLock(lock) {
  if (lock.standardVersion !== 1 || !Array.isArray(lock.files) || lock.files.length !== FILES.length) throw new Error("Snapshot must pin Standard v1 and all expected source files");
  const seen = new Set(), revisions = new Map();
  for (const f of lock.files) {
    if (!FILES.some(([repo, source, path]) => f.repository === repo && f.source === source && f.path === path) || seen.has(f.path)) throw new Error("Unknown, duplicate or unsafe snapshot mapping");
    if (!revision(f.revision) || !/^[0-9a-f]{64}$/.test(f.sha256)) throw new Error("Snapshot requires full commit and SHA-256 values");
    if (revisions.has(f.repository) && revisions.get(f.repository) !== f.revision) throw new Error("A repository snapshot must use one revision");
    revisions.set(f.repository, f.revision); seen.add(f.path);
  }
  return lock;
}
export function verifySnapshot(root = ROOT) {
  const lock = validateLock(JSON.parse(read(resolve(root, "tools/upstream-lock.json"), 65536)));
  for (const f of lock.files) if (digest(read(resolve(root, f.path))) !== f.sha256) throw new Error(`Snapshot digest mismatch: ${f.path}; restore or explicitly refresh the pinned source`);
  const standard = read(resolve(root, "docs/upstream/documentation-standard.md")).toString("utf8");
  if (!V1.test(standard)) throw new Error("The pinned Standard text no longer identifies version 1; review is required");
  const checker = lock.files.find((f) => f.path === "tools/vendor/check-documentation.mjs");
  const ci = read(resolve(root, ".github/workflows/ci.yml")).toString("utf8");
  const pins = ci.split(/\r?\n/).filter((line) => line.includes("kibertoad/refurbished-dinosaurs-toolkit/actions/check-documentation@"));
  if (pins.length !== 1 || !pins[0].trim().startsWith(`- uses: kibertoad/refurbished-dinosaurs-toolkit/actions/check-documentation@${checker.revision}`) || !/@[0-9a-f]{40}(?:\s|$)/.test(pins[0])) throw new Error("CI checker revision differs from the verified offline checker");
  return lock;
}
async function download(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000), headers: { "User-Agent": "restoration-template-upstream-check" } });
  if (!response.ok) throw new Error(`Upstream ${response.status}: ${url}`);
  const parts = []; let count = 0;
  for await (const part of response.body) { count += part.length; if (count > MAX_FILE) throw new Error("Upstream response exceeds snapshot limit"); parts.push(part); }
  return Buffer.concat(parts);
}
export async function prepareSnapshot(rules, toolkit, fetchFile = download) {
  if (!revision(rules) || !revision(toolkit)) throw new Error("Refresh requires explicit full --rules and --toolkit commit SHAs");
  const staged = await Promise.all(FILES.map(async ([repository, source, path]) => {
    const rev = repository.endsWith("-toolkit") ? toolkit : rules;
    const bytes = await fetchFile(`https://raw.githubusercontent.com/${repository}/${rev}/${source}`);
    if (!Buffer.isBuffer(bytes) || bytes.length > MAX_FILE) throw new Error("Invalid snapshot response");
    return { metadata: { repository, revision: rev, source, path, sha256: digest(bytes) }, bytes };
  }));
  if (!V1.test(staged[0].bytes.toString("utf8"))) throw new Error("Refresh would change or lose Standard v1; review required");
  return { lock: { standardVersion: 1, captured: new Date().toISOString().slice(0, 10), files: staged.map((x) => x.metadata) }, staged };
}
export async function checkUpstream(root = ROOT, fetchFile = download) {
  const lock = verifySnapshot(root), repos = [...new Set(lock.files.map((f) => f.repository))];
  const heads = new Map(await Promise.all(repos.map(async (repo) => {
    const info = JSON.parse(await fetchFile(`https://api.github.com/repos/${repo}/commits/main`));
    if (!revision(info.sha)) throw new Error("Upstream did not return a full commit SHA");
    return [repo, info.sha];
  })));
  return Promise.all(lock.files.map(async (f) => {
    const latest = heads.get(f.repository), bytes = await fetchFile(`https://raw.githubusercontent.com/${f.repository}/${latest}/${f.source}`);
    return { path: f.path, pinned: f.revision, upstream: latest, changed: digest(bytes) !== f.sha256 };
  }));
}
export async function main(args, root = ROOT) {
  const [command, ...rest] = args;
  if (command === "verify" && !rest.length) { verifySnapshot(root); console.log("Pinned Standard v1, Protocol and checker digests verified offline; upstream freshness not checked."); return 0; }
  if (command === "docs") {
    verifySnapshot(root);
    const result = spawnSync(process.execPath, [resolve(root, "tools/vendor/check-documentation.mjs"), "--root", root, ...rest], { cwd: root, stdio: "inherit" });
    if (result.error) throw result.error;
    return result.status ?? 1;
  }
  if (command === "check-upstream" && !rest.length) {
    const reports = await checkUpstream(root); console.log(JSON.stringify(reports, null, 2)); return reports.some((r) => r.changed) ? 2 : 0;
  }
  if (command === "refresh" && rest.length === 4 && rest[0] === "--rules" && rest[2] === "--toolkit") {
    // Fetch every file before any mutation. Failed downloads leave the snapshot untouched.
    const { lock, staged } = await prepareSnapshot(rest[1], rest[3]);
    const ciPath = resolve(root, ".github/workflows/ci.yml"), ci = read(ciPath).toString("utf8");
    const pattern = /kibertoad\/refurbished-dinosaurs-toolkit\/actions\/check-documentation@[0-9a-f]{40}/g;
    if ((ci.match(pattern) ?? []).length !== 1) throw new Error("Expected exactly one pinned checker action");
    const writes = [...staged.map((x) => [x.metadata.path, x.bytes]),
      [".github/workflows/ci.yml", Buffer.from(ci.replace(pattern, `kibertoad/refurbished-dinosaurs-toolkit/actions/check-documentation@${rest[3]}`))],
      ["tools/upstream-lock.json", Buffer.from(JSON.stringify(lock, null, 2) + "\n")]];
    // Lock is written last: an interrupted refresh fails verification before the checker executes.
    for (const [path, bytes] of writes) { const target = resolve(root, path); mkdirSync(dirname(target), { recursive: true }); writeFileSync(target + ".refresh", bytes); renameSync(target + ".refresh", target); }
    verifySnapshot(root); console.log("Refreshed explicit revisions. Review the diff and run the canonical gate before committing."); return 0;
  }
  throw new Error("Usage: upstream.mjs verify | docs [checker arguments] | check-upstream | refresh --rules <full-sha> --toolkit <full-sha>");
}
// Node resolves symlinks for the entry module, so compare real paths; a mismatch would skip main() and exit 0.
const invokedDirectly = (() => { try { return process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href; } catch { return false; } })();
if (invokedDirectly) {
  try { process.exitCode = await main(process.argv.slice(2)); }
  catch (error) { console.error(`Upstream snapshot: ${error.message}. Freshness is unverified on a network failure; no successful check is implied.`); process.exitCode = 1; }
}
