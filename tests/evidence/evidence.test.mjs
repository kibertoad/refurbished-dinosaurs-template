import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sourceXxh3 } from "@scientific-method/executable-reader";
import { readMz, incomingCalls } from "../../tools/evidence/legacy-image.mjs";
import { reviewFlow, boundedTable } from "../../tools/evidence/review.mjs";
import { inventoryPath, parseInventory, joinInventories, verifyInventory } from "../../tools/evidence/inventory.mjs";
import { run } from "../../tools/evidence/report.mjs";

function synthetic() {
  const b = Buffer.alloc(592), w = (p, n) => b.writeUInt16LE(n, p), d = (p, n) => b.writeUInt32LE(n, p);
  b.write("MZ"); w(4, 1); w(8, 4); w(6, 2); w(24, 28);
  w(28, 19); w(32, 35);
  b[80] = 0x9A; w(81, 32); w(83, 12);
  b[96] = 0x9A; w(97, 16); w(99, 13); // Different segment pair, same trampoline.
  b.write("FBOV", 512); d(516, 64); d(520, 128); d(524, 2);
  w(136, 12); w(140, 2);
  w(256, 0x3FCD); d(260, 0); w(264, 32); w(266, 2); w(268, 1);
  w(288, 0x3FCD); w(290, 0);
  b[532] = 0x9A; w(533, 16); w(535, 0); w(560, 7);
  return b;
}

test("MZ and FBOV operands retain raw, loaded, trampoline and canonical identities", () => {
  const image = readMz(synthetic());
  const r = image.resolveOperand(83, 32);
  assert.equal(r.raw, 12); assert.equal(r.loadedAddress, "100C:0020");
  assert.equal(r.fileOffset, "0x00000120"); assert.equal(r.canonicalTarget, "0x00000210");
  assert.equal(image.resolveOperand(99, 16).canonicalTarget, r.canonicalTarget);
  const overlay = image.resolveOperand(535, 16);
  assert.equal(overlay.kind, "FBOV fixup"); assert.equal(overlay.descriptor, 0);
  assert.equal(overlay.canonicalTarget, "0x00000050");
  assert.equal(image.resolveOperand(85, 0).relocated, false);
});

test("incoming candidates preserve aliases, controls and truncation", () => {
  const image = readMz(synthetic()), report = incomingCalls(image, 528, { controls: [80, 96], limit: 1 });
  assert.equal(report.total, 2); assert.equal(report.matches.length, 1); assert.equal(report.truncated, true);
  assert.match(report.matches[0].classification, /candidate/);
  assert.throws(() => incomingCalls(image, 528, { controls: [81] }), /Positive control/);
  assert.match(incomingCalls(image, 81).negative, /no positive control/);
  const negative = incomingCalls(image, 81, { controls: [80] });
  assert.match(negative.negative, /this domain/);
  // A coverage control need not call the target; the report shows what it resolved to.
  assert.deepEqual(negative.controls, [{ callSite: "0x00000050", canonicalTarget: "0x00000210" }]);
  // A call byte before an unresolvable relocated word is reported, not fatal to the search.
  const bogus = synthetic(); bogus.writeUInt16LE(0x0F00, 99);
  const partial = incomingCalls(readMz(bogus), 528, { controls: [80] });
  assert.equal(partial.total, 1); assert.equal(partial.unresolved.length, 1); assert.equal(partial.unresolved[0].callSite, "0x00000060");
  // An unresolved site cannot serve as a control.
  assert.throws(() => incomingCalls(readMz(bogus), 528, { controls: [96] }), /Positive control/);
});

for (const [name, edit, error] of [
  ["truncated MZ", (b) => b.subarray(0, 20), /header/],
  ["page tail", (b) => { b.writeUInt16LE(512, 2); return b; }, /page/],
  ["relocation table", (b) => { b.writeUInt16LE(63, 24); return b; }, /relocation table/],
  ["duplicate relocation", (b) => { b.writeUInt16LE(19, 32); return b; }, /Duplicate/],
  ["payload outside envelope", (b) => { b.writeUInt32LE(1, 516); return b; }, /code and fixups/],
  ["wrong descriptor type", (b) => { b.writeUInt16LE(2, 132); return b; }, /trap prefix/],
  ["missing trap", (b) => { b[256] = 0; return b; }, /trap prefix/],
  ["odd fixups", (b) => { b.writeUInt16LE(3, 266); return b; }, /fixup dimensions/],
  ["bad fixup operand", (b) => { b.writeUInt16LE(31, 560); return b; }, /fixup operand/],
  ["bad descriptor token", (b) => { b.writeUInt16LE(16, 535); return b; }, /invalid FBOV fixup/],
  ["trampoline outside code", (b) => { b.writeUInt16LE(32, 290); return b; }, /trampoline/],
  ["extended executable", (b) => { b.writeUInt32LE(64, 60); b.write("PE", 64); return b; }, /unsupported/],
  ["extended header past load image", (b) => { b.writeUInt32LE(576, 60); b.write("NE", 576); return b; }, /unsupported/],
]) test(`reject ${name}`, () => assert.throws(() => readMz(edit(synthetic())), error));

test("flow traverses every branch beyond an early return and counts discontiguous bytes", () => {
  const report = reviewFlow({ entries: [10], instructions: [
    { start: 10, size: 2, kind: "branch", next: [20, 40], calls: [] },
    { start: 20, size: 1, kind: "return", next: [], calls: [] },
    { start: 40, size: 3, kind: "call", next: [50], calls: [200] },
    { start: 50, size: 1, kind: "return", next: [], calls: [] },
  ] }, 10);
  assert.equal(report.bodyBytes, 7); assert.equal(report.spans.length, 4);
  assert.equal(report.exits.length, 2); assert.equal(report.calls.length, 1);
  assert.equal(report.localPathsResolved, true); assert.match(report.status, /never promotes/);
});

test("explicit overlapping targets survive while undecoded edges remain gaps", () => {
  const graph = { entries: [0], instructions: [
    { start: 0, size: 4, kind: "branch", next: [2, 30], calls: [] },
    { start: 2, size: 1, kind: "return", next: [], calls: [] },
  ] };
  const result = reviewFlow(graph, 0);
  assert.equal(result.overlaps.length, 1); assert.equal(result.bodyBytes, 4);
  assert.equal(result.localPathsResolved, false); assert.match(result.gaps[0].reason, /No verified/);
  assert.match(reviewFlow(graph, 0, 1).gaps[0].reason, /limit/);
});

test("other entries and analyzer ownership cannot silently join a caller", () => {
  const graph = { entries: [0, 10], instructions: [
    { start: 0, size: 1, kind: "ordinary", next: [10], calls: [], owner: 20 },
    { start: 10, size: 1, kind: "return", next: [], calls: [] },
  ] };
  const report = reviewFlow(graph, 0);
  assert.equal(report.ownership.length, 1); assert.match(report.gaps[0].reason, /another exported/);
  const twice = reviewFlow({ ...graph, instructions: [{ ...graph.instructions[0], next: [10, 10] }, graph.instructions[1]] }, 0);
  assert.equal(twice.gaps.filter((g) => /another exported/.test(g.reason)).length, 1);
  assert.equal(report.localPathsResolved, false);
});

test("table count and widths prohibit decoding beyond the declared layout", () => {
  const bytes = Buffer.from([1, 0, 2, 0, 255, 255]);
  const layout = { start: 0, count: 2, stride: 2, fields: [{ name: "tag", offset: 0, width: 2 }], countEvidence: "synthetic loop bound" };
  assert.deepEqual(boundedTable(bytes, layout).rows, [{ tag: 1 }, { tag: 2 }]);
  assert.throws(() => boundedTable(bytes, { ...layout, count: 4 }), /outside/);
  assert.throws(() => boundedTable(bytes, { ...layout, countEvidence: "" }), /evidence/);
  assert.throws(() => boundedTable(bytes, { ...layout, fields: [{ name: "tag", offset: 1, width: 2 }] }), /field/);
  assert.throws(() => boundedTable(bytes, { ...layout, fields: [{ offset: 0, width: 2 }] }), /field/);
});

test("portable paths retain manifest identity and reject traversal/collisions", () => {
  assert.equal(inventoryPath("BLD-EXAMPLE", "CD:GAME.EXE"), "coverage/BLD-EXAMPLE/@CD/GAME.EXE.tsv");
  assert.equal(inventoryPath("BLD-EXAMPLE", "CD2:DIR/GAME.EXE"), "coverage/BLD-EXAMPLE/@CD2/DIR/GAME.EXE.tsv");
  for (const path of ["../GAME.EXE", "CD:/GAME.EXE", "C:/GAME.EXE", "@CD/GAME.EXE", "CON.txt", "a\\b", "a./b", "a//b"]) assert.throws(() => inventoryPath("BLD-EXAMPLE", path));
});

test("inventory views report exclusions and reject aliased ownership conflicts", () => {
  const image = readMz(synthetic()), view = { name: "resident", ranges: [{ start: 64, end: 512 }], text: "start\tsize\n1001:0000\t8\n" };
  const joined = joinInventories(image, "CD:GAME.EXE", [view, { name: "mapped", ranges: [{ start: 528, end: 560 }], text: "start\tsize\n1001:0000\t8\n0x0210\t2\n" }]);
  assert.match(joined.tsv, /CD:GAME.EXE\+0x00000210\t2/); assert.equal(joined.views[1].excluded, 1);
  assert.throws(() => joinInventories(image, "GAME.EXE", [view, { ...view, name: "second" }]), /Conflicting/);
  assert.throws(() => parseInventory("start\tsize\tname\n0x01\t1\tFromOriginal\n"), /only start and size/);
  assert.throws(() => parseInventory("start\tsize\n0x01\t1\n0x01\t1\n"), /Duplicate/);
  assert.throws(() => joinInventories(image, "GAME.EXE", [{ ...view, ranges: [{ start: 600, end: 610 }] }]), /outside/);
  // Overlapping ownership across views is rejected even when no start collides.
  assert.throws(() => joinInventories(image, "GAME.EXE", [view, { name: "other", ranges: [{ start: 256, end: 300 }], text: "start\tsize\n0x0104\t4\n" }]), /Conflicting ownership/);
  // Segment arithmetic never reaches overlay payload; overlay starts must be canonical offsets.
  assert.throws(() => image.address(0x101D, 0), /resident load image/);
  // A discontiguous function's body count must not be mistaken for start + size.
  assert.doesNotThrow(() => joinInventories(image, "GAME.EXE", [{ ...view, text: "start\tsize\n0x01FF\t5\n" }]));
});

test("command interface checks identity and writes only the canonical inventory path", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "evidence-")); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const bytes = synthetic(); writeFileSync(join(dir, "synthetic.exe"), bytes);
  writeFileSync(join(dir, "view.tsv"), "start\tsize\n1001:0000\t8\n");
  const cfg = { source: "synthetic.exe", xxh3: sourceXxh3(bytes), site: 83, targetOffset: 32,
    build: "BLD-EXAMPLE", manifest: "CD:GAME.EXE", writeRoot: "out", views: [{ name: "resident", path: "view.tsv", ranges: [{ start: 64, end: 512 }] }] };
  const path = join(dir, "report.json"); writeFileSync(path, JSON.stringify(cfg));
  assert.equal(run(["operand", path]).relocated, true);
  const result = run(["inventory", path]); assert.equal(result.tsv, undefined);
  assert.ok(existsSync(join(dir, "out", result.destination)));
  assert.match(readFileSync(join(dir, "out", result.destination), "utf8"), /CD:GAME.EXE/);
  assert.throws(() => run(["inventory", path]), /exist/);
  cfg.inventory = { path: `out/${result.destination}`, repositoryPath: result.destination };
  writeFileSync(path, JSON.stringify(cfg));
  assert.equal(run(["inventory-check", path]).rows, 1);
  cfg.inventory.repositoryPath = "wrong.tsv"; writeFileSync(path, JSON.stringify(cfg));
  assert.throws(() => run(["inventory-check", path]), /repositoryPath/);
  cfg.inventory = { path: `out/${result.destination}`, repositoryPath: "coverage/BLD-EXAMPLE/@CD/OTHER.EXE.tsv" }; writeFileSync(path, JSON.stringify(cfg));
  assert.throws(() => run(["inventory-check", path]), /repositoryPath/);
  cfg.xxh3 = "0".repeat(32); writeFileSync(path, JSON.stringify(cfg));
  assert.throws(() => run(["operand", path]), /baseline/);
  // A config from before the move to xxh3 is refused rather than checked against nothing.
  writeFileSync(path, JSON.stringify({ ...cfg, xxh3: undefined, sha256: "0".repeat(64) }));
  assert.throws(() => run(["operand", path]), /sha256 is no longer read/);
  assert.throws(() => run(["unknown", path]), /Unknown/);
});

test("x86 commands reach scientific-method-engine through the executable reader", (t) => {
  // A synthetic MZ whose resident code makes a far call through a relocated segment to a routine that
  // loads AX and returns far. The engine comes from EVIDENCE_PYTHON, or python.
  const dir = mkdtempSync(join(tmpdir(), "evidence-x86-")); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const bytes = Buffer.alloc(512);
  bytes.write("MZ"); bytes.writeUInt16LE(1, 4); bytes.writeUInt16LE(4, 8);
  bytes.writeUInt16LE(1, 6); bytes.writeUInt16LE(28, 24); bytes.writeUInt16LE(3, 28);
  bytes.set([0x9a, 0x10, 0, 0, 0, 0xc3], 64);
  bytes.set([0xb8, 0xff, 0xff, 0xcb], 80);
  writeFileSync(join(dir, "source.bin"), bytes);
  const path = join(dir, "config.json");
  writeFileSync(path, JSON.stringify({ source: "source.bin", sourceKind: "mz", xxh3: sourceXxh3(bytes), entry: 64,
    regions: [{ name: "resident", start: 64, end: 84, ip: 0, segment: 4096, entries: [64], evidence: "synthetic mapped MZ" }] }));
  const report = run(["x86-returns", path]);
  assert.equal(report.completeWithinModel, true);
  assert.equal(report.paths[0].registers.ax.value, 65535);
  assert.ok(report.paths[0].events.some((e) => e.kind === "call-return"));
  assert.throws(() => run(["x86-unknown", path]), /Unknown x86 report command/);
});


test("hardware and indirect boundaries prevent an unqualified local-path result", () => {
  const report = reviewFlow({ entries: [0], instructions: [
    { start: 0, size: 1, kind: "ordinary", next: [1], calls: [], externalEffects: ["port I/O"] },
    { start: 1, size: 1, kind: "indirect", next: [], calls: [] },
  ] }, 0);
  assert.equal(report.localPathsResolved, false);
  assert.equal(report.gaps.length, 2);
  assert.match(report.gaps[0].reason, /Hardware/);
});

test('committed inventory validates identity, columns, numeric aliases and explicit legacy paths',()=>{
 const image=readMz(synthetic()),build='BLD-EXAMPLE',manifest='CD:GAME.EXE',path=inventoryPath(build,manifest);
 const text='start\tsize\tname\tout_of_scope\nCD:GAME.EXE+0x00000040\t8\tneutralHelper\toutside selected slice\n';
 const check=(t=text,p=path,options={})=>verifyInventory(image,build,manifest,t,p,options);
 assert.equal(check().rows,1);
 assert.equal(check(text.replace('outside selected slice','')).rows,1);
 assert.throws(()=>check(text,'CON.tsv'),/Unsafe/);
 assert.equal(check(text,'coverage/BLD-EXAMPLE/CD/GAME.EXE.tsv',{legacyPath:'coverage/BLD-EXAMPLE/CD/GAME.EXE.tsv',legacyEvidence:'documented historical path'}).legacyPathEvidence,'documented historical path');
 assert.throws(()=>check(text,'coverage/BLD-EXAMPLE/CD/GAME.EXE.tsv'),/destination/);
 assert.throws(()=>check(text,path,{legacyPath:'../bad.tsv',legacyEvidence:'bad'}),/Legacy/);
 assert.throws(()=>check(text,path,{legacyPath:'safe.tsv'}),/Legacy/);
 assert.throws(()=>check(text.replace('CD:GAME.EXE+','OTHER.EXE+')),/prefix/);
 assert.throws(()=>check(text.replace('0x00000040','0x0000FFFF')),/outside/);
 assert.throws(()=>check(text.replace('\t8\t','\t0\t')),/body/);
 assert.throws(()=>check('start\tsize\nCD:GAME.EXE+0x00000040\t1\nCD:GAME.EXE+0x00000040\t1\n'),/Duplicate/);
 assert.throws(()=>check(text.replace('0x00000040','0x0040')),/noncanonical/);
 assert.throws(()=>check(text.replace('0x00000040','0x0000004a')),/noncanonical/);
 assert.throws(()=>check(text.replace('neutralHelper','FUN_00000040')),/analyzer/);
 assert.throws(()=>check(text.replace('out_of_scope','bytes')),/columns/);
 assert.throws(()=>check(text.replace('name\tout_of_scope','name\tname')),/columns/);
 assert.throws(()=>check('start\tsize\n'),/row count/);
 assert.throws(()=>check(text,'/bad.tsv'),/Unsafe/);
});
