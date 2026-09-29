# Evidence tooling plan

This plan applies to maintenance of the unconfigured template. The user has
requested pull requests for all ten research priorities and explicitly retains
Standard v1. Tooling changes need no game-product decision under the Protocol.

## Outcome and scope

A researcher can cite relocated code, export a portable coverage inventory,
review bounded control flow and record the limits of a claim without keeping
original code in Git. Local copies of the applicable rules and the checker are
identified by upstream revision and verified independently of network access.
The game runtime, formats, rules and presentation are outside this work.

## Evidence and provenance

The source of the requests is the project-authored gaps document in
kibertoad/dark-sun-wake-redux, gaps 1 through 43, grouped into ten priorities.
Only generic procedures, repository-authored tools and synthetic fixtures are
adapted. The upstream Standard and Protocol sources are the MIT-licensed
kibertoad/refurbished-dinosaurs repository. Checker fixes belong to the
MIT-licensed refurbished-dinosaurs-toolkit and receive a linked dependency PR.
Original executables, assets, analysis output and game-specific conclusions
never enter these PRs.

## Batches and acceptance

1. **Locations, boundaries, negative searches and inventories (priorities
   1, 2, 5, 8).** Provide bounded read-only tooling with explicit source identity,
   MZ relocation and FBOV fixup provenance, file-offset mapping, positive-control
   checks, declared coverage exclusions, and portable inventory paths. Unknown
   or unsupported mappings fail explicitly. Reports keep byte-pattern candidates
   distinct from verified instruction paths. Committed inventories contain only
   starts, sizes and optional researcher-authored name/reason columns; analysis
   reports remain local. Synthetic fixtures cover malformed lengths, fixups,
   alias targets, missing controls, conflicting views and discontiguous bodies.
2. **Evidence contracts (priorities 3, 4, 6, 7).** Integrate conditional review
   guidance and worked synthetic examples into the research procedure. Cover
   memory/argument identity, path effects, capacities and caller ranges, progress,
   and hardware boundaries. Split independent queue questions and give each a
   settling condition. No added confidence scale or automatic status promotion.
3. **Checker and offline rules (priorities 9, 10).** Preserve historical
   procedures while excluding them from active ownership. Accept v1 overlay
   offsets with file bounds checks. Pin the fixed checker and rule snapshots,
   check hashes offline and provide an explicit refresh/check command. Network
   unavailability cannot silently replace the snapshot or claim freshness.

## Validation and exit

Each PR runs the canonical Invoke-Validation.ps1 gate. New tools run synthetic
Node tests in that gate and CI, without proprietary content or external Python
packages. Ghidra scripts are checked against the installed public API when
available; any live analyzer check not performed is stated explicitly.
The linked checker PR runs its full documentation fixture suite and repository
policy checks. Each PR description maps its priorities to changed files and
verification. The final set must cover all ten priorities and keep Standard v1.
No PR is merged or pushed directly to main as part of this task.

## Delivery map

| Priority | Delivered in | Review surface |
| --- | --- | --- |
| 1. Canonical locations and relocations | Template #19 | `tools/evidence/legacy-image.mjs` |
| 2. Function boundaries and complete readings | Template #19 and workflow follow-up | `review.mjs`, `ExportBoundedFlow.java`, `EVIDENCE-REVIEW.md` |
| 3. Memory and argument identity | Workflow follow-up | Memory identity and arguments examples |
| 4. Path effects and failures | Workflow follow-up | Paths, failures and ordering examples |
| 5. Negative findings and bounded questions | Template #19 and workflow follow-up | Search controls/exclusions, queue procedure |
| 6. Capacities, arithmetic and callers | Template #19 and workflow follow-up | Bounded table reader and review examples |
| 7. Emulation, progress and hardware | Template #19 and workflow follow-up | External-effect gaps and progress examples |
| 8. Portable honest coverage | Template #19 | Inventory exporter, explicit view joins |
| 9. Superseded ownership and location validation | Toolkit #10/#11, template #19 | Matching pinned action and offline checker |
| 10. Offline authority | Workflow follow-up | Snapshots, digests, refresh and configuration tests |

The workflow follow-up preserves the exact upstream Standard v1 text; its review
procedure adds no entry statuses, schema fields or format exceptions. The canonical
gate verifies both snapshot integrity and preservation during configuration.
