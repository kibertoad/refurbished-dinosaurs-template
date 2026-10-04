#!/usr/bin/env node
// Published dependency locations and diagnostics; no copied package implementation.
import { readFileSync, existsSync, realpathSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SETUP = "Run ./tools/Restore-ToolDependencies.ps1 to install the locked tooling dependencies.";
export function enginePython(root = ROOT, env = process.env) {
  return env.EVIDENCE_PYTHON || resolve(root, "artifacts/evidence-python", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
}
export function verifyNpmPackages(root = ROOT) {
  const manifest = JSON.parse(readFileSync(resolve(root, "package.json")));
  const lock = JSON.parse(readFileSync(resolve(root, "package-lock.json")));
  for (const name of ["@scientific-method/executable-reader", "@scientific-method/standard-checker"]) {
    const expected = manifest.devDependencies?.[name], row = lock.packages?.[`node_modules/${name}`];
    if (!/^\d+\.\d+\.\d+$/.test(expected ?? "") || row?.version !== expected || !row?.integrity?.startsWith("sha512-"))
      throw new Error(`Missing or inconsistent exact npm lock for ${name}. ${SETUP}`);
    const path = resolve(root, "node_modules", name, "package.json");
    if (!existsSync(path) || JSON.parse(readFileSync(path)).version !== expected)
      throw new Error(`Installed ${name} differs from ${expected}. ${SETUP}`);
  }
}
export function checkerScript() {
  verifyNpmPackages();
  return createRequire(import.meta.url).resolve("@scientific-method/standard-checker/dist/standard-checker.js");
}
export function verifyEngine(root = ROOT, env = process.env) {
  const expected = [...readFileSync(resolve(root, "tools/evidence/requirements.txt"), "utf8").matchAll(/^([a-z-]+)==([^\s]+) /gm)];
  if (expected.length !== 2) throw new Error("Engine requirements must pin the engine and Capstone wheel hashes.");
  const child = spawnSync(enginePython(root, env), ["-c", "import importlib.metadata,json; print(json.dumps({n:importlib.metadata.version(n) for n in ['scientific-method-engine','capstone']}))"],
    {encoding: "utf8", timeout: 30000, maxBuffer: 65536, env});
  if (child.error || child.status !== 0) throw new Error(`Published Python engine unavailable. ${SETUP}`);
  const versions = JSON.parse(child.stdout);
  for (const [, name, version] of expected) if (versions[name] !== version)
    throw new Error(`Installed ${name} is ${versions[name]}, expected ${version}. ${SETUP}`);
  return enginePython(root, env);
}
export function withEngine(callback) {
  const previous = process.env.EVIDENCE_PYTHON;
  process.env.EVIDENCE_PYTHON = verifyEngine();
  try { return callback(); }
  finally { if (previous === undefined) delete process.env.EVIDENCE_PYTHON; else process.env.EVIDENCE_PYTHON = previous; }
}
export function ghidraScriptPath() {
  const child = spawnSync(verifyEngine(), ["-m", "scientific_method_engine", "ghidra-scripts"], {encoding: "utf8", timeout: 30000, maxBuffer: 65536});
  if (child.error || child.status !== 0) throw new Error(child.stderr || SETUP);
  return child.stdout.trim();
}
export function main(args) {
  if (args.length !== 1 || !["verify", "ghidra"].includes(args[0])) throw new Error("Usage: tool-dependencies.mjs verify | ghidra");
  verifyNpmPackages();
  // ghidraScriptPath verifies the engine itself.
  if (args[0] === "ghidra") console.log(ghidraScriptPath());
  else { verifyEngine(); console.log("Published npm/Python tooling versions and exact locks verified; upstream freshness not checked."); }
}
const invokedDirectly = (() => { try { return process.argv[1] && pathToFileURL(realpathSync(process.argv[1])).href === import.meta.url; } catch { return false; } })();
if (invokedDirectly) {
  try { main(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
