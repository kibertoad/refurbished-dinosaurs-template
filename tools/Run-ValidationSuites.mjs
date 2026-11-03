// Dispatch only a validated plan; full integration always discovers all tests.
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { planFromBase } from './Select-ValidationSuites.mjs';

export function runSuites(root, manifest, base, { integration = false, run = spawnSync } = {}) {
  const plan = planFromBase(root, manifest, base, { integration });
  console.log(`Validation ${plan.mode}: ${plan.reason}`);
  const invoke = (args, fresh) => {
    const environment = { ...process.env, ...(fresh ? { RESTORATION_VALIDATION_FRESH: '1' } : {}) };
    // A child runner must create its own test context, including in gate tests.
    delete environment.NODE_TEST_CONTEXT;
    const result = run(process.execPath, args, { cwd: root, stdio: 'inherit', env: environment });
    if (result.error) throw result.error;
    if (result.signal || result.status !== 0) throw new Error(`Synthetic suite failed (${result.signal ?? result.status})`);
  };
  if (plan.mode === 'integration') {
    invoke(['--test', ...plan.tests], true);
  } else {
    for (const id of plan.suites) {
      const suite = manifest.suites.find(suite => suite.id === id);
      if (suite.tests.length) invoke([resolve(root, 'tools/Run-ValidationCheck.mjs'), `suite-${id}`, '--',
        process.execPath, '--test', ...suite.tests], false);
    }
  }
  return plan;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv.length !== 3) throw new Error('Usage: Run-ValidationSuites.mjs <base-commit|--integration>');
    const root = resolve(import.meta.dirname, '..');
    const manifest = JSON.parse(readFileSync(resolve(root, 'tools/validation-suites.json'), 'utf8'));
    runSuites(root, manifest, process.argv[2], { integration: process.argv[2] === '--integration' || !!process.env.CI });
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
