// Section line ranges for links into the local copy of the standard in docs/upstream/.
// A link such as [Status](docs/upstream/documentation-standard.md#status) (lines 118-136)
// names the lines an agent reads instead of the whole page.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { spawnSync } from "node:child_process";

export const PAGES = ["methodology", "documentation-standard", "work-protocol"];
const COPY = "docs/upstream/";
const RANGE = / \(lines (\d+)-(\d+)\)/y;
const LINK = /\]\(([^)\s]*?)(methodology|documentation-standard|work-protocol)\.md(?:#([^)\s]+))?\)/g;
const SITE_LINK = /\]\(\/(methodology|documentation-standard|work-protocol)\/(?:#([^)\s]+))?\)/g;
const PUBLISHED = /dinorefurb\.com\/(methodology|documentation-standard|work-protocol)/;

export const slug = (text) => text.trim().toLowerCase().replace(/[^a-z0-9 _-]/g, "").replace(/ /g, "-");

// Maps each heading's anchor to its 1-based line range: from the heading to the last
// non-blank line before the next heading of the same or a higher level.
export function sections(text) {
  const lines = text.split(/\r?\n/), headings = [];
  let fenced = false;
  lines.forEach((line, index) => {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
    else if (!fenced && /^#{1,6} /.test(line)) headings.push({ index, level: line.indexOf(" "), anchor: slug(line.replace(/^#+ /, "")) });
  });
  const ranges = new Map();
  headings.forEach((heading, position) => {
    const next = headings.slice(position + 1).find((other) => other.level <= heading.level);
    let end = next ? next.index - 1 : lines.length - 1;
    while (end > heading.index && lines[end].trim() === "") end--;
    ranges.set(heading.anchor, { start: heading.index + 1, end: end + 1 });
  });
  return ranges;
}

export function loadSections(root) {
  return new Map(PAGES.map((page) => [page, sections(readFileSync(resolve(root, `${COPY}${page}.md`), "utf8"))]));
}

export function markdownFiles(root) {
  const listed = spawnSync("git", ["ls-files", "-z", "-co", "--exclude-standard", "*.md"], { cwd: root, encoding: "utf8" });
  if (listed.status !== 0) throw new Error(`Listing Markdown files requires a Git checkout: ${listed.stderr}`);
  return [...new Set(listed.stdout.split("\0").filter(Boolean))].filter((file) => existsSync(resolve(root, file)));
}

// Checks one file's links into the copy, and with write set returns the text with each
// section link's range added or corrected. Problems that a rewrite cannot fix are reported.
export function linkFile(root, file, text, pages, write = false) {
  const problems = [];
  if (file.startsWith(COPY)) {
    for (const [link, page, anchor] of text.matchAll(SITE_LINK)) {
      if (anchor && !pages.get(page).has(anchor)) problems.push(`${file}: ${link} names no heading`);
    }
    return { text, problems };
  }
  if (PUBLISHED.test(text)) problems.push(`${file}: links the published page instead of ${COPY}`);
  let output = "", last = 0;
  for (const match of text.matchAll(LINK)) {
    const [link, prefix, page, anchor] = match, after = match.index + link.length;
    RANGE.lastIndex = after;
    const stated = RANGE.exec(text), expected = anchor && pages.get(page).get(anchor);
    const range = expected && ` (lines ${expected.start}-${expected.end})`;
    output += text.slice(last, after);
    last = stated ? RANGE.lastIndex : after;
    if (resolve(root, dirname(file), `${prefix}${page}.md`) !== resolve(root, `${COPY}${page}.md`)) problems.push(`${file}: ${link} misses ${COPY}`);
    else if (anchor && !expected) problems.push(`${file}: ${link} names no heading`);
    else if (!anchor && stated) problems.push(`${file}: ${link} names no section but states lines`);
    else if (range && (stated?.[0] ?? "") !== range && !write) problems.push(`${file}: ${link} needs${range}, not ${stated ? stated[0].trim() : "no range"}`);
    output += range && write ? range : stated?.[0] ?? "";
  }
  return { text: output + text.slice(last), problems };
}

export function checkLinks(root, write = false) {
  const pages = loadSections(root), problems = [], changed = [];
  for (const file of markdownFiles(root)) {
    const path = resolve(root, file), before = readFileSync(path, "utf8");
    const result = linkFile(root, file, before, pages, write);
    problems.push(...result.problems);
    if (write && result.text !== before) { writeFileSync(path, result.text); changed.push(file); }
  }
  return { problems, changed };
}
