// Equal-tool benchmark of the old and new diagnostic policy acceptance test.
// Only synthetic inputs are created. Results stay in ignored .artifacts/.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, cpSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { populateCheckerFixture } from '../tests/upstream/checker-fixture.mjs';

const root = resolve(import.meta.dirname, '..');
function git(...args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (result.error || result.status !== 0) throw new Error(result.error?.message ?? result.stderr);
  return result.stdout;
}
const base = git('rev-parse', '--verify', '--end-of-options', `${process.argv[2] ?? 'HEAD'}^{commit}`).trim();
const parent = resolve(root, '.artifacts/validation-benchmarks');
mkdirSync(parent, { recursive: true });
const output = mkdtempSync(resolve(parent, 'policy-'));
const results = { base, node: process.version, samples: [] };
for (const variant of ['before', 'after']) {
  const directory = resolve(output, variant);
  for (const file of ['tests/upstream/diagnostics.test.mjs', 'tools/Verify-Repository.ps1',
    'tools/repository-policy.json', '.gitignore', ...(variant === 'after' ? ['tools/Repository-Policy.psm1'] : [])]) {
    const target = resolve(directory, file);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, variant === 'before' ? git('show', `${base}:${file}`) : readFileSync(resolve(root, file)));
  }
  for (let sample = 0; sample < 3; sample++) {
    const start = performance.now();
    const result = spawnSync(process.execPath, ['--test', 'tests/upstream/diagnostics.test.mjs'],
      { cwd: directory, encoding: 'utf8' });
    if (result.error || result.status !== 0) throw new Error(result.error?.message ?? result.stdout + result.stderr);
    results.samples.push({ variant, milliseconds: Math.round(performance.now() - start) });
  }
}
// Measure only fixture preparation: pinned snapshots are identical in both cases.
// The stress input adds irrelevant synthetic files, as a large project may have.
function measureTree(directory) {
  let files = 0, bytes = 0;
  for (const name of readdirSync(directory)) {
    const path = resolve(directory, name), info = statSync(path);
    if (info.isDirectory()) { const child = measureTree(path); files += child.files; bytes += child.bytes; }
    else { files++; bytes += info.size; }
  }
  return { files, bytes };
}
const source = resolve(output, 'fixture-source');
populateCheckerFixture(source, root);
writeFileSync(resolve(source, 'PARITY.md'), 'Synthetic generated baseline.\n');
mkdirSync(resolve(source, 'spec/support'), { recursive: true });
for (let i = 0; i < 3000; i++) writeFileSync(resolve(source, `spec/support/fixture-${i}.txt`), 'Synthetic unrelated input.\n');
results.fixtureSamples = [];
for (const variant of ['before', 'after']) {
  for (let sample = 0; sample < 3; sample++) {
    const directory = resolve(output, `fixture-${variant}-${sample}`);
    mkdirSync(directory);
    const start = performance.now();
    if (variant === 'before') for (const path of ['spec', 'parity', 'deviations', 'PARITY.md'])
      cpSync(resolve(source, path), resolve(directory, path), { recursive: true });
    else populateCheckerFixture(directory, source);
    const milliseconds = Math.round(performance.now() - start);
    results.fixtureSamples.push({ variant, milliseconds, ...measureTree(directory) });
  }
}
writeFileSync(resolve(output, 'results.json'), JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify(results, null, 2));
console.log(`Results: ${output}`);
