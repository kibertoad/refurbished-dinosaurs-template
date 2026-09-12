# Architecture

Document dependency direction, runtime paths, state ownership, rendering resolution and
scaling, audio/video strategy, and boundaries between deterministic rules, original
formats, extraction tooling, and MonoGame presentation. Core and Resources must not
depend on MonoGame. The separately runnable Extractor and read-only Inspector may depend
on Resources; Game may depend on Core and Resources but consumes only a verified asset
pack, never the original installation or executable.

The Extractor verifies an exact licensed-source fingerprint, writes a versioned pack to
a unique sibling staging directory, generates provenance plus an exact output inventory,
re-opens and hashes every output, rejects unexpected files, and only then atomically
replaces the installed pack. Failure preserves the last verified pack.

Record meaningful changes as short ADRs. Link to shared patterns in Toad Discovery
Center instead of copying general explanations into this repository.
