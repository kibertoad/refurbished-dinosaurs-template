#!/usr/bin/env node
// The node checks of the fast gate, listed once: tools/Invoke-Validation.ps1 and
// .githooks/pre-commit both run this script. Each check runs from the tree this script is in.
// --no-ksy is passed to the documentation check, which then skips compiling the .ksy files.
import { realpathSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export function checks(noKsy = false) {
  return [
    ["Documentation check", "tools/upstream.mjs", ["docs", "--check", ...(noKsy ? ["--no-ksy"] : [])]],
    ["Research queue tracking", "tools/Check-ResearchTracking.mjs", []],
  ];
}
export function main(args, root = ROOT) {
  if (args.some((a) => a !== "--no-ksy")) throw new Error("Usage: Invoke-NodeChecks.mjs [--no-ksy]");
  for (const [name, script, rest] of checks(args.includes("--no-ksy"))) {
    const result = spawnSync(process.execPath, [resolve(root, script), ...rest], { cwd: root, stdio: "inherit" });
    if (result.error) throw result.error;
    if (result.status !== 0) { console.error(`${name} failed.`); return result.status ?? 1; }
  }
  return 0;
}
// Node resolves symlinks for the entry module, so compare real paths; a mismatch would skip main() and exit 0.
const invokedDirectly = (() => { try { return process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href; } catch { return false; } })();
if (invokedDirectly) {
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
