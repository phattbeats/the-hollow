# PHAA-559: Jump traversal feel under the 20 Hz server-authoritative sim (willow paths)

Spike verdict: **GO-WITH-CONSTRAINTS** (see caveat on landable surfaces below).

## Method
- Read the movement/jump physics (`src/sim/sim.ts` `updatePlayerMovement`, constants at top),
  the netcode mirror (`src/net/online.ts` + `src/net/CLAUDE.md`), collision
  (`src/sim/colliders.ts`), and terrain (`src/sim/world.ts`).
- Built a deterministic measurement harness (`qa/spikes/jump_arc_spike.test.ts`) that drives
  the `Sim` directly and dumps the arc tick-by-tick. Green and re-runnable.

## The jump physics (measured, seed 42, flat ground)
- Constants: `GRAVITY = 16` yd/s squared, `JUMP_VELOCITY = 6` yd/s, `DT = 1/20` (20 Hz).
- **Effective (visible) apex: 0.98 yd.** Textbook `v^2/2g` = 1.125 yd, but the sim integrates
  with discrete symplectic (semi-implicit) Euler at 20 Hz, which peaks ~13% lower at the
  tick-sampled apex. The renderer interpolates linearly between tick samples, so 0.98 yd is
  what the player actually sees.
- **Air time: 14 ticks = 0.70 s.** Per-tick height samples:
  `0.26 0.48 0.66 0.80 0.90 0.96 0.98 0.96 0.90 0.80 0.66 0.48 0.26 0` - a clean symmetric
  parabola, 14 samples, ~42 rendered frames at 60 fps. Readable and smooth.
- **Running-jump horizontal reach: 5.25 yd** (RUN_SPEED 7 yd/s x 0.75 s).
- **No air control:** horizontal velocity is locked at launch (airborne movement uses
  `p.vx`/`p.vz` set at takeoff; the ground-move branch requires `onGround`). The arc is fully
  ballistic and deterministic: two identical input streams produce byte-identical trajectories.

## Q1: Jump arc feel at DT=1/20
Readable and controllable. 14 in-air ticks interpolated to ~42 render frames is smooth; the
arc is a clean parabola. No client-side smoothing of the arc **shape** is needed. The latency
is not in the arc, it is in the input-to-photon path (Q2).

## Q2: Server reconciliation on narrow platforms
Key finding, and it inverts the framing of the question. **The client does not predict its own
movement.** Per `src/net/CLAUDE.md` ("Never ... 'predict' an outcome") and `applySnapshot`, the
local player's position comes from the server snapshot (`snap.self`), interpolated on the global
snapshot clock. The client streams movement **intent** at 20 Hz (`sendInput`, 50 ms) and renders
wherever the server says it is.

Consequence: there is **nothing to reconcile mid-arc** - the client never predicts, so the
server never has to correct it, and the classic "rubber-band on a missed reconciliation" failure
mode does not exist here. The cost is pure **display latency** on your own avatar:
- input batching (up to 50 ms) + RTT + interpolation buffer (~50 ms).
- LAN/local: ~100-150 ms. Real internet (60-80 ms RTT): ~160-230 ms input-to-photon.

Failure mode on a narrow platform: because you send intent (not position), releasing "forward"
at the displayed platform edge reaches the server ~RTT/2 later, after it has already run you
forward a few extra ticks. Overshoot is roughly `(RTT/2 + interp) x RUN_SPEED`, up to ~1.4 yd at
200 ms. On a knife-edge platform you can walk off before your stop registers. There is no
rubber-band; you simply land a bit further than you aimed. The server echoes the input ack seq
in snapshots (`inputEchoSamples`), so real input latency is measurable in-client.

## Q3: Fall-off handling
Penalty-free retry is natively supported. Fall damage triggers only when free-fall drop exceeds
`FALL_SAFE_DISTANCE = 12` yd; splashing into deep water zeroes the fall entirely (velocity reset,
no damage). Willow-path drops under 12 yd, or over water, cost zero HP by design. A
"reset-to-entrance on fall" is level/quest-script work, not netcode.

## The caveat the brief does not mention: no landable elevated surfaces
Willow paths imply hopping between branches/platforms **above** the ground. The sim does not
support that today:
- Colliders push out in XZ only. `cameraTopY` is explicitly "used by camera occlusion; movement
  ignores it." You cannot stand on a building, rock, tree, or any prop top.
- Vertical landing snaps only to `groundHeight(x,z)` = procedural terrain (or the flat dungeon
  floor). A player jumping onto a prop/branch passes through it and lands on the terrain below.

Two substrate forms, very different scope:
- **Terrain-sculpted willow paths (buildable now, zero sim change):** narrow raised terrain
  fingers/spurs with low ground or water in the gaps. Landing is against `terrainHeight`, so
  raised terrain platforms are landable today; the gaps are penalty-free falls.
- **Floating-branch platforms (needs new sim/harness work):** actual branches you land on top
  of. Requires a standable-surface height query (prop/platform tops feeding the vertical landing
  check) plus `IWorld`/collider parity, guarded by the parity gate. Bigger than this spike; its
  own ticket, gated on the design choosing this form.

## Verdict: GO-WITH-CONSTRAINTS
The netcode feel is fine for a no-timer, no-penalty, aim-then-commit hopping puzzle. Constraints:

1. **Absorb latency in geometry; do not add client prediction.** Own-avatar prediction would
   violate the server-authority invariant and the net "never predict" rule, and would
   reintroduce the rubber-band failure mode on landing. Instead size platforms/gaps with
   headroom: landing pads >= ~2-3 yd deep along the travel direction (absorbs ~1.4 yd worst-case
   overshoot; no knife-edges); gaps <= ~3.5-4 yd (running reach is 5.25 yd, leave margin for
   early/late launch).
2. **Design as aim-then-commit hops.** No mid-air course correction exists. This is a feature:
   fully deterministic, nothing to reconcile.
3. **Keep it vertical-shallow.** Effective jump height is 0.98 yd. Step-ups/obstacles must be
   <= ~0.9 yd. Willow paths should be primarily horizontal branch-to-branch hops.
4. **Keep falls penalty-free.** Drops < 12 yd or over deep water; add a reset-to-start on fall
   (level design).
5. **Substrate choice decides scope.** Terrain-sculpted paths ship now with zero sim change;
   floating-branch platforms need the standable-surface system first (separate ticket).

**NO-GO** only if willow paths require twitch timing, mid-air adjustment, pixel-precise
knife-edge landings, or a death/time penalty. None of those are in the Shade brief.

## Reproduce
```
NODE_ENV= npx vitest run qa/spikes/jump_arc_spike.test.ts --reporter=verbose
```
