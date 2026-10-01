import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { verifyNpmPackages, verifyEngine, enginePython, withEngine, checkerScript } from "../../tools/tool-dependencies.mjs";
import { run } from "../../tools/evidence/report.mjs";
const root = resolve(import.meta.dirname, "../..");
function scratch(t) {
  const dir = mkdtempSync(join(tmpdir(), "published-tooling-"));
  t.after(() => rmSync(dir, {recursive:true,force:true}));
  return dir;
}
test("published versions, missing engine and version mismatch fail actionably", t => {
  verifyNpmPackages(); verifyEngine(); assert(checkerScript().endsWith("standard-checker.js"));
  assert.throws(() => verifyEngine(root, {...process.env,EVIDENCE_PYTHON:join(scratch(t),"missing-python")}), /Restore-ToolDependencies/);
  const dir = scratch(t); mkdirSync(join(dir,"tools/evidence"),{recursive:true});
  writeFileSync(join(dir,"tools/evidence/requirements.txt"),readFileSync(join(root,"tools/evidence/requirements.txt"),"utf8").replace(/scientific-method-engine==\d+\.\d+\.\d+/,"scientific-method-engine==99.0.0"));
  assert.throws(() => verifyEngine(dir,{...process.env,EVIDENCE_PYTHON:enginePython()}), /expected 99.0.0/);
});
test("exact npm lock and installed-version mismatch are rejected", t => {
  const dir=scratch(t), name="@scientific-method/executable-reader";
  writeFileSync(join(dir,"package.json"),JSON.stringify({devDependencies:{[name]:"0.0.0"}}));
  writeFileSync(join(dir,"package-lock.json"),JSON.stringify({packages:{["node_modules/"+name]:{version:"0.0.1",integrity:"sha512-synthetic"}}}));
  assert.throws(() => verifyNpmPackages(dir), /exact npm lock/);
});
test("wrapper routes a synthetic MZ through the installed engine and restores environment", t => {
  const dir=scratch(t), data=Buffer.alloc(512); data.write("MZ");data.writeUInt16LE(1,4);data.writeUInt16LE(4,8);data[64]=0xc3;
  writeFileSync(join(dir,"source.bin"),data);
  writeFileSync(join(dir,"config.json"),JSON.stringify({source:"source.bin",sourceKind:"mz",sha256:createHash("sha256").update(data).digest("hex"),entry:64,
    regions:[{name:"synthetic",start:64,end:65,ip:0,segment:4096,entries:[64],evidence:"synthetic MZ"}]}));
  const previous=process.env.EVIDENCE_PYTHON;
  assert.equal(run(["x86-effects",join(dir,"config.json")]).completeWithinModel,true);
  assert.equal(process.env.EVIDENCE_PYTHON,previous);
  assert.throws(() => withEngine(() => {throw Error("synthetic failure")}),/synthetic failure/);
  assert.equal(process.env.EVIDENCE_PYTHON,previous);
});
test("installed engine refuses incompatible prepared protocol before source access", () => {
  const r=spawnSync(enginePython(),["-m","scientific_method_engine","trace","-"],{input:JSON.stringify({preparedProtocol:99}),encoding:"utf8"});
  assert.notEqual(r.status,0);assert.match(r.stderr,/protocol 99/);assert.match(r.stderr,/Install matching/);
});
