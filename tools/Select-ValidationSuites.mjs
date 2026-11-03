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
    if (!suite || typeof suite.id !== 'string' || Object.keys(suite).some(key => !['id', 'inputs', 'tests', 'dependencies', 'dotnet', 'receipt'].includes(key)) ||
        !/^[a-z][a-z0-9-]*$/.test(suite.id) || suites.has(suite.id) ||
        !Array.isArray(suite.inputs) || !suite.inputs.every(canonical) ||
        !Array.isArray(suite.tests) || !suite.tests.every(canonical) ||
        (suite.dotnet !== undefined && typeof suite.dotnet !== 'boolean') ||
        !Array.isArray(suite.dependencies) || !suite.dependencies.every(x => typeof x === 'string'))
      throw new Error('Invalid or duplicate validation suite');
    if (suite.receipt !== undefined) {
      const receipt = suite.receipt;
      if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt) ||
          Object.keys(receipt).some(key => !['exclude', 'tools', 'externalEnvironment'].includes(key)) ||
          !Array.isArray(receipt.tools) || !receipt.tools.length ||
          receipt.tools.some(tool => !Array.isArray(tool) || tool.length < 2 || tool.some(arg => typeof arg !== 'string')) ||
          (receipt.exclude !== undefined && (!Array.isArray(receipt.exclude) || !receipt.exclude.every(canonical))) ||
          (receipt.externalEnvironment !== undefined && (!Array.isArray(receipt.externalEnvironment) ||
            !receipt.externalEnvironment.every(name => typeof name === 'string' && /^[A-Z][A-Z0-9_]*$/.test(name)))))
        throw new Error(`Invalid suite receipt: ${suite.id}`);
    }
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
export function selectSuites(manifest, paths, testFiles, { integration = false, requested = [], research = false } = {}) {
  const { suites, owners } = validateSuites(manifest, testFiles);
  for (const id of requested) if (!suites.has(id)) throw new Error(`Unknown requested suite: ${id}`);
  if (research && integration) throw new Error('Research selection cannot run integration; run it separately');
  const full = reason => {
    if (research) throw new Error(`Research selection requires separate integration: ${reason}`);
    return ({ mode: 'integration', reason, dotnet: true, suites: [...suites.keys()].sort(), tests: [...testFiles].sort() });
  };
  if (integration) return full('explicit integration');
  if (testFiles.some(file => !owners.has(file))) return full('unregistered test');
  if (!Array.isArray(paths) || paths.some(path => !canonical(path) || path.endsWith('/')))
    return full('unavailable or invalid change paths');
  if (research && (paths.some(path => /^(?:src|tests)\//.test(path)) || requested.some(id => suites.get(id).dotnet)))
    throw new Error('A research batch cannot change src/tests or request rebuild tests');
  const selected = new Set(requested);
  for (const path of paths) {
    if (research && path.startsWith('spec/') && /\.(?:md|ksy)$/.test(path)) continue;
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
  const ids = [...selected].filter(id => !research || !suites.get(id).dotnet).sort();
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
export function suiteArguments(args, environment = process.env) {
  const research = args[0] === '--research';
  const rest = research ? args.slice(1) : args;
  if (rest.length !== 1) throw new Error('Usage: [--research] <base-commit|--integration>');
  return { base: rest[0], options: { research, integration: rest[0] === '--integration' || !!environment.CI } };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const root = resolve(import.meta.dirname, '..');
    const { base, options } = suiteArguments(process.argv.slice(2));
    const manifest = JSON.parse(readFileSync(resolve(root, 'tools/validation-suites.json'), 'utf8'));
    console.log(JSON.stringify(planFromBase(root, manifest, base, options)));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
