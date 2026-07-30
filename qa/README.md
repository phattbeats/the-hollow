# qa/

QA harnesses and spike evidence for The Hollow that are not part of a feature's
own `tests/` pairing.

- `spikes/` - deterministic investigation harnesses driving `src/sim` directly to
  measure feel/behavior, plus the findings write-ups they back. Spike harnesses are
  kept collected by Vitest (they double as characterization guards on the constants
  they measure) and stay fast + deterministic. Each is documented at the top of its
  file and referenced from its findings `.md`.

Browser/E2E and screenshot scripts still live in `scripts/*.mjs` (need `npm run dev`
/ `npm run server`); unit-style Vitest still lives in `tests/`. This directory is for
QA-owned investigation artifacts.

## Live-world sim spikes (driving `sim.tick()` directly)

A "live smoke" that must exercise a mechanic through the real per-tick loop (not a
mocked slice) can build a `Sim` and call `sim.tick()` in a loop. Exemplar:
`spikes/greenpaw_cutting_live_smoke.spike.test.ts` (PHAA-772), which spawns the
Greenpaw companion in a running world and proves it can never be tab-/click-/AoE-
targeted or emit stray combat text.

**Gotcha (paid for on PHAA-772): `sim.tick()` RETURNS the drained event array and
clears the buffer.** So `sim.tick(); sim.drainEvents()` yields an EMPTY array (the
tick already consumed it), which silently makes any `events.some(...) === false`
assertion pass vacuously. Collect events from the tick's return value instead:
`events.push(...sim.tick())`. Also note `damage`/FCT events flow through this same
per-tick channel, not a separate personal queue, so this is the only way to read
them. The unkillable-companion HP staying at exactly `999999` is the independent
ground-truth check that no damage was ever applied.
