import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtempSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, chmodSync, rmSync, symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, dirname, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {checkTextPolicy, textCounts, validateRules} from '../../tools/Check-TextPolicy.mjs';

const root = resolve(import.meta.dirname, '../..');
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'text-policy-'));
  t.after(() => rmSync(dir, {recursive: true, force: true}));
  const put = (path, text) => {mkdirSync(dirname(join(dir, path)), {recursive: true}); writeFileSync(join(dir, path), text);};
  return {dir, put};
}
const rule = {name: 'documentation', roots: ['docs'], extensions: ['.md'], maxLines: 3,
  excludedRoots: ['docs/upstream'], excludedFiles: ['docs/generated.md']};

test('line counts agree for LF, CRLF, bare CR, empty files and final terminators', () => {
  for (const [text, lines] of [['', 0], ['one', 1], ['one\n', 1], ['one\r\n', 1],
    ['one\n\n', 2], ['one\rtwo\r\nthree\n', 3], ['\n', 1]]) {
    assert.equal(textCounts(text).lines, lines, JSON.stringify(text));
  }
  assert.equal(textCounts(' one\t two\nthree ').words, 3);
  assert.equal(textCounts(' \r\n ').words, 0);
});

test('a post-gate append fails and a linked content-preserving split passes', t => {
  const {dir, put} = fixture(t);
  put('docs/record.md', 'one\ntwo\n');
  assert.deepEqual(checkTextPolicy(dir, [rule]).failures, []);
  const appended = 'one\ntwo\nthree\nfour\n';
  put('docs/record.md', appended);
  assert.match(checkTextPolicy(dir, [rule]).failures[0], /4 lines exceeds 3/);
  put('docs/record.md', 'one\ntwo\n'); put('docs/records/002.md', 'three\nfour\n');
  put('docs/VALIDATION.md', '[First](record.md)\n[Second](records/002.md)\n');
  assert.equal(readFileSync(join(dir, 'docs/record.md'), 'utf8') + readFileSync(join(dir, 'docs/records/002.md'), 'utf8'), appended);
  assert.deepEqual(checkTextPolicy(dir, [rule]).failures, []);
});

test('explicit pinned/generated exclusions and binary suffixes retain their scope', t => {
  const {dir, put} = fixture(t);
  put('docs/short.md', 'one\r\ntwo\r\n');
  put('docs/upstream/long.md', 'long\n'.repeat(10));
  put('docs/generated.md', 'generated\n'.repeat(10));
  put('docs/blob.bin', Buffer.from([255, 254, 0]));
  const report = checkTextPolicy(dir, [rule]);
  assert.deepEqual(report.checked.map(f => f.file), ['docs/short.md']);
  assert.deepEqual(report.failures, []);
  put('docs/broken.md', Buffer.from([255]));
  assert(checkTextPolicy(dir, [rule]).failures.some(x => /cannot read UTF-8/.test(x)));
});

test('the operational handover cannot evade its word budget with very long lines', t => {
  const {dir, put} = fixture(t);
  put('docs/HANDOVER.md', 'one two three four\n');
  const handover = {name: 'handover', files: ['docs/HANDOVER.md'], extensions: ['.md'], maxLines: 200, maxWords: 3};
  assert.match(checkTextPolicy(dir, [handover]).failures[0], /4 words exceeds 3/);
});

test('missing policies, malformed limits and escaping paths fail explicitly', () => {
  for (const rules of [undefined, [], [{...rule, maxLines: 0}], [{...rule, maxWords: -1}],
    [{...rule, roots: ['../outside']}], [{...rule, roots: ['docs\\outside']}],
    [{...rule, roots: ['/absolute']}], [{...rule, extensions: []}], [rule, rule],
    [{...rule, typoLimit: 5}], [{...rule, roots: [], files: []}]]) {
    assert.throws(() => validateRules(rules));
  }
});

test('selected links and directory-valued exact files fail while explicit exclusions are respected', t => {
  const {dir, put} = fixture(t);
  put('data/source/long.md', 'synthetic\n'.repeat(10));
  mkdirSync(join(dir, 'docs'), {recursive: true});
  symlinkSync(join(dir, 'data/source'), join(dir, 'docs/linked'), 'junction');
  assert(checkTextPolicy(dir, [rule]).failures.some(x => /symbolic link/.test(x)));
  assert.deepEqual(checkTextPolicy(dir, [{...rule, excludedRoots: ['docs/linked']}]).failures, []);
  mkdirSync(join(dir, 'docs/directory.md'));
  const exact = {...rule, roots: [], files: ['docs/directory.md']};
  assert(checkTextPolicy(dir, [exact]).failures.some(x => /file is a directory/.test(x)));
  assert(checkTextPolicy(dir, [{...exact, files: ['docs/HANDOVR.md']}]).failures.some(x => /does not exist/.test(x)));
  put('docs/HANDOVER.txt', 'one\n');
  assert(checkTextPolicy(dir, [{...exact, files: ['docs/HANDOVER.txt']}]).failures.some(x => /does not have one of the extensions/.test(x)));
});

test('the command runs through a linked checkout and reads a policy saved with a BOM', t => {
  const {dir, put} = fixture(t);
  put('tools/repository-policy.json', `\uFEFF${JSON.stringify({textSizeRules: [rule]})}`);
  copyFileSync(join(root, 'tools/Check-TextPolicy.mjs'), join(dir, 'tools/Check-TextPolicy.mjs'));
  put('docs/record.md', 'long\n'.repeat(4));
  const linked = `${dir}-linked`;
  symlinkSync(dir, linked, 'junction');
  t.after(() => rmSync(linked, {force: true}));
  const result = spawnSync(process.execPath, [join(linked, 'tools/Check-TextPolicy.mjs')], {encoding: 'utf8'});
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stderr, /4 lines exceeds 3/);
});

test('the working-tree command skips files Git ignores and checks untracked ones', t => {
  const {dir, put} = fixture(t);
  const git = (...args) => { const r = spawnSync('git', args, {cwd: dir, encoding: 'utf8'}); assert.equal(r.status, 0, r.stdout + r.stderr); };
  put('tools/repository-policy.json', JSON.stringify({textSizeRules: [rule]}));
  copyFileSync(join(root, 'tools/Check-TextPolicy.mjs'), join(dir, 'tools/Check-TextPolicy.mjs'));
  put('.gitignore', 'docs/audit/\ndocs/backup.md\n');
  put('docs/audit/old.md', 'long\n'.repeat(10));
  put('docs/backup.md', 'long\n'.repeat(10));
  put('docs/record.md', 'one\n');
  git('init', '--quiet');
  const run = () => spawnSync(process.execPath, [join(dir, 'tools/Check-TextPolicy.mjs')], {cwd: dir, encoding: 'utf8'});
  let result = run();
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /passed for 1 files/);
  put('docs/untracked.md', 'long\n'.repeat(10));
  result = run();
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stderr, /docs\/untracked\.md: 10 lines exceeds 3/);
});

test('the actual staged snapshot rejects a late append despite an unstaged repair', t => {
  const {dir, put} = fixture(t);
  const git = (...args) => spawnSync('git', args, {cwd: dir, encoding: 'utf8'});
  const ok = (...args) => {const r = git(...args); assert.equal(r.status, 0, r.stdout + r.stderr); return r;};
  put('tools/repository-policy.json', JSON.stringify({textSizeRules: [rule]}));
  mkdirSync(join(dir, 'tools'), {recursive: true});
  copyFileSync(join(root, 'tools/Check-TextPolicy.mjs'), join(dir, 'tools/Check-TextPolicy.mjs'));
  // Run the real checker through the real hook's snapshot, without unrelated application checks.
  put('tools/Invoke-NodeChecks.mjs', "import {main} from './Check-TextPolicy.mjs'; process.exitCode = main([]);\n");
  put('.githooks/pre-commit', readFileSync(join(root, '.githooks/pre-commit'), 'utf8'));
  chmodSync(join(dir, '.githooks/pre-commit'), 0o755);
  put('docs/record.md', 'one\ntwo\n');
  ok('init', '--quiet'); ok('config', 'user.name', 'Synthetic'); ok('config', 'user.email', 'synthetic@example.invalid');
  ok('config', 'core.hooksPath', '.githooks'); ok('add', '.'); ok('commit', '--quiet', '-m', 'passing baseline');
  const appended = 'one\r\ntwo\r\nthree\r\nfour\r\n';
  put('docs/record.md', appended); ok('add', 'docs/record.md');
  put('docs/record.md', 'unstaged repair\n');
  assert.deepEqual(checkTextPolicy(dir, [rule]).failures, []);
  const failed = git('commit', '--quiet', '-m', 'late validation record');
  assert.notEqual(failed.status, 0);
  assert.match(failed.stdout + failed.stderr, /4 lines exceeds 3/);
  put('docs/record.md', 'one\r\ntwo\r\n'); put('docs/records/002.md', 'three\r\nfour\r\n');
  put('docs/VALIDATION.md', '[First](record.md)\n[Second](records/002.md)\n');
  assert.equal(readFileSync(join(dir, 'docs/record.md'), 'utf8') + readFileSync(join(dir, 'docs/records/002.md'), 'utf8'), appended);
  ok('add', 'docs');
  // Untracked working-tree output is outside what this commit proposes.
  put('docs/untracked.md', 'untracked\n'.repeat(10));
  ok('commit', '--quiet', '-m', 'split and link retained record');
});
