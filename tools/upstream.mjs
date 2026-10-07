#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, renameSync, statSync, realpathSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { checkLinks } from "./upstream-sections.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FILES = [
  ["kibertoad/refurbished-dinosaurs", "website/content/english/pages/documentation-standard.md", "docs/upstream/documentation-standard.md"],
  ["kibertoad/refurbished-dinosaurs", "website/content/english/pages/methodology.md", "docs/upstream/methodology.md"],
  ["kibertoad/refurbished-dinosaurs", "website/content/english/pages/work-protocol.md", "docs/upstream/work-protocol.md"],
  ["kibertoad/refurbished-dinosaurs", "LICENSE", "docs/upstream/LICENSE"],
];
// The checker is the npm package @scientific-method/standard-checker. CI runs the toolkit's action at a
// commit; the lock records that commit and the package version it carries, which package.json pins.
const TOOLKIT = "kibertoad/refurbished-dinosaurs-toolkit";
const CHECKER = "@scientific-method/standard-checker";
const CHECKER_MANIFEST = "packages/standard-checker/package.json";
const ACTION = `${TOOLKIT}/actions/check-documentation@`;
const VERSION = /^\d+\.\d+\.\d+$/;
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
  const { checker } = lock;
  if (!checker || checker.repository !== TOOLKIT || !revision(checker.revision) || !VERSION.test(checker.version ?? "")) throw new Error("Snapshot must pin the checker action's full commit and the exact package version it carries");
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
  const ci = read(resolve(root, ".github/workflows/ci.yml")).toString("utf8");
  const pins = ci.split(/\r?\n/).filter((line) => line.includes(ACTION));
  if (pins.length !== 1 || !pins[0].trim().startsWith(`- uses: ${ACTION}${lock.checker.revision}`) || !/@[0-9a-f]{40}(?:\s|$)/.test(pins[0])) throw new Error("CI checker action differs from the commit the snapshot pins");
  const pinned = JSON.parse(read(resolve(root, "package.json"), 65536)).devDependencies?.[CHECKER];
  if (pinned !== lock.checker.version) throw new Error(`package.json must pin ${CHECKER} to exactly ${lock.checker.version}, the version the CI action's commit carries`);
  return lock;
}
// The installed checker, resolved from this script's checkout. It must be the version the lock pins,
// so a stale node_modules cannot check against other rules than CI.
export function checkerEntry(lock, from = import.meta.url) {
  // The package is found by directory on Node's lookup path rather than by resolving its package.json,
  // which a package whose exports omit "./package.json" (as the executable reader's do) refuses.
  const manifestPath = (createRequire(from).resolve.paths(CHECKER) ?? [])
    .map((dir) => resolve(dir, CHECKER, "package.json")).find((path) => existsSync(path));
  if (!manifestPath) throw new Error(`${CHECKER} is not installed; run pnpm install`);
  const manifest = JSON.parse(read(manifestPath, 65536));
  if (manifest.version !== lock.checker.version) throw new Error(`Installed ${CHECKER} is ${manifest.version}, not the pinned ${lock.checker.version}; run pnpm install`);
  const bin = typeof manifest.bin === "string" ? manifest.bin : manifest.bin?.["standard-checker"];
  if (typeof bin !== "string") throw new Error(`Installed ${CHECKER} declares no standard-checker executable`);
  return resolve(dirname(manifestPath), bin);
}
// pnpm holds back releases younger than its minimum release age, and refresh takes a checker release
// as soon as it is tagged, so the pin is exempted. The exemption names the pinned version, so it
// moves with the pin instead of outliving it.
export function exemptChecker(workspace, version) {
  const entry = `'${CHECKER}@${version}'`, key = /^minimumReleaseAgeExclude:[ \t]*\r?\n/m;
  const pinned = /(['"]?)@scientific-method\/standard-checker@[^'"\s]+\1/g;
  if (pinned.test(workspace)) return workspace.replace(pinned, entry);
  if (key.test(workspace)) return workspace.replace(key, (line) => `${line}  - ${entry}\n`);
  if (/^minimumReleaseAgeExclude\b/m.test(workspace)) throw new Error("pnpm-workspace.yaml must list minimumReleaseAgeExclude as a block sequence for refresh to update it");
  return `${workspace}${workspace && !workspace.endsWith("\n") ? "\n" : ""}minimumReleaseAgeExclude:\n  - ${entry}\n`;
}
// The checker inputs the CI step gives under with:, as the arguments the action passes for them, so a
// local run checks what CI checks. Only flat "key: value" lines are read; anything else fails.
const INPUTS = ["code", "references", "images", "max-range", "data-dirs", "rebuild", "scheduled-generation"];
export function ciCheckerArgs(ci) {
  const lines = ci.split(/\r?\n/), at = lines.findIndex((line) => line.includes(ACTION));
  if (at < 0) throw new Error("CI does not run the pinned checker action");
  const indent = (line) => line.length - line.trimStart().length, ignored = (line) => !line.trim() || line.trim().startsWith("#");
  const step = indent(lines[at]), args = [];
  let inWith = false;
  for (const line of lines.slice(at + 1)) {
    if (ignored(line)) continue;
    if (indent(line) <= step) break;
    if (indent(line) === step + 2) {
      inWith = /^with:\s*(?:#.*)?$/.test(line.trim());
      if (!inWith && /^with:/.test(line.trim())) throw new Error("CI checker inputs must be a block of key: value lines");
      continue;
    }
    if (!inWith) continue;
    const m = /^([a-z-]+):(?:\s+(?:"([^"]*)"|'([^']*)'|([^\s#"'|>][^#]*?)))?\s*(?:#.*)?$/.exec(line.trim());
    if (!m) throw new Error(`Unsupported CI checker input line: ${line.trim()}`);
    const [, key, ...values] = m, value = values.find((v) => v !== undefined) ?? "";
    if (!INPUTS.includes(key)) continue;
    // scheduled-generation is a flag, which the action passes only for the exact value "true".
    if (key === "scheduled-generation") { if (value === "true") args.push("--scheduled-generation"); continue; }
    // The action always passes code, references and rebuild (an empty rebuild turns its check off),
    // and the other inputs only when they are set. Without a rebuild line, the checker's default
    // is the action's.
    if (value || key === "code" || key === "references" || key === "rebuild") args.push(`--${key}`, value);
  }
  return args;
}
async function download(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000), headers: { "User-Agent": "restoration-template-upstream-check" } });
  if (!response.ok) throw new Error(`Upstream ${response.status}: ${url}`);
  const parts = []; let count = 0;
  for await (const part of response.body) { count += part.length; if (count > MAX_FILE) throw new Error("Upstream response exceeds snapshot limit"); parts.push(part); }
  return Buffer.concat(parts);
}
async function checkerVersion(toolkit, fetchFile) {
  const { name, version } = JSON.parse(await fetchFile(`https://raw.githubusercontent.com/${TOOLKIT}/${toolkit}/${CHECKER_MANIFEST}`));
  if (name !== CHECKER || !VERSION.test(version ?? "")) throw new Error(`The toolkit commit carries no ${CHECKER} release version`);
  return version;
}
// The action runs the checker source at the pinned commit, and local runs the published package. The
// two hold the same rules only at the commit the toolkit tagged for that release: a later commit can
// carry the same version in package.json with unreleased changes.
async function releasedChecker(toolkit, fetchFile) {
  const version = await checkerVersion(toolkit, fetchFile), api = `https://api.github.com/repos/${TOOLKIT}/git`;
  let { object } = JSON.parse(await fetchFile(`${api}/ref/tags/${CHECKER}@${version}`));
  if (object?.type === "tag") ({ object } = JSON.parse(await fetchFile(`${api}/tags/${object.sha}`)));
  if (object?.type !== "commit" || object.sha !== toolkit) throw new Error(`The toolkit commit is not the one tagged ${CHECKER}@${version}; pass the commit of that release`);
  return version;
}
export async function prepareSnapshot(rules, toolkit, fetchFile = download) {
  if (!revision(rules) || !revision(toolkit)) throw new Error("Refresh requires explicit full --rules and --toolkit commit SHAs");
  const staged = await Promise.all(FILES.map(async ([repository, source, path]) => {
    const bytes = await fetchFile(`https://raw.githubusercontent.com/${repository}/${rules}/${source}`);
    if (!Buffer.isBuffer(bytes) || bytes.length > MAX_FILE) throw new Error("Invalid snapshot response");
    return { metadata: { repository, revision: rules, source, path, sha256: digest(bytes) }, bytes };
  }));
  if (!V1.test(staged[0].bytes.toString("utf8"))) throw new Error("Refresh would change or lose Standard v1; review required");
  const checker = { repository: TOOLKIT, revision: toolkit, version: await releasedChecker(toolkit, fetchFile) };
  return { lock: { standardVersion: 1, captured: new Date().toISOString().slice(0, 10), checker, files: staged.map((x) => x.metadata) }, staged };
}
export async function checkUpstream(root = ROOT, fetchFile = download) {
  const lock = verifySnapshot(root), repos = [...new Set([...lock.files.map((f) => f.repository), TOOLKIT])];
  const heads = new Map(await Promise.all(repos.map(async (repo) => {
    const info = JSON.parse(await fetchFile(`https://api.github.com/repos/${repo}/commits/main`));
    if (!revision(info.sha)) throw new Error("Upstream did not return a full commit SHA");
    return [repo, info.sha];
  })));
  const files = await Promise.all(lock.files.map(async (f) => {
    const latest = heads.get(f.repository), bytes = await fetchFile(`https://raw.githubusercontent.com/${f.repository}/${latest}/${f.source}`);
    return { path: f.path, pinned: f.revision, upstream: latest, changed: digest(bytes) !== f.sha256 };
  }));
  const latest = await checkerVersion(heads.get(TOOLKIT), fetchFile);
  return [...files, { path: CHECKER, pinned: lock.checker.version, upstream: latest, changed: latest !== lock.checker.version }];
}
export async function main(args, root = ROOT) {
  const [command, ...rest] = args;
  if (command === "verify" && !rest.length) { verifySnapshot(root); console.log("Pinned Standard v1, Methodology and Protocol digests and the checker pins verified offline; upstream freshness not checked."); return 0; }
  if (command === "docs") {
    const checker = checkerEntry(verifySnapshot(root));
    // The checker keeps the last value of an option, so arguments given here override CI's inputs.
    // A flag cannot be overridden that way, so --generate drops CI's --scheduled-generation: the
    // check then writes spec/index/ and PARITY.md, as the scheduled job on the main branch does.
    const generate = rest.includes("--generate"), passed = rest.filter((a) => a !== "--generate");
    const fromCi = ciCheckerArgs(read(resolve(root, ".github/workflows/ci.yml")).toString("utf8"))
      .filter((a) => !(generate && a === "--scheduled-generation"));
    const result = spawnSync(process.execPath, [checker, "--root", root, ...fromCi, ...passed], { cwd: root, stdio: "inherit" });
    if (result.error) throw result.error;
    return result.status ?? 1;
  }
  if (command === "links" && (!rest.length || (rest.length === 1 && rest[0] === "--write"))) {
    const { problems, changed } = checkLinks(root, rest[0] === "--write");
    for (const file of changed) console.log(`Wrote section ranges: ${file}`);
    for (const problem of problems) console.error(problem);
    return problems.length ? 1 : 0;
  }
  if (command === "check-upstream" && !rest.length) {
    const reports = await checkUpstream(root); console.log(JSON.stringify(reports, null, 2)); return reports.some((r) => r.changed) ? 2 : 0;
  }
  if (command === "refresh" && rest.length === 4 && rest[0] === "--rules" && rest[2] === "--toolkit") {
    // Fetch every file before any mutation. Failed downloads leave the snapshot untouched.
    const { lock, staged } = await prepareSnapshot(rest[1], rest[3]);
    const ci = read(resolve(root, ".github/workflows/ci.yml")).toString("utf8");
    const pattern = new RegExp(`${ACTION.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[0-9a-f]{40}`, "g");
    if ((ci.match(pattern) ?? []).length !== 1) throw new Error("Expected exactly one pinned checker action");
    const manifest = JSON.parse(read(resolve(root, "package.json"), 65536));
    if (!manifest.devDependencies?.[CHECKER]) throw new Error(`package.json does not pin ${CHECKER}`);
    manifest.devDependencies[CHECKER] = lock.checker.version;
    const workspacePath = resolve(root, "pnpm-workspace.yaml");
    const workspace = exemptChecker(existsSync(workspacePath) ? read(workspacePath, 65536).toString("utf8") : "", lock.checker.version);
    const writes = [...staged.map((x) => [x.metadata.path, x.bytes]),
      [".github/workflows/ci.yml", Buffer.from(ci.replace(pattern, `${ACTION}${lock.checker.revision}`))],
      ["package.json", Buffer.from(JSON.stringify(manifest, null, 2) + "\n")],
      ["pnpm-workspace.yaml", Buffer.from(workspace)],
      ["tools/upstream-lock.json", Buffer.from(JSON.stringify(lock, null, 2) + "\n")]];
    // Lock is written last: an interrupted refresh fails verification before the checker executes.
    for (const [path, bytes] of writes) { const target = resolve(root, path); mkdirSync(dirname(target), { recursive: true }); writeFileSync(target + ".refresh", bytes); renameSync(target + ".refresh", target); }
    verifySnapshot(root); console.log(`Refreshed explicit revisions; the checker is ${CHECKER} ${lock.checker.version}. Run pnpm install, review the diff and run the canonical gate before committing.`); return 0;
  }
  throw new Error("Usage: upstream.mjs verify | docs [--generate] [checker arguments] | links [--write] | check-upstream | refresh --rules <full-sha> --toolkit <full-sha>");
}
// Node resolves symlinks for the entry module, so compare real paths; a mismatch would skip main() and exit 0.
const invokedDirectly = (() => { try { return process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href; } catch { return false; } })();
if (invokedDirectly) {
  try { process.exitCode = await main(process.argv.slice(2)); }
  catch (error) { console.error(`Upstream snapshot: ${error.message}. Freshness is unverified on a network failure; no successful check is implied.`); process.exitCode = 1; }
}
