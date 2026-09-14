# Supported source editions

Record each supported original release independently from its sales channel. Include a
human-readable edition name, acquisition/media form, required relative files, sizes,
SHA-256 values, language/region, known differences, and the evidence that extracted output
is equivalent. A storefront may distribute more than one edition, and identical builds
may appear through multiple storefronts; fingerprints, not branding, decide support.

Add one JSON document below `src/Restoration.Extractor/source-manifests` per edition.
The Extractor tries them deterministically and reports why each failed. Preserve manual
source selection even after adding optional registry, storefront, mounted-media, or
archive discovery adapters.
