// Local machine paths belong to this checkout, never the account environment.
import {readFileSync,realpathSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';

export const localInputsPath = '.artifacts/local-inputs.json';
export function projectInputEnvironment(root, inherited = process.env) {
  const environment = {...inherited};
  for (const key of Object.keys(environment)) {
    if (key === 'GAME_DIR' || (process.platform === 'win32' && key.toUpperCase() === 'GAME_DIR')) delete environment[key];
  }
  let config;
  try { config = JSON.parse(readFileSync(path.join(root, localInputsPath), 'utf8').replace(/^\uFEFF/, '')); }
  catch (error) { if (error.code === 'ENOENT') return environment; throw new Error(`Invalid ${localInputsPath}: ${error.message}`); }
  if (!config || config.version !== 1 || Array.isArray(config) ||
      Object.keys(config).some(key => !['version', 'gameDirectory'].includes(key)) ||
      !Object.hasOwn(config, 'gameDirectory') ||
      (config.gameDirectory !== null && (typeof config.gameDirectory !== 'string' || !config.gameDirectory.trim()))) {
    throw new Error(`Invalid ${localInputsPath}: expected version 1 and gameDirectory (path or null).`);
  }
  if (config.gameDirectory !== null) environment.GAME_DIR = path.resolve(root, config.gameDirectory);
  return environment;
}
function main() {
  const [separator, command, ...args] = process.argv.slice(2);
  if (separator !== '--' || !command) throw new Error('Usage: node tools/Project-Inputs.mjs -- COMMAND ARG...');
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const result = spawnSync(command, args, {cwd: root, env: projectInputEnvironment(root), stdio: 'inherit'});
  if (result.error) throw result.error;
  return result.status ?? 1;
}
if (process.argv[1] && pathToFileURL(realpathSync(process.argv[1])).href === import.meta.url) {
  try { process.exitCode = main(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
