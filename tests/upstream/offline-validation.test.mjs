import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,copyFileSync,writeFileSync,readFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
// Invoke-Validation.ps1 sets PWSH to the PowerShell running the gate, which need not be on PATH.
const root=resolve(import.meta.dirname,'../..'),pwsh=process.env.PWSH||'pwsh';
const noPwsh=spawnSync(pwsh,['-NoProfile','-Command','exit 0']).error?'PowerShell 7 required for the validation entry point':false;
const literal=s=>"'"+s.replaceAll("'","''")+"'";
function exercise(t,offline,failBuild=false){
 const dir=mkdtempSync(join(tmpdir(),'validation-offline-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));mkdirSync(join(dir,'tools'));
 copyFileSync(join(root,'tools/Invoke-Validation.ps1'),join(dir,'tools/Invoke-Validation.ps1'));
 for(const name of ['Verify-Repository','Verify-Configuration','Test-TemplateInfrastructure','Restore-ToolDependencies','Test'])writeFileSync(join(dir,'tools',name+'.ps1'),`param($RepositoryRoot,$MinimumExpectedTests,$TestFilter,[switch]$NoRestore)\n$global:checks.Add('${name}')\n${name==='Test'?'$global:forwarded=[bool]$NoRestore':''}\n$global:LASTEXITCODE=0\n`);
 const driver=join(dir,'driver.ps1');writeFileSync(driver,`
$ErrorActionPreference='Stop'
$global:commands=[Collections.Generic.List[object]]::new()
$global:checks=[Collections.Generic.List[string]]::new()
$global:forwarded=$false
function Get-Process {}
function node { $global:checks.Add('node');$global:LASTEXITCODE=0 }
function python { $global:checks.Add('python');$global:LASTEXITCODE=0 }
function dotnet {
 $global:commands.Add([object]@($args))
 if (${failBuild?'$true':'$false'} -and $args[0] -eq 'build') { $global:LASTEXITCODE=7 } else { $global:LASTEXITCODE=0 }
}
Remove-Item Env:EVIDENCE_PYTHON -ErrorAction SilentlyContinue
$failure=$null
try { & ${literal(join(dir,'tools/Invoke-Validation.ps1'))} ${offline?'-NoRestore':''} -TestFilter 'SyntheticFilter' -MinimumExpectedTests 3 }
catch { $failure=$_.Exception.Message }
Write-Output ('MOCK_RESULT:'+(@{commands=@($global:commands);checks=@($global:checks);forwarded=$global:forwarded;failure=$failure}|ConvertTo-Json -Depth 8 -Compress))
`);
 // The copied script takes its per-checkout lock in the temp directory; point that at the scratch directory so it is removed with it.
 const r=spawnSync(pwsh,['-NoProfile','-ExecutionPolicy','Bypass','-File',driver],{encoding:'utf8',timeout:120000,env:{...process.env,TMPDIR:dir,TMP:dir,TEMP:dir}});assert.equal(r.status,0,r.error?.message||r.stdout+r.stderr);
 const line=r.stdout.split(/\r?\n/).find(s=>s.startsWith('MOCK_RESULT:'));assert(line,r.stdout+r.stderr);return JSON.parse(line.slice('MOCK_RESULT:'.length));
}
test('validation restores normally and explicit NoRestore retains checks and no-restore consumers',{skip:noPwsh},t=>{
 const normal=exercise(t,false),offline=exercise(t,true);
 assert.equal(normal.failure,null);assert.equal(offline.failure,null);
 assert.equal(normal.commands[0][0],'restore');assert(!offline.commands.some(a=>a[0]==='restore'));
 assert(offline.commands.some(a=>a[0]==='build'));assert(offline.commands.some(a=>a[0]==='test'));
 assert(offline.commands.filter(a=>['build','test','publish'].includes(a[0])).every(a=>a.includes('--no-restore')));
 assert.deepEqual(offline.checks,normal.checks);
 if(existsSync(join(root,'tools/Test.ps1'))){assert.equal(offline.forwarded,true);assert.equal(normal.forwarded,false);assert(offline.checks.includes('Test'));}
 else {assert(offline.checks.includes('Verify-Repository'));assert(offline.checks.includes('Verify-Configuration'));assert(offline.checks.includes('Test-TemplateInfrastructure'));assert(offline.checks.includes('node'));assert(offline.checks.includes('Restore-ToolDependencies'));}
 const nativeTest=offline.commands.find(a=>a[0]==='test');if(nativeTest){assert(nativeTest.includes('SyntheticFilter'));assert(nativeTest.includes('--minimum-expected-tests'));}
});
test('NoRestore failure propagates without falling back to restore',{skip:noPwsh},t=>{
 const r=exercise(t,true,true);assert.match(r.failure,/build failed with exit code 7/);assert(!r.commands.some(a=>a[0]==='restore'));assert(!r.commands.some(a=>a[0]==='test'||a[0]==='publish'));
});
