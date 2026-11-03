// Minimal metadata required by the production checker; no live spec entries.
import { mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
export function populateCheckerFixture(dir, root) {
  for (const path of ["spec/glossary", "parity", "deviations"])
    mkdirSync(resolve(dir, path), { recursive: true });
  writeFileSync(resolve(dir, "spec/README.md"), "# Synthetic spec\n\n## Scope\nOption forwarding only.\n\n## Standard version\nThis spec follows version 1 of the documentation standard.\n\n## Areas\n| Area | Covers |\n|---|---|\n| TEST | Synthetic controls. |\n");
  copyFileSync(resolve(root, "spec/LICENSE"), resolve(dir, "spec/LICENSE"));
}
