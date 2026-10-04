// The interpreter that runs scientific-method-engine: EVIDENCE_PYTHON, or else the first of python
// and python3 that starts as Python 3.12 or later (the engine's floor). Many Linux and macOS installs
// provide only python3, some keep an older Python as python, and Windows can put a Store alias on
// the path that starts no Python at all.
// When neither qualifies the answer is python, so the error names the interpreter that was tried.
import { spawnSync } from "node:child_process";

let probed;
export function evidencePython() {
  if (process.env.EVIDENCE_PYTHON) return process.env.EVIDENCE_PYTHON;
  probed ??= ["python", "python3"].find((name) =>
    spawnSync(name, ["-c", "import sys; sys.exit(sys.version_info < (3, 12))"], { stdio: "ignore", timeout: 30000 }).status === 0) ?? "python";
  return probed;
}

// The executable reader reads EVIDENCE_PYTHON, or python, when it starts the engine.
export function withEvidencePython(action) {
  const previous = process.env.EVIDENCE_PYTHON;
  process.env.EVIDENCE_PYTHON = evidencePython();
  try { return action(); }
  finally {
    if (previous === undefined) delete process.env.EVIDENCE_PYTHON;
    else process.env.EVIDENCE_PYTHON = previous;
  }
}
