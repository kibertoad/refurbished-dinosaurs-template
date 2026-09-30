#!/usr/bin/env node
// Explicit local-checkout adoption; never fetches or refreshes upstream rules.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const files = ["NOTICE.md", "legacy-image.mjs", "report.mjs", "report.py", "requirements.txt",
  "x86/__init__.py", "x86/pe.py", "x86/image.py", "x86/machine.py", "x86/reports.py", "x86/trace.py", "x86/values.py"];
const mapping = [
  ...files.map(f => [`tools/evidence/${f}`, `tools/evidence/x86-reporter/${f}`]),
  ["LICENSE", "tools/evidence/x86-reporter/LICENSE"],
  ["docs/bounded-evidence-reporters.md", "docs/BOUNDED-EVIDENCE-REPORTERS.md"],
  ["tests/evidence/test_x86.py", "tests/evidence/test_x86.py"],
  ["tests/evidence/test_pe.py", "tests/evidence/test_pe.py"],
  ["tests/evidence/bridge.test.mjs", "tests/evidence/bridge.test.mjs"],
];
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
function safePath(base, name) {
  if (typeof name !== "string" || name.split("/").some(x => !x || x === "." || x === ".." || !/^[A-Za-z0-9_.-]+$/.test(x)))
    throw new Error("Unsafe pinned reporter path");
  return resolve(base, name);
}
export function verify(base = root) {
  const lock = JSON.parse(readFileSync(resolve(base, "tools/evidence/x86-lock.json"), "utf8"));
  if (lock.repository !== "kibertoad/refurbished-dinosaurs-toolkit" || !/^[a-f0-9]{40}$/.test(lock.revision ?? "")) throw new Error("Invalid reporter pin");
  if (!Array.isArray(lock.files) || lock.files.length !== mapping.length) throw new Error("Incomplete reporter pin");
  const expected = new Map(mapping);
  for (const f of lock.files) {
    if (expected.get(f.source) !== f.path) throw new Error("Unexpected or duplicate reporter mapping");
    expected.delete(f.source);
    if (hash(readFileSync(safePath(base, f.path))) !== f.sha256) throw new Error(`Pinned reporter differs: ${f.path}`);
  }
  return lock;
}
export function adopt(checkout, base = root) {
  const source = resolve(checkout);
  const git = (...args) => execFileSync("git", ["-c", `safe.directory=${source.replaceAll("\\", "/")}`, "-C", source, ...args]);
  if (git("status", "--porcelain").toString().trim()) throw new Error("Reporter source checkout must be clean");
  const revision = git("rev-parse", "HEAD").toString().trim();
  const candidates = mapping.map(([from, to]) => ({ source: from, path: to, bytes: git("show", `${revision}:${from}`) }));
  for (const f of candidates) {
    const path = safePath(base, f.path);
    mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, f.bytes);
  }
  const lock = { repository: "kibertoad/refurbished-dinosaurs-toolkit", revision,
    files: candidates.map(({ source, path, bytes }) => ({ source, path, sha256: hash(bytes) })) };
  writeFileSync(resolve(base, "tools/evidence/x86-lock.json"), JSON.stringify(lock, null, 2) + "\n");
  return verify(base);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2);
    if (args.length === 1 && args[0] === "--check") console.log(`Reporter pin verified: ${verify().revision}`);
    else if (args.length === 1) console.log(`Reporter adopted: ${adopt(args[0]).revision}`);
    else throw new Error("Usage: node tools/evidence/sync-x86.mjs <--check|clean-toolkit-checkout>");
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
