import { hex } from "./legacy-image.mjs";

// One path segment that every supported OS can store and Git can check out unchanged.
const portableSegment = (x) => !!x && x !== "." && x !== ".." && !/[<>:"\\|?*\x00-\x1F]/.test(x) && !/[. ]$/.test(x) && !/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(x);
// Default names analyzers invent; a committed name must be the researcher's own.
const analyzerName = /^(?:thunk_|j_)?(?:FUN|SUB|LAB|DAT|LOC|nullsub)_[0-9A-Fa-f]+$/i;
// The standard writes an MZ address with the load image placed at segment 0x1000.
const STANDARD_LOAD_SEGMENT = 0x1000;
const word = (n) => n.toString(16).toUpperCase().padStart(4, "0");

export function inventoryPath(build, manifest) {
  if (!/^BLD-[A-Z][A-Z0-9.-]*$/.test(build)) throw new Error("Invalid build ID");
  if (typeof manifest !== "string") throw new Error("Invalid manifest path");
  const disc = /^(CD\d*):(.+)$/.exec(manifest), path = disc ? `@${disc[1]}/${disc[2]}` : manifest;
  const parts = path.split("/");
  if (!parts.every(portableSegment) || (!disc && parts[0].startsWith("@"))) throw new Error("Manifest path cannot be represented portably");
  return `coverage/${build}/${path}.tsv`;
}
export function parseInventory(text) {
  const lines = text.replace(/^\uFEFF/, "").trimEnd().split(/\r?\n/);
  if (lines.shift() !== "start\tsize") throw new Error("Raw exports must contain only start and size; analyzer names are excluded");
  if (lines.length > 1000000) throw new Error("Inventory row limit exceeded");
  const seen = new Set();
  return lines.map((line) => {
    const [start, size, extra] = line.split("\t");
    if (!start || extra !== undefined || !/^[1-9][0-9]*$/.test(size) || !Number.isSafeInteger(Number(size))) throw new Error("Invalid inventory row");
    if (seen.has(start)) throw new Error("Duplicate inventory start"); seen.add(start);
    return { start, size: Number(size) };
  });
}

// The build entry's Code ranges for the file, as half-open file offsets. Only MZ overlay code is
// located by offset, so each range must lie inside one overlay payload the image declares.
function checkedCodeRanges(image, codeRanges = []) {
  if (!Array.isArray(codeRanges) || codeRanges.length > 4096) throw new Error("codeRanges must be a list of at most 4096 ranges");
  if (codeRanges.length && image.format === "PE") throw new Error("Code ranges locate MZ overlay code; a PE start is an address");
  for (const r of codeRanges)
    if (!Number.isSafeInteger(r?.start) || !Number.isSafeInteger(r?.end) || r.end <= r.start ||
        !image.ranges.some((m) => m.view.startsWith("overlay-") && r.start >= m.start && r.end <= m.end))
      throw new Error("A code range must lie inside one overlay payload of the file");
  return codeRanges;
}

// One start in the standard's notation for the file's format, with the number it is compared by:
// the file offset for MZ (resident or overlay) and the virtual address for PE. A segmented start
// keeps its spelling. A file offset in the MZ load image is written as the segment:offset whose
// offset is below 0x10, which names the same byte. A file offset in overlay code stays an offset,
// and must lie in a row of the build's Code ranges.
function notation(image, start, codeRanges) {
  if (image.format === "PE") {
    if (!/^0x[0-9A-Fa-f]{1,8}$/.test(start)) throw new Error("A PE inventory start is a 32-bit virtual address");
    const at = Number(start);
    if (!image.ranges.some((r) => at >= r.start && at < r.end)) throw new Error("Inventory start outside the executable sections");
    return { at, start: hex(at) };
  }
  if (image.loadSegment !== STANDARD_LOAD_SEGMENT) throw new Error("An MZ inventory is written with the load image at segment 0x1000, where the standard's notation places it");
  const pair = /^([0-9A-Fa-f]{4}):([0-9A-Fa-f]{4})$/.exec(start);
  if (pair) return { at: image.address(parseInt(pair[1], 16), parseInt(pair[2], 16)), start: start.toUpperCase() };
  if (!/^0x[0-9A-Fa-f]+$/.test(start)) throw new Error("Inventory start must be segmented or a canonical file offset");
  const at = Number(start), range = image.ranges.find((r) => at >= r.start && at < r.end);
  if (!Number.isSafeInteger(at) || !range) throw new Error("Inventory start outside mapped source");
  if (range.view === "resident") {
    const linear = at - image.header, segment = STANDARD_LOAD_SEGMENT + Math.floor(linear / 16);
    if (segment > 0xFFFF) throw new Error("Resident start lies beyond segment FFFF");
    return { at, start: `${word(segment)}:${word(linear % 16)}` };
  }
  if (!codeRanges.some((r) => at >= r.start && at < r.end)) throw new Error(`Overlay start ${hex(at)} lies in no row of the build's Code ranges; supply codeRanges`);
  return { at, start: hex(at) };
}

// Each view explicitly owns source ranges. No view silently replaces another. View ranges are in
// the space starts are compared in: file offsets for MZ, virtual addresses for PE.
export function joinInventories(image, manifest, views, { codeRanges } = {}) {
  inventoryPath("BLD-CHECK", manifest);
  if (!Array.isArray(views) || !views.length || views.length > 64) throw new Error("Supply 1..64 inventory views");
  const code = checkedCodeRanges(image, codeRanges);
  const output = new Map(), summaries = [], names = new Set(), owned = [];
  for (const v of views) {
    if (!v.name || names.has(v.name) || !Array.isArray(v.ranges) || !v.ranges.length) throw new Error("Each view needs a distinct name and explicit ranges");
    names.add(v.name);
    for (const r of v.ranges) if (!Number.isSafeInteger(r.start) || !Number.isSafeInteger(r.end) || r.end <= r.start || !image.ranges.some((m) => r.start >= m.start && r.end <= m.end)) throw new Error("View range is outside mapped source");
    const sorted = [...v.ranges].sort((a, b) => a.start - b.start);
    if (sorted.some((r, i) => i && r.start < sorted[i - 1].end)) throw new Error("Overlapping ownership ranges within a view");
    const other = owned.find((o) => sorted.some((r) => r.start < o.end && o.start < r.end));
    if (other) throw new Error(`Conflicting ownership: view ${v.name} overlaps a range owned by ${other.view}; choose ownership explicitly`);
    owned.push(...sorted.map((r) => ({ view: v.name, start: r.start, end: r.end })));
    const rows = parseInventory(v.text); let accepted = 0, excluded = 0;
    for (const row of rows) {
      const { at, start } = notation(image, row.start, code);
      const range = v.ranges.find((r) => at >= r.start && at < r.end);
      if (!range) { excluded++; continue; }
      // Size counts body bytes, possibly discontiguous. It is never used as start + size.
      if (row.size > v.ranges.reduce((n, r) => n + r.end - r.start, 0)) throw new Error("Body byte count exceeds view capacity");
      if (output.has(at)) throw new Error(`Conflicting view or aliased duplicate at ${start}; choose ownership explicitly`);
      output.set(at, { start, size: row.size }); accepted++;
    }
    summaries.push({ view: v.name, accepted, excluded, ranges: v.ranges });
  }
  return { tsv: "start\tsize\n" + [...output].sort((a, b) => a[0] - b[0]).map(([, row]) => `${row.start}\t${row.size}\n`).join(""), views: summaries,
    limitation: "Analyzer-discovered starts in declared views; not a census of all original functions. Size counts body bytes, not contiguous span." };
}

// Validate committed rows, not rich analyzer exports; optional text is researcher-authored only.
export function verifyInventory(image, build, manifest, text, path, { legacyPath, legacyEvidence, codeRanges } = {}) {
  const destination = inventoryPath(build, manifest);
  const safe = p => typeof p === 'string' && p.endsWith('.tsv') && p.split('/').every(portableSegment);
  if (!safe(path)) throw new Error('Unsafe inventory destination');
  if (legacyPath !== undefined && (!safe(legacyPath) || typeof legacyEvidence !== 'string' || !legacyEvidence.trim()))
    throw new Error('Legacy inventory path requires a safe path and explicit evidence');
  if (path !== destination && path !== legacyPath) throw new Error('Inventory destination does not match build/manifest identity');
  if (typeof text !== 'string' || Buffer.byteLength(text) > 32 * 1024 * 1024) throw new Error('Inventory too large');
  const code = checkedCodeRanges(image, codeRanges);
  const lines = text.replace(/^\uFEFF/, '').replace(/(?:\r?\n)+$/, '').split(/\r?\n/);
  const columns = lines.shift().split('\t');
  if (columns[0] !== 'start' || columns[1] !== 'size' || new Set(columns).size !== columns.length ||
      columns.some(c => !['start', 'size', 'name', 'out_of_scope'].includes(c))) throw new Error('Invalid committed inventory columns');
  if (!lines.length || lines.length > 1000000) throw new Error('Invalid committed inventory row count');
  const seen = new Set(), capacity = image.ranges.reduce((n,r)=>n+r.end-r.start,0);
  for (const line of lines) {
    const cells = line.split('\t');
    if (cells.length !== columns.length || cells.some(c=>c.length > 1024)) throw new Error('Invalid committed inventory row');
    const [start,size] = cells;
    const { at, start: canonical } = notation(image, start, code);
    // A segmented start may be any spelling of its byte, in upper case. An address or an overlay
    // offset has one spelling, eight upper-case digits, as joinInventories writes it.
    if (start !== canonical && !/^[0-9A-F]{4}:[0-9A-F]{4}$/.test(start)) throw new Error('Inventory start is not in the standard notation for the file (noncanonical)');
    if (seen.has(at)) throw new Error('Duplicate or aliased inventory start'); seen.add(at);
    if (!/^[1-9][0-9]*$/.test(size) || !Number.isSafeInteger(Number(size)) || Number(size)>capacity)
      throw new Error('Invalid inventory body byte count');
    const name = cells[columns.indexOf('name')];
    if (name !== undefined && analyzerName.test(name)) throw new Error('Inventory name is an analyzer default, not a researcher-authored name');
  }
  return { rows:lines.length, destination, actualPath:path, manifest, build,
    legacyPathEvidence:path===destination?null:legacyEvidence,
    limitation:'Analyzer-discovered starts only; names/reasons require researcher provenance; body size is not a contiguous end.' };
}
