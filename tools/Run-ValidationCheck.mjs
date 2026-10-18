// Local receipts are an optimization, never evidence or a replacement for hooks.
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, lstatSync, readdirSync, realpathSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [id, separator, executable, ...args] = process.argv.slice(2);
const hash = value => createHash('sha256').update(value).digest('hex');
const run = (command, arguments_, options = {}) => spawnSync(command, arguments_, { cwd: root, encoding: 'utf8', ...options });
const checked = (command, arguments_) => {
  const result = run(command, arguments_);
  if (result.error || result.status !== 0) throw new Error(`Identity command failed: ${command}`);
  return result.stdout;
};
const relative = value => {
  if (typeof value !== 'string' || !value || value.includes('\\') || value.startsWith('/') ||
      value.split('/').some(part => !part || part === '.' || part === '..') || value.includes(':')) {
    throw new Error('Input exclusions must be canonical repository-relative files or directory prefixes.');
  }
  return value;
};
function fileIdentity(filename) {
  try {
    const info = lstatSync(filename);
    if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Not a regular input file: ${filename}`);
    // Refuse links in parent directories as well.
    const canonical = value => process.platform === 'win32' ? value.toLowerCase() : value;
    if (canonical(path.resolve(realpathSync(filename))) !== canonical(path.resolve(filename))) {
      throw new Error(`Linked input: ${filename}`);
    }
    return hash(readFileSync(filename));
  } catch (error) {
    if (error.code === 'ENOENT') return 'missing';
    throw error;
  }
}
function externalIdentity(directory) {
  const rows = [];
  function visit(current, relativeName) {
    const info = lstatSync(current);
    if (info.isSymbolicLink()) throw new Error('External input links are not supported.');
    if (info.isDirectory()) {
      rows.push([relativeName, 'directory']);
      for (const name of readdirSync(current).sort()) visit(path.join(current, name), `${relativeName}/${name}`);
    } else rows.push([relativeName, fileIdentity(current)]);
  }
  visit(directory, '');
  return rows;
}
function snapshot(configBytes, contract) {
  if (!contract || typeof contract !== 'object' || Array.isArray(contract) ||
      Object.keys(contract).some(key => !['exclude', 'tools', 'externalEnvironment'].includes(key)) ||
      (contract.externalEnvironment !== undefined && !Array.isArray(contract.externalEnvironment))) {
    throw new Error('Invalid check input contract.');
  }
  const excluded = contract.exclude ?? [];
  if (!Array.isArray(excluded)) throw new Error('exclude must be an array.');
  for (const name of excluded) relative(name.endsWith('/') ? name.slice(0, -1) : name);
  // A configuration/tool change always invalidates, even if an exclusion would match it.
  const protectedInput = name => name === 'validation-inputs.json' || name.startsWith('tools/') ||
    name.startsWith('.githooks/') || name.endsWith('lock.yaml') || name.endsWith('.json') || name.endsWith('.props');
  const names = [...new Set(checked('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard']).split('\0').filter(Boolean))].sort();
  const files = names.filter(name => protectedInput(name) || !excluded.some(item =>
    item.endsWith('/') ? name.startsWith(item) : name === item)).map(name => [name, fileIdentity(path.join(root, name))]);
  if (!Array.isArray(contract.tools) || contract.tools.length === 0 || contract.tools.some(tool =>
    !Array.isArray(tool) || tool.length < 2 || tool.some(arg => typeof arg !== 'string'))) {
    throw new Error('A reusable check requires explicit tool identity commands.');
  }
  const tools = contract.tools.map(([command, ...arguments_]) => [command, arguments_, checked(command, arguments_)]);
  const externalNames = [...new Set(['GAME_DIR', ...(contract.externalEnvironment ?? [])])].sort();
  const external = externalNames.map(name => {
    if (!/^[A-Z][A-Z0-9_]*$/.test(name)) throw new Error('Invalid external environment name.');
    return [name, process.env[name] ? externalIdentity(path.resolve(process.env[name])) : null];
  });
  // Values, including secrets, enter only the digest, never the receipt or logs.
  const environment = Object.entries(process.env).sort(([a], [b]) => a.localeCompare(b));
  return hash(JSON.stringify({ version: 1, root, executable, args, node: process.version,
    config: hash(configBytes), runner: fileIdentity(fileURLToPath(import.meta.url)), files, tools, external, environment }));
}
try {
  if (!/^[a-z][a-z0-9-]*$/.test(id ?? '') || separator !== '--' || !executable) {
    throw new Error('Usage: node tools/Run-ValidationCheck.mjs CHECK -- EXECUTABLE ARG...');
  }
  let configBytes;
  try { configBytes = readFileSync(path.join(root, 'validation-inputs.json')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const config = configBytes ? JSON.parse(configBytes) : { version: 1, checks: {} };
  if (config.version !== 1 || !config.checks || typeof config.checks !== 'object' || Array.isArray(config.checks) ||
      Object.keys(config).some(key => !['version', 'checks'].includes(key))) throw new Error('Invalid validation input configuration.');
  const contract = config.checks[id];
  const receiptPath = path.join(root, '.artifacts', 'validation-receipts', `${id}.json`);
  // No declaration means run fresh. CI never reuses a developer receipt.
  const reusable = contract && !process.env.CI;
  const before = reusable ? snapshot(configBytes, contract) : null;
  if (reusable) {
    let previous;
    try { previous = JSON.parse(readFileSync(receiptPath, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error; }
    if (previous?.version === 1 && previous.identity === before && previous.result === 'passed') {
      console.log(`${id}: reused passing run from ${previous.completed}; declared inputs match. Fresh documentation and staged checks remain required.`);
      process.exit(0);
    }
  }
  // Remove an earlier success before executing so a failed/interrupted run cannot leave it reusable.
  try { unlinkSync(receiptPath); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const result = run(executable, args, { stdio: 'inherit' });
  if (result.error || result.status !== 0) process.exit(result.status || 1);
  if (reusable) {
    const after = snapshot(configBytes, contract);
    if (before !== after) throw new Error('Inputs changed during validation; no receipt recorded. Run again.');
    mkdirSync(path.dirname(receiptPath), { recursive: true });
    writeFileSync(receiptPath, JSON.stringify({ version: 1, result: 'passed', identity: after, completed: new Date().toISOString() }) + '\n');
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
