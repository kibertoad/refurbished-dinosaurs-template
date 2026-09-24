# Supported source editions

## Latest official version gate

Before executable analysis, replace this section with a one-time, evidence-backed
determination of the latest official patch/version. Record the authoritative or
corroborated sources used, patch provenance, exact analysis version, executable
path (local only), length, and SHA-256. The analysis version must match the
latest official version recorded in `tools/project-config.json`; otherwise stop
and patch the owned copy first. This check runs once. After it is recorded
here, it is established truth: link to this record, and do not investigate the
question again unless the repository owner asks for it.

## Editions

Each original release is a build entry, `spec/builds/BLD-<alias>.md`, which
lists every file the spec uses with its size and xxh3. The patched analysis
copy is the first build, and every other supported release gets its own entry.
A storefront may distribute more than one build, and identical builds may appear
through more than one storefront; hashes, not branding, decide support.

List the builds the rebuild supports here, one line each with its build ID and
why it is supported, along with the evidence that extracted output from each is
equivalent.

## Extractor manifests

Add one JSON document below `src/Restoration.Extractor/source-manifests` per
supported build, covering the same files and sizes as the build entry.
Manifests fingerprint with SHA-256 and build entries with xxh3;
`Restoration.Inspect --source <dir>` prints both for every file. The Extractor tries
the manifests deterministically, refuses files it does not recognise, and
reports why each manifest failed. Preserve manual source selection even after
adding optional registry, storefront, mounted-media, or archive discovery
adapters.

Each manifest must set `sourceKind` to `directory`, `iso9660`, or `cue-bin`.
Paths and hashes describe logical files exposed by that source, not the outer
image bytes. Use outer-media fingerprints as additional recorded evidence when
useful, but keep identification resilient to lawful re-dumps only when the
logical file and track evidence actually proves equivalence.
