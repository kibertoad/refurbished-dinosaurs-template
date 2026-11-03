// Domain selection is conservative: unmatched inputs require full integration.
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { changedPaths } from './Select-Validation.mjs';

const canonical = value => typeof value === 'string' && value.length > 0 &&
  !value.includes('\\') && !value.includes(':') && !value.startsWith('/') &&
  !value.replace(/\/$/, '').split('/').some(part => !part || part === '.' || part === '..');
const matches = (path, input) => input.endsWith('/') ? path.startsWith(input) : path === input;
export function discoverTests(root) {
  const files = [];
  function visit(directory) {
    for (const item of readdirSync(resolve(root, directory), { withFileTypes: true })) {
      const path = `${directory}/${item.name}`;
      if (item.isSymbolicLink()) throw new Error(`Linked test input: ${path}`);
      if (item.isDirectory()) visit(path);
      else if (item.isFile() && item.name.endsWith('.test.mjs')) files.push(path);
    }
  }
  visit('tests');
  return files.sort();
}
export function validateSuites(manifest, testFiles) {
  if (manifest?.version !== 1 || !Array.isArray(manifest.suites) || !manifest.suites.length ||
      !Array.isArray(manifest.documentation) || !manifest.documentation.every(canonical) ||
      (manifest.integration !== undefined && (!Array.isArray(manifest.integration) || !manifest.integration.every(canonical))) ||
      Object.keys(manifest).some(key => !['version', 'documentation', 'integration', 'suites'].includes(key)))
    throw new Error('Invalid validation suite manifest');
  const suites = new Map(), owners = new Map();
  for (const suite of manifest.suites) {
    if (!suite || typeof suite.id !== 'string' || Object.keys(suite).some(key => !['id', 'inputs', 'tests', 'dependencies', 'dotnet'].includes(key)) ||
        !/^[a-z][a-z0-9-]*$/.test(suite.id) || suites.has(suite.id) ||
        !Array.isArray(suite.inputs) || !suite.inputs.every(canonical) ||
        !Array.isArray(suite.tests) || !suite.tests.every(canonical) ||
        (suite.dotnet !== undefined && typeof suite.dotnet !== 'boolean') ||
        !Array.isArray(suite.dependencies) || !suite.dependencies.every(x => typeof x === 'string'))
      throw new Error('Invalid or duplicate validation suite');
    suites.set(suite.id, suite);
    for (const file of suite.tests) {
      if (!testFiles.includes(file)) throw new Error(`Missing test: ${file}`);
      if (owners.has(file)) throw new Error(`Duplicate test ownership: ${file}`);
      owners.set(file, suite.id);
    }
  }
  const visiting = new Set(), visited = new Set();
  function visit(id) {
    if (!suites.has(id)) throw new Error(`Unknown suite dependency: ${id}`);
    if (visiting.has(id)) throw new Error(`Cyclic suite dependency: ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of suites.get(id).dependencies) visit(dependency);
    visiting.delete(id); visited.add(id);
  }
  for (const id of suites.keys()) visit(id);
  return { suites, owners };
}
export function selectSuites(manifest, paths, testFiles, { integration = false, requested = [] } = {}) {
  const { suites, owners } = validateSuites(manifest, testFiles);
  for (const id of requested) if (!suites.has(id)) throw new Error(`Unknown requested suite: ${id}`);
  const full = reason => ({ mode: 'integration', reason, dotnet: true, suites: [...suites.keys()].sort(), tests: [...testFiles].sort() });
  if (integration) return full('explicit integration');
  if (testFiles.some(file => !owners.has(file))) return full('unregistered test');
  if (!Array.isArray(paths) || paths.some(path => !canonical(path) || path.endsWith('/')))
    return full('unavailable or invalid change paths');
  const selected = new Set(requested);
  for (const path of paths) {
    if ((manifest.integration ?? []).some(input => matches(path, input)) ||
        /\.(?:csproj|props|targets|slnx)$/.test(path) || /(?:^|\/)(?:packages\.lock\.json|pnpm-lock\.yaml)$/.test(path))
      return full(`shared integration input: ${path}`);
    const affected = [...suites.values()].filter(suite => suite.tests.includes(path) || suite.inputs.some(input => matches(path, input)));
    if (affected.length) for (const suite of affected) selected.add(suite.id);
    else if (!manifest.documentation.some(input => matches(path, input) &&
      (!input.endsWith('/') || /\.(?:md|ya?ml)$/.test(path)))) return full(`unmapped input: ${path}`);
  }
  // Select prerequisites and reverse dependencies to retain consumer coverage.
  let previous;
  do {
    previous = selected.size;
    for (const suite of suites.values()) {
      if (selected.has(suite.id)) for (const id of suite.dependencies) selected.add(id);
      if (suite.dependencies.some(id => selected.has(id))) selected.add(suite.id);
    }
  } while (selected.size !== previous);
  const ids = [...selected].sort();
  return { mode: 'selected', reason: 'reviewed input ownership', dotnet: ids.some(id => suites.get(id).dotnet), suites: ids,
    tests: ids.flatMap(id => suites.get(id).tests).sort() };
}
export function planFromBase(root, manifest, base, options = {}) {
  const tests = discoverTests(root);
  // Invalid manifests fail rather than being hidden by an unavailable baseline.
  validateSuites(manifest, tests);
  let paths;
  try { paths = changedPaths(root, base); } catch { paths = null; }
  return selectSuites(manifest, paths, tests, options);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const root = resolve(import.meta.dirname, '..');
    if (process.argv.length !== 3) throw new Error('Usage: Select-ValidationSuites.mjs <base-commit>');
    const manifest = JSON.parse(readFileSync(resolve(root, 'tools/validation-suites.json'), 'utf8'));
    console.log(JSON.stringify(planFromBase(root, manifest, process.argv[2], { integration: process.argv[2] === '--integration' || !!process.env.CI })));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
