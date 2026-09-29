import { hex, span } from "./legacy-image.mjs";

// Consumes explicit edges from a local analyzer export; does not decode a linear byte window.
export function reviewFlow(graph, entry, limit = 1000) {
  if (!graph || !Array.isArray(graph.instructions) || graph.instructions.length > 100000 || !Array.isArray(graph.entries)) throw new Error("Invalid or oversized control-flow report");
  if (!Number.isSafeInteger(entry) || !Number.isInteger(limit) || limit < 1 || limit > 10000) throw new Error("Invalid entry or traversal limit");
  const nodes = new Map(), exported = new Set(graph.entries), pending = [entry], seen = new Set(), gaps = [], calls = [], exits = [], ownership = [];
  for (const n of graph.instructions) {
    if (!Number.isSafeInteger(n.start) || n.start < 0 || !Number.isInteger(n.size) || n.size < 1 || n.size > 32 || !Array.isArray(n.next) || !Array.isArray(n.calls)) throw new Error("Invalid instruction metadata");
    if (nodes.has(n.start)) throw new Error("Duplicate instruction start");
    if (![...n.next, ...n.calls].every((x) => Number.isSafeInteger(x) && x >= 0)) throw new Error("Invalid edge target");
    if (!["ordinary", "branch", "call", "return", "indirect", "terminal"].includes(n.kind)) throw new Error("Unknown control-flow kind");
    if (n.kind === "return" && n.next.length) throw new Error("A return cannot also declare local successors");
    nodes.set(n.start, n);
  }
  while (pending.length) {
    const at = pending.pop();
    if (seen.has(at)) continue;
    if (seen.size >= limit) { gaps.push({ at: hex(at), reason: "Traversal limit reached" }); break; }
    if (at !== entry && exported.has(at)) { gaps.push({ at: hex(at), reason: "Edge reaches another exported entry; ownership needs review" }); continue; }
    seen.add(at);
    const n = nodes.get(at);
    if (!n) { gaps.push({ at: hex(at), reason: "No verified instruction at edge target" }); continue; }
    if (n.owner != null && n.owner !== entry) ownership.push({ at: hex(at), analyzerOwner: hex(n.owner), requestedEntry: hex(entry) });
    if (n.externalEffects?.length) gaps.push({ at: hex(at), reason: "Hardware or external effects: " + n.externalEffects.join(", ") });
    if (n.kind === "indirect") gaps.push({ at: hex(at), reason: "Indirect flow remains unresolved" });
    if (n.kind === "terminal") gaps.push({ at: hex(at), reason: "External termination or trap semantics require evidence" });
    for (const target of n.calls) calls.push({ site: hex(at), target: hex(target), continuation: "Following edges assume callee returns; effects remain dependencies" });
    if (n.kind === "return") exits.push(hex(at));
    else if (!n.next.length && !["terminal", "indirect"].includes(n.kind)) gaps.push({ at: hex(at), reason: "No exit or successor recorded" });
    pending.push(...n.next);
  }
  const reached = [...seen].filter((x) => nodes.has(x)).sort((a, b) => a - b), overlaps = [];
  for (let i = 0; i < reached.length; i++) {
    for (let j = i + 1; j < reached.length && reached[j] < reached[i] + nodes.get(reached[i]).size; j++)
      overlaps.push({ first: hex(reached[i]), second: hex(reached[j]), classification: "Both starts reached by explicit edges; inspect each path" });
  }
  const intervals = [];
  for (const start of reached) {
    const end = start + nodes.get(start).size, last = intervals.at(-1);
    if (last && start <= last.end) last.end = Math.max(last.end, end);
    else intervals.push({ start, end });
  }
  const bodyBytes = intervals.reduce((sum, r) => sum + r.end - r.start, 0);
  return { entry: hex(entry), reached: reached.map((x) => hex(x)), bodyBytes, spans: intervals,
    exits, calls, overlaps, ownership, gaps,
    localPathsResolved: gaps.length === 0 && ownership.length === 0 && exits.length > 0,
    status: "Review artifact only; never promotes a spec entry or proves caller/input coverage" };
}

export function boundedTable(bytes, { start, count, stride, fields, countEvidence, limit = 256 }) {
  if (!Number.isInteger(count) || count < 0 || !Number.isInteger(limit) || limit < 1 || limit > 4096 || count > limit || !Number.isInteger(stride) || stride < 1 || stride > 65536 || typeof countEvidence !== "string" || !countEvidence.trim()) throw new Error("Table requires bounded count, stride and count evidence");
  if (!Array.isArray(fields) || !fields.length || fields.length > 32) throw new Error("Invalid table field layout");
  const names = new Set();
  for (const f of fields) {
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(f.name) || names.has(f.name) || ![1, 2, 4].includes(f.width)) throw new Error("Invalid or duplicate table field");
    names.add(f.name); span(f.offset, f.width, stride, "Table field");
  }
  span(start, count * stride, bytes.length, "Table");
  return { countEvidence, count, stride, rows: Array.from({ length: count }, (_, i) => Object.fromEntries(fields.map((f) => [f.name, bytes.readUIntLE(start + i * stride + f.offset, f.width)]))),
    interpretation: "Raw positions and unsigned fields only; input-to-index transformation remains a separate reading" };
}
