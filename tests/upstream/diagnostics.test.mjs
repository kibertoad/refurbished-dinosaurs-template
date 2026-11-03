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
  for(const file of ['Verify-Repository.ps1','Repository-Policy.psm1','repository-policy.json']) copyFileSync(join(root,'tools',file),join(scratch,'tools',file));
  copyFileSync(join(root,'.gitignore'),join(scratch,'.gitignore'));
  assert.equal(exec('git',['init']).status,0);
  writeFileSync(join(scratch,'ordinary.log'),'synthetic log');
  const gate=()=>exec('pwsh',['-NoProfile','-File',join(scratch,'tools/Verify-Repository.ps1'),'-RepositoryRoot',scratch]);
  const passes=()=>{const result=gate();assert.equal(result.status,0,result.stdout+result.stderr);};
  passes();
  const files=['hs_err_pid123.log','nested/replay_pid456.log','nested/HS_ERR_PID789.LOG','nested/java_pid321.hprof'];
  // Keep a real CLI failure control; the remaining case matrix shares one host.
  writeFileSync(join(scratch,files[0]),'synthetic diagnostic marker');
  assert.equal(exec('git',['add','-f','--',files[0]]).status,0);
  const rejected=gate();assert.notEqual(rejected.status,0);assert.match(rejected.stdout+rejected.stderr,/local JVM diagnostic/);
  assert.equal(exec('git',['rm','--cached','--',files[0]]).status,0);rmSync(join(scratch,files[0]));
  writeFileSync(join(scratch,'cases.json'),JSON.stringify(files));
  writeFileSync(join(scratch,'matrix.ps1'),`
$ErrorActionPreference='Stop'
Import-Module (Join-Path $PSScriptRoot 'tools/Repository-Policy.psm1') -Force
$files=Get-Content (Join-Path $PSScriptRoot 'cases.json') -Raw | ConvertFrom-Json
foreach ($file in $files) {
 $path=Join-Path $PSScriptRoot $file
 Set-Content -LiteralPath $path -Value 'synthetic diagnostic marker'
 if ($file -cnotlike '*HS_ERR*') {
  & git check-ignore -- $file | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Diagnostic is not ignored: $file" }
 }
 & git add -f -- $file
 if ($LASTEXITCODE -ne 0) { throw 'Git add failed' }
 $result=Test-RepositoryPolicy -RepositoryRoot $PSScriptRoot
 if (-not ($result.Violations -match 'local JVM diagnostic')) { throw "Policy accepted $file" }
 & git rm --cached -- $file | Out-Null
 if ($LASTEXITCODE -ne 0) { throw 'Git reset failed' }
 Remove-Item -LiteralPath $path
 $result=Test-RepositoryPolicy -RepositoryRoot $PSScriptRoot
 if ($result.Violations.Count) { throw 'Case leaked policy state' }
}
Write-Output 'MATRIX:4'
`);
  const matrix=exec('pwsh',['-NoProfile','-File',join(scratch,'matrix.ps1')]);
  assert.equal(matrix.status,0,matrix.stdout+matrix.stderr);assert.match(matrix.stdout,/MATRIX:4/);
  passes();
 } finally {rmSync(scratch,{recursive:true,force:true});}
});
