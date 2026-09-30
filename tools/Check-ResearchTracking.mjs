#!/usr/bin/env node
// Structural protocol checks; never upgrades evidence or declares a survey complete.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
export function checkResearchTracking(root) {
  const errors = [], entries = new Map(), items = new Map(), next = new Map();
  const read = path => readFileSync(path, 'utf8').replace(/^\uFEFF/, '').replaceAll('\r\n', '\n');
  const files = dir => existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? files(join(dir, e.name)) : e.name.endsWith('.md') ? [join(dir, e.name)] : []) : [];
  const specReadme = join(root, 'spec/README.md');
  const areas = [...(existsSync(specReadme) ? read(specReadme) : '').matchAll(/^\| `([A-Z]+)` \|/gm)].map(m => m[1]);
  for (const path of files(join(root, 'spec'))) {
    const body = read(path), metadata = body.match(/^---\n([\s\S]*?)\n---(?:\n|$)/)?.[1];
    const id = metadata?.match(/^id: (\S+)/m)?.[1];
    if (!id) continue;
    if (entries.has(id)) errors.push(`Duplicate spec entry ${id}`);
    entries.set(id, { path, body, superseded: /^status: superseded$/m.test(metadata) || !/^superseded_by: \[\]/m.test(metadata) });
  }
  const sections = ['Static', 'Emulated call', 'Agent run', 'Live session', 'Source', 'Blocked'];
  for (const area of areas) {
    const path = join(root, `queue/${area}.md`), split = join(root, `queue/${area}/README.md`);
    if (!existsSync(path) && !existsSync(split)) { errors.push(`Missing queue for ${area}`); continue; }
    const body = read(existsSync(path) ? path : split);
    if (!body.startsWith(`# ${area}\n`)) errors.push(`Wrong queue heading for ${area}`);
    const id = body.match(/^Next ID: Q-([A-Z]+)-(\d+)$/m);
    if (!id || id[1] !== area) errors.push(`Missing or invalid Next ID for ${area}`);
    else next.set(area, Number(id[2]));
    const sources = existsSync(path) ? [path] : files(join(root, `queue/${area}`)).filter(p => p !== split);
    if (existsSync(path)) {
      const actual = [...body.matchAll(/^## (.+)$/gm)].map(m => m[1]);
      if (JSON.stringify(actual) !== JSON.stringify(sections)) errors.push(`Queue sections out of order for ${area}`);
    }
    for (const source of sources) {
      const content = read(source);
      for (const match of content.matchAll(/^- (Q-([A-Z]+)-(\d+))\. ([\s\S]*?)(?=\n\n|\n## |$(?![\s\S]))/gm)) {
        const [full, qid, origin, number, rawText] = match;
        const text = rawText.replace(/\s+/g, ' ');
        if (items.has(qid)) errors.push(`Duplicate queue item ${qid}`);
        const refs = (text.split(':')[0].match(/(?:RULE|FMT|SCR|BUG|FND|EXP|BLD|SRC)-[A-Z0-9-]+/g) ?? []);
        if (!refs.length) errors.push(`${qid}: no spec entries`);
        for (const ref of refs) {
          if (!entries.has(ref)) errors.push(`${qid}: missing spec entry ${ref}`);
          else if (entries.get(ref).superseded) errors.push(`${qid}: superseded spec entry ${ref}`);
        }
        if (refs.length && /^(RULE|FMT|SCR|BUG|FND|EXP)-/.test(refs[0]) && refs[0].split('-')[1] !== area)
          errors.push(`${qid}: first entry belongs to another area`);
        if (!text.includes('?') || !text.includes('Settles it:') || !/Blocks:\s*\S/.test(text))
          errors.push(`${qid}: missing question, evidence or blocking scope`);
        const preceding = content.slice(0, match.index);
        const section = [...preceding.matchAll(/^##? (?:[A-Z]+: )?(.+)$/gm)].at(-1)?.[1];
        if (section === 'Blocked' && !text.includes('Waiting on:')) errors.push(`${qid}: blocked item has no Waiting on`);
        items.set(qid, { refs, origin, number: Number(number) });
      }
    }
  }
  for (const [qid, item] of items) {
    if (!next.has(item.origin) || next.get(item.origin) <= item.number) errors.push(`${qid}: Next ID would reuse an existing ID`);
  }
  for (const [id, entry] of entries) {
    if (entry.superseded) continue;
    const open = entry.body.match(/^## Open questions\s*\n([\s\S]*?)(?=^## |$(?![\s\S]))/m)?.[1]?.trim();
    if (!open || /^(None\.?|None known\.)$/i.test(open)) continue;
    const questions = open.split(/\n(?=- )/);
    for (const question of questions) {
      const qids = [...question.matchAll(/\bQ-[A-Z]+-\d+\b/g)].map(m => m[0]);
      if (!qids.length) errors.push(`${id}: untracked open question`);
      for (const qid of qids) {
        if (!items.has(qid)) errors.push(`${id}: missing queue item ${qid}`);
        else if (!items.get(qid).refs.includes(id)) errors.push(`${id}: ${qid} does not name this entry`);
      }
    }
  }
  return errors;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
  const errors = checkResearchTracking(root);
  for (const error of errors) console.error(error);
  if (errors.length) process.exitCode = 1;
  else console.log('Area queues and active spec open-question references are consistent.');
}
