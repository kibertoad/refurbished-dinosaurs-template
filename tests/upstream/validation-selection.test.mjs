import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { classify, changedPaths } from '../../tools/Select-Validation.mjs';

test('only recognized documentation paths select the documentation gate', () => {
  assert.equal(classify(['spec/rules/example.md', 'spec/formats/layout.ksy', 'queue/X.md', 'parity/X.md', 'validation/run.yaml']), 'documentation');
  for (const paths of [[], ['AGENTS.md'], ['src/Game.cs'], ['tools/gate.mjs'], ['.githooks/pre-commit'],
    ['docs/a.md', 'package.json'], ['docs/../src/a.md'], ['spec/new.bin'], ['README.md']]) {
    assert.equal(classify(paths), 'full', paths.join(','));
  }
});

test('generated root parity selects documentation while lookalikes and mixed code changes require full validation', () => {
  assert.equal(classify(['PARITY.md']), 'documentation');
  assert.equal(classify(['parity/TEST.md', 'PARITY.md', 'docs/VALIDATION.md']), 'documentation');
  for (const paths of [['PARITY.md', 'src/Game.cs'], ['parity.md'], ['PARITY.md.js'],
    ['other/PARITY.md'], ['parity/../PARITY.md'], ['PARITY.md', 'AGENTS.md']]) {
    assert.equal(classify(paths), 'full', paths.join(','));
  }
});

test('selection includes committed, staged, unstaged, untracked and both rename sides', t => {
  const dir = mkdtempSync(join(tmpdir(), 'validation-selection-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const git = (...args) => {
    const result = spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  git('init'); git('config', 'user.name', 'Synthetic'); git('config', 'user.email', 'synthetic@example.invalid');
  mkdirSync(join(dir, 'docs')); mkdirSync(join(dir, 'src'));
  writeFileSync(join(dir, 'docs/base.md'), 'base');
  writeFileSync(join(dir, 'src/old.cs'), 'code');
  git('add', '.'); git('commit', '-m', 'base');
  const base = git('rev-parse', 'HEAD');
  writeFileSync(join(dir, 'docs/committed.md'), 'committed');
  writeFileSync(join(dir, 'PARITY.md'), '# Generated parity\n');
  git('add', '.'); git('commit', '-m', 'documentation');
  writeFileSync(join(dir, 'docs/base.md'), 'staged'); git('add', 'docs/base.md');
  writeFileSync(join(dir, 'docs/base.md'), 'unstaged');
  writeFileSync(join(dir, 'docs/untracked space.md'), 'untracked');
  assert(changedPaths(dir, base).includes('PARITY.md'));
  assert.equal(classify(changedPaths(dir, base)), 'documentation');
  renameSync(join(dir, 'src/old.cs'), join(dir, 'docs/moved.md'));
  const paths = changedPaths(dir, base);
  assert(paths.includes('src/old.cs')); assert(paths.includes('docs/moved.md'));
  assert.equal(classify(paths), 'full');
  assert.throws(() => changedPaths(dir, 'missing-revision'), /Cannot determine|revision|single revision/i);
});
