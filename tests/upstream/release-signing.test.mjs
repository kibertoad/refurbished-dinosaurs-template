import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
const root=resolve(import.meta.dirname,'../..');
const commit='a'.repeat(40),tagObject='b'.repeat(40);
const literal=s=>"'"+s.replaceAll("'","''")+"'";
test('release tag reruns reuse the same commit and fail closed on errors or mismatches',t=>{
 const dir=mkdtempSync(join(tmpdir(),'release-tag-controls-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const cases=[['light',true,0],['annotated',true,0],['missing',true,2],['different',false,0],['forbidden',false,0],['network',false,0],['create-fails',false,1],['bad-object',false,1],['bad-ref',false,2]];
 for(const [mode,ok,writes] of cases){
  const file=join(dir,'mock.ps1');
  writeFileSync(file,`$ErrorActionPreference='Stop'
$global:writes=0
function gh {
 $global:LASTEXITCODE=0
 if ($args -contains '--include') {
  if ('${mode}' -in @('missing','create-fails','bad-object','bad-ref')) {$global:LASTEXITCODE=1;'HTTP/2.0 404 Not Found';return}
  if ('${mode}' -eq 'forbidden') {$global:LASTEXITCODE=1;'HTTP/2.0 403 Forbidden';return}
  if ('${mode}' -eq 'network') {$global:LASTEXITCODE=1;'connection reset';return}
  if ('${mode}' -eq 'annotated') {'HTTP/2.0 200 OK';'${JSON.stringify({object:{type:'tag',sha:tagObject}})}';return}
  'HTTP/2.0 200 OK';'${JSON.stringify({object:{type:'commit',sha:mode==='different'?'c'.repeat(40):commit}})}';return
 }
 if ($args -notcontains 'POST') {'${JSON.stringify({object:{type:'commit',sha:commit}})}';return}
 $global:writes++
 if ('${mode}' -eq 'create-fails') {$global:LASTEXITCODE=7;'refused';return}
 if ($global:writes -eq 1) {'${JSON.stringify({sha:mode==='bad-object'?'':tagObject})}';return}
 '${JSON.stringify({object:{sha:mode==='bad-ref'?'c'.repeat(40):tagObject}})}'
}
$failed=$false
try {& ${literal(join(root,'tools/Ensure-ReleaseTag.ps1'))} -Repository owner/repo -Tag 1.2.3 -Commit '${commit}'} catch {$failed=$true;Write-Host $_}
if ($failed -ne ${ok?'$false':'$true'}) {throw 'Wrong acceptance for ${mode}'}
if ($global:writes -ne ${writes}) {throw "Unexpected write count $global:writes for ${mode}"}
`);
  const r=spawnSync(process.env.PWSH||'pwsh',['-NoProfile','-File',file],{encoding:'utf8'});assert.equal(r.status,0,r.stdout+r.stderr);
 }
});
test('release jobs are bounded, main-only, and check certificate identity at all three boundaries',()=>{
 const source=readFileSync(join(root,'.github/workflows/release.yml'),'utf8');
 assert.match(source,/DISPATCH_REF -ne 'refs\/heads\/main'/);assert.doesNotMatch(source,/^    if: github\.ref/m);
 assert.equal((source.match(/^    runs-on:/gm)||[]).length,(source.match(/^    timeout-minutes:/gm)||[]).length);
 assert.equal((source.match(/Assert-WindowsSignature.ps1/g)||[]).length,3);
 assert.match(source,/Ensure-ReleaseTag.ps1/);assert.doesNotMatch(source,/throw 'Tag already exists/);
 assert.match(source,/ES_CERTIFICATE_THUMBPRINT/);
});
test('Authenticode checks reject unexpected certificates, missing timestamps and invalid status',t=>{
 const dir=mkdtempSync(join(tmpdir(),'release-cert-controls-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 for(const [status,stamp,thumb,ok] of [['Valid',true,commit,true],['NotSigned',true,commit,false],['Valid',false,commit,false],['Valid',true,tagObject,false]]){
  const file=join(dir,'mock.ps1');writeFileSync(file,`$ErrorActionPreference='Stop'
function Get-AuthenticodeSignature {[pscustomobject]@{Status='${status}';TimeStamperCertificate=${stamp?'[pscustomobject]@{}':'$null'};SignerCertificate=[pscustomobject]@{Thumbprint='${thumb}'}}}
& ${literal(join(root,'tools/Assert-WindowsSignature.ps1'))} -Path synthetic.exe -ExpectedThumbprint '${commit}'`);
  const r=spawnSync(process.env.PWSH||'pwsh',['-NoProfile','-File',file],{encoding:'utf8'});assert.equal(r.status===0,ok,r.stdout+r.stderr);
 }
});
