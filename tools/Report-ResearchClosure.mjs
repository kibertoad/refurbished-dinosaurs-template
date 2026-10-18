#!/usr/bin/env node
// Assess an explicit research plan against the pinned coverage report. A ready
// assessment requests review; it never establishes an entry or validates parity.
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { checkerEntry, verifySnapshot } from './upstream.mjs';
import { trackingReferences } from './Check-ResearchTracking.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REQUIRED = ['callers', 'state-producers', 'indirect-transfers', 'remaining-evidence'];
const digest = value => createHash('sha256').update(value).digest('hex');
const array = (value, name) => { if (!Array.isArray(value)) throw new Error(`${name} must be an array`); return value; };
const text = (value, name) => { if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} must be nonempty text`); return value; };
const unique = (values, name) => { if (new Set(values).size !== values.length) throw new Error(`${name} has duplicates`); return values; };
const key = (path, start) => `${path}:${start}`;
const keys = (object, allowed, name) => { if (Object.keys(object).some(k => !allowed.includes(k))) throw new Error(`Unknown field in ${name}`); };
const inventoryPath = path => {
  text(path, 'inventory path');
  if (!path.startsWith('coverage/') || /[\\:]/.test(path) || path.split('/').some(p => !p || p === '..' || p === '.')) throw new Error('Inventory path must stay under coverage/');
  return path;
};

/** Assess metadata only; hashes and coverage must describe the same current inventory inputs. */
export function assessClosure(plan, coverage, hashes) {
  keys(plan, ['version', 'areas', 'inventories', 'obligations'], 'plan');
  if (plan.version !== 1) throw new Error('Unsupported closure plan version');
  const areas = unique(array(plan.areas, 'areas').map(area => text(area.id, 'area id')), 'areas');
  if (areas.some(id => !/^[A-Z][A-Z0-9]*$/.test(id))) throw new Error('Invalid area id');
  for (const area of plan.areas) { keys(area, ['id', 'scope'], 'area'); text(area.scope, `scope for ${area.id}`); }
  const errors = [], stale = [], ownership = new Map(), mapped = new Set();
  const reports = array(coverage.inventories, 'coverage inventories');
  const actual = new Map(reports.map(inv => [inv.path, inv]));
  for (const inventory of array(plan.inventories, 'plan inventories')) {
    keys(inventory, ['path', 'sha256', 'assignments'], 'inventory');
    const path = inventoryPath(inventory.path);
    if (mapped.has(path)) throw new Error(`Duplicate inventory ${path}`);
    mapped.add(path);
    if (!/^[a-f0-9]{64}$/.test(inventory.sha256)) throw new Error(`Invalid SHA256 for ${path}`);
    const changed = hashes[path] !== inventory.sha256;
    if (changed) stale.push(path);
    const report = actual.get(path);
    if (!report) { errors.push(`Inventory is not measured: ${path}`); continue; }
    const starts = new Map(array(report.list, `--list rows for ${path}`).map(f => [f.start, f]));
    for (const assignment of array(inventory.assignments, `assignments for ${path}`)) {
      keys(assignment, ['start', 'areas', 'reason'], 'assignment');
      const start = text(assignment.start, 'function start'), id = key(path, start);
      if (ownership.has(id)) throw new Error(`Duplicate assignment ${id}`);
      const owners = unique(array(assignment.areas, `owners for ${id}`).map(a => text(a, 'owner')), `owners for ${id}`);
      if (!owners.length || owners.some(a => !areas.includes(a))) throw new Error(`Unknown or empty owner for ${id}`);
      if (owners.length > 1) text(assignment.reason, `shared ownership reason for ${id}`);
      // A changed inventory may have dropped or excluded an assigned row; that is a stale plan to reconcile.
      const row = starts.get(start);
      if (!row || row.outOfScope) {
        const problem = row ? `Out-of-scope function assigned: ${id}` : `Unknown function ${id}`;
        if (!changed) throw new Error(problem);
        errors.push(`${problem} in a changed inventory; reconcile its assignments`);
        continue;
      }
      ownership.set(id, owners);
    }
  }
  const functions = reports.flatMap(inv => array(inv.list, `--list rows for ${inv.path}`).map(f => ({
    ...f, inventory: inv.path, owners: ownership.get(key(inv.path, f.start)) ?? [],
  })));
  const unassigned = functions.filter(f => !f.outOfScope && !f.owners.length);
  const shared = functions.filter(f => !f.outOfScope && f.owners.length > 1);
  const obligations = array(plan.obligations, 'obligations');
  unique(obligations.map(o => text(o.id, 'obligation id')), 'obligation ids');
  for (const o of obligations) {
    keys(o, ['id', 'area', 'kind', 'question', 'state', 'queue', 'evidence'], 'obligation');
    if (!areas.includes(o.area)) throw new Error(`Unknown obligation area ${o.area}`);
    if (!REQUIRED.includes(o.kind)) throw new Error(`Unknown obligation kind ${o.kind}`);
    text(o.question, `question for ${o.id}`);
    if (!['open', 'closed'].includes(o.state)) throw new Error(`Invalid obligation state ${o.id}`);
    const queue = array(o.queue, `queue for ${o.id}`), evidence = array(o.evidence, `evidence for ${o.id}`);
    if (o.state === 'open' && !queue.length) throw new Error(`Open obligation ${o.id} needs a queue item`);
    if (o.state === 'closed' && (!evidence.length || queue.length)) throw new Error(`Closed obligation ${o.id} needs evidence and no open queue items`);
    if (queue.some(id => !/^Q-[A-Z][A-Z0-9]*-\d+$/.test(id))) throw new Error(`Invalid queue reference in ${o.id}`);
    if (evidence.some(id => !/^(FND|EXP|RULE|FMT|SCR|BUG)-[A-Z][A-Z0-9]*-\d+$/.test(id))) throw new Error(`Invalid evidence reference in ${o.id}`);
  }
  const byArea = plan.areas.map(area => {
    const owned = functions.filter(f => !f.outOfScope && f.owners.includes(area.id));
    const checks = obligations.filter(o => o.area === area.id);
    const missingKinds = REQUIRED.filter(kind => !checks.some(o => o.kind === kind));
    return {
      id: area.id, scope: area.scope, functions: owned.length,
      cited: owned.filter(f => array(f.citedBy, 'citedBy').length).length,
      acceptedReadings: owned.filter(f => f.read === true).length,
      unavailableReadings: owned.filter(f => typeof f.read !== 'boolean').length,
      sharedFunctions: owned.filter(f => f.owners.length > 1).length,
      missingKinds, obligations: checks,
      readyForReview: owned.length > 0 && owned.every(f => f.read === true && !stale.includes(f.inventory)) && !missingKinds.length && checks.every(o => o.state === 'closed'),
    };
  });
  const unmeasured = array(coverage.unmeasured, 'unmeasured');
  const withoutInventory = array(coverage.withoutInventory, 'withoutInventory');
  const coverageProblems = [...array(coverage.problems, 'coverage problems'), ...array(coverage.unread, 'coverage unread')];
  return {
    version: 1, areas: byArea, staleInventories: stale, unassigned, shared,
    excludedFunctions: functions.filter(f => f.outOfScope),
    files: reports.map(inv => ({path: inv.path, completeReading: inv.completeReading, mapping: inv.mapping})),
    unmeasured, withoutInventory, errors: [...errors, ...coverageProblems],
    readyForReview: areas.length > 0 && reports.length > 0 && byArea.every(a => a.readyForReview) &&
      !stale.length && !unassigned.length && !unmeasured.length && !withoutInventory.length && !errors.length && !coverageProblems.length,
    limits: ['Ownership is explicitly assigned, never inferred from citations.', 'Shared area counts are not additive; byte figures remain those of each inventory.',
      'Closed checklists request human review; accepted complete readings come only from the pinned checker.', 'This assessment does not establish entries, validate parity or prove whole-game completion.'],
  };
}

/** Check that obligations use the current area's queue and non-superseded spec evidence. */
export function referenceProblems(plan, references) {
  const errors = [];
  for (const area of plan.areas) if (!references.areas.has(area.id)) errors.push(`Unknown spec area ${area.id}`);
  for (const o of plan.obligations) {
    for (const id of o.queue) if (!references.queue.has(id)) errors.push(`${o.id}: queue item is not open: ${id}`);
    for (const id of o.evidence) {
      const status = references.entries.get(id);
      // An unknown entry claims nothing yet, so it cannot record an obligation's answer.
      if (!status || ['superseded', 'disputed', 'unknown'].includes(status)) errors.push(`${o.id}: missing or inactive evidence ${id}`);
    }
  }
  return errors;
}

// The spec areas, active entry statuses and open queue items, read as tools/Check-ResearchTracking.mjs reads them.
function readReferences(root) {
  const {areas, entries, items} = trackingReferences(root);
  return {
    areas: new Set(areas), queue: new Set(items.keys()),
    entries: new Map([...entries].map(([id, entry]) => [id, entry.superseded ? 'superseded' : entry.status])),
  };
}

/** Run the pinned coverage CLI freshly and compare the declared inventory fingerprints. */
export function main(argv, root = ROOT) {
  if (argv.length === 1 && argv[0] === '--help') {
    console.log('Usage: Report-ResearchClosure.mjs --plan <metadata.json, relative to the repository root> [--json] [--require-ready]');
    return 0;
  }
  let planPath, json = false, requireReady = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--plan' && argv[i + 1]) planPath = argv[++i];
    else if (argv[i] === '--json') json = true;
    else if (argv[i] === '--require-ready') requireReady = true;
    else throw new Error('Usage: Report-ResearchClosure.mjs --plan <metadata.json, relative to the repository root> [--json] [--require-ready]');
  }
  if (!planPath) throw new Error('--plan is required; an empty plan cannot establish closure');
  verifySnapshot(root);
  const lock = JSON.parse(readFileSync(resolve(root, 'tools/upstream-lock.json'), 'utf8'));
  const cli = checkerEntry(lock, undefined, 'standard-coverage');
  const measured = spawnSync(process.execPath, [cli, '--root', root, '--json', '--list'], {encoding: 'utf8', maxBuffer: 16 * 1024 * 1024});
  if (measured.error) throw new Error(`Pinned coverage capture failed (16 MiB output limit): ${measured.error.message}`);
  // The reporter exits 1 with a full report when an inventory or side file is invalid; those
  // problems and unmeasured files are gaps to report. Any other exit, or no report, is a failure.
  const failed = () => new Error(`Pinned coverage failed (${measured.status}): ${measured.stderr.trim()}`);
  if (measured.status !== 0 && measured.status !== 1) throw failed();
  let coverage;
  try { coverage = JSON.parse(measured.stdout); } catch { throw failed(); }
  const plan = JSON.parse(readFileSync(resolve(root, planPath), 'utf8'));
  const hashes = Object.fromEntries(array(plan.inventories, 'plan inventories').map(inv => {
    const path = inventoryPath(inv.path);
    // Line endings and a byte order mark are normalized, so a CRLF checkout fingerprints as an LF one.
    // A missing inventory has no fingerprint, so its plan is stale and reported as not measured.
    const file = resolve(root, path);
    return [path, existsSync(file) ? digest(readFileSync(file, 'utf8').replace(/^\uFEFF/, '').replaceAll('\r\n', '\n')) : undefined];
  }));
  const report = assessClosure(plan, coverage, hashes);
  report.errors.push(...referenceProblems(plan, readReferences(root)));
  if (report.errors.length) { report.readyForReview = false; for (const area of report.areas) area.readyForReview = false; }
  report.checkerVersion = lock.checker.version;
  if (json) console.log(JSON.stringify(report, null, 2));
  else {
    for (const area of report.areas) console.log(`${area.id}: ${area.acceptedReadings}/${area.functions} accepted readings; ${area.obligations.filter(o => o.state === 'open').length} open obligations; ${area.missingKinds.length} missing checklist kinds`);
    console.log(`${report.unassigned.length} unassigned functions; ${report.shared.length} shared; ${report.withoutInventory.length} files without inventories; ${report.staleInventories.length} stale plans`);
    for (const error of report.errors) console.error(error);
    console.log(report.readyForReview ? 'Ready for closure review; evidence status and parity are unchanged.' : 'Closure review is not ready; inspect the explicit gaps with --json.');
  }
  return report.errors.length || (requireReady && !report.readyForReview) ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 2; }
}
