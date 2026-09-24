# Architecture

Document dependency direction, runtime paths, state ownership, rendering resolution and
scaling, audio/video strategy, and boundaries between deterministic rules, original
formats, extraction tooling, and MonoGame presentation. Core and Resources must not
depend on MonoGame. The separately runnable Extractor and read-only Inspector may depend
on Resources; Game may depend on Core and Resources but consumes only a verified asset
pack, never the original installation or executable.

Resources owns the read-only original-source abstraction. Directory, ISO-9660,
and CUE/BIN adapters expose deterministic normalized inventories and bounded
streams; Extractor and Inspect consume that contract instead of parsing media
independently. Optional InstallShield expansion stays in Extractor because it is
a staging transformation, runs in an isolated child process, and never becomes
a runtime dependency of Game.

## Source media

The adapters read directories, cooked 2048-byte-sector ISO-9660 images, and
single-file CUE/BIN images whose first track is MODE1/2352 and remaining tracks
are audio. Source manifests select `directory`, `iso9660`, or `cue-bin` through
`sourceKind`. Fingerprints address logical files inside that source and do not
cover `sourceKind` itself, so one edition fingerprints identically whether it is
read from an image or from a directory the owner copied it into. The adapters
reject traversal, ambiguous media, invalid sector alignment, raw sectors whose
header does not match the MODE1/2352 the CUE sheet declares, unsupported track
layouts, inconsistent both-endian ISO fields, oversized directory structures,
duplicate normalized paths, and extents outside the image. A CUE/BIN data track
ends at the following track's INDEX 00 where one is declared, so an audio pregap
is never presented as data.

The Extractor's `expand-installshield` command runs the pinned SabreTools
parser in a child process, requires an empty output directory, limits file
count and expanded sizes, and rejects non-portable or escaping paths. A
configured project documents the exact cabinet generation it has lawfully
validated before claiming support.

These adapters make no claim about any edition. The formats of the game's own
files are format entries in `spec/formats/`, and the readers in Resources cite
their IDs.

## Extraction

The Extractor verifies an exact licensed-source fingerprint, writes a versioned pack to
a unique sibling staging directory, generates provenance plus an exact output inventory,
re-opens and hashes every output, rejects unexpected files, and only then atomically
replaces the installed pack. Failure preserves the last verified pack.

Record meaningful changes as short ADRs. Link to shared patterns in Toad Discovery
Center instead of copying general explanations into this repository.
