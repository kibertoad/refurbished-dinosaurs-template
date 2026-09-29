import { hex } from "./legacy-image.mjs";

export function inventoryPath(build, manifest) {
  if (!/^BLD-[A-Z][A-Z0-9.-]*$/.test(build)) throw new Error("Invalid build ID");
  if (typeof manifest !== "string") throw new Error("Invalid manifest path");
  const disc = /^(CD\d*):(.+)$/.exec(manifest), path = disc ? `@${disc[1]}/${disc[2]}` : manifest;
  const parts = path.split("/");
  if (parts.some((x) => !x || x === "." || x === ".." || /[<>:"\\|?*\x00-\x1F]/.test(x) || /[. ]$/.test(x) || /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(x)) || (!disc && parts[0].startsWith("@"))) throw new Error("Manifest path cannot be represented portably");
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
// Each view explicitly owns source ranges. No view silently replaces another.
export function joinInventories(image, manifest, views) {
  inventoryPath("BLD-CHECK", manifest);
  if (!Array.isArray(views) || !views.length || views.length > 64) throw new Error("Supply 1..64 inventory views");
  const output = new Map(), summaries = [], names = new Set();
  for (const v of views) {
    if (!v.name || names.has(v.name) || !Array.isArray(v.ranges) || !v.ranges.length) throw new Error("Each view needs a distinct name and explicit ranges");
    names.add(v.name);
    for (const r of v.ranges) if (!Number.isSafeInteger(r.start) || !Number.isSafeInteger(r.end) || r.end <= r.start || !image.ranges.some((m) => r.start >= m.start && r.end <= m.end)) throw new Error("View range is outside mapped source");
    const sorted = [...v.ranges].sort((a, b) => a.start - b.start);
    if (sorted.some((r, i) => i && r.start < sorted[i - 1].end)) throw new Error("Overlapping ownership ranges within a view");
    const rows = parseInventory(v.text); let accepted = 0, excluded = 0;
    for (const row of rows) {
      const pair = /^([0-9A-Fa-f]{4}):([0-9A-Fa-f]{4})$/.exec(row.start);
      const canonical = /^0x[0-9A-Fa-f]+$/.test(row.start);
      if (!pair && !canonical) throw new Error("Inventory start must be segmented or a canonical file offset");
      const start = pair ? image.address(parseInt(pair[1], 16), parseInt(pair[2], 16)) : Number(row.start);
      if (!Number.isSafeInteger(start) || !image.ranges.some((r) => start >= r.start && start < r.end)) throw new Error("Inventory start outside mapped source");
      const range = v.ranges.find((r) => start >= r.start && start < r.end);
      if (!range) { excluded++; continue; }
      // Size counts body bytes, possibly discontiguous. It is never used as start + size.
      if (row.size > v.ranges.reduce((n, r) => n + r.end - r.start, 0)) throw new Error("Body byte count exceeds view capacity");
      if (output.has(start)) throw new Error(`Conflicting view or aliased duplicate at ${hex(start)}; choose ownership explicitly`);
      output.set(start, row.size); accepted++;
    }
    summaries.push({ view: v.name, accepted, excluded, ranges: v.ranges });
  }
  return { tsv: "start\tsize\n" + [...output].sort((a, b) => a[0] - b[0]).map(([start, size]) => `${manifest}+${hex(start)}\t${size}\n`).join(""), views: summaries,
    limitation: "Analyzer-discovered starts in declared views; not a census of all original functions. Size counts body bytes, not contiguous span." };
}
