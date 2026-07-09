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
