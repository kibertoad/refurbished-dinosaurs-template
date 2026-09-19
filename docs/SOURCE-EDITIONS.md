# Supported source editions

## Latest official version gate

Before executable analysis, replace this section with a one-time, evidence-backed
determination of the latest official patch/version. Record the authoritative or
corroborated sources used, patch provenance, exact analysis version, executable
path (local only), length, and SHA-256. The analysis version must match the
latest official version recorded in `tools/project-config.json`; otherwise stop
and patch the owned copy first. Once conclusively established, link to this
record instead of repeatedly re-investigating the same question unless new
contradictory evidence appears.

Record each supported original release independently from its sales channel. Include a
human-readable edition name, acquisition/media form, required relative files, sizes,
SHA-256 values, language/region, known differences, and the evidence that extracted output
is equivalent. A storefront may distribute more than one edition, and identical builds
may appear through multiple storefronts; fingerprints, not branding, decide support.

Add one JSON document below `src/Restoration.Extractor/source-manifests` per edition.
The Extractor tries them deterministically and reports why each failed. Preserve manual
source selection even after adding optional registry, storefront, mounted-media, or
archive discovery adapters.

Each manifest must set `sourceKind` to `directory`, `iso9660`, or `cue-bin`.
Paths and hashes describe logical files exposed by that source, not the outer
image bytes. Use outer-media fingerprints as additional recorded evidence when
useful, but keep identification resilient to lawful re-dumps only when the
logical file and track evidence actually proves equivalence.
