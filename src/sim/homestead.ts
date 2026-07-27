// Homestead v0 (PHAA-417): a second, later open-world housing tier, distinct
// from Housing v0's fixed Sanctum plots (src/sim/housing.ts, the moon-sanctum
// quarter of the hub). Players pick their own spot on the Hollow Reaches
// homestead ground (content/hollow_zone.ts HOLLOW_HOMESTEAD_AREA) instead of
// claiming a fixed slot; a real placement/collision-avoidance pass keeps
// plots close together but never overlapping, clear of the gate, the lake,
// the camps, the graveyard, and the roads, and it is gated behind completing
// the FULL Greenpaw quest arc (a late tutorial/early-game unlock, unlike the
// Sanctum's near-immediate grant after the vase).
//
// World editing around a claimed plot (terrain paint / prop placement /
// radius) is explicitly out of scope for v0 per the ticket: it needs its own
// design pass and is tracked as a follow-up. This module only owns placement
// and ownership.
//
// `src/sim`-pure: no DOM/browser/Three-js imports, no Math.random/Date.now
// (enforced by tests/architecture.test.ts). Homestead draws NO rng:
// placement is validated against the player's own chosen position, never
// generated.
//
// Player-facing /homestead command text is deliberately English here, like
// Housing v0's /house readouts (the same documented backstop pending a
// dedicated localization pass); the sim core stays language-agnostic.

import { HOLLOW_QUEST_ORDER } from './content/hollow';
import {
  HOLLOW_HOMESTEAD_AREA,
  HOLLOW_ZONE_CAMPS,
  HOLLOW_ZONE_ROADS,
  HOLLOW_ZONE_ZONE,
} from './content/hollow_zone';
import type { PlayerMeta } from './sim';
import type { SimContext } from './sim_context';

// Footprint radius per plot ("generous per-plot space"); two plot centers
// must clear this much of each other combined. Exported so a foreign system
// gating an on-plot action (e.g. greenpaw_cutting.ts's planting proximity
// check) uses the same radius family instead of inventing its own.
export const PLOT_RADIUS = 9;
// No overlap (2x radius) plus a small buffer, while staying "close together".
const MIN_SEPARATION = PLOT_RADIUS * 2 + 4;
const HUB_CLEARANCE = HOLLOW_ZONE_ZONE.hub.radius + 18;
const LAKE_CLEARANCE = 12;
const CAMP_CLEARANCE = 14;
const GRAVEYARD_CLEARANCE = 20;
const ROAD_CLEARANCE = 6;

export interface HomesteadPlotState {
  ownerKey: string; // stable account-scoped key (accountKey, else characterId)
  ownerName: string; // display name of the claiming character
  x: number;
  z: number;
}

// Persistable homestead state (the world_state 'homestead' JSONB blob).
export interface HomesteadSave {
  plots: HomesteadPlotState[];
}

// Shortest distance from point (px,pz) to segment (ax,az)-(bx,bz).
function distToSegment(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
): number {
  const dx = bx - ax;
  const dz = bz - az;
  const len2 = dx * dx + dz * dz;
  if (len2 === 0) return Math.hypot(px - ax, pz - az);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / len2));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}

export class Homestead {
  // One ownership record per claimed plot; unclaimed ground has no entry.
  private plots: HomesteadPlotState[] = [];
  // Monotonic change counter: the server polls it to save on change.
  rev = 0;

  constructor(private readonly ctx: SimContext) {}

  // Rename-proof, account-scoped owner identity (same rule as Housing v0).
  private ownerKeyFor(meta: PlayerMeta): string {
    return meta.accountKey ?? String(meta.characterId ?? meta.entityId);
  }

  private plotOwnedBy(key: string): HomesteadPlotState | null {
    return this.plots.find((p) => p.ownerKey === key) ?? null;
  }

  // Public lookup for a foreign system (greenpaw_cutting.ts's plant-at-your-
  // own-plot gate) that needs "does this player own a plot, and where" without
  // duplicating the owner-key resolution above.
  ownedPlotFor(meta: PlayerMeta): HomesteadPlotState | null {
    return this.plotOwnedBy(this.ownerKeyFor(meta));
  }

  // The progression gate: the FULL Greenpaw quest arc, not just the first
  // quest. HOLLOW_QUEST_ORDER is append-only as the arc grows, so this stays
  // correct without a hardcoded quest id.
  private hasFullGreenpawArc(meta: PlayerMeta): boolean {
    return HOLLOW_QUEST_ORDER.every((qid) => meta.questsDone.has(qid));
  }

  // The real placement/collision-avoidance pass: null when the point is a
  // valid claim, else a player-facing reason it isn't.
  private placementIssue(x: number, z: number): string | null {
    const area = HOLLOW_HOMESTEAD_AREA;
    if (x < area.xMin || x > area.xMax || z < area.zMin || z > area.zMax) {
      return 'That is outside the homestead ground. Try Fallow Acres, west of the road.';
    }
    const hub = HOLLOW_ZONE_ZONE.hub;
    if (Math.hypot(x - hub.x, z - hub.z) < HUB_CLEARANCE) {
      return 'Too close to the gate. Move further out.';
    }
    for (const lake of HOLLOW_ZONE_ZONE.lakes) {
      if (Math.hypot(x - lake.x, z - lake.z) < lake.radius + LAKE_CLEARANCE) {
        return 'Too close to the water.';
      }
    }
    const graveyard = HOLLOW_ZONE_ZONE.graveyard;
    if (Math.hypot(x - graveyard.x, z - graveyard.z) < GRAVEYARD_CLEARANCE) {
      return 'Too close to the graveyard.';
    }
    for (const camp of HOLLOW_ZONE_CAMPS) {
      if (Math.hypot(x - camp.center.x, z - camp.center.z) < camp.radius + CAMP_CLEARANCE) {
        return 'Too close to the wildlife. Clear the area or move further off.';
      }
    }
    for (const road of HOLLOW_ZONE_ROADS) {
      for (let i = 0; i < road.length - 1; i++) {
        const a = road[i];
        const b = road[i + 1];
        if (distToSegment(x, z, a.x, a.z, b.x, b.z) < ROAD_CLEARANCE) {
          return 'Too close to the road.';
        }
      }
    }
    for (const p of this.plots) {
      if (Math.hypot(x - p.x, z - p.z) < MIN_SEPARATION) {
        return 'Too close to another homestead.';
      }
    }
    return null;
  }

  homesteadClaim(pid?: number): void {
    const r = this.ctx.resolve(pid);
    if (!r) return;
    const { meta, e } = r;
    if (e.dead) return;
    if (!this.hasFullGreenpawArc(meta)) {
      this.ctx.error(
        meta.entityId,
        "Brother Greenpaw hasn't sent you off yet. Finish his errands first.",
      );
      return;
    }
    const key = this.ownerKeyFor(meta);
    if (this.plotOwnedBy(key)) {
      this.ctx.error(meta.entityId, 'You already own a homestead.');
      return;
    }
    const issue = this.placementIssue(e.pos.x, e.pos.z);
    if (issue) {
      this.ctx.error(meta.entityId, issue);
      return;
    }
    this.plots.push({ ownerKey: key, ownerName: meta.name, x: e.pos.x, z: e.pos.z });
    this.rev++;
    this.ctx.emit({
      type: 'log',
      text: 'The ground is yours. This homestead is claimed.',
      color: '#8f8',
      pid: meta.entityId,
    });
  }

  // "/homestead [claim]" chat routing (called from social/chat.ts). Returns
  // true when the message was a /homestead command (handled, even if it
  // errored).
  handleChat(raw: string, pid: number): boolean {
    const m = /^\/homestead(?:\s+(\S+))?\s*$/i.exec(raw);
    if (!m) return false;
    const sub = (m[1] ?? '').toLowerCase();
    if (sub === 'claim') {
      this.homesteadClaim(pid);
      return true;
    }
    // "/homestead" (or anything else): a self-only readout.
    const meta = this.ctx.players.get(pid);
    if (!meta) return true;
    const plot = this.plotOwnedBy(this.ownerKeyFor(meta));
    if (plot) {
      this.ctx.error(pid, `Your homestead sits at (${Math.round(plot.x)}, ${Math.round(plot.z)}).`);
    } else if (!this.hasFullGreenpawArc(meta)) {
      this.ctx.error(
        pid,
        "You own no homestead. Finish Brother Greenpaw's full errand chain to unlock one.",
      );
    } else {
      this.ctx.error(
        pid,
        'You own no homestead. Stand somewhere viable in the Hollow Reaches and type /homestead claim.',
      );
    }
    return true;
  }

  homesteadInfoFor(pid: number): import('../world_api/homestead').HomesteadInfo {
    const meta = this.ctx.players.get(pid);
    const key = meta ? this.ownerKeyFor(meta) : null;
    return {
      plots: this.plots.map((p) => ({
        x: p.x,
        z: p.z,
        ownerName: p.ownerName,
        mine: key !== null && p.ownerKey === key,
      })),
    };
  }

  serializeHomestead(): HomesteadSave {
    return { plots: this.plots.map((p) => ({ ...p })) };
  }

  loadHomestead(save: HomesteadSave | null | undefined): void {
    if (!save) return;
    const seenOwners = new Set<string>();
    for (const p of save.plots ?? []) {
      if (!p || typeof p.ownerKey !== 'string' || p.ownerKey === '') continue;
      if (typeof p.x !== 'number' || typeof p.z !== 'number') continue;
      if (seenOwners.has(p.ownerKey)) continue;
      seenOwners.add(p.ownerKey);
      this.plots.push({
        ownerKey: p.ownerKey,
        ownerName: typeof p.ownerName === 'string' ? p.ownerName : '?',
        x: p.x,
        z: p.z,
      });
    }
  }
}
