// Read-only section layout of a PE32 executable, for inventories whose starts are flat addresses.
// No original bytes or names are emitted: sections are reported by index, not by their names.
import { span } from "./legacy-image.mjs";

const CODE = 0x00000020, EXECUTE = 0x20000000;

// The executable sections of a PE32 file, as half-open virtual address ranges at the image base its
// header gives, which is how the standard writes a PE address. PE32+ files have sixteen-digit
// addresses, and LE, LX and NE files have layouts of their own, so all three are refused.
export function readPe32(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length > 256 * 1024 * 1024) throw new Error("PE input must be a buffer of at most 256 MiB");
  span(0, 64, bytes.length, "MZ stub");
  if (bytes.toString("ascii", 0, 2) !== "MZ") throw new Error("Unsupported executable: expected an MZ stub");
  const pe = bytes.readUInt32LE(0x3C);
  span(pe, 24, bytes.length, "PE header");
  const signature = bytes.toString("ascii", pe, pe + 4);
  if (signature !== "PE\0\0") {
    const kind = bytes.toString("ascii", pe, pe + 2);
    throw new Error(["LE", "LX", "NE"].includes(kind) ? `Unsupported executable: ${kind} has no PE section table` : "Unsupported executable: expected PE");
  }
  const count = bytes.readUInt16LE(pe + 6), optionalSize = bytes.readUInt16LE(pe + 20), optional = pe + 24;
  span(optional, optionalSize, bytes.length, "PE optional header");
  if (optionalSize < 2) throw new Error("PE optional header is too short");
  const magic = bytes.readUInt16LE(optional);
  if (magic === 0x20B) throw new Error("Unsupported executable: PE32+ addresses have sixteen digits");
  if (magic !== 0x10B || optionalSize < 96) throw new Error("Invalid PE32 optional header");
  const imageBase = bytes.readUInt32LE(optional + 28), sizeOfImage = bytes.readUInt32LE(optional + 56);
  if (!sizeOfImage || imageBase + sizeOfImage > 2 ** 32) throw new Error("PE image does not fit in 32-bit addresses");
  if (!count || count > 96) throw new Error("Invalid PE section count");
  const table = optional + optionalSize;
  span(table, count * 40, bytes.length, "PE section table");
  const sections = [];
  for (let i = 0; i < count; i++) {
    const entry = table + i * 40, virtualSize = bytes.readUInt32LE(entry + 8), address = bytes.readUInt32LE(entry + 12);
    const size = virtualSize || bytes.readUInt32LE(entry + 16), characteristics = bytes.readUInt32LE(entry + 36);
    if (!size) continue;
    if (address + size > sizeOfImage) throw new Error("PE section lies outside SizeOfImage");
    const section = { view: `section-${i}`, start: imageBase + address, end: imageBase + address + size, code: !!(characteristics & (CODE | EXECUTE)) };
    if (sections.some((s) => section.start < s.end && s.start < section.end)) throw new Error("Overlapping PE sections");
    sections.push(section);
  }
  const ranges = sections.filter((s) => s.code).map(({ view, start, end }) => ({ view, start, end }));
  if (!ranges.length) throw new Error("PE file has no executable section");
  return { format: "PE", imageBase, sizeOfImage, ranges };
}
