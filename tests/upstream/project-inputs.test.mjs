import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,copyFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {projectInputEnvironment} from '../../tools/Project-Inputs.mjs';
function fixture(t) {
  const root=mkdtempSync(path.join(tmpdir(),'project-inputs-'));
  t.after(()=>rmSync(root,{recursive:true,force:true}));
  mkdirSync(path.join(root,'.artifacts'));
  const config=value=>writeFileSync(path.join(root,'.artifacts/local-inputs.json'),JSON.stringify(value));
  return {root,config};
}
test('missing local settings ignore global originals without mutating the caller',t=>{
  const f=fixture(t); const inherited={GAME_DIR:'/another/game',KEEP:'value'};
  assert.deepEqual(projectInputEnvironment(f.root,inherited),{KEEP:'value'});
  assert.equal(inherited.GAME_DIR,'/another/game');
});
test('two checkouts resolve their own paths regardless of the working directory',t=>{
  const a=fixture(t),b=fixture(t);
  a.config({version:1,gameDirectory:'owned input'}); b.config({version:1,gameDirectory:'other input'});
  assert.equal(projectInputEnvironment(a.root).GAME_DIR,path.join(a.root,'owned input'));
  assert.equal(projectInputEnvironment(b.root).GAME_DIR,path.join(b.root,'other input'));
  a.config({version:1,gameDirectory:null});
  assert.equal(projectInputEnvironment(a.root).GAME_DIR,undefined);
});
test('malformed settings fail instead of falling back to a global directory',t=>{
  const f=fixture(t);
  for(const value of [null,[],{version:2,gameDirectory:'x'},{version:1},{version:1,gameDirectory:''},{version:1,gameDirectory:12},{version:1,gameDirectory:null,extra:1}]) {
    f.config(value); assert.throws(()=>projectInputEnvironment(f.root),/Invalid/);
  }
  writeFileSync(path.join(f.root,'.artifacts/local-inputs.json'),'{');
  assert.throws(()=>projectInputEnvironment(f.root),/Invalid/);
});
test('launcher forwards arguments, project-local environment and child exit status',t=>{
  const f=fixture(t); mkdirSync(path.join(f.root,'tools'));
  copyFileSync(new URL('../../tools/Project-Inputs.mjs',import.meta.url),path.join(f.root,'tools/Project-Inputs.mjs'));
  f.config({version:1,gameDirectory:'owned input'});
  const result=spawnSync(process.execPath,[path.join(f.root,'tools/Project-Inputs.mjs'),'--',process.execPath,'-e','console.log(JSON.stringify({game:process.env.GAME_DIR,args:process.argv.slice(1),cwd:process.cwd()}));process.exit(7)','argument with spaces'],{encoding:'utf8',env:{...process.env,GAME_DIR:'/wrong/game'},cwd:tmpdir()});
  assert.equal(result.status,7,result.stderr);
  assert.deepEqual(JSON.parse(result.stdout),{game:path.join(f.root,'owned input'),args:['argument with spaces'],cwd:f.root});
});
