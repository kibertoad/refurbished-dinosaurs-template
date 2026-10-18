#!/usr/bin/env node
// Classify the complete tracked/untracked change; unknown paths require the full gate.
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export function classify(paths) {
  const documentation = /^(?:spec\/.*\.(?:md|ksy)|(?:docs|queue|parity|deviations)\/.*\.md|validation\/.*\.ya?ml)$/;
  return paths.length > 0 && paths.every(path => documentation.test(path) &&
    !path.split('/').some(part => part === '..' || part === '.')) ? 'documentation' : 'full';
}

export function changedPaths(root, base) {
  const git = args => {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(result.stderr.trim() || 'Cannot determine changed paths');
    return result.stdout;
  };
  const revision = git(['rev-parse', '--verify', '--end-of-options', `${base}^{commit}`]).trim();
  const tracked = git(['diff', '--name-only', '-z', '--no-renames', revision, '--']);
  const untracked = git(['ls-files', '--others', '--exclude-standard', '-z']);
  return [...new Set((tracked + untracked).split('\0').filter(Boolean))].sort();
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv.length !== 3) throw new Error('Usage: Select-Validation.mjs <base-commit>');
    console.log(classify(changedPaths(resolve(dirname(fileURLToPath(import.meta.url)), '..'), process.argv[2])));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
