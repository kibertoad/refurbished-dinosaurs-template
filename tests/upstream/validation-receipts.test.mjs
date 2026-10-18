import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('../../tools/Run-ValidationCheck.mjs', import.meta.url));
function fixture(t, contract = { tools: [[process.execPath, '--version']] }) {
  const root = mkdtempSync(path.join(tmpdir(), 'validation-receipt-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, 'tools'));
  mkdirSync(path.join(root, 'docs'));
  copyFileSync(source, path.join(root, 'tools/Run-ValidationCheck.mjs'));
  copyFileSync(new URL('../../tools/Project-Inputs.mjs', import.meta.url), path.join(root, 'tools/Project-Inputs.mjs'));
  writeFileSync(path.join(root, '.gitignore'), '.artifacts/\n');
  writeFileSync(path.join(root, 'source.txt'), 'source');
  writeFileSync(path.join(root, 'docs/record.md'), 'before');
  writeFileSync(path.join(root, 'validation-inputs.json'), JSON.stringify({ version: 1, checks: contract ? { fixture: contract } : {} }));
  const git = (...args) => {
    const result = spawnSync('git', ['-c', `safe.directory=${root.replaceAll('\\', '/')}`, ...args], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  };
  git('init', '--quiet');
  git('add', '.');
  const command = "const fs=require('fs');fs.mkdirSync('.artifacts',{recursive:true});fs.appendFileSync('.artifacts/runs','x')";
  const run = (extra = '', environment = {}) => spawnSync(process.execPath,
    ['tools/Run-ValidationCheck.mjs', 'fixture', '--', process.execPath, '-e', command + extra],
    { cwd: root, encoding: 'utf8', env: { ...process.env, CI: '', GAME_DIR: '', ...environment } });
  const count = () => readFileSync(path.join(root, '.artifacts/runs'), 'utf8').length;
  const setOriginal = gameDirectory => { mkdirSync(path.join(root, '.artifacts'), {recursive:true}); writeFileSync(path.join(root, '.artifacts/local-inputs.json'), JSON.stringify({version:1, gameDirectory})); };
  return { root, run, count, setOriginal, write: (name, value) => writeFileSync(path.join(root, name), value) };
}
test('matching success reuses, included source and new untracked files invalidate', t => {
  const f = fixture(t);
  assert.equal(f.run().status, 0);
  assert.match(f.run().stdout, /reused passing run/);
  assert.equal(f.count(), 1);
  f.write('source.txt', 'changed');
  assert.equal(f.run().status, 0);
  f.write('new.txt', 'new');
  assert.equal(f.run().status, 0);
  assert.equal(f.count(), 3);
});
test('reviewed record exclusion permits reuse but config and protected tools still invalidate', t => {
  const f = fixture(t, { exclude: ['docs/record.md', 'tools/'], tools: [[process.execPath, '--version']] });
  assert.equal(f.run().status, 0);
  f.write('docs/record.md', 'final');
  assert.match(f.run().stdout, /reused passing run/);
  f.write('tools/new-tool.txt', 'changed');
  assert.equal(f.run().status, 0);
  assert.equal(f.count(), 2);
});
test('undeclared whole-tree checks and CI always run fresh', t => {
  for (const [configured, ci] of [[false, ''], [false, 'true'], [true, 'true']]) {
    const f = fixture(t, configured ? { tools: [[process.execPath, '--version']] } : null);
    assert.equal(f.run('', { CI: ci }).status, 0);
    assert.equal(f.run('', { CI: ci }).status, 0);
    assert.equal(f.count(), 2);
  }
});
test('receipts are not inputs in a checkout that does not ignore them', t => {
  const f = fixture(t, { exclude: ['.artifacts/runs'], tools: [[process.execPath, '--version']] });
  f.write('.gitignore', '');
  assert.equal(f.run().status, 0);
  assert.match(f.run().stdout, /reused/);
  assert.equal(f.count(), 1);
});
test('missing and linked original directories are identities, links inside them are refused', t => {
  const f = fixture(t);
  const missing = path.join(f.root, '.artifacts/absent');
  f.setOriginal(missing);
  assert.equal(f.run().status, 0);
  assert.match(f.run().stdout, /reused/);
  const original = path.join(f.root, '.artifacts/original');
  mkdirSync(original, { recursive: true });
  writeFileSync(path.join(original, 'synthetic.txt'), 'synthetic');
  const linked = path.join(f.root, '.artifacts/linked');
  symlinkSync(original, linked, 'junction');
  f.setOriginal(linked);
  assert.equal(f.run().status, 0);
  assert.match(f.run().stdout, /reused/);
  symlinkSync(original, path.join(original, 'loop'), 'junction');
  assert.equal(f.run().status, 1);
  assert.equal(f.count(), 2);
});
test('arguments, environment and original-directory contents invalidate', t => {
  const f = fixture(t);
  const original = path.join(f.root, '.artifacts/original');
  mkdirSync(original, { recursive: true });
  writeFileSync(path.join(original, 'synthetic.txt'), 'synthetic');
  f.setOriginal(original);
  assert.equal(f.run().status, 0);
  assert.match(f.run().stdout, /reused/);
  writeFileSync(path.join(original, 'synthetic.txt'), 'modified synthetic');
  assert.equal(f.run().status, 0);
  assert.equal(f.run(';void 0').status, 0);
  assert.equal(f.run(';void 0', { RECEIPT_TEST: 'changed' }).status, 0);
  assert.equal(f.count(), 4);
});
test('failed runs and inputs mutated during execution cannot retain success', t => {
  const f = fixture(t);
  assert.equal(f.run().status, 0);
  assert.equal(f.run(';process.exit(7)').status, 7);
  assert.doesNotMatch(f.run().stdout, /reused/);
  const mutated = f.run(";fs.writeFileSync('source.txt','changed during run')");
  assert.equal(mutated.status, 1);
  assert.match(mutated.stderr, /Inputs changed/);
  assert.doesNotMatch(f.run().stdout, /reused/);
});
test('changed tool version output invalidates, and failed version probes refuse reuse', t => {
  const f = fixture(t, { tools: [[process.execPath, '-e', "process.stdout.write(require('fs').readFileSync('.artifacts/tool-version','utf8'))"]] });
  mkdirSync(path.join(f.root, '.artifacts'));
  f.write('.artifacts/tool-version', 'synthetic-v1');
  assert.equal(f.run().status, 0);
  assert.match(f.run().stdout, /reused/);
  f.write('.artifacts/tool-version', 'synthetic-v2');
  assert.equal(f.run().status, 0);
  assert.equal(f.count(), 2);
  rmSync(path.join(f.root, '.artifacts/tool-version'));
  assert.equal(f.run().status, 1);
  assert.equal(f.count(), 2);
});
test('invalid contracts refuse reuse instead of skipping checks', t => {
  for (const contract of [{ tools: [] }, { exclude: ['../outside'], tools: [[process.execPath, '--version']] },
    { externalEnvironment: 'OTHER_INPUT', tools: [[process.execPath, '--version']] },
    { typo: [], tools: [[process.execPath, '--version']] }]) {
    const f = fixture(t, contract);
    assert.equal(f.run().status, 1);
  }
});

test('global game directories are ignored while local input configuration invalidates', t => {
  const f = fixture(t);
  assert.equal(f.run('', {GAME_DIR: '/unrelated/first'}).status, 0);
  assert.match(f.run('', {GAME_DIR: '/unrelated/second'}).stdout, /reused/);
  f.setOriginal(null);
  assert.doesNotMatch(f.run().stdout, /reused/);
  assert.match(f.run().stdout, /reused/);
  const mutated = f.run(";fs.writeFileSync('.artifacts/local-inputs.json',JSON.stringify({version:1,gameDirectory:'.artifacts/changed'}))");
  assert.equal(mutated.status, 1);
  assert.match(mutated.stderr, /Inputs changed/);
});
