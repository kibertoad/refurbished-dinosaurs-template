# Windows guest probes with rust-dos

A Windows PE game needs its Windows guest, drivers and dependencies. Successful
synthetic DOS sessions do not validate that setup. rust-dos can boot Windows 95
images and expose its machine through a local debugger API. Use this procedure
when an owner has supplied a suitable Windows/DOSBox image and game media.
It complements the [runtime access record](RUNTIME.md); it does not replace
the pinned protocol's static-first and recorded-run rules.

The tested baseline for this procedure is rust-dos 1.7.2 with
`dinorefurb-dosbox-session` 0.9.0 on Windows. Consult the release's primary
[configuration](https://github.com/dividebysandwich/rust-dos/blob/v1.7.2/CONFIGURATION.md)
and [debugging guide](https://github.com/dividebysandwich/rust-dos/blob/v1.7.2/docs/llm-debugging.md)
when adapting it. Record the versions actually validated by the project.

## Retain and identify an owned setup

1. Inspect the owner's existing DOSBox configuration, Windows disk image and
   media. Record hardware, image geometry, CD framing, installed game path and
   working directory. Preserve those source files.
2. Copy the guest and media into owned ignored storage. Apply the latest official
   patch to the copy. Version preparation/configuration scripts; never commit
   the Windows image, executable, patch archive, media or captured original data.
3. Hash the patch/payload and installed guest executable. Compare file length and
   fingerprint against the analysis build. Inspect the Ghidra project's stored
   original/modified import and file-backed bytes when auditing an existing
   analysis; matching filenames or program metadata alone are insufficient.
   An unpatched runtime image does not imply that the analysis executable was
   unpatched: check both independently and record the result.
4. Retain an immutable patched seed, a separate writable working image and the
   configuration/input-hash manifest. Mount CD media read-only. Raw sector images
   mislabeled `.iso` may need an appropriate CUE, rather than a plain ISO mount.

Reuse the supplied hardware where possible. An S3 Windows 95 installation has
been validated with `machine=svga_s3`, `cpu=pentium` and 64 MiB; that does not
establish compatibility for another image. New hardware may cause guest device
detection/restart prompts. Derive disk geometry from the supplied configuration
or image, rather than copying another game's cylinder/head/sector values.

Example project-specific configuration (replace paths/hardware as required):

```ini
[emulator]
machine=svga_s3
cpu=pentium
memsize=64
cycles=50000
core=normal

[drives]
2=C:/owned-probes/working-windows.img hdd -boot
D=C:/owned-probes/game.cue cdrom -ro -ide 2m
```

Keep the bootstrap host C: directory empty and separate from the guest's
image-backed Windows C:. Stable owned media paths allow a checkpoint to be
restored in another process. A `[drives]` auto-boot configuration can use
`--no-boot` for a checkpoint start while retaining the same mounted media.

## Own the process and every operation

Use an isolated interpreter with the exact session package pin; verify the
portable emulator SHA-256 against `RUST_DOS_PINNED_SHA256` and retain its adjacent
release SDL2.dll. A project setup helper should verify the release archive too.

`RustDosSettings` 0.9.0 reserves `--config` and expects a DOS program/readiness
marker. Do not point that target at a Windows EXE or monkeypatch the installed
package. For booted Windows, reuse these package primitives with a project
runner that supplies its own boot/state gates:

- `RunLock.acquire(resolve_lock_path(), session, current())`: exclusive machine
  lock with repository/session and owner PID/start time. Never remove another
  session's lock or attach to its emulator.
- `launch_owned(...)` and `lock.record(...)`: hidden Windows process/job lifetime
  and recorded child identity. Pass `SDL_VIDEODRIVER=dummy` and
  `SDL_AUDIODRIVER=dummy` to this child for headless, muted probes.
- `RustDosClient` with a unique `RequestIds` namespace: read the ephemeral
  localhost endpoint from that owned child's output, verify the server version/
  features, and journal requests/replies and operation IDs.
- `finally`: export evidence, request `POST /api/control/quit`, wait for exit,
  terminate only this owned child on teardown failure, close its job, then
  release only the lock this runner acquired.

Launch with `--config <owned-config> -d <empty-host-c> --debug-server 127.0.0.1:0`
and `--deterministic --cycles <fixed-value> --core normal`. Retain the command,
environment, server build, start clock and owned process identity.

A continuation is an operation, not an instruction to retry after a timeout:

```python
reply = client.request("POST", "/api/control/resume", body={"until_ms": budget_end_ms})
operation_id = reply.body["op"]
while True:
    observed = client.request("GET", f"/api/ops/{operation_id}", query={"wait": 30000}).body
    if observed["state"] == "pending":
        continue  # Observe the same live operation; never resume it a second time.
    if observed["state"] != "stopped":
        raise RuntimeError(observed)
    stop = observed["stop"]
    break
```

Bound total observation time and stop/clean up on failure. `until_ms` bounds
deterministic execution; the timestamp alone does not establish a desired state.
Assert the actual state or native breakpoint. Use host polling only for owned
process/server readiness, never arbitrary sleeps to decide guest readiness.

## Input, memory and checkpoints

- For keyboard launch, Ctrl+Escape and Run can work where a `win` modifier is
  unsupported. Use the guest shortcut or a launch path that preserves the game
  working directory. Record input delivery, not just queued input requests.
- Windows uses PS/2 motion. Send small relative `dx`/`dy` moves and verify its
  pointer; absolute coordinates target the built-in DOS mouse driver. Test
  movement and buttons separately from keyboard input.
- Use `lin:` for PE virtual addresses and `/api/pagewalk` in the stopped
  context's CR3. Breakpoints bind physical pages; confirm residency first.
  Split reads at page boundaries. Cold/unmapped bytes are not a runtime
  fingerprint mismatch. Compare resident code against the verified file while
  accounting for supported loader relocation/IAT or self-modification effects.
- A memory write requires a paused/quiescent state, `If-State-Seq`, expected
  old bytes and readback. Keep the original requested linear address for the
  write. Every watched/written address needs a supported format/glossary meaning.
- Save only after queued input is delivered. Use `/api/state/save` with
  `strict_match` and `check_files`; retain the state, every boot-disk sidecar and
  a metadata file with full hashes, hardware/media paths, stop and frame.
- For a second-process restore, validate hashes, prepare the owned working disk
  from its saved sidecar, mount the same media without booting, then request
  `/api/state/load` with `strict_match` and `check_files`. Verify saved CS:IP,
  instruction count, emulated time, debugger reset and frame. Some 1.7.2 boot-state
  success replies omit `differences`/`unchecked`; do not rely only on those fields.
  Test a deliberate hardware mismatch and verify unchanged refusal.

## Validate, document and retain

Version the actual probe scripts and starting-state/input/assertion logic under
`tools/`. Validate a real game launch, input devices, supported memory reads,
breakpoint, frame capture, same-process checkpoint restore and second-process
restore separately. Repeat a bounded action from the same checkpoint and compare
its instruction/time/state outcome. A checkpoint is not a patched native save;
frames do not establish sound capture; menu access does not establish gameplay.

Update RUNTIME.md by capability part with commands, retained paths, versions,
outcomes and limits. Where the owner authorized probes and the setup passes,
record that standing scope once; do not ask for renewed permission for each
probe within it. Ownership/locking and evidence requirements continue to apply.
Changed tooling/inputs or additional capabilities need revalidation.

Research probes still need the queue's prior static attempt, a fixed starting
state, supported watched/written fields and gameplay seed/draw recording by rule
ID. Deterministic emulator checkpoints alone do not provide the protocol's
gameplay RNG trace or rebuild parity comparison. Retain unresolved divergences
and current verified checkpoints; clean consumed, regenerable intermediates
under [ANALYSIS-OUTPUTS.md](ANALYSIS-OUTPUTS.md).
