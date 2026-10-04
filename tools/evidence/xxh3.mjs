#!/usr/bin/env node
// Prints each file's xxh3, the XXH3-128 hash the documentation standard names files by (as
// `xxhsum -H2` prints it), one "<xxh3>  <path>" line per argument in order. It uses the executable
// reader's sourceXxh3, so it gives exactly the hash the evidence commands check.
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { sourceXxh3 } from "@scientific-method/executable-reader";

const MAX_BYTES = 256 * 1024 * 1024;

export function hashFiles(paths) {
  if (!paths.length) throw new Error("Usage: node tools/evidence/xxh3.mjs <file>...");
  return paths.map((path) => {
    const stat = statSync(path);
    if (!stat.isFile() || stat.size > MAX_BYTES) throw new Error(`Not a file of at most 256 MiB: ${path}`);
    return { path, xxh3: sourceXxh3(readFileSync(path)) };
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    for (const { path, xxh3 } of hashFiles(process.argv.slice(2))) console.log(`${xxh3}  ${path}`);
  } catch (error) {
    console.error(`xxh3: ${error.message}`);
    process.exitCode = 1;
  }
}
