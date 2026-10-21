import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,copyFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

// tools/ghidra/SegmentedInputs.java holds the near-target arithmetic and the readers of the segment
// map and the declared entries and flows that CorrectNearTransfers.java, ApplyDeclaredEntries.java
// and ApplyDeclaredFlows.java use. It needs no Ghidra class, so a plain JDK compiles it with a
// harness that reads one command per line and prints one result line each.
const ghidra=join(dirname(fileURLToPath(import.meta.url)),'..','..','tools','ghidra');
const harness=`import java.nio.file.Path;
import java.util.HexFormat;
public class Harness {
 public static void main(String[] args) throws Exception {
  java.io.BufferedReader in=new java.io.BufferedReader(new java.io.InputStreamReader(System.in));
  for(String line;(line=in.readLine())!=null;){
   String[] f=line.split("\\t",-1);
   try{
    System.out.println(switch(f[0]){
     case "target" -> String.format("%04X",SegmentedInputs.nearTargetOffset(Integer.parseInt(f[1],16),Long.parseLong(f[2],16),Integer.parseInt(f[3]),Integer.parseInt(f[4])));
     case "near" -> String.valueOf(SegmentedInputs.nearTransfer(HexFormat.of().parseHex(f[1])));
     case "indirect" -> String.valueOf(SegmentedInputs.isNearIndirectJump(HexFormat.of().parseHex(f[1])));
     case "map" -> { SegmentedInputs.SegmentMap m=SegmentedInputs.readSegmentMap(Path.of(f[1])); StringBuilder s=new StringBuilder("spans="+m.spans().size()); for(int i=2;i<f.length;i++)s.append(' ').append(String.format("%X",m.segmentAt(Long.parseLong(f[i],16)))); yield s.toString(); }
     case "entries" -> String.valueOf(SegmentedInputs.readDeclaredEntries(Path.of(f[1]),f.length>2?f[2]:null));
     case "flows" -> String.valueOf(SegmentedInputs.readDeclaredFlows(Path.of(f[1]),f.length>2?f[2]:null));
     default -> "unknown command";
    });
   }catch(IllegalArgumentException x){System.out.println("ERROR: "+x.getMessage());}
  }
 }
}
`;

function compile(t){
 const javac=process.env.JAVA_HOME?join(process.env.JAVA_HOME,'bin',process.platform==='win32'?'javac.exe':'javac'):'javac';
 const java=process.env.JAVA_HOME?join(process.env.JAVA_HOME,'bin',process.platform==='win32'?'java.exe':'java'):'java';
 if(spawnSync(javac,['-version']).error){t.skip('JDK required for synthetic Java script acceptance');return null;}
 const scratch=mkdtempSync(join(tmpdir(),'restoration-near-test-'));
 copyFileSync(join(ghidra,'SegmentedInputs.java'),join(scratch,'SegmentedInputs.java'));
 writeFileSync(join(scratch,'Harness.java'),harness);
 const built=spawnSync(javac,['-d',scratch,join(scratch,'SegmentedInputs.java'),join(scratch,'Harness.java')],{encoding:'utf8'});
 assert.equal(built.status,0,built.stderr);
 const run=(...lines)=>{
  const p=spawnSync(java,['-cp',scratch,'Harness'],{input:lines.map(l=>l.join('\t')).join('\n')+'\n',encoding:'utf8'});
  assert.equal(p.status,0,p.stderr);
  return p.stdout.trim().split(/\r?\n/);
 };
 const put=(name,value)=>{const path=join(scratch,name);writeFileSync(path,typeof value==='string'?value:JSON.stringify(value));return path;};
 return {scratch,run,put};
}

test('near targets wrap at FFFF inside the segment of the instruction',(t)=>{
 const h=compile(t);if(!h)return;
 try{
  const lines=h.run(
   // Segment 1F00 starts at linear 1F000, so its offsets 1000 and up lie past linear 20000.
   // A call at 1F00:0FF0 with displacement 010D reaches 1F00:1100 (linear 20100); Ghidra 12.1.3
   // wraps the sum at the page 10000..1FFFF and gives linear 10100.
   ['target','1F00','1FFF0','3',String(0x010D)],
   // Backwards across the boundary: a jump at 1F00:1080 to 1F00:0FF0.
   ['target','1F00','20080','3',String(-0x93)],
   // IP wraps at FFFF inside the segment.
   ['target','1000','1FFFD','3','16'],
   ['target','1000','10002','2','-10'],
   ['target','1F00','1EFFF','3','0'],
   ['target','1F00','2F000','3','0']);
  assert.deepEqual(lines,['1100','0FF0','0010','FFFA',
   'ERROR: Linear address 1EFFF lies outside segment 1F00\'s 64K window.',
   'ERROR: Linear address 2F000 lies outside segment 1F00\'s 64K window.']);
 }finally{rmSync(h.scratch,{recursive:true,force:true});}
});

test('near relative transfers are recognized by their encodings',(t)=>{
 const h=compile(t);if(!h)return;
 try{
  const lines=h.run(['near','E80D01'],['near','E96DFF'],['near','EB7B'],['near','7405'],['near','E2FE'],['near','E3F0'],
   ['near','0F84FEFF'],['near','2EE80100'],['near','66E801000000'],['near','9A00001000'],['near','FFE0'],['near','26'],
   ['indirect','FFE0'],['indirect','2EFF2600'],['indirect','FFD0'],['indirect','FF']);
  assert.deepEqual(lines,[
   'NearTransfer[kind=CALL, displacement=269]','NearTransfer[kind=JUMP, displacement=-147]',
   'NearTransfer[kind=JUMP, displacement=123]','NearTransfer[kind=CONDITIONAL, displacement=5]',
   'NearTransfer[kind=CONDITIONAL, displacement=-2]','NearTransfer[kind=CONDITIONAL, displacement=-16]',
   'NearTransfer[kind=CONDITIONAL, displacement=-2]','NearTransfer[kind=CALL, displacement=1]',
   'null','null','null','null','true','true','false','false']);
 }finally{rmSync(h.scratch,{recursive:true,force:true});}
});

test('segment maps read from JSON and TSV and reject overlaps and bad values',(t)=>{
 const h=compile(t);if(!h)return;
 try{
  const json=h.put('map.json',{schema:'restoration-segment-map-v1',segments:[
   {segment:'1F00',start:'0FF0',end:'10000',name:'synthetic'},{segment:'1000',start:'0',end:'F000'}]});
  const tsv=h.put('map.tsv','# synthetic\nsegment\tstart\tend\n1F00\t0FF0\t10000\n1000\t0\tF000\n');
  const overlap=h.put('overlap.json',{schema:'restoration-segment-map-v1',segments:[{segment:'1000',start:'0',end:'1100'},{segment:'1100',start:'0',end:'10'}]});
  const prefixed=h.put('prefixed.tsv','segment\tstart\tend\n0x1000\t0\t10\n');
  const reversed=h.put('reversed.tsv','segment\tstart\tend\n1000\t10\t10\n');
  const noHeader=h.put('noheader.tsv','1000\t0\t10\n');
  const extra=h.put('extra.json',{schema:'restoration-segment-map-v1',segments:[],spans:[]});
  const schema=h.put('schema.json',{schema:'other',segments:[]});
  const duplicate=h.put('duplicate.json','{"schema":"restoration-segment-map-v1","segments":[],"segments":[]}');
  const lines=h.run(['map',json,'1FFF0','2EFFF','2F000','10000','1EFFF'],['map',tsv,'1FFF0','1FFEF'],
   ['map',overlap],['map',prefixed],['map',reversed],['map',noHeader],['map',extra],['map',schema],['map',duplicate],
   ['map',h.put('map.txt','')],['map',join(ghidra,'segment-map.example.json')]);
  assert.deepEqual(lines.slice(0,2),['spans=2 1F00 1F00 FFFFFFFF 1000 1000','spans=2 1F00 FFFFFFFF']);
  assert.match(lines[2],/^ERROR: Segment map spans 1000:0000\.\.1000:1100 and 1100:0000\.\.1100:0010 overlap\.$/);
  assert.match(lines[3],/^ERROR: line 2 segment must be 1 to 5 hex digits without a prefix/);
  assert.match(lines[4],/^ERROR: line 2: the span's end must lie after its start/);
  assert.match(lines[5],/^ERROR: A segment map TSV starts with the header/);
  assert.match(lines[6],/^ERROR: segment map has unknown key "spans"/);
  assert.match(lines[7],/^ERROR: Expected "schema": "restoration-segment-map-v1"/);
  assert.match(lines[8],/^ERROR: Duplicate key "segments"/);
  assert.match(lines[9],/^ERROR: A segment map is a \.json or \.tsv file/);
  assert.equal(lines[10],'spans=0');
 }finally{rmSync(h.scratch,{recursive:true,force:true});}
});

test('declared entries and flows follow their schemas and views',(t)=>{
 const h=compile(t);if(!h)return;
 try{
  const entries=h.put('entries.json',{schema:'restoration-declared-entries-v1',build:'BLD-EXAMPLE',file:'GAME.EXE',evidence:['synthetic evidence'],
   entries:[{at:'1f00:1090',reason:'synthetic'},{at:'2000:0010',view:'overlay'}],
   remove:[{starts:['1000:0100'],clear:'1000:0100..1000:0122',owner:'1F00:0FF0',evidence:['synthetic evidence']},{starts:['2000:0000'],clear:'2000:0000..2000:0004',view:'overlay'}]});
  const flows=h.put('flows.json',{schema:'restoration-declared-flows-v1',
   jumps:[{site:'1F00:1070',targets:['1F00:1080','1F00:1090'],table:'1F00:2000',bound:'2',reason:'synthetic'}],
   decode:[{range:'1F00:1080..1F00:1084',owner:'1F00:0FF0'},{range:'2000:0000..2000:0010',view:'overlay'}],
   returns:[{function:'1000:3F5A',reason:'its one path ends at a retf'}],
   fallThroughs:[{at:'1F00:10A0',reason:'int3 used as padding is never reached',view:'resident'}]});
  const bad=(name,value)=>h.put(name,value);
  const lines=h.run(['entries',entries],['entries',entries,'overlay'],['flows',flows,'resident'],['flows',flows],
   ['entries',join(ghidra,'declared-entries.example.json')],['flows',join(ghidra,'declared-flows.example.json')],
   ['entries',bad('e1.json',{schema:'restoration-declared-entries-v1',entries:[{at:'0x1000'}],remove:[]})],
   ['entries',bad('e2.json',{schema:'restoration-declared-entries-v1',entries:[{at:'1000:0010',name:'x'}],remove:[]})],
   ['entries',bad('e3.json',{schema:'restoration-declared-entries-v1',entries:[],remove:[{starts:[],clear:'1000:0010..1000:0010'}]})],
   ['entries',bad('e4.json',{schema:'restoration-declared-entries-v1',entries:[],remove:[{starts:[],clear:'1000:0010..1100:0020'}]})],
   ['entries',bad('e5.json',{schema:'restoration-declared-entries-v1',entries:[]})],
   ['flows',bad('f1.json',{schema:'restoration-declared-flows-v1',jumps:[{site:'1000:0010',targets:[]}],decode:[],returns:[],fallThroughs:[]})],
   ['flows',bad('f2.json',{schema:'restoration-declared-flows-v1',jumps:[],decode:[],returns:[{function:'1000:0010'}],fallThroughs:[]})],
   ['flows',bad('f3.json','{"schema":"restoration-declared-flows-v1","jumps":[],"decode":[],"returns":[],"fallThroughs":[],}')],
   ['flows',bad('f4.json','['.repeat(40)+']'.repeat(40))]);
  assert.deepEqual(lines.slice(0,6),[
   'DeclaredEntries[entries=[1F00:1090], removals=[Removal[starts=[1000:0100], clear=Range[start=1000:0100, end=1000:0122], owner=1F00:0FF0]]]',
   'DeclaredEntries[entries=[1F00:1090, 2000:0010], removals=[Removal[starts=[1000:0100], clear=Range[start=1000:0100, end=1000:0122], owner=1F00:0FF0], Removal[starts=[2000:0000], clear=Range[start=2000:0000, end=2000:0004], owner=null]]]',
   'DeclaredFlows[jumps=[Jump[site=1F00:1070, targets=[1F00:1080, 1F00:1090]]], decodes=[Decode[range=Range[start=1F00:1080, end=1F00:1084], owner=1F00:0FF0]], returns=[1000:3F5A], fallThroughs=[1F00:10A0]]',
   'DeclaredFlows[jumps=[Jump[site=1F00:1070, targets=[1F00:1080, 1F00:1090]]], decodes=[Decode[range=Range[start=1F00:1080, end=1F00:1084], owner=1F00:0FF0]], returns=[1000:3F5A], fallThroughs=[]]',
   'DeclaredEntries[entries=[], removals=[]]',
   'DeclaredFlows[jumps=[], decodes=[], returns=[], fallThroughs=[]]']);
  assert.match(lines[6],/^ERROR: entries\[0\]\.at must be segment:offset in hex: 0x1000$/);
  assert.match(lines[7],/^ERROR: entries\[0\] has unknown key "name"/);
  assert.match(lines[8],/^ERROR: remove\[0\]\.clear must end after its start, in the same segment/);
  assert.match(lines[9],/^ERROR: remove\[0\]\.clear must end after its start, in the same segment/);
  assert.match(lines[10],/^ERROR: declared entries lacks "remove"/);
  assert.match(lines[11],/^ERROR: jumps\[0\]\.targets is empty/);
  assert.match(lines[12],/^ERROR: returns\[0\] lacks "reason"/);
  assert.match(lines[13],/^ERROR: Expected a key/);
  assert.match(lines[14],/^ERROR: JSON nested deeper than 32/);
 }finally{rmSync(h.scratch,{recursive:true,force:true});}
});
