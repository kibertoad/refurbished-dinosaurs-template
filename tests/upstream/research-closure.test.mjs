import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {assessClosure, referenceProblems} from '../../tools/Report-ResearchClosure.mjs';

const path = 'coverage/BLD-TEST-1.0/PROGRAM.EXE.tsv', sha256 = 'a'.repeat(64);
// Synthetic IDs are built at runtime so source citations remain real spec IDs.
const finding = ['FND', 'TEST', '001'].join('-');
const format = ['FMT', 'TEST', '001'].join('-');
const syntheticFinding = ['FND', 'SYNTHETIC', '999999'].join('-');
const kinds = ['callers', 'state-producers', 'indirect-transfers', 'remaining-evidence'];
const obligations = area => kinds.map(kind => ({id: `${area}-${kind}`, area, kind,
  question: `Which ${kind} remain within this bounded contract?`, state: 'closed', queue: [], evidence: [finding]}));
function fixture() {
  return {
    plan: {version: 1, areas: [{id: 'TEST', scope: 'Synthetic bounded dispatcher and its state producers'}],
      inventories: [{path, sha256, assignments: [
        {start: '7F001000', areas: ['TEST']}, {start: '7F001008', areas: ['TEST']},
      ]}], obligations: obligations('TEST')},
    coverage: {inventories: [{path, completeReading: {functions: 2, bytes: 16}, mapping: {unavailable: 'no regions file'}, list: [
      {start: '7F001000', size: 8, name: '', outOfScope: '', citedBy: [finding], read: true},
      {start: '7F001008', size: 8, name: '', outOfScope: '', citedBy: [finding], read: true},
      {start: '7F001010', size: 8, name: '', outOfScope: 'Synthetic runtime helper excluded explicitly', citedBy: [], read: false},
    ]}], unmeasured: [], withoutInventory: [], problems: [], unread: []},
    hashes: {[path]: sha256},
  };
}
const run = f => assessClosure(f.plan, f.coverage, f.hashes);

test('a finite fully read contract requests review and preserves the separate mapping limits', () => {
  const r = run(fixture());
  assert.equal(r.readyForReview, true);
  assert.equal(r.areas[0].acceptedReadings, 2);
  assert.equal(r.excludedFunctions.length, 1);
  assert.equal(r.files[0].mapping.unavailable, 'no regions file');
  assert(r.limits.some(x => /does not establish/.test(x)));
});

test('citations, unavailable readings, empty plans and incomplete checklists do not close research', () => {
  const cited = fixture();
  for (const row of cited.coverage.inventories[0].list) row.read = false;
  assert.equal(run(cited).areas[0].cited, 2);
  assert.equal(run(cited).areas[0].acceptedReadings, 0);
  assert.equal(run(cited).readyForReview, false);
  const unavailable = fixture();
  for (const row of unavailable.coverage.inventories[0].list) delete row.read;
  unavailable.coverage.inventories[0].completeReading = {unavailable: 'Synthetic unread location'};
  assert.equal(run(unavailable).areas[0].unavailableReadings, 2);
  assert.equal(run(unavailable).readyForReview, false);
  const empty = fixture(); empty.plan.areas = []; empty.plan.inventories = []; empty.plan.obligations = [];
  assert.equal(run(empty).readyForReview, false);
  for (const kind of kinds) {
    const f = fixture(); f.plan.obligations = f.plan.obligations.filter(o => o.kind !== kind);
    assert.deepEqual(run(f).areas[0].missingKinds, [kind]);
    assert.equal(run(f).readyForReview, false);
  }
});

test('unresolved caller, producer, indirect or remaining-evidence obligations stay visible', () => {
  for (const kind of kinds) {
    const f = fixture(), obligation = f.plan.obligations.find(o => o.kind === kind);
    obligation.state = 'open'; obligation.queue = ['Q-TEST-001']; obligation.evidence = [];
    const r = run(f);
    assert.equal(r.readyForReview, false);
    assert.deepEqual(r.areas[0].obligations.find(o => o.kind === kind).queue, ['Q-TEST-001']);
  }
});

test('unassigned and shared ownership are explicit and shared counts are not summed as bytes', () => {
  const missing = fixture(); missing.plan.inventories[0].assignments.pop();
  assert.equal(run(missing).unassigned[0].start, '7F001008');
  assert.equal(run(missing).readyForReview, false);
  const shared = fixture(); shared.plan.areas.push({id: 'OTHER', scope: 'Synthetic shared state owner'});
  Object.assign(shared.plan.inventories[0].assignments[0], {areas: ['TEST', 'OTHER'], reason: 'Both contracts consume the same state helper'});
  shared.plan.obligations.push(...obligations('OTHER'));
  const r = run(shared);
  assert.equal(r.readyForReview, true);
  assert.equal(r.shared.length, 1);
  assert.deepEqual(r.areas.map(a => a.acceptedReadings), [2, 1]);
  assert.equal(r.files[0].completeReading.bytes, 16);
  assert(r.limits.some(x => /not additive/.test(x)));
});

test('changed inventories and missing or unmeasured files prevent a ready assessment', () => {
  const stale = fixture(); stale.hashes[path] = 'b'.repeat(64);
  assert.deepEqual(run(stale).staleInventories, [path]);
  assert.equal(run(stale).areas[0].readyForReview, false);
  assert.equal(run(stale).readyForReview, false);
  for (const field of ['withoutInventory', 'unmeasured', 'problems', 'unread']) {
    const f = fixture(); f.coverage[field].push(field === 'withoutInventory' ? {build: 'BLD-TEST-1.0', file: 'OTHER.DLL', format: format} : 'Synthetic unresolved input');
    assert.equal(run(f).readyForReview, false, field);
    assert.deepEqual(run(f)[field === 'problems' || field === 'unread' ? 'errors' : field], f.coverage[field]);
  }
});

test('invalid ownership, references and path traversal fail instead of disappearing from scope', () => {
  const cases = [
    f => { f.plan.inventories[0].assignments.push({...f.plan.inventories[0].assignments[0]}); },
    f => { f.plan.inventories[0].assignments[0].areas = ['UNKNOWN']; },
    f => { f.plan.inventories[0].assignments[0].start = '7F009999'; },
    f => { f.plan.inventories[0].assignments[0].areas = []; },
    f => { f.plan.inventories[0].path = 'coverage/../../outside.tsv'; },
    f => { f.plan.inventories[0].path = 'coverage/..\\outside.tsv'; },
    f => { f.plan.obligations[0].state = 'closed'; f.plan.obligations[0].evidence = []; },
    f => { f.plan.obligations[0].state = 'open'; f.plan.obligations[0].queue = []; },
    f => { f.plan.inventories[0].assignments.push({start: '7F001010', areas: ['TEST']}); },
    f => { f.plan.inventories[0].sha256 = 'not-a-hash'; },
    f => { f.plan.skipMissing = true; },
  ];
  for (const mutate of cases) { const f = fixture(); mutate(f); assert.throws(() => run(f)); }
  const f = fixture(), refs = {areas: new Set(['TEST']), queue: new Set(['Q-TEST-001']), entries: new Map([[finding, 'recorded']])};
  assert.deepEqual(referenceProblems(f.plan, refs), []);
  refs.entries.set(finding, 'superseded');
  assert(referenceProblems(f.plan, refs).some(x => /inactive evidence/.test(x)));
  refs.entries.clear(); refs.areas.clear();
  f.plan.obligations[0].queue = ['Q-TEST-999'];
  assert(referenceProblems(f.plan, refs).some(x => /not open/.test(x)));
  assert(referenceProblems(f.plan, refs).some(x => /Unknown spec area/.test(x)));
});

test('the CLI runs the pinned coverage reporter and refuses vacuous readiness', t => {
  const dir = mkdtempSync(join(tmpdir(), 'closure-cli-'));
  t.after(() => rmSync(dir, {recursive: true, force: true}));
  const plan = join(dir, 'plan.json');
  writeFileSync(plan, JSON.stringify({version: 1, areas: [], inventories: [], obligations: []}));
  const root = resolve(import.meta.dirname, '../..');
  const result = spawnSync(process.execPath, [join(root, 'tools/Report-ResearchClosure.mjs'), '--plan', plan, '--json', '--require-ready'], {cwd: root, encoding: 'utf8'});
  assert.ifError(result.error);
  assert.equal(result.status, 1, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.readyForReview, false);
  assert.match(report.checkerVersion, /^\d+\.\d+\.\d+$/);
  assert.equal(report.areas.length, 0);
});

test('the CLI reconciles plan references with actual spec and open queue files', t => {
  const dir = mkdtempSync(join(tmpdir(), 'closure-references-'));
  t.after(() => rmSync(dir, {recursive: true, force: true}));
  const plan = join(dir, 'plan.json'), checks = obligations('SYNTHETIC');
  for (const o of checks) o.evidence = [syntheticFinding];
  checks[0].state = 'open'; checks[0].queue = ['Q-SYNTHETIC-999999']; checks[0].evidence = [];
  writeFileSync(plan, JSON.stringify({version: 1, areas: [{id: 'SYNTHETIC', scope: 'A synthetic nonexistent area'}], inventories: [], obligations: checks}));
  const root = resolve(import.meta.dirname, '../..');
  const result = spawnSync(process.execPath, [join(root, 'tools/Report-ResearchClosure.mjs'), '--plan', plan, '--json'], {cwd: root, encoding: 'utf8'});
  assert.ifError(result.error);
  assert.equal(result.status, 1, result.stderr);
  const report = JSON.parse(result.stdout);
  assert(report.errors.some(x => /Unknown spec area SYNTHETIC/.test(x)));
  assert(report.errors.some(x => /not open: Q-SYNTHETIC-999999/.test(x)));
  assert(report.errors.some(x => x.includes(`inactive evidence ${syntheticFinding}`)));
  assert.equal(report.readyForReview, false);
});
