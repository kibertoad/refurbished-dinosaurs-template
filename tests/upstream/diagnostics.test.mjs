import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,copyFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const root=resolve(import.meta.dirname,'../..');
test('JVM diagnostics are ignored and rejected if force-staged, while ordinary logs remain allowed',(t)=>{
 if(spawnSync('pwsh',['-NoProfile','-Command','exit 0']).error){t.skip('PowerShell 7 required for the repository policy gate');return;}
 const scratch=mkdtempSync(join(tmpdir(),'restoration-diagnostic-policy-'));
 const exec=(command,args)=>spawnSync(command,args,{cwd:scratch,encoding:'utf8'});
 try {
  mkdirSync(join(scratch,'tools'));mkdirSync(join(scratch,'nested'));
  for(const file of ['Verify-Repository.ps1','repository-policy.json']) copyFileSync(join(root,'tools',file),join(scratch,'tools',file));
  copyFileSync(join(root,'.gitignore'),join(scratch,'.gitignore'));
  assert.equal(exec('git',['init']).status,0);
  writeFileSync(join(scratch,'ordinary.log'),'synthetic log');
  const gate=()=>exec('pwsh',['-NoProfile','-File',join(scratch,'tools/Verify-Repository.ps1'),'-RepositoryRoot',scratch]);
  const passes=()=>{const result=gate();assert.equal(result.status,0,result.stdout+result.stderr);};
  passes();
  for(const file of ['hs_err_pid123.log','nested/replay_pid456.log','nested/HS_ERR_PID789.LOG','nested/java_pid321.hprof']){
   writeFileSync(join(scratch,file),'synthetic diagnostic marker');
   // Git ignore patterns are platform case-sensitive; policy remains case-insensitive.
   if(!file.includes('HS_ERR')) assert.equal(exec('git',['check-ignore',file]).status,0);
   assert.equal(exec('git',['add','-f','--',file]).status,0);
   const result=gate();assert.notEqual(result.status,0);assert.match(result.stdout+result.stderr,/local JVM diagnostic/);
   assert.equal(exec('git',['rm','--cached','--',file]).status,0);
   rmSync(join(scratch,file));
  }
  passes();
 } finally {rmSync(scratch,{recursive:true,force:true});}
});
