import test from 'node:test';
import assert from 'node:assert/strict';
import { selectSuites, validateSuites } from '../../tools/Select-ValidationSuites.mjs';

const files = ['tests/core.test.mjs', 'tests/view.test.mjs', 'tests/tool.test.mjs'];
const manifest = () => ({ version: 1, documentation: ['docs/', 'queue/'], suites: [
  { id: 'core', inputs: ['src/Core/', 'spec/rules/'], tests: [files[0]], dependencies: [] },
  { id: 'view', inputs: ['src/View/', 'spec/screens/'], tests: [files[1]], dependencies: ['core'] },
  { id: 'tool', inputs: ['tools/reader.mjs'], tests: [files[2]], dependencies: [] }
] });
const select = (paths, options) => selectSuites(manifest(), paths, files, options);

test('domain changes select dependencies and consumers; documentation still runs fresh checks outside selection', () => {
  assert.deepEqual(select(['src/Core/A.cs']).suites, ['core', 'view']);
  assert.deepEqual(select(['spec/screens/SCREEN-A.md']).suites, ['core', 'view']);
  assert.deepEqual(select(['docs/A.md', 'tools/reader.mjs']).suites, ['tool']);
  assert.deepEqual(select(['docs/A.md']).suites, []);
  assert.deepEqual(select(['spec/rules/RULE-A.md']).suites, ['core', 'view']);
  assert.deepEqual(select([files[2]]).tests, [files[2]]);
});

test('unknown, deleted unowned tests, shared inputs and absent baselines require integration', () => {
  for (const paths of [null, ['package.json'], ['tools/Invoke-Validation.ps1'], ['tests/deleted.test.mjs'],
    ['docs/A.md', 'unknown.txt'], ['docs/new-script.mjs'], ['docs/new.json'], ['../outside'], ['docs//A.md'], ['C:/outside']])
    assert.equal(select(paths).mode, 'integration', JSON.stringify(paths));
  assert.equal(selectSuites(manifest(), [], [...files, 'tests/new.test.mjs']).mode, 'integration');
  assert.deepEqual(selectSuites(manifest(), [], [...files, 'tests/new.test.mjs']).tests, [...files, 'tests/new.test.mjs'].sort());
});

test('explicit requests execute and cannot narrow integration fallback', () => {
  assert.deepEqual(select(['docs/A.md'], { requested: ['tool'] }).suites, ['tool']);
  assert.equal(select(['package.json'], { requested: ['tool'] }).tests.length, 3);
  assert.equal(select([], { integration: true }).mode, 'integration');
  assert.throws(() => select([], { requested: ['absent'] }), /Unknown requested/);
});

test('invalid manifests, missing tests, duplicate owners and dependency cycles fail explicitly', () => {
  const mutations = [
    m => m.version = 2,
    m => m.suites.push(structuredClone(m.suites[0])),
    m => m.suites[1].tests.push(files[0]),
    m => m.suites[0].tests.push('tests/missing.test.mjs'),
    m => m.suites[0].dependencies.push('missing'),
    m => m.suites[0].dependencies.push('view'),
    m => m.suites[0].inputs.push('../escape'),
    m => m.documentation.push('/absolute')
  ];
  for (const mutate of mutations) {
    const m = manifest(); mutate(m);
    assert.throws(() => validateSuites(m, files));
  }
});


test('shared inputs take precedence over documentation and mapped runtime paths', () => {
  const m = manifest(); m.integration = ['docs/upstream/'];
  for (const paths of [['docs/upstream/work-protocol.md'], ['src/Core/Core.csproj'], ['src/Core/Directory.Build.targets']])
    assert.equal(selectSuites(m, paths, files).mode, 'integration');
  for (const mutate of [m => m.extra = true, m => m.suites[0].typo = true, m => m.integration = ['../escape']]) {
    const copy = manifest(); mutate(copy); assert.throws(() => validateSuites(copy, files));
  }
});
