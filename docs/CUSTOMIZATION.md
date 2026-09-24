# Customization guide

This repository ships as a template. Everything that ties it to one specific
game is either a `{{PLACEHOLDER}}` token, a value in `tools/project-config.json`,
or a decision recorded in the documents listed under "Decisions that stay
manual".

## Establish facts, then one command

1. Complete and obtain approval for `docs/IMPLEMENTATION-PLAN.md`.
2. Establish the latest official patch/version once, patch and fingerprint the
   legally owned analysis copy, and record the evidence and matching versions in
   `tools/project-config.json` and `docs/SOURCE-EDITIONS.md`. Bootstrap refuses an
   older or unestablished analysis build. Once the record exists, it is settled;
   do not redo the investigation unless the repository owner asks for it.
3. Fill in `tools/project-config.json`. `projectName` (PascalCase, used for
   namespaces, assemblies, and directories), `displayName` (player-facing), the
   original-game facts, and patch-status evidence are required. Identity fields
   with documented defaults may remain empty.
4. Run `./tools/Bootstrap-Project.ps1`. It checks the plan and patch gates, calls
   `Configure-Project.ps1`, substitutes the placeholders, renames
   the template's `Restoration.*` projects, and writes the resolved identity back
   to `tools/project-config.json` with `"configured": true`.
5. Customize the provisional `AGENTS.md` for the game and resolve the remaining
   items reported by `./tools/Verify-Configuration.ps1`.

Command-line parameters override the file for one run, so
`./tools/Configure-Project.ps1 -ProjectName Sanctuary -DisplayName 'Sanctuary Restored'`
works against an untouched template. Add `-WhatIf` to see every file, rename,
and unresolved placeholder without changing anything.

## Placeholders

| Placeholder | Configuration field | Value when the field is empty |
|---|---|---|
| `{{PROJECT_NAME}}` | `projectName` | required |
| `{{DISPLAY_NAME}}` | `displayName` | required |
| `{{GAME_ID}}` | `gameId` | `projectName` in lowercase |
| `{{PACKAGE_ID}}` | `packageId` | `projectName` |
| `{{APP_DATA_DIRECTORY}}` | `appDataDirectory` | `projectName` |
| `{{APP_ID}}` | `appId` | a newly generated GUID, kept stable afterwards |
| `{{BUNDLE_ID}}` | `bundleId` | `io.github.<publisher>.<gameId>` |
| `{{SHORTCUT_NAME}}` | `shortcutName` | `displayName` without path-hostile characters |
| `{{SOURCE_ENVIRONMENT_VARIABLE}}` | `sourceEnvironmentVariable` | screaming-snake `projectName` plus `_SOURCE_PATH` |
| `{{PUBLISHER}}` | `publisher` | `kibertoad` |
| `{{COPYRIGHT_HOLDER}}` | `copyrightHolder` | `publisher` |
| `{{COPYRIGHT_YEAR}}` | `copyrightYear` | the current year |
| `{{REPOSITORY_URL}}` | `repositoryUrl` | `https://github.com/<publisher>/<gameId>` |
| `{{PROJECT_SUMMARY}}` | `summary` | composed from the `original` metadata |
| `{{ORIGINAL_TITLE}}` | `original.title` | left unresolved and reported |
| `{{ORIGINAL_DEVELOPER}}` | `original.developer` | left unresolved and reported |
| `{{ORIGINAL_RELEASE_YEAR}}` | `original.releaseYear` | left unresolved and reported |
| `{{ORIGINAL_GENRE}}` | `original.genre` | left unresolved and reported |

A placeholder with no value is deliberately left in place rather than filled
with a plausible guess, so `./tools/Verify-Configuration.ps1` keeps reporting it.

## What configuration rewrites

- Placeholder tokens in every tracked text file, including `.github/workflows`.
- The template project name in namespaces, assembly names, project references,
  the solution file, the Inno Setup script, and the directories and files named
  after it. Only `Restoration` followed by a project suffix or `Game` is
  replaced, so prose and unrelated identifiers survive.
- `tools/project-config.json`, which becomes the record of the chosen identity.
- The root `Start {{SHORTCUT_NAME}}.bat` filename and content, including the
  configured source environment variable.

`tools/Configure-Project.ps1` and `tools/Verify-Configuration.ps1` are excluded
from rewriting; they hold the placeholder table and the template name that make
reconfiguration possible.

## Continuous integration

The packaging jobs need an identity: an unconfigured template cannot build a
Debian package or an installer, because `{{GAME_ID}}` is not a valid package
name. Those jobs therefore start with
`./tools/Configure-Project.ps1 -SkipIfConfigured` and a throwaway
`TemplateSample` identity, which does nothing once a repository is configured
and keeps both the packaging scripts and the configuration tooling under test on
every pull request. The build-and-test job runs against the repository as it is,
and `./tools/Verify-Configuration.ps1` runs everywhere.

## Decisions that stay manual

Configuration cannot decide these. Each one is also an item in
`docs/BOOTSTRAP-CHECKLIST.md`:

- `src/<Project>.Extractor/source-manifests/*.json`: one fingerprint manifest per
  supported original edition. Delete the sample; it is reported until it is gone.
- `tools/repository-policy.json`: the restricted extensions list is a starting
  point aimed at a typical 1990s PC release. Add the extensions the original
  game actually uses, and keep `deniedRoots` as it is.
- `packaging/windows/<Project>.iss`: original-installation discovery, validation,
  and the extraction step shown during Setup.
- `tools/Build-LinuxInstaller.ps1`: Debian package name, dependencies, and
  desktop entry categories.
- `tools/Build-MacInstaller.ps1`: bundle identifier and minimum macOS version.
- `README.md`: the status table, the controls section, and acknowledgements.
- `AGENTS.md`: canonical patched oracle, game terminology, evidence ledgers,
  local tools, validation commands, and game-specific invariants.
- `spec/`: the documentation of the original game, in the format the
  [documentation standard](https://dinorefurb.com/documentation-standard/)
  sets. It starts with a scope and area list to fill in and empty directories
  for each kind of entry; `docs/SPEC-ENTRY-TEMPLATES.md` has blank entries.
- `PARITY.md` and `DEVIATIONS.md`: how much of the spec the rebuild does, and
  where it departs from it on purpose.
- `docs/*`: the source-edition, tool, and architecture documents, which start
  as instructions for what to record rather than as content.

## Renaming or reconfiguring later

Re-running requires `-Force` and renames from the currently configured name, so
`./tools/Configure-Project.ps1 -ProjectName NewName -Force` renames the projects
and identifiers. Values that were already substituted into prose — display name,
copyright, shortcut name, application data directory — are not placeholders any
more and have to be updated in place. Changing those is easiest on a fresh clone
of the template.
