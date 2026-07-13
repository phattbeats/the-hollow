// Collection tracking core (PHAA-625/626): server-authoritative per-character
// record of which collectibles a character has found. Reading a world
// readable (or any future collectible kind) marks its stable id collected,
// EXACTLY ONCE, forever: `meta.collectedIds` only ever grows, and re-reading
// an already-collected id is a silent no-op (no error, no re-fired event), so
// a player can freely re-open a book they already found.
//
// This replaces the old client-only, stateless read (src/world_api/readables.ts
// IWorldReadables is deliberately read-only: placement only). `readCollectible`
// is a real sim command, resolved on the deterministic tick it arrives on
// (same shape as harvestNode, src/sim/gathering.ts), so offline Sim and the
// online server behave identically. No rng draw, so no SimContext callback
// beyond the existing resolve/error/emit is needed.
//
// `src/sim`-pure: no DOM/Three/render/ui/game/net imports (tests/architecture.test.ts).

import { COLLECTIBLES_BY_ID, READABLES_BY_ID, READ_RADIUS } from './data';
import type { SimContext } from './sim_context';

function distTo(pos: { x: number; z: number }, target: { x: number; z: number }): number {
  const dx = pos.x - target.x;
  const dz = pos.z - target.z;
  return Math.sqrt(dx * dx + dz * dz);
}

// Command entry point (behind the SimContext seam): resolves one player's
// attempt to read/collect a collectible. Denies (no side effect, no rng) if
// the requesting player is dead, the collectible id is unknown, or (for a
// 'readable' collectible) they are too far from its world placement. A
// re-read of an already-collected id is accepted but inert: no event, no
// error, matching "reading is always allowed, collection only happens once".
export function readCollectible(ctx: SimContext, id: string, pid?: number): void {
  const r = ctx.resolve(pid);
  if (!r) return;
  const { meta, e: p } = r;
  if (p.dead) {
    ctx.error(meta.entityId, "You can't do that while dead.");
    return;
  }
  const def = COLLECTIBLES_BY_ID[id];
  if (!def) {
    ctx.error(meta.entityId, 'That does not exist.');
    return;
  }
  if (meta.collectedIds.has(id)) return; // already collected: re-reading is free, no re-fire
  if (def.kind === 'readable') {
    const readable = READABLES_BY_ID[id];
    if (!readable) return; // defensive: a CollectibleDef with no backing readable
    if (distTo(p.pos, readable.pos) > READ_RADIUS) {
      ctx.error(meta.entityId, 'Too far away.');
      return;
    }
  }
  meta.collectedIds.add(id);
  ctx.emit({ type: 'collectibleFound', collectibleId: id, pid: meta.entityId });
}
