# FORK-NOTES

The fork-discipline log mandated by the constitution (`docs/plan-the-hollow.md`, §6).
Every modification to this fork gets a dated entry below. Upstream is a
**one-time donor**: no tracking, no routine merges, ever. A specific upstream
fix may be cherry-picked by hand, with an entry here.

## Sync point

- **Upstream:** `levy-street/world-of-claudecraft`
- **Pinned commit:** `b00fb6a5d6d0e1ffab9327ddcbfeb730267ab05e` (upstream tag `v0.17.0`, 2,703 commits)
- **Local tag:** `upstream-sync-2026-06-30`
- **Inherited test suite verified green, unmodified** (2026-07-01): 569 test
  files, 5,997 tests passed, 0 real failures. Eight tests hit the 5-second
  default timeout on slow container hardware and all pass unmodified with
  `--testTimeout` raised; they are environment flakes, not failures.

## Staged content (applied at fork time, per the §6 mandate; not a gameplay modification)

- `src/sim/content/hollow.ts` — the Hollow zone module from the packet
  (Greenpaw, the first-run quests, the Under-Shrine skeleton). **Not yet
  registered** in `sim/data.ts`; registration is Phase 1 work.
- `docs/plan-the-hollow.md` — the constitution (v3.1), the game's governing document.
- `docs/sim/hollow-build-sim-v2.py`, `docs/sim/hollow-build-sim-v2-results.txt`
  — the §8 build-depth simulation and its corrected first results.

## Modifications
