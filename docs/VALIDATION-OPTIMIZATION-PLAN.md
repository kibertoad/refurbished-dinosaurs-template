# Validation suites and fixture costs

The template's validation should give fast feedback on the changed contracts
while retaining full checks before integration. This tooling work implements
the five requested improvements: small fixtures, domain suites, reviewed suite
receipts, an explicit integration gate, and fewer PowerShell startups.
It affects no game behaviour or proprietary-input contract.

## Selection contract

- Keep repository policy, configuration, pinned rules, section links, complete
  documentation/citation/schema checks, queue checks and staged hooks fresh.
  The toolkit's pending preflight feature is optional editing feedback and
  never replaces these acceptance checks.
- A versioned JSON manifest owns test files and source patterns by suite and
  declares suite dependencies. A dependency change selects its consumers.
  Match the union of committed, staged, unstaged, untracked, added, deleted
  and both sides of renamed paths against a verified base commit.
- Unknown paths, unowned tests, shared build/dependency/gate changes and an
  unavailable base conservatively select full integration. Invalid manifests,
  duplicate ownership, missing tests and cyclic dependencies fail explicitly.
  A full run discovers all test files so an unregistered test cannot disappear.
- Behaviour entries and their data select the relevant runtime domains;
  documentation classification cannot suppress tests of changed rules or
  formats. Projects can refine the initial broad template domains after review.
- Explicit test requests still execute. They cannot narrow a required full
  fallback. Manual filtered diagnostics are labelled partial acceptance.

## Execution and reuse

- Run Node files by suite and use the existing receipt runner per cacheable
  suite. Define reviewed input contracts; retain commands, tools, environment,
  configuration, locks, runner and protected inputs in the identity. A cache
  hit is not evidence. Failure or mutation during a run invalidates it.
- Cacheable synthetic suites must not read changing live project evidence or
  ignored inputs outside their contract. Whole-checkout integration suites
  remain uncached. CI and explicit integration execute every suite freshly.
- Node policy/checker commands remain outside receipt wrappers. .NET suites
  run when affected; caching .NET is unnecessary for this change.
- Expose a selected local mode with a base and an explicit integration mode.
  CI uses integration. Local batch acceptance uses fresh checks plus required
  suites; full integration runs before publication, for unknown/cross-cutting
  changes and when requested. Preserve serialization and failure propagation. Installer acceptance verifies
  the downloaded pinned release against that same tag, retaining attestation
  and publisher-signature checks in both CI and release workflows.

## Fixtures and process startup

- Replace broad copies only for narrow checker/configuration tests whose
  claims need a small synthetic project. Invoke production modules and keep
  passing, missing/malformed and override/failure controls. Inputs are explicit.
- Retain named full-checkout integration cases for configuration, preserved
  rule snapshots, tracked/untracked selection and staged-hook behaviour.
  Separate them from reusable unit suites; mutable fixtures stay independent.
- Extract reusable repository policy evaluation into an importable PowerShell
  module used by the production CLI. Exercise its case matrix in one host,
  with independent case inputs, while retaining real CLI success/failure controls.
  Do not rewrite exits or stub the behaviour under test to save startups.
- Record old assertions and where each remains covered. Benchmark fixture
  files/bytes, startup counts and elapsed time before/after with the same
  tools and claims, using synthetic data and no timing-based test thresholds.

## Acceptance and exit

Automated controls cover dependency propagation, mixed/unknown changes,
renames/deletions/untracked tests, manifest failures, explicit requests and
full-CI selection; receipt hit/invalidation, protected inputs, failures and
fresh integration; and real runner dispatch/failure propagation.
Existing fixture and CLI assertions stay covered. Configuration preserves
manifest paths when the project identity changes. Tests require no original.

Run targeted selector/receipt/fixture/runner tests, pinned documentation and
policy checks locally; CI runs full integration. Publish reproducible benchmark
results with their limits. Update instructions and validation documentation,
retain all existing integration claims, and create upstream PRs for review.

## Acceptance result

The manifest and domain runner are wired into the gate and CI. Integration
discovers Node tests and runs all .NET categories freshly. Selected runs retain
fresh checks and affected domains. Two audited synthetic suites have receipt
contracts. Repository-policy evaluation is shared with its CLI; the diagnostic
matrix uses one host and retains real CLI controls. Configuring project identity
updates manifest source paths and retains valid ownership.

Final implementation-tree integration passed 120 Node tests and 55 .NET tests,
with no skips and a zero-warning build. Startup and fixture measurements,
assertion accounting and their limits are in
[Results](VALIDATION-OPTIMIZATION-RESULTS.md). Fresh final documentation and staged
checks remain required after writing the acceptance record.

Process policy is proposed in
[PR128](https://github.com/kibertoad/refurbished-dinosaurs/pull/128).
Snapshots adopt merged fixture guidance PR127 at unchanged checker 6.0.1.
Merge the process policy before adopting the narrower gate downstream. Toolkit
preflight PR549 is separate editing feedback; this work requires no unreleased
checker flag. No downstream restoration policy is changed by this PR.
