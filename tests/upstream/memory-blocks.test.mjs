import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,copyFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {spawnSync} from 'node:child_process';
import {ghidraScriptPath} from '../../tools/tool-dependencies.mjs';
const root=resolve(import.meta.dirname,'../..');
test('bounded memory map selection handles large maps and rejects invalid or ambiguous selections',(t)=>{
 const javac=process.env.JAVA_HOME?join(process.env.JAVA_HOME,'bin',process.platform==='win32'?'javac.exe':'javac'):'javac';
 const java=process.env.JAVA_HOME?join(process.env.JAVA_HOME,'bin',process.platform==='win32'?'java.exe':'java'):'java';
 if(spawnSync(javac,['-version']).error){t.skip('JDK required for synthetic Java script acceptance');return;}
 const scratch=mkdtempSync(join(tmpdir(),'restoration-block-test-'));
 const put=(name,text)=>{mkdirSync(dirname(join(scratch,name)),{recursive:true});writeFileSync(join(scratch,name),text);};
 try{
  put('ghidra/program/model/mem/MemoryBlock.java','package ghidra.program.model.mem; public class MemoryBlock { public String name; public MemoryBlock(String n){name=n;} public String getName(){return name;} public String getStart(){return "0";} public String getEnd(){return "7";} public long getSize(){return 8;} }');
  put('ghidra/app/script/GhidraScript.java',`package ghidra.app.script; import ghidra.program.model.mem.MemoryBlock; public abstract class GhidraScript { public String[] args; public Program currentProgram=new Program(); public String[] getScriptArgs(){return args;} public void println(String s){System.out.println(s);} public void printerr(String s){System.out.println("ERROR: "+s);} protected abstract void run() throws Exception; public static class Program { public Memory getMemory(){return new Memory();} } public static class Memory { public MemoryBlock[] getBlocks(){MemoryBlock[] b=new MemoryBlock[3546]; for(int i=0;i<b.length;i++)b[i]=new MemoryBlock(i<2?"duplicate":"block"+i); return b;} } }`);
  copyFileSync(join(ghidraScriptPath(),'ReportMemoryBlocks.java'),join(scratch,'ReportMemoryBlocks.java'));
  put('Harness.java','public class Harness { public static void main(String[] args)throws Exception { ReportMemoryBlocks r=new ReportMemoryBlocks();r.args=args;r.run(); } }');
  const compile=spawnSync(javac,['-d',scratch,join(scratch,'ghidra/program/model/mem/MemoryBlock.java'),join(scratch,'ghidra/app/script/GhidraScript.java'),join(scratch,'ReportMemoryBlocks.java'),join(scratch,'Harness.java')],{encoding:'utf8'});assert.equal(compile.status,0,compile.stderr);
  const run=(...args)=>{const p=spawnSync(java,['-cp',scratch,'Harness',...args],{encoding:'utf8'});assert.equal(p.status,0,p.stderr);return p.stdout;};
  assert.match(run(),/maximum is 512/);
  const tail=run('page','3538','16');assert.match(tail,/total=3546 start=3538 emitted=8 partial=true requested=16 /);assert.equal(tail.trim().split(/\r?\n/).length,9);
  assert.match(run('page','3546','16'),/emitted=0/);
  assert.equal(run('page','0','512').trim().split(/\r?\n/).length,513);
  assert.match(run('name','block3545'),/emitted=1/);
  assert.match(run('name','missing'),/No block/);assert.match(run('name','duplicate'),/Ambiguous block name: 2 blocks at indices 0,1;/);
  for(const args of [['page','-1','1'],['page','3547','1'],['page','0','513'],['page','0','0']])assert.match(run(...args),/within/);
  assert.match(run('page','x','1'),/integers/);assert.match(run('bad'),/Usage/);
 }finally{rmSync(scratch,{recursive:true,force:true});}
});
