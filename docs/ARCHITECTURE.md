# Architecture

Document dependency direction, runtime paths, state ownership, rendering resolution and
scaling, audio/video strategy, and boundaries between deterministic rules, original
formats, import tooling, and MonoGame presentation. Core and Resources must not depend
on MonoGame. The importer and inspector may depend on Resources; Game may depend on both.

Record meaningful changes as short ADRs. Link to shared patterns in Toad Discovery
Center instead of copying general explanations into this repository.
