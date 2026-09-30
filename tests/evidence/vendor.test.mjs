import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { verify } from "../../tools/evidence/sync-x86.mjs";
const root = fileURLToPath(new URL("../../", import.meta.url));
test("reporter pin verifies the exact adopted set and detects mutation", t => {
  const lock = verify(root);
  const dir = mkdtempSync(join(tmpdir(), "reporter-pin-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, "tools/evidence"), { recursive: true });
  writeFileSync(join(dir, "tools/evidence/x86-lock.json"), JSON.stringify(lock));
  for (const f of lock.files) {
    mkdirSync(dirname(join(dir, f.path)), { recursive: true });
    writeFileSync(join(dir, f.path), readFileSync(join(root, f.path)));
  }
  assert.equal(verify(dir).revision, lock.revision);
  writeFileSync(join(dir, lock.files[0].path), "changed");
  assert.throws(() => verify(dir), /differs/);
  lock.files[0].path = "../escape";
  writeFileSync(join(dir, "tools/evidence/x86-lock.json"), JSON.stringify(lock));
  assert.throws(() => verify(dir), /mapping/);
});
