import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,copyFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const root=resolve(import.meta.dirname,'../..');
test('JVM diagnostics are ignored and rejected if force-staged, while ordinary logs remain allowed',()=>{
 const scratch=mkdtempSync(join(tmpdir(),'restoration-diagnostic-policy-'));
 const exec=(command,args)=>spawnSync(command,args,{cwd:scratch,encoding:'utf8'});
 try {
  mkdirSync(join(scratch,'tools'));mkdirSync(join(scratch,'nested'));
  for(const file of ['Verify-Repository.ps1','repository-policy.json']) copyFileSync(join(root,'tools',file),join(scratch,'tools',file));
  copyFileSync(join(root,'.gitignore'),join(scratch,'.gitignore'));
  assert.equal(exec('git',['init']).status,0);
  writeFileSync(join(scratch,'ordinary.log'),'synthetic log');
  const gate=()=>exec('pwsh',['-NoProfile','-File',join(scratch,'tools/Verify-Repository.ps1'),'-RepositoryRoot',scratch]);
  assert.equal(gate().status,0);
  for(const file of ['hs_err_pid123.log','nested/replay_pid456.log','nested/HS_ERR_PID789.LOG']){
   writeFileSync(join(scratch,file),'synthetic diagnostic marker');
   // Git ignore patterns are platform case-sensitive; policy remains case-insensitive.
   if(!file.includes('HS_ERR')) assert.equal(exec('git',['check-ignore',file]).status,0);
   assert.equal(exec('git',['add','-f','--',file]).status,0);
   const result=gate();assert.notEqual(result.status,0);assert.match(result.stdout+result.stderr,/local JVM diagnostic/);
   assert.equal(exec('git',['rm','--cached','--',file]).status,0);
   rmSync(join(scratch,file));
  }
  assert.equal(gate().status,0);
 } finally {rmSync(scratch,{recursive:true,force:true});}
});
