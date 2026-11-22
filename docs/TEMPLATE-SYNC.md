# Taking later template changes

A project made from this template keeps getting the template's later changes:
new rules in `AGENTS.md` and the skills, tooling, guides, and refreshed copies
of the rules in `docs/upstream/`. `tools/template.mjs` merges them into a
configured project. This page says when to use it, how it works, and how to
resolve what it cannot merge.

## The recorded revision

`template` in `tools/project-config.json` names the template repository and
the full commit the project was made from or last synced to:

```json
"template": {
  "repository": "kibertoad/refurbished-dinosaurs-template",
  "revision": "<full 40-character commit>"
}
```

Configuration fills it in when the project is created:

- In an unconfigured clone of the template (a remote of the checkout names the
  template repository), `Configure-Project.ps1` records the checkout's `HEAD`.
- Otherwise, such as a repository made with GitHub's "Use this template" or
  one that imported the template's files in a commit, pass the commit:
  `./tools/Bootstrap-Project.ps1 -TemplateRevision <full commit>`, or fill in
  `template.revision` before bootstrap.

`Configure-Project.ps1 -Force` keeps the recorded value, and a sync writes the
new one. `Verify-Configuration.ps1` warns about a configured project with no
revision and fails one whose revision is not a full commit. A project made
before the field existed finds its starting commit where it recorded the
import (a commit message such as "Import refurbished-dinosaurs-template at
1d24d30" gives the short form; `git ls-remote` or the template's history gives
the full one), and passes it once with `--from`.

## When to sync

Only when the owner asks for it in the current task, as with refreshing the
rules copy (`docs/UPSTREAM-RULES.md`). Agents do not check for template
changes during routine work, and a sync is never a side effect of another
task.

## Commands

Both need Git, Node.js 22 or newer, PowerShell 7 (`pwsh`) and network access
to the template repository.

```sh
node tools/template.mjs check
node tools/template.mjs sync --to <full commit>
node tools/template.mjs sync --to <full commit> --from <full commit>
```

`check` prints the recorded revision and the template's current main commit,
with a link to the changes between them. It exits 0 when they match, 2 when
the template has moved on and 1 on failure, and changes nothing.

`sync` takes the template's changes from the recorded revision to `--to`.
`--from` gives the starting commit for a project with no recorded revision;
the command refuses it when a revision is recorded. `--repository` takes
another repository (`owner/name`, a URL or a local path) in place of the
recorded one, and the sync records it. Pick `--to` from `check` or the
template's history, and read the entries the range adds to the template's
`docs/TEMPLATE-CHANGELOG.md`: they say what each change asks of a project.

Sync refuses a working tree with changes, so its own changes can be reviewed
and undone apart from anything else. It then:

1. fetches the template at both revisions into a scratch directory;
2. configures a copy of each revision with the project's own
   `tools/project-config.json`, using that revision's `Configure-Project.ps1`;
3. for every file that differs between the two configured copies, takes the
   new copy where the project's file still matches the old one, and otherwise
   runs a three-way `git merge-file` (project, old copy, new copy), which
   leaves conflict markers labelled `project` and `template <commit>`;
4. runs `./tools/Configure-Project.ps1 -Force` in the project, which reapplies
   its values and platform-guide blocks and writes `tools/project-config.json`
   in the new revision's form;
5. records `--to` as `template.revision`;
6. runs `node tools/upstream.mjs links --write`.

It commits nothing. It prints the files it updated, the files where it merged
the template's change into the project's own edits, the conflicts, and any
step that failed. It exits 0 when nothing conflicted, 2 when something needs a
decision, and 1 on failure.

### Why it compares configured copies

Configuration rewrites the template's files: `{{TOKEN}}`s become the
project's values, `Restoration.*` paths and identifiers take the project
name, and the platform-guide blocks link one platform's guide. The template's
own diff is written against the unconfigured text, so applied to a project it
would conflict on every line configuration touched, and would name paths the
project no longer has. Configuring both revisions with the project's values
gives a diff in the project's own terms: a file the project never edited
merges with no conflict, and a conflict means the project and the template
changed the same lines. Each revision is configured by its own
`Configure-Project.ps1`, so a change to configuration itself (such as a new
platform block) shows up as the difference it makes to the files.

## Resolving conflicts

Most conflicts come from documents the template ships as instructions for
what to record, which the project has since filled in with its record:
`docs/RUNTIME.md`, `docs/GHIDRA.md`, `docs/SOURCE-EDITIONS.md`,
`docs/IMPLEMENTATION-PLAN.md`, `docs/BOOTSTRAP-CHECKLIST.md` and the
customized `AGENTS.md`. For these:

- Keep the project's record. Drop the template's instruction text where the
  record already answers it.
- Adopt only what is new: a requirement the record does not meet yet, a line
  the record now has to carry, or a rule the template added. Write it in the
  record's own terms, and leave a requirement the project cannot meet yet as an
  open item where the record keeps them.
- The changelog entries for the range say which changes are requirements.

The list of files merged into the project's edits needs the same reading even
though they merged cleanly: a merge can put a template sentence next to the
project's answer to it. A file the project deleted (such as
`docs/TEMPLATE-CHANGELOG.md`, which a project may delete) stays deleted. A file the template deleted that the project changed
stays, and the project decides whether it still needs it.

When the conflicts are resolved, run any step sync reported as failed (a
conflict in `tools/Configure-Project.ps1` stops step 4), then
`./tools/Verify-Configuration.ps1` and the validation gate. Commit the sync on
its own, naming both template revisions in the message.

## Limits

- A file the template renamed arrives as a delete and an add. Edits the
  project made at the old path are not moved: the old file is listed as kept.
- A binary file both sides changed keeps the project's version and is listed
  as a conflict.
- Only file contents are merged. A file mode change is not carried.
- A file the project moved or renamed itself is treated as deleted, so the
  template's changes to it are listed and not applied.
- A placeholder the new revision adds and the project's configuration has no
  value for stays in place, and `Verify-Configuration.ps1` reports it.
