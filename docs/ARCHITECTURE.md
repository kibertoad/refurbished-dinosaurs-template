# Architecture

Document dependency direction, runtime paths, state ownership, rendering resolution and
scaling, audio/video strategy, and boundaries between deterministic rules, original
formats, extraction tooling, and MonoGame presentation. Core and Resources must not
depend on MonoGame. The separately runnable Extractor and read-only Inspector may depend
on Resources; Game may depend on Core and Resources but consumes only a verified asset
pack, never the original installation or executable.

Original media is read through `OriginalContentSource` from the
[`RefurbishedDinosaurs.LegacyFormats`](https://github.com/kibertoad/refurbished-dinosaurs-toolkit/blob/main/docs/runtime-libraries.md)
NuGet package, which the template pins at an exact version. Its directory, ISO 9660 and CUE/BIN
readers expose deterministic normalized inventories and bounded streams; Extractor and Inspect
consume that contract instead of parsing media independently. Edition manifests are the
package's `AssetManifest`, which `AssetVerifier.IdentifyAsync` matches against the owner's copy,
and the asset pack's manifest is `InstalledAssetManifest`, checked by `InstalledAssetVerifier`;
every hash is the XXH3-128 the spec's build entries give. Resources keeps only what is specific to
this project: the game id, the pack format version, where the pack lives and that a pack holds
nothing its manifest does not list (`OriginalContent`). Optional InstallShield expansion stays in
Extractor because it is a staging transformation, runs in an isolated child process, and never
becomes a runtime dependency of Game.

## Source media

The package reads directories, cooked 2048-byte-sector ISO 9660 images, and single-file CUE/BIN
images whose first track is MODE1/2352 starting at `00:00:00` and whose remaining tracks are audio.
Source manifests select `directory`, `iso9660`, or `cue-bin` (`ContentSourceKinds`) through
`sourceKind`. Fingerprints address logical files inside that source and do not cover `sourceKind`
itself, so one edition fingerprints identically whether it is read from an image or from a
directory the owner copied it into. The readers reject ambiguous media, invalid sector alignment,
raw sectors whose header does not match the MODE1/2352 the CUE sheet declares, unsupported track
layouts, CUE layout lines they cannot read, inconsistent both-endian ISO fields, oversized directory
structures, duplicate normalized paths, and extents outside the volume the image declares. A CUE/BIN
data track ends at the following track's INDEX 00 where one is declared, so an audio pregap is
never presented as data. Manifest paths and source lookups go through `PortableAssetPath.Relative`,
which rejects traversal, rooted and drive-relative names, components with a trailing dot or space,
and reserved device names on every host.

The Extractor's `expand-installshield` command runs the pinned SabreTools
parser in a child process, requires an empty output directory, limits file
count and expanded sizes, and rejects non-portable or escaping paths. A
configured project documents the exact cabinet generation it has lawfully
validated before claiming support.

These readers make no claim about any edition. The formats of the game's own
files are format entries in `spec/formats/`, and the readers in Resources cite
their IDs.

## Extraction

The Extractor verifies an exact licensed-source fingerprint, writes a versioned pack to
a unique sibling staging directory (the package's `StagedAssetPack`), generates provenance plus an
exact output inventory, re-opens and hashes every output, rejects unexpected files, and only then
commits, which swaps the new pack in and restores the previous one if the swap fails. A pack that
fails verification is never committed, so the last verified pack stays in place.

The game reports a failed start with the package's `StartupFailure`: it writes
`startup-error.log` under the per-user state directory (`RestorationPaths`) and prints the message.
It shows the Windows error dialog only when a person launched it; a platform smoke test or a run
with `CI` set never blocks on a dialog.

Record meaningful changes as short ADRs. Link to shared patterns in Toad Discovery
Center instead of copying general explanations into this repository.
