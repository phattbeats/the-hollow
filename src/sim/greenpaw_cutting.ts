// Greenpaw's cutting (PHAA-751): the cosmetic homestead companion first_cutting
// grows into once planted at the player's claimed homestead plot. Sibling module
// to Homestead (src/sim/homestead.ts), built the same way: a self-contained
// SimContext-seam class owning its own persisted record book, wired through
// Sim with thin delegates and its own world_state JSONB row (like
// greenpaw_hearth.ts / homestead.ts), not folded into either.
//
// Deliberately NOT built on src/sim/pet/pet_ai.ts's combat-pet lifecycle: that
// file's "PRIME DIRECTIVE: this is a MOVE, not a rewrite" header locks every
// function's rng draw order for the parity gate's byte-identical trace, so a
// cosmetic companion sharing that code path would risk interleaving a new draw
// into a locked sequence. This module draws rng exactly ONCE per cutting (the
// cosmetic variant roll in plant()); its per-tick follow movement
// (updateGreenpawCompanion, dispatched from mob/locomotion.ts the same way the
// delve companion is) draws no rng at all.
//
// Growth drifts continuously like GreenpawHearth's hunger/smoke: a persisted
// accumulator incremented by dt every tick, so it survives a server restart
// cleanly (unlike a raw tick-count comparison, which resets on restart). The
// companion entity itself is a session-only projection of a grown record: it
// is spawned once its owner is online and the record is fully grown, and
// despawned on logout, exactly like a hunter's combat pet
// (src/sim/pet/pet_commands.ts restorePet/despawnPersistentPet), so
// persistence only ever needs the record, never a live entity id.
//
// `src/sim`-pure: no DOM/Three/render-ui-game-net imports, no Math.random/
// Date.now (enforced by tests/architecture.test.ts).

import { GREENPAW_COMPANION_MOB_IDS } from './content/hollow';
import { MOBS } from './data';
import { createMob } from './entity';
import { PLOT_RADIUS } from './homestead';
import type { PlayerMeta } from './sim';
import type { SimContext } from './sim_context';
import { dist2d, type Entity, PET_TELEPORT_DISTANCE } from './types';

// ~30 minutes of elapsed sim time before a planted cutting grows into its
// companion form ("something perceptible", per the ticket). Exported so tests
// can assert the exact threshold instead of guessing at "long enough".
export const GROWTH_DURATION = 30 * 60;
// How close the companion holds to its owner while following (mirrors
// pet_ai.ts's PET_FOLLOW_DISTANCE; this module does not import that constant
// since it is private to pet_ai.ts and this module is deliberately independent
// of it).
const COMPANION_FOLLOW_DISTANCE = 3.5;

interface PlantedCuttingState {
  ownerKey: string; // stable account-scoped key, same convention as Homestead
  ownerName: string;
  x: number;
  z: number;
  growth: number; // seconds elapsed since planting, clamped to GROWTH_DURATION
  mobTemplateId: string; // the rolled cosmetic variant, fixed at plant time
  entityId: number | null; // live companion entity id this session, else null
}

// Persistable state (the world_state 'greenpaw_cutting' JSONB blob). entityId
// is session-only bookkeeping and is never persisted.
export interface GreenpawCuttingSave {
  cuttings: {
    ownerKey: string;
    ownerName: string;
    x: number;
    z: number;
    growth: number;
    mobTemplateId: string;
  }[];
}

function isCompanionMobId(templateId: string): boolean {
  return (GREENPAW_COMPANION_MOB_IDS as readonly string[]).includes(templateId);
}

export class GreenpawCutting {
  private cuttings: PlantedCuttingState[] = [];

  constructor(private readonly ctx: SimContext) {}

  // Rename-proof, account-scoped owner identity (same rule as Homestead).
  private ownerKeyFor(meta: PlayerMeta): string {
    return meta.accountKey ?? String(meta.characterId ?? meta.entityId);
  }

  private cuttingFor(key: string): PlantedCuttingState | null {
    return this.cuttings.find((c) => c.ownerKey === key) ?? null;
  }

  private onlinePidFor(key: string): number | null {
    for (const [pid, meta] of this.ctx.players) {
      if (this.ownerKeyFor(meta) === key) return pid;
    }
    return null;
  }

  // Spawn the companion entity for a grown, not-yet-spawned-this-session
  // cutting, if its owner happens to be online right now. A no-op otherwise
  // (still growing, already spawned, or the owner is offline); the owner's
  // next join calls this again via onPlayerJoin.
  private trySpawnFor(c: PlantedCuttingState): void {
    if (c.growth < GROWTH_DURATION || c.entityId !== null) return;
    const ownerPid = this.onlinePidFor(c.ownerKey);
    if (ownerPid === null) return;
    const owner = this.ctx.entities.get(ownerPid);
    if (!owner || owner.dead) return;
    const template = MOBS[c.mobTemplateId];
    if (!template) return;
    const mob = createMob(
      this.ctx.nextId++,
      template,
      1,
      this.ctx.groundPos(owner.pos.x + 1.5, owner.pos.z),
    );
    mob.ownerId = ownerPid;
    mob.hostile = false;
    mob.aiState = 'idle';
    this.ctx.addEntity(mob);
    c.entityId = mob.id;
    this.ctx.emit({
      type: 'log',
      text: 'Your cutting has grown into a companion. It follows you now.',
      color: '#8dc86a',
      pid: ownerPid,
    });
  }

  // Called once per sim tick (DT seconds), like GreenpawHearth.update(). Cheap:
  // only cuttings still short of GROWTH_DURATION do any work, and that set
  // shrinks to nothing once a cutting is grown.
  update(dt: number): void {
    for (const c of this.cuttings) {
      if (c.growth >= GROWTH_DURATION) continue;
      c.growth = Math.min(GROWTH_DURATION, c.growth + dt);
      if (c.growth >= GROWTH_DURATION) this.trySpawnFor(c);
    }
  }

  // The item-use entry point (src/sim/items.ts's useItem 'plant' branch).
  plant(pid?: number): void {
    const r = this.ctx.resolve(pid);
    if (!r) return;
    const { meta, e } = r;
    if (e.dead) return;
    const key = this.ownerKeyFor(meta);
    if (this.cuttingFor(key)) {
      this.ctx.error(meta.entityId, 'You have already planted your cutting. Give it time to grow.');
      return;
    }
    const plot = this.ctx.homesteadOwnedPlotFor(meta);
    if (!plot) {
      this.ctx.error(meta.entityId, 'You need a homestead plot before you can plant this.');
      return;
    }
    if (Math.hypot(e.pos.x - plot.x, e.pos.z - plot.z) > PLOT_RADIUS) {
      this.ctx.error(meta.entityId, 'You must be at your own homestead to plant this.');
      return;
    }
    this.ctx.removeItem('first_cutting', 1, meta.entityId);
    const mobTemplateId = this.ctx.rng.pick([...GREENPAW_COMPANION_MOB_IDS]);
    this.cuttings.push({
      ownerKey: key,
      ownerName: meta.name,
      x: plot.x,
      z: plot.z,
      growth: 0,
      mobTemplateId,
      entityId: null,
    });
    this.ctx.emit({
      type: 'log',
      text: 'You plant the cutting at your homestead. Give it time.',
      color: '#8dc86a',
      pid: meta.entityId,
    });
  }

  // Called from addPlayer (mirrors restorePet): spawns the companion the
  // moment its owner joins, if the record is already grown from an earlier
  // (possibly cross-session) stretch of elapsed time.
  onPlayerJoin(meta: PlayerMeta): void {
    const c = this.cuttingFor(this.ownerKeyFor(meta));
    if (c) this.trySpawnFor(c);
  }

  // Called from removePlayer (mirrors despawnPersistentPet): the companion is
  // a session-only projection, so it never idles in the world after its owner
  // logs off.
  onPlayerLeave(meta: PlayerMeta): void {
    const c = this.cuttingFor(this.ownerKeyFor(meta));
    if (c?.entityId !== null && c?.entityId !== undefined) {
      this.ctx.dropEntity(c.entityId);
      c.entityId = null;
    }
  }

  serialize(): GreenpawCuttingSave {
    return {
      cuttings: this.cuttings.map((c) => ({
        ownerKey: c.ownerKey,
        ownerName: c.ownerName,
        x: c.x,
        z: c.z,
        growth: c.growth,
        mobTemplateId: c.mobTemplateId,
      })),
    };
  }

  load(save: GreenpawCuttingSave | null | undefined): void {
    if (!save) return;
    const seenOwners = new Set<string>();
    for (const c of save.cuttings ?? []) {
      if (!c || typeof c.ownerKey !== 'string' || c.ownerKey === '') continue;
      if (typeof c.x !== 'number' || typeof c.z !== 'number') continue;
      if (typeof c.mobTemplateId !== 'string' || !MOBS[c.mobTemplateId]) continue;
      if (seenOwners.has(c.ownerKey)) continue;
      seenOwners.add(c.ownerKey);
      this.cuttings.push({
        ownerKey: c.ownerKey,
        ownerName: typeof c.ownerName === 'string' ? c.ownerName : '?',
        x: c.x,
        z: c.z,
        growth:
          typeof c.growth === 'number' && Number.isFinite(c.growth)
            ? Math.max(0, Math.min(GROWTH_DURATION, c.growth))
            : 0,
        mobTemplateId: c.mobTemplateId,
        entityId: null,
      });
    }
  }
}

// Mob-AI dispatch predicate (mob/locomotion.ts's updateMob, mirroring
// isDelveCompanionMob): true for a live companion entity, so the dispatcher
// routes it here instead of falling through to the combat pet branch
// (ctx.updatePet, pet_ai.ts).
export function isGreenpawCompanionMob(mob: Entity): boolean {
  return mob.ownerId !== null && isCompanionMobId(mob.templateId);
}

// Per-tick follow movement for a live companion entity, dispatched from
// mob/locomotion.ts like the delve companion. Read petFollow (pet_ai.ts) only
// as a reference for the shape of a heel behavior; this is intentionally a
// much simpler teleport-then-approach (no A* heel routing, no rng), since a
// cosmetic companion never fights and losing it briefly behind an obstacle is
// not gameplay-relevant.
export function updateGreenpawCompanion(ctx: SimContext, companion: Entity): void {
  const owner = companion.ownerId !== null ? ctx.entities.get(companion.ownerId) : null;
  if (owner?.kind !== 'player' || !ctx.players.has(owner.id)) {
    ctx.dropEntity(companion.id);
    return;
  }
  const d = dist2d(companion.pos, owner.pos);
  if (d > PET_TELEPORT_DISTANCE) {
    companion.pos = { ...owner.pos };
    companion.prevPos = { ...companion.pos };
    ctx.rebucket(companion);
    return;
  }
  if (d > COMPANION_FOLLOW_DISTANCE && !ctx.isRooted(companion)) {
    ctx.moveToward(companion, owner.pos, companion.moveSpeed * ctx.moveSpeedMult(companion));
  }
}
