// Tooling test for tools/template.mjs over a small synthetic fixture: a fake template repository with
// two commits, and a project configured from the first one that has edits of its own.
import test from "node:test";
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { checkTemplate, main, syncTemplate } from "../../tools/template.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const agents = readFileSync(resolve(root, "AGENTS.md"), "utf8").replaceAll("\r\n", "\n");
const block = agents.slice(agents.indexOf("<!-- platform-guide:begin"), agents.indexOf("<!-- platform-guide:end -->") + "<!-- platform-guide:end -->".length);
const read = (dir, path) => readFileSync(join(dir, path), "utf8").replaceAll("\r\n", "\n");
function git(dir, ...args) {
  const result = spawnSync("git", ["-c", `safe.directory=${dir.replaceAll("\\", "/")}`, ...args], { cwd: dir, encoding: "utf8" });
  assert.equal(result.status, 0, `git ${args.join(" ")}: ${result.stderr}`);
  return result.stdout.trim();
}
const commit = (dir, message) => git(dir, "-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false",
  "commit", "-q", "--no-verify", "-m", message);
function write(dir, files) {
  for (const [path, text] of Object.entries(files)) {
    if (text === null) { rmSync(join(dir, path)); continue; }
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
}
function configure(dir, ...args) {
  const result = spawnSync(process.env.PWSH || "pwsh", ["-NoProfile", "-File", join(dir, "tools/Configure-Project.ps1"), ...args],
    { cwd: dir, encoding: "utf8" });
  assert.equal(result.status, 0, result.error?.message ?? result.stdout + result.stderr);
}

// The template's path ends in fixture/template, the repository its configuration names, so a clone
// of it is recognized as a template checkout.
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), "template-sync-test-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const template = join(dir, "fixture", "template").replaceAll("\\", "/");
  mkdirSync(join(template, "tools"), { recursive: true });
  for (const name of ["Configure-Project.ps1", "Platform-Guides.psm1"]) cpSync(resolve(root, "tools", name), join(template, "tools", name));
  write(template, {
    "tools/project-config.json": JSON.stringify({ configured: false, projectName: "", displayName: "", platform: "",
      template: { repository: "fixture/template", revision: "" }, original: {} }, null, 2) + "\n",
    // Stands in for the rules tooling: shows that sync runs `links --write` in the project.
    "tools/upstream.mjs": 'import { writeFileSync } from "node:fs";\nif (process.argv.slice(2).join(" ") === "links --write") writeFileSync("links-written", "");\n',
    "AGENTS.md": `# Agents\n\nRead this first.\n\n${block}\n\nThe end.\n`,
    "src/Restoration.Core/Rules.cs": "namespace Restoration.Core;\n// Rules of {{DISPLAY_NAME}}.\n",
    "docs/GUIDE.md": "# Guide\n\nalpha\n\nbeta\n\ngamma\n",
    "docs/RECORD.md": "# Tool record\n\nRecord the Ghidra version here.\n",
    "docs/OLD.md": "old\n",
  });
  git(template, "init", "-q", "-b", "main");
  git(template, "add", ".");
  commit(template, "first");
  const first = git(template, "rev-parse", "HEAD");
  write(template, {
    "AGENTS.md": `# Agents\n\nRead this first, then the guide.\n\n${block}\n\nThe end.\n`,
    "src/Restoration.Core/Rules.cs": "namespace Restoration.Core;\n// Rules of {{DISPLAY_NAME}}.\n// A rule added later.\n",
    "docs/GUIDE.md": "# Guide\n\nalpha, revised by the template\n\nbeta\n\ngamma\n",
    "docs/RECORD.md": "# Tool record\n\nRecord the Ghidra version and the JDK here.\n",
    "docs/NEW.md": "# New page for {{DISPLAY_NAME}}\n",
    "docs/OLD.md": null,
  });
  git(template, "add", "-A");
  commit(template, "second");
  const second = git(template, "rev-parse", "HEAD");

  // The project: a clone of the first commit, configured, then edited by the project.
  const project = join(dir, "project");
  spawnSync("git", ["clone", "-q", template, project], { encoding: "utf8" });
  git(project, "checkout", "-q", first);
  const config = JSON.parse(readFileSync(join(project, "tools/project-config.json"), "utf8"));
  write(project, { "tools/project-config.json": JSON.stringify({ ...config, projectName: "Sample", displayName: "Sample Game", platform: "win32",
    appId: "{00000000-0000-0000-0000-000000000001}", copyrightYear: 2026 }, null, 2) + "\n" });
  configure(project);
  write(project, {
    "docs/GUIDE.md": "# Guide\n\nalpha\n\nbeta\n\ngamma, as this project found it\n",
    "docs/RECORD.md": "# Tool record\n\nGhidra 12.2.\n",
  });
  git(project, "add", "-A");
  commit(project, "configure and record");
  return { template, project, first, second };
}

test("configuring a clone of the template records its commit", t => {
  const { project, first } = fixture(t);
  const config = JSON.parse(read(project, "tools/project-config.json"));
  assert.deepEqual(config.template, { repository: "fixture/template", revision: first });
  assert.ok(existsSync(join(project, "src/Sample.Core/Rules.cs")));
});

test("sync takes the template's changes, keeps the project's edits and reports conflicts", t => {
  const { template, project, first, second } = fixture(t);
  assert.deepEqual(checkTemplate(project, { repository: template }), { repository: template, recorded: first, latest: second, behind: true });

  const result = syncTemplate(project, { to: second, repository: template });
  // Files Configure rewrote take the change without a conflict: the merge compares configured copies.
  assert.equal(read(project, "src/Sample.Core/Rules.cs"), "namespace Sample.Core;\n// Rules of Sample Game.\n// A rule added later.\n");
  assert.equal(read(project, "docs/NEW.md"), "# New page for Sample Game\n");
  assert.equal(existsSync(join(project, "docs/OLD.md")), false);
  const agentsText = read(project, "AGENTS.md");
  assert.match(agentsText, /^# Agents\n\nRead this first, then the guide\./);
  assert.ok(agentsText.includes("](docs/WIN32-RUNTIME-AND-LIFT.md)"));
  assert.ok(!agentsText.includes("DOS-REAL-MODE-RUNTIME-AND-LIFT.md"));
  // A template change next to a project edit merges, and the file is listed for review.
  assert.equal(read(project, "docs/GUIDE.md"), "# Guide\n\nalpha, revised by the template\n\nbeta\n\ngamma, as this project found it\n");
  assert.deepEqual(result.merged, ["docs/GUIDE.md"]);
  // The template's instructions changed where the project wrote its record: a conflict.
  assert.deepEqual(result.conflicts, ["docs/RECORD.md"]);
  assert.match(read(project, "docs/RECORD.md"), /<<<<<<< project\nGhidra 12\.2\.\n=======\nRecord the Ghidra version and the JDK here\.\n>>>>>>> template [0-9a-f]{7}\n/);
  assert.deepEqual(result.followUps, []);
  assert.ok(existsSync(join(project, "links-written")));
  const config = JSON.parse(read(project, "tools/project-config.json"));
  assert.deepEqual(config.template, { repository: template, revision: second });
  assert.equal(config.appId, "{00000000-0000-0000-0000-000000000001}");
  // Nothing is committed.
  assert.equal(git(project, "rev-list", "--count", "HEAD"), "2");
  assert.equal(main(["check", "--repository", template], project), 0);
});

test("sync refuses a dirty tree and an unknown starting revision", t => {
  const { template, project, first, second } = fixture(t);
  assert.throws(() => syncTemplate(project, { to: "abc", repository: template }), /full 40-character/);
  assert.throws(() => syncTemplate(project, { to: second, from: second, repository: template }), /pass --from only when no revision is recorded/);
  write(project, { "docs/GUIDE.md": "uncommitted\n" });
  assert.throws(() => syncTemplate(project, { to: second, repository: template }), /working tree has changes/);
  git(project, "checkout", "--", "docs/GUIDE.md");

  const configPath = join(project, "tools/project-config.json");
  const config = JSON.parse(read(project, "tools/project-config.json"));
  write(project, { "tools/project-config.json": JSON.stringify({ ...config, template: undefined }, null, 2) + "\n" });
  git(project, "add", "-A");
  commit(project, "a project made before the revision was recorded");
  assert.throws(() => syncTemplate(project, { to: second, repository: template }), /records no template\.revision; pass --from/);
  assert.throws(() => checkTemplate(project, { repository: template }), /records no template\.revision/);
  // The command line reports the conflict with exit code 2.
  assert.equal(main(["sync", "--to", second, "--from", first, "--repository", template], project), 2);
  assert.match(read(project, "docs/RECORD.md"), /^<<<<<<< project$/m);
  assert.equal(JSON.parse(readFileSync(configPath, "utf8")).template.revision, second);
});
