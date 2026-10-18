# Offscreen capture fixture prerequisite (2026-10-19)

The original direct-capture acceptance reproducibly fails `Blank result accepted`
on this desktop, both alone and in the broad gate. This is an additional case of
[issue 73](https://github.com/kibertoad/refurbished-dinosaurs-template/issues/73).
It repaints one entirely offscreen form while requesting the compositor-backed
full-content flag. That does not establish that the new uniform surface reached
the captured cache. No original-game window is involved.

The consumer's existing correction runs the synthetic form on its own STA
message loop, uses an undecorated 320x160 client, and synchronously changes its
uniform state on the owner thread. The direct GDI control explicitly requests
the client-print flag. Production calls retain the full-content default; the
separate worker test still covers that path. This isolates the fixture's
blank/invalid rejection controls from offscreen compositor caching.

Both focused capture controls pass with zero skips. Patterned source pixels,
uniform rejection, invalid-handle rejection and absent rejected outputs remain
asserted once, with no retries, desktop-copy fallback or relaxed deadlines.
This does not settle all readiness/diagnostic work in issue 73 or prove arbitrary
original-game capture freshness.
