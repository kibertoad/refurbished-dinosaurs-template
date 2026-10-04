import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { hashFiles } from "../../tools/evidence/xxh3.mjs";

test("xxh3 helper prints the hash xxhsum -H2 prints, one line per file in order", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "xxh3-")); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const empty = join(dir, "empty.bin"), abc = join(dir, "abc.bin");
  writeFileSync(empty, ""); writeFileSync(abc, "abc");
  assert.deepEqual(hashFiles([abc, empty]).map((row) => row.xxh3),
    ["06b05ab6733a618578af5f94892f3950", "99aa06d3014798d86001c324468d497f"]);
  const cli = spawnSync(process.execPath, [resolve(import.meta.dirname, "../../tools/evidence/xxh3.mjs"), abc, empty], { encoding: "utf8" });
  assert.equal(cli.status, 0, cli.stderr);
  assert.equal(cli.stdout, `06b05ab6733a618578af5f94892f3950  ${abc}\n99aa06d3014798d86001c324468d497f  ${empty}\n`);
  assert.throws(() => hashFiles([]), /Usage/);
  assert.throws(() => hashFiles([dir]), /Not a file/);
});
