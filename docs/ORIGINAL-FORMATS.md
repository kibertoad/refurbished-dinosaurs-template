# Original file formats

## Reusable source-media layer

The template supplies bounded read-only adapters for directories, cooked
2048-byte-sector ISO-9660 images, and single-file CUE/BIN images whose first
track is MODE1/2352 and remaining tracks are audio. Source manifests select
`directory`, `iso9660`, or `cue-bin` through `sourceKind`; fingerprints address
logical files inside that source. The adapters reject traversal, ambiguous
media, invalid sector alignment, unsupported track layouts, inconsistent
both-endian ISO fields, oversized directory structures, duplicate normalized
paths, and extents outside the image.

The Extractor also exposes bounded InstallShield cabinet expansion through
`expand-installshield`. It runs the pinned SabreTools parser in a child process,
requires an empty output directory, limits file count and expanded sizes, and
rejects non-portable or escaping paths. A configured project must document the
exact cabinet generation it has lawfully validated before claiming support.

These are transport/container facilities, not edition claims. Replace or extend
this section with the exact supported layout, fingerprints, limits, and evidence
for the selected game.

For each container or resource type, record signatures, endianness, offsets, lengths,
compression, palette/channel conventions, animation/audio timing, confidence, evidence,
known editions, malformed-input behavior, and unresolved questions. Include small hex
fragments only when they are factual and necessary; never commit original files.
