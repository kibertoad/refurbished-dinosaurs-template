import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { spawnSync } from "node:child_process";

const excluded = new Set([".git", "artifacts", "bin", "obj", "TestResults", "analysis", "reference", "UserContent"]);
export function includedPath(path) {
  return !path.split(/[\\/]/).some(part => excluded.has(part));
}
export function copyWorkingTree(root, destination) {
  const listed = spawnSync("git", ["-c", `safe.directory=${root.replaceAll("\\", "/")}`,
    "ls-files", "-z", "-co", "--exclude-standard"], { cwd: root, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  if (listed.error || listed.status !== 0) {
    throw new Error(`Configuration test requires a Git checkout; initialize Git before validating a ZIP download. ${listed.error?.message ?? listed.stderr}`);
  }
  for (const rel of new Set(listed.stdout.split("\0").filter(Boolean))) {
    if (!includedPath(rel)) continue;
    const from = resolve(root, rel);
    if (!existsSync(from)) continue; // A tracked file may be deleted in the working tree.
    const target = resolve(destination, rel);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(from, target);
  }
}
