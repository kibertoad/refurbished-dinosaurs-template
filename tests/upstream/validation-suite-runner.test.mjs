import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, copyFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { runSuites } from '../../tools/Run-ValidationSuites.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'suite-runner-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'tests'));
  writeFileSync(join(root, 'tests/owned.test.mjs'), 'import assert from "node:assert/strict"; assert.equal(2+2,4);');
  const manifest = { version: 1, documentation: [], suites: [
    { id: 'owned', inputs: [], tests: ['tests/owned.test.mjs'], dependencies: [] }
  ] };
  return { root, manifest };
}

test('real integration executes discovered unregistered tests and propagates failure', t => {
  const { root, manifest } = fixture(t);
  const plan = runSuites(root, manifest, 'unavailable', { integration: true });
  assert.equal(plan.mode, 'integration');
  writeFileSync(join(root, 'tests/new.test.mjs'), 'throw new Error("synthetic failure control");');
  assert.throws(() => runSuites(root, manifest, 'unavailable', { integration: true }), /Synthetic suite failed/);
});

test('integration propagates spawn errors and forces fresh environment', t => {
  const { root, manifest } = fixture(t);
  let calls = 0;
  const run = (command, args, options) => {
    calls++;
    assert.equal(command, process.execPath);
    assert.deepEqual(args, ['--test', 'tests/owned.test.mjs']);
    assert.equal(options.env.RESTORATION_VALIDATION_FRESH, '1');
    return { error: new Error('synthetic spawn failure') };
  };
  assert.throws(() => runSuites(root, manifest, '', { integration: true, run }), /synthetic spawn failure/);
  assert.equal(calls, 1);
});


test('selected dispatch uses production receipt runner, reuses success and propagates failures', t => {
  const { root, manifest } = fixture(t);
  mkdirSync(join(root, 'tools'));
  for (const file of ['Run-ValidationCheck.mjs', 'Project-Inputs.mjs', 'Select-ValidationSuites.mjs', 'Select-Validation.mjs'])
    copyFileSync(new URL(`../../tools/${file}`, import.meta.url), join(root, 'tools', file));
  writeFileSync(join(root, '.gitignore'), '.artifacts/\n');
  manifest.suites[0].receipt = { tools: [[process.execPath, '--version']] };
  writeFileSync(join(root, 'tools/validation-suites.json'), JSON.stringify(manifest));
  writeFileSync(join(root, 'validation-inputs.json'), JSON.stringify({ version: 1, checks: {} }));
  writeFileSync(join(root, 'tests/owned.test.mjs'), `import {mkdirSync,appendFileSync} from 'node:fs';
mkdirSync('.artifacts',{recursive:true});appendFileSync('.artifacts/runs','x');`);
  const git = (...args) => {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stdout + result.stderr); return result.stdout.trim();
  };
  git('init', '--quiet'); git('add', '.');
  git('-c', 'user.name=Synthetic', '-c', 'user.email=synthetic@example.invalid', 'commit', '--quiet', '-m', 'baseline');
  let base = git('rev-parse', 'HEAD');
  writeFileSync(join(root, 'tests/owned.test.mjs'), readFileSync(join(root, 'tests/owned.test.mjs'), 'utf8') + '\n// changed\n');
  const run = (command, args, options) => spawnSync(command, args, { ...options,
    env: { ...options.env, CI: '', RESTORATION_VALIDATION_FRESH: '', NODE_TEST_CONTEXT: undefined } });
  assert.equal(runSuites(root, manifest, base, { run }).mode, 'selected');
  runSuites(root, manifest, base, { run });
  assert.equal(readFileSync(join(root, '.artifacts/runs'), 'utf8'), 'x');
  manifest.suites[0].receipt.exclude = ['docs/'];
  writeFileSync(join(root, 'tools/validation-suites.json'), JSON.stringify(manifest));
  // The manifest is a shared gate input, so use the prior changed-test plan
  // directly through the receipt runner to isolate contract invalidation.
  const receipt = run(process.execPath, [join(root, 'tools/Run-ValidationCheck.mjs'), 'suite-owned', '--',
    process.execPath, '--test', 'tests/owned.test.mjs'], {cwd: root, stdio: 'inherit', env: process.env});
  assert.equal(receipt.status, 0);
  assert.equal(readFileSync(join(root, '.artifacts/runs'), 'utf8'), 'xx');
  git('add', 'tools/validation-suites.json');
  git('-c', 'user.name=Synthetic', '-c', 'user.email=synthetic@example.invalid', 'commit', '--quiet', '-m', 'reviewed receipt map');
  base = git('rev-parse', 'HEAD');
  writeFileSync(join(root, 'tests/owned.test.mjs'), 'throw new Error("changed failure");');
  assert.throws(() => runSuites(root, manifest, base, { run }), /Synthetic suite failed/);
});
