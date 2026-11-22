#!/usr/bin/env node
// Takes later template changes into a configured project. docs/TEMPLATE-SYNC.md says when and how.
//
// A configured project's files hold its own values where the template has {{TOKEN}}s, its project
// name where the template has Restoration.*, and its platform's guide in the platform-guide blocks.
// A diff of the template's own files would touch those lines and conflict in every such file. So
// sync configures a scratch copy of the template at each revision with the project's own
// tools/project-config.json, and merges the difference between the two configured copies into the
// project file by file with `git merge-file`.
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG = "tools/project-config.json";
export const DEFAULT_REPOSITORY = "kibertoad/refurbished-dinosaurs-template";
const USAGE = "Usage: template.mjs check [--repository <repo>] | sync --to <full commit> [--from <full commit>] [--repository <repo>]";
const revision = (x) => typeof x === "string" && /^[0-9a-f]{40}$/.test(x);
const short = (x) => x.slice(0, 7);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...options });
  if (result.error) throw new Error(`${command} could not start: ${result.error.message}`);
  return result;
}
function git(cwd, args, options = {}) {
  const result = run("git", ["-c", `safe.directory=${cwd.replaceAll("\\", "/")}`, ...args], { cwd, ...options });
  if (result.status !== 0 && !options.allowFailure) throw new Error(`git ${args.join(" ")} failed: ${(result.stderr || result.stdout || "").trim()}`);
  return result;
}
const pwsh = () => process.env.PWSH || "pwsh";

// "owner/name" is a GitHub repository; anything else (a URL or a local path) is passed to git as is.
export function repositoryUrl(repository) {
  return /^[\w.-]+\/[\w.-]+$/.test(repository) ? `https://github.com/${repository}.git` : repository;
}
function readConfig(root) {
  const config = JSON.parse(readFileSync(resolve(root, CONFIG), "utf8"));
  if (config.configured !== true) throw new Error(`${CONFIG} is not configured; template sync is for a configured project`);
  return config;
}
function parseOptions(args, allowed) {
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.startsWith("--") ? args[i].slice(2) : null;
    if (!key || !allowed.includes(key) || args[i + 1] === undefined || key in options) throw new Error(USAGE);
    options[key] = args[i + 1];
  }
  return options;
}

export function checkTemplate(root, { repository } = {}) {
  const config = readConfig(root), recorded = config.template?.revision ?? "";
  if (!revision(recorded)) throw new Error(`${CONFIG} records no template.revision; run sync with --from <full commit the project was made from>`);
  const repo = repository ?? config.template?.repository ?? DEFAULT_REPOSITORY;
  const listed = git(root, ["ls-remote", repositoryUrl(repo), "refs/heads/main"]).stdout.trim().split(/\s+/)[0];
  if (!revision(listed)) throw new Error(`${repo} returned no main commit`);
  return { repository: repo, recorded, latest: listed, behind: listed !== recorded };
}

function walk(dir, prefix = "", out = []) {
  for (const entry of readdirSync(join(dir, prefix), { withFileTypes: true })) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (!prefix && entry.name === ".git") continue;
    if (entry.isDirectory()) walk(dir, path, out);
    else if (entry.isFile()) out.push(path);
  }
  return out;
}
const readOrNull = (path) => existsSync(path) ? readFileSync(path) : null;
const binary = (...buffers) => buffers.some((b) => b && b.subarray(0, 8000).includes(0));
function put(path, bytes) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, bytes); }

// Merges the change between two configured template copies into the project, one path at a time.
// The project's own tools/project-config.json is left to Configure and to the revision update.
export function mergeTrees(root, baseDir, newDir, labels, scratch) {
  const report = { updated: [], added: [], removed: [], merged: [], conflicts: [], keptChanged: [], skippedRemoved: [] };
  const empty = join(scratch, "empty");
  writeFileSync(empty, "");
  const paths = [...new Set([...walk(baseDir), ...walk(newDir)])].sort();
  for (const path of paths) {
    if (path === CONFIG) continue;
    const base = readOrNull(join(baseDir, path)), next = readOrNull(join(newDir, path));
    if (base && next ? base.equals(next) : base === next) continue;
    const target = resolve(root, path), mine = readOrNull(target);
    if (mine && next && mine.equals(next)) continue;
    if (!next) {
      if (!mine) continue;
      if (mine.equals(base)) { rmSync(target); report.removed.push(path); } else report.keptChanged.push(path);
      continue;
    }
    if (!mine) {
      if (base) report.skippedRemoved.push(path); else { put(target, next); report.added.push(path); }
      continue;
    }
    if (base && mine.equals(base)) { put(target, next); report.updated.push(path); continue; }
    if (binary(base, next, mine)) { report.conflicts.push(`${path} (binary: kept the project's file)`); continue; }
    const merged = run("git", ["merge-file", "-p", "-L", "project", "-L", labels[0], "-L", labels[1],
      target, base ? join(baseDir, path) : empty, join(newDir, path)], { encoding: "buffer" });
    if (merged.status === null || merged.status > 127) throw new Error(`git merge-file failed on ${path}: ${merged.stderr}`);
    put(target, merged.stdout);
    (merged.status === 0 ? report.merged : report.conflicts).push(path);
  }
  return report;
}

// A scratch copy of the template at `sha`, configured with the project's values.
function configuredCopy(cache, dir, sha, config) {
  git(cache, ["worktree", "add", "--quiet", "--detach", dir, sha]);
  writeFileSync(join(dir, CONFIG), JSON.stringify({ ...config, configured: false }, null, 2) + "\n");
  const configured = run(pwsh(), ["-NoProfile", "-File", join(dir, "tools/Configure-Project.ps1")], { cwd: dir });
  if (configured.status !== 0) throw new Error(`Configure-Project.ps1 at ${short(sha)} failed with the project's configuration:\n${configured.stdout}${configured.stderr}`);
}

function writeRevision(root, repository, to) {
  const path = resolve(root, CONFIG), config = JSON.parse(readFileSync(path, "utf8"));
  config.template = { repository, revision: to };
  writeFileSync(path, JSON.stringify(config, null, 2) + "\n");
}

export function syncTemplate(root, { to, from, repository } = {}) {
  const config = readConfig(root), recorded = config.template?.revision ?? "";
  if (!revision(to)) throw new Error("sync needs --to <full 40-character template commit>");
  if (from !== undefined && !revision(from)) throw new Error("--from must be a full 40-character template commit");
  if (from && recorded && from !== recorded) throw new Error(`${CONFIG} records template revision ${recorded}; pass --from only when no revision is recorded`);
  const base = from ?? recorded;
  if (!revision(base)) throw new Error(`${CONFIG} records no template.revision; pass --from <full commit the project was made from or last synced to>`);
  const repo = repository ?? config.template?.repository ?? DEFAULT_REPOSITORY;
  if (base === to) return { upToDate: true, base, to };
  if (git(root, ["status", "--porcelain"]).stdout.trim()) throw new Error("The working tree has changes; commit or stash them first, so the sync's changes can be reviewed and undone on their own");

  const scratch = mkdtempSync(join(tmpdir(), "template-sync-"));
  let report;
  try {
    const cache = join(scratch, "cache");
    mkdirSync(cache);
    git(cache, ["init", "--quiet"]);
    // The scratch copies are checked out with the project's line-ending settings, so a file the
    // project has not changed compares equal byte for byte.
    for (const key of ["core.autocrlf", "core.eol"]) {
      const value = git(root, ["config", "--get", key], { allowFailure: true }).stdout.trim();
      if (value) git(cache, ["config", key, value]);
    }
    for (const sha of [base, to]) git(cache, ["fetch", "--quiet", "--depth", "1", repositoryUrl(repo), sha]);
    const baseDir = join(scratch, "base"), newDir = join(scratch, "new");
    configuredCopy(cache, baseDir, base, config);
    configuredCopy(cache, newDir, to, config);
    report = mergeTrees(root, baseDir, newDir, [`template ${short(base)}`, `template ${short(to)}`], scratch);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }

  // Configure reapplies the project's values and platform blocks to what came in, and writes the
  // configuration in the new revision's form. The revision is written after it, so a Configure that
  // fails on a conflicted script still leaves the record right.
  const followUps = [];
  const configure = resolve(root, "tools/Configure-Project.ps1");
  const configured = existsSync(configure) ? run(pwsh(), ["-NoProfile", "-File", configure, "-Force"], { cwd: root }) : null;
  if (configured?.status !== 0) followUps.push({ command: "pwsh -NoProfile -File ./tools/Configure-Project.ps1 -Force", output: configured ? configured.stdout + configured.stderr : "tools/Configure-Project.ps1 is missing" });
  writeRevision(root, repo, to);
  const upstream = resolve(root, "tools/upstream.mjs");
  const links = existsSync(upstream) ? run(process.execPath, [upstream, "links", "--write"], { cwd: root }) : null;
  if (links?.status !== 0) followUps.push({ command: "node tools/upstream.mjs links --write", output: links ? links.stdout + links.stderr : "tools/upstream.mjs is missing" });
  return { upToDate: false, base, to, repository: repo, ...report, followUps };
}

function printSync(result) {
  if (result.upToDate) { console.log(`The project already records template revision ${result.to}.`); return 0; }
  const list = (title, paths) => { if (paths.length) console.log(`\n${title} (${paths.length}):\n${paths.map((p) => `  ${p}`).join("\n")}`); };
  console.log(`Merged ${result.repository} ${short(result.base)}..${short(result.to)} into the working tree. Nothing is committed.`);
  list("Took the template's change (the project had not changed these files)", [...result.updated, ...result.added, ...result.removed]);
  list("Merged into files the project has changed: review that the project's content is still right", result.merged);
  list("Conflicts: resolve the markers, keeping the project's records", result.conflicts);
  list("The template deleted these files and the project has changed them: kept, decide by hand", result.keptChanged);
  list("The template changed these files and the project has deleted them: left deleted", result.skippedRemoved);
  for (const step of result.followUps) console.log(`\nFailed: ${step.command}. Run it again once the conflicts are resolved.\n${step.output.trim()}`);
  console.log(`\ntools/project-config.json now records template revision ${result.to}. Review the whole diff, run the validation gate, then commit.`);
  return result.conflicts.length || result.keptChanged.length || result.followUps.length ? 2 : 0;
}

export function main(args, root = ROOT) {
  const [command, ...rest] = args;
  if (command === "check") {
    const report = checkTemplate(root, parseOptions(rest, ["repository"]));
    console.log(JSON.stringify(report, null, 2));
    if (report.behind && /^[\w.-]+\/[\w.-]+$/.test(report.repository)) console.log(`Changes: https://github.com/${report.repository}/compare/${report.recorded}...${report.latest}`);
    return report.behind ? 2 : 0;
  }
  if (command === "sync") return printSync(syncTemplate(root, parseOptions(rest, ["to", "from", "repository"])));
  throw new Error(USAGE);
}

// Node resolves symlinks for the entry module, so compare real paths; a mismatch would skip main() and exit 0.
const invokedDirectly = (() => { try { return process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href; } catch { return false; } })();
if (invokedDirectly) {
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (error) { console.error(`Template sync: ${error.message}`); process.exitCode = 1; }
}
