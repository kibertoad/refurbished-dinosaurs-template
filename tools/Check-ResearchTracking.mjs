#!/usr/bin/env node
// Structural protocol checks; never upgrades evidence or declares a survey complete.
import { readdirSync, readFileSync, existsSync, realpathSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
export function checkResearchTracking(root) {
  const errors = [], entries = new Map(), items = new Map(), next = new Map();
  const read = path => readFileSync(path, 'utf8').replace(/^\uFEFF/, '').replaceAll('\r\n', '\n');
  const files = dir => existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? files(join(dir, e.name)) : e.name.endsWith('.md') ? [join(dir, e.name)] : []) : [];
  const specReadme = join(root, 'spec/README.md');
  const areas = [...(existsSync(specReadme) ? read(specReadme) : '').matchAll(/^\| `([A-Z][A-Z0-9]*)` \|/gm)].map(m => m[1]);
  for (const path of files(join(root, 'spec'))) {
    const body = read(path), metadata = body.match(/^---\n([\s\S]*?)\n---(?:\n|$)/)?.[1];
    const id = metadata?.match(/^id: (\S+)/m)?.[1];
    if (!id) continue;
    if (entries.has(id)) errors.push(`Duplicate spec entry ${id}`);
    entries.set(id, { path, body, superseded: /^status: superseded$/m.test(metadata) || !/^superseded_by: \[\]/m.test(metadata) });
  }
  const sections = ['Static', 'Emulated call', 'Agent run', 'Live session', 'Source', 'Blocked'];
  const queueDir = join(root, 'queue');
  if (existsSync(queueDir)) for (const e of readdirSync(queueDir, { withFileTypes: true })) {
    const name = e.isDirectory() ? e.name : e.name.endsWith('.md') ? e.name.slice(0, -3) : null;
    if (name && name !== 'README' && !name.startsWith('.') && !areas.includes(name))
      errors.push(`queue/${e.name} is not an area listed in spec/README.md`);
  }
  // Entries use the standard's IDs; builds and sources take an alias that may hold dots.
  const entryRef = /\b(?:(?:RULE|FMT|SCR|BUG|FND|EXP)-[A-Z][A-Z0-9]*-\d+|(?:BLD|SRC)-[A-Z](?:[A-Z0-9.-]*[A-Z0-9])?)/g;
  const checkItem = (area, { qid, origin, number, section, lines }) => {
    const text = lines.join(' ').replace(/\s+/g, ' ');
    if (items.has(qid)) errors.push(`Duplicate queue item ${qid}`);
    const refs = text.split(':')[0].match(entryRef) ?? [];
    if (!refs.length) errors.push(`${qid}: no spec entries`);
    for (const ref of refs) {
      if (!entries.has(ref)) errors.push(`${qid}: missing spec entry ${ref}`);
      else if (entries.get(ref).superseded) errors.push(`${qid}: superseded spec entry ${ref}`);
    }
    if (refs.length && /^(RULE|FMT|SCR|BUG|FND|EXP)-/.test(refs[0]) && refs[0].split('-')[1] !== area)
      errors.push(`${qid}: first entry belongs to another area`);
    if (!text.includes('?') || !text.includes('Settles it:') || !/Blocks:\s*\S/.test(text))
      errors.push(`${qid}: missing question, evidence or blocking scope`);
    if (section === 'Blocked' && !text.includes('Waiting on:')) errors.push(`${qid}: blocked item has no Waiting on`);
    items.set(qid, { refs, origin, number: Number(number) });
  };
  for (const area of areas) {
    const path = join(root, `queue/${area}.md`), split = join(root, `queue/${area}/README.md`);
    const flat = existsSync(path);
    if (!flat && !existsSync(split)) { errors.push(`Missing queue for ${area}`); continue; }
    const body = read(flat ? path : split);
    if (!body.startsWith(`# ${area}\n`)) errors.push(`Wrong queue heading for ${area}`);
    const id = body.match(/^Next ID: Q-([A-Z][A-Z0-9]*)-(\d+)$/m);
    if (!id || id[1] !== area) errors.push(`Missing or invalid Next ID for ${area}`);
    else next.set(area, Number(id[2]));
    const sources = flat ? [path] : files(join(root, `queue/${area}`)).filter(p => p !== split);
    if (flat) {
      const actual = [...body.matchAll(/^## (.+)$/gm)].map(m => m[1]);
      if (JSON.stringify(actual) !== JSON.stringify(sections)) errors.push(`Queue sections out of order for ${area}`);
    }
    for (const source of sources) {
      const content = read(source);
      const shown = relative(root, source).replaceAll('\\', '/');
      if (!flat) {
        const heading = content.match(/^# ([A-Z][A-Z0-9]*): (.+)\n/);
        if (!heading || heading[1] !== area || !sections.includes(heading[2])) errors.push(`${shown}: wrong section heading`);
      }
      // One pass: a heading sets the section, a top-level bullet starts an item, and blank or
      // indented lines continue it. Any other top-level line ends it.
      let section, current = null;
      const flush = () => { if (current) checkItem(area, current); current = null; };
      for (const line of content.split('\n')) {
        const heading = line.match(/^##? (?:[A-Z][A-Z0-9]*: )?(.+)$/);
        if (heading) { flush(); section = heading[1]; continue; }
        if (line.startsWith('- ')) {
          flush();
          const item = line.match(/^- (Q-([A-Z][A-Z0-9]*)-(\d+))\. (.*)$/);
          if (item) current = { qid: item[1], origin: item[2], number: item[3], section, lines: [item[4]] };
          else errors.push(`${shown}: malformed queue item: ${line}`);
          continue;
        }
        if (current && (line.trim() === '' || /^\s/.test(line))) { current.lines.push(line); continue; }
        flush();
      }
      flush();
    }
  }
  for (const [qid, item] of items) {
    if (!next.has(item.origin) || next.get(item.origin) <= item.number) errors.push(`${qid}: Next ID would reuse an existing ID`);
  }
  for (const [id, entry] of entries) {
    if (entry.superseded) continue;
    const open = entry.body.match(/^## Open questions\s*\n([\s\S]*?)(?=^## |$(?![\s\S]))/m)?.[1]?.trim();
    if (!open || /^(None\.?|None known\.)$/i.test(open)) continue;
    // Prose that introduces a list of readings is not a reading of its own.
    let questions = open.split(/\n(?=- )/);
    if (questions.length > 1 && !questions[0].startsWith('- ')) questions = questions.slice(1);
    for (const question of questions) {
      const qids = [...question.matchAll(/\bQ-[A-Z][A-Z0-9]*-\d+\b/g)].map(m => m[0]);
      // Content no queue item can settle (a neutral name, an observation no run can make yet) says why.
      const exemption = question.match(/\(No item:([^)]*)\)/);
      if (exemption && !exemption[1].trim()) errors.push(`${id}: open question exempted with no reason`);
      else if (!qids.length && !exemption) errors.push(`${id}: untracked open question`);
      for (const qid of qids) {
        if (!items.has(qid)) errors.push(`${id}: missing queue item ${qid}`);
        else if (!items.get(qid).refs.includes(id)) errors.push(`${id}: ${qid} does not name this entry`);
      }
    }
  }
  return errors;
}
// Compare real paths, as tools/upstream.mjs does, so a symlinked checkout still runs the check.
const invokedDirectly = (() => { try { return process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href; } catch { return false; } })();
if (invokedDirectly) {
  const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
  const errors = checkResearchTracking(root);
  for (const error of errors) console.error(error);
  if (errors.length) process.exitCode = 1;
  else console.log('Area queues and active spec open-question references are consistent.');
}
