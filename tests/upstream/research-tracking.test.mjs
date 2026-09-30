import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkResearchTracking } from '../../tools/Check-ResearchTracking.mjs';
function fixture(t, ending = '\n', area = 'TEST') {
  const root = mkdtempSync(join(tmpdir(), 'research-tracking-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'spec/rules'), { recursive: true });
  mkdirSync(join(root, 'queue'));
  const write = (name, body) => writeFileSync(join(root, name.replaceAll('TEST', area)), body.replaceAll('TEST_ENTRY', ['RULE', 'TEST', '001'].join('-')).replaceAll('MISSING_ENTRY', ['RULE', 'MISSING', '001'].join('-')).replaceAll('TEST', area).replaceAll('\n', ending));
  write('spec/README.md', '# Spec\n\n| Area | Covers |\n| `TEST` | Test domain |\n');
  write('spec/rules/TEST_ENTRY.md', '---\nid: TEST_ENTRY\nsuperseded_by: []\n---\n\n## Open questions\n\n- Which branch? (Q-TEST-001)\n');
  const queue = '# TEST\n\nNext ID: Q-TEST-002\n\n## Static\n\n- Q-TEST-001. TEST_ENTRY: Which branch?\n  Settles it: read the caller. Blocks: none.\n\n## Emulated call\n\nNone.\n\n## Agent run\n\nNone.\n\n## Live session\n\nNone.\n\n## Source\n\nNone.\n\n## Blocked\n\nNone.\n';
  write('queue/TEST.md', queue);
  return { root, write, queue };
}
test('wrapped questions and both line endings work', t => {
  for (const ending of ['\n', '\r\n']) assert.deepEqual(checkResearchTracking(fixture(t, ending).root), []);
});
test('missing area files and dangling question references fail', t => {
  const {root, write} = fixture(t);
  rmSync(join(root, 'queue/TEST.md'));
  assert.ok(checkResearchTracking(root).some(e => e.includes('Missing queue')));
  write('queue/TEST.md', '# TEST\nNext ID: Q-TEST-002\n');
  assert.ok(checkResearchTracking(root).some(e => e.includes('missing queue item')));
});
test('duplicate IDs, wrong entry ownership and allocator reuse fail', t => {
  const {root, write, queue} = fixture(t);
  write('queue/TEST.md', queue.replace('Q-TEST-002', 'Q-TEST-001').replace('None.\n\n## Agent run', '- Q-TEST-001. MISSING_ENTRY: Why? Settles it: read. Blocks: none.\n\n## Agent run'));
  const errors = checkResearchTracking(root);
  for (const expected of ['Duplicate queue item', 'missing spec entry', 'another area', 'reuse'])
    assert.ok(errors.some(e => e.includes(expected)), expected);
});
test('untracked questions and incomplete blocked records fail', t => {
  const {root, write, queue} = fixture(t);
  write('spec/rules/TEST_ENTRY.md', '---\nid: TEST_ENTRY\nsuperseded_by: []\n---\n## Open questions\n- Which branch?\n');
  write('queue/TEST.md', queue.replace('## Static', '## Blocked'));
  const errors = checkResearchTracking(root);
  assert.ok(errors.some(e => e.includes('untracked open question')));
  assert.ok(errors.some(e => e.includes('Waiting on')));
});

test('documentation examples outside front matter do not create entries', t => {
  const {root, write} = fixture(t);
  write('spec/rules/example.md', '# Example\n\n```yaml\nid: TEST_ENTRY\nsuperseded_by: []\n```\n');
  assert.deepEqual(checkResearchTracking(root), []);
});
test('alphanumeric standard area IDs are tracked', t => {
  assert.deepEqual(checkResearchTracking(fixture(t, '\n', 'AREA2').root), []);
});
