#!/usr/bin/env node
// One adopted text-size policy for working-tree and staged-snapshot checks.
import {readFileSync, readdirSync, lstatSync, existsSync} from 'node:fs';
import {resolve, dirname, extname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const decoder = new TextDecoder('utf-8', {fatal: true});
const list = (value, field) => { if (!Array.isArray(value) || value.some(x => typeof x !== 'string' || !x)) throw new Error(`${field} must be an array of nonempty strings`); return value; };
const path = (value, field) => {
  if (typeof value !== 'string' || !value || /[\\:]/.test(value) || value.startsWith('/') || value.split('/').some(p => !p || p === '.' || p === '..')) throw new Error(`${field} must be a canonical repository-relative path`);
  return value;
};
const within = (file, prefix) => file === prefix || file.startsWith(prefix + '/');

/** Match ReadAllLines: empty text has zero lines and a trailing terminator adds no extra line. */
export function textCounts(text) {
  const lines = text ? text.split(/\r\n|\r|\n/) : [];
  if (lines.at(-1) === '') lines.pop();
  return {lines: lines.length, words: text.trim() ? text.trim().split(/\s+/u).length : 0};
}

/** Validate explicit scopes and limits; missing or malformed policies cannot disable a check silently. */
export function validateRules(rules) {
  if (!Array.isArray(rules) || !rules.length) throw new Error('repository policy must declare nonempty textSizeRules');
  const names = new Set();
  return rules.map(rule => {
    if (!rule || typeof rule !== 'object' || Array.isArray(rule)) throw new Error('Invalid text-size rule');
    if (Object.keys(rule).some(k => !['name', 'roots', 'files', 'extensions', 'excludedRoots', 'excludedFiles', 'maxLines', 'maxWords'].includes(k))) throw new Error('Unknown text-size rule field');
    if (typeof rule.name !== 'string' || !rule.name.trim() || names.has(rule.name)) throw new Error('Text-size rule names must be nonempty and unique');
    names.add(rule.name);
    const roots = list(rule.roots ?? [], 'roots').map(p => path(p, 'root'));
    const files = list(rule.files ?? [], 'files').map(p => path(p, 'file'));
    if (!roots.length && !files.length) throw new Error(`${rule.name}: empty scope`);
    const excludedRoots = list(rule.excludedRoots ?? [], 'excludedRoots').map(p => path(p, 'excluded root'));
    const excludedFiles = list(rule.excludedFiles ?? [], 'excludedFiles').map(p => path(p, 'excluded file'));
    const extensions = list(rule.extensions, 'extensions').map(e => e.toLowerCase());
    if (!extensions.length || extensions.some(e => !/^\.[a-z0-9]+$/.test(e))) throw new Error(`${rule.name}: extensions must name text suffixes explicitly`);
    if (rule.maxLines === undefined && rule.maxWords === undefined) throw new Error(`${rule.name}: missing limit`);
    for (const limit of ['maxLines', 'maxWords']) if (rule[limit] !== undefined && (!Number.isSafeInteger(rule[limit]) || rule[limit] < 1)) throw new Error(`${rule.name}: invalid ${limit}`);
    return {...rule, roots, files, extensions, excludedRoots, excludedFiles};
  });
}

/** Check the files present in this tree using the repository's configured scopes and line definition. */
export function checkTextPolicy(root, configuredRules) {
  const rules = validateRules(configuredRules), candidates = new Set(), failures = [];
  const ignored = (file, rule) => rule.excludedFiles.includes(file) || rule.excludedRoots.some(p => within(file, p));
  function visit(file, rule) {
    if (ignored(file, rule)) return;
    const full = resolve(root, file);
    if (!existsSync(full)) return;
    const stat = lstatSync(full);
    if (stat.isSymbolicLink()) { failures.push(`${file}: selected path is a symbolic link; text-size policy cannot inspect it`); return; }
    if (stat.isDirectory()) for (const entry of readdirSync(full)) visit(`${file}/${entry}`, rule);
    else if (stat.isFile() && rule.extensions.includes(extname(file).toLowerCase())) candidates.add(file);
  }
  for (const rule of rules) {
    for (const file of rule.roots) visit(file, rule);
    for (const file of rule.files) {
      if (!ignored(file, rule) && existsSync(resolve(root, file)) && lstatSync(resolve(root, file)).isDirectory()) failures.push(`${file}: configured text file is a directory`);
      else visit(file, rule);
    }
  }
  const checked = [];
  for (const file of [...candidates].sort()) {
    const applicable = rules.filter(rule => !ignored(file, rule) && rule.extensions.includes(extname(file).toLowerCase()) &&
      (rule.files.includes(file) || rule.roots.some(p => within(file, p))));
    let counts;
    try { counts = textCounts(decoder.decode(readFileSync(resolve(root, file)))); }
    catch (error) { failures.push(`${file}: cannot read UTF-8 text: ${error.message}`); continue; }
    checked.push({file, ...counts});
    for (const rule of applicable) for (const [field, limit] of [['lines', rule.maxLines], ['words', rule.maxWords]]) {
      if (limit !== undefined && counts[field] > limit) failures.push(`${file}: ${counts[field]} ${field} exceeds ${limit} (${rule.name})`);
    }
  }
  return {checked, failures};
}

/** Read the adopted repository policy. The staged hook calls this same command inside its snapshot. */
export function main(argv, root = ROOT) {
  if (argv.length) {
    if (argv.length !== 2 || argv[0] !== '--root') throw new Error('Usage: Check-TextPolicy.mjs [--root <checkout>]');
    root = resolve(argv[1]);
  }
  const policy = JSON.parse(readFileSync(resolve(root, 'tools/repository-policy.json'), 'utf8'));
  const report = checkTextPolicy(root, policy.textSizeRules);
  for (const failure of report.failures) console.error(failure);
  if (!report.failures.length) console.log(`Text-size policy passed for ${report.checked.length} files.`);
  return report.failures.length ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 2; }
}
