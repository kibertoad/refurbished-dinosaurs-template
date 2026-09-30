#!/usr/bin/env node
// Reports and configurations stay in GAME_DIR and are not committed.
import { readFileSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { run as runX86 } from "./x86-reporter/report.mjs";
import { readMz, incomingCalls } from "./legacy-image.mjs";
import { reviewFlow, boundedTable } from "./review.mjs";
import { joinInventories, inventoryPath, verifyInventory } from "./inventory.mjs";

function readBounded(path, max = 256 * 1024 * 1024) {
  const stat = statSync(path);
  if (!stat.isFile() || stat.size > max) throw new Error(`Input too large or not a file: ${path}`);
  return readFileSync(path);
}
export function run(args) {
  const [command, configPath, ...extra] = args;
  if (!command || !configPath || extra.length) throw new Error("Usage: node tools/evidence/report.mjs <operand|incoming|flow|table|inventory|inventory-check|x86-COMMAND> <local-config.json>");
  const configFile = resolve(configPath);
  // The pinned reporter reads and bounds its own config.
  if (command.startsWith("x86-")) return runX86([command.slice(4), configFile]);
  const config = JSON.parse(readBounded(configFile, 16 * 1024 * 1024)), base = dirname(configFile);
  const local = (p) => { if (typeof p !== "string" || !p) throw new Error("Expected an input path"); return resolve(base, p); };
  if (command === "flow") return reviewFlow(JSON.parse(readBounded(local(config.graph), 32 * 1024 * 1024)), config.entry, config.limit);
  if (!["operand", "incoming", "table", "inventory", "inventory-check"].includes(command)) throw new Error(`Unknown report command: ${command}`);
  const bytes = readBounded(local(config.source)), digest = createHash("sha256").update(bytes).digest("hex");
  if (!/^[a-f0-9]{64}$/.test(config.sha256 ?? "") || digest !== config.sha256) throw new Error("Source SHA-256 does not match the explicit local analysis baseline");
  // SHA-256 is an input guard for this tool, not a replacement for Standard v1's XXH3 build identity.
  let result;
  if (command === "table") result = boundedTable(bytes, config.table);
  else {
    const image = readMz(bytes, config.loadSegment);
    if (command === "operand") result = image.resolveOperand(config.site, config.targetOffset);
    if (command === "incoming") result = incomingCalls(image, config.target, { limit: config.limit, controls: config.controls });
    if (command === "inventory-check") {
      const inventory = config.inventory;
      if (!inventory || typeof inventory !== 'object') throw new Error('Supply an inventory check contract');
      result = verifyInventory(image, config.build, config.manifest,
        readBounded(local(inventory.path), 32 * 1024 * 1024).toString('utf8'),
        inventory.repositoryPath, inventory);
    }
    if (command === "inventory") {
      const views = config.views.map((v) => ({ ...v, text: readBounded(local(v.path), 32 * 1024 * 1024).toString("utf8") }));
      result = joinInventories(image, config.manifest, views);
      const relative = inventoryPath(config.build, config.manifest);
      result.destination = relative;
      if (config.writeRoot) {
        const output = resolve(local(config.writeRoot), relative);
        mkdirSync(dirname(output), { recursive: true });
        writeFileSync(output, result.tsv, { encoding: "utf8", flag: "wx" });
        delete result.tsv;
      }
    }
  }
  return { sourceIdentity: { size: bytes.length, sha256: digest }, ...result };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { console.log(JSON.stringify(run(process.argv.slice(2)), null, 2)); }
  catch (error) { console.error(`Evidence report: ${error.message}`); process.exitCode = 1; }
}
