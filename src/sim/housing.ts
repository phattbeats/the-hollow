// Housing v0: account-owned homestead plots inside the portal-instanced
// Hollow hub. Built on the market.ts pattern (a self-contained system module
// behind SimContext that owns its state and exposes serialize/load for the
// server's world_state persistence). The plot book is GLOBAL (one ownership
// record per plot, shared by every hub instance slot); the per-viewer read
// (housingInfoFor) adds the viewer's current hub-instance origin so the
// renderer can map hub-local plot coordinates into world space.
//
// `src/sim`-pure: no DOM/Three/render-ui-game-net imports, no Math.random /
// Date.now (enforced by tests/architecture.test.ts). Housing draws NO rng.
//
// Player-facing /house command text is deliberately English here, like the
// v0.7 slash-command readouts (a documented backstop pending a dedicated
// localization pass); the sim core stays language-agnostic.

import {
  HOLLOW_HOUSE_OBJECT_KINDS,
  HOLLOW_HOUSE_PLOTS,
  HOLLOW_HOUSE_SLOT_OFFSETS,
} from './content/hollow';
import { DUNGEONS } from './data';
import type { PlayerMeta } from './sim';
import type { SimContext } from './sim_context';
import type { Entity } from './types';

const HUB_DUNGEON_ID = 'the_hollow';
// You must stand this close to a plot centre to claim it.
const CLAIM_RADIUS = 8;
export const HOUSE_SLOT_COUNT = HOLLOW_HOUSE_SLOT_OFFSETS.length;

export interface HousePlotState {
  plotId: string;
  ownerKey: string; // stable account-scoped key (accountKey, else characterId)
  ownerName: string; // display name of the claiming character
  objects: { slot: number; kind: string }[];
}

// Persistable housing state (the world_state 'housing' JSONB blob).
export interface HousingSave {
  plots: HousePlotState[];
}

export class Housing {
  // plotId -> ownership record; unclaimed plots have no entry.
  private plots = new Map<string, HousePlotState>();
  // Monotonic change counter: the server polls it to save on change.
  rev = 0;

  constructor(private readonly ctx: SimContext) {}

  // Rename-proof, account-scoped owner identity. The server passes the account
  // id through PlayerMeta.accountKey; offline/sim-only hosts fall back to the
  // character id (offline worlds are single-account and unpersisted anyway).
  private ownerKeyFor(meta: PlayerMeta): string {
    return meta.accountKey ?? String(meta.characterId ?? meta.entityId);
  }

  private plotOwnedBy(key: string): HousePlotState | null {
    for (const p of this.plots.values()) if (p.ownerKey === key) return p;
    return null;
  }

  // The world-space origin of the hub instance the entity is standing in, or
  // null when it is not inside any active the_hollow instance.
  private hubOriginFor(e: Entity): { x: number; z: number } | null {
    if (!DUNGEONS[HUB_DUNGEON_ID]) return null;
    for (const inst of this.ctx.instances) {
      if (inst.dungeonId !== HUB_DUNGEON_ID || inst.partyKey === null) continue;
      const origin = this.ctx.instanceOriginOf(inst);
      if (Math.abs(e.pos.x - origin.x) < 120 && Math.abs(e.pos.z - origin.z) < 250) return origin;
    }
    return null;
  }

  housingClaim(pid?: number): void {
    const r = this.ctx.resolve(pid);
    if (!r) return;
    const { meta, e } = r;
    if (e.dead) return;
    const origin = this.hubOriginFor(e);
    if (!origin) {
      this.ctx.error(meta.entityId, 'You must stand on a homestead plot in the Hollow to claim.');
      return;
    }
    const key = this.ownerKeyFor(meta);
    const owned = this.plotOwnedBy(key);
    if (owned) {
      this.ctx.error(meta.entityId, 'You already own a homestead in the Hollow.');
      return;
    }
    // Nearest plot to where the player stands, in hub-local space.
    const lx = e.pos.x - origin.x;
    const lz = e.pos.z - origin.z;
    let best: (typeof HOLLOW_HOUSE_PLOTS)[number] | null = null;
    let bestD = Infinity;
    for (const plot of HOLLOW_HOUSE_PLOTS) {
      const d = Math.hypot(lx - plot.x, lz - plot.z);
      if (d < bestD) {
        bestD = d;
        best = plot;
      }
    }
    if (!best || bestD > CLAIM_RADIUS) {
      this.ctx.error(meta.entityId, 'There is no free homestead plot here. Stand on one to claim.');
      return;
    }
    if (this.plots.has(best.id)) {
      this.ctx.error(meta.entityId, 'That homestead already has an owner.');
      return;
    }
    this.plots.set(best.id, { plotId: best.id, ownerKey: key, ownerName: meta.name, objects: [] });
    this.rev++;
    this.ctx.emit({
      type: 'log',
      text: 'The homestead is yours. Decorate it with /house place <slot> <kind>.',
      color: '#8f8',
      pid: meta.entityId,
    });
    // A real threshold the Plant (PHAA-422) may lean in and comment on
    // (section 11: "finally says something about your house"); rationed on
    // its own side, so this simply reports the milestone in.
    this.ctx.notifyPlantThreshold('house_claimed');
  }

  housingPlace(slot: number, kind: string, pid?: number): void {
    const r = this.ctx.resolve(pid);
    if (!r) return;
    const { meta, e } = r;
    if (e.dead) return;
    const plot = this.plotOwnedBy(this.ownerKeyFor(meta));
    if (!plot) {
      this.ctx.error(meta.entityId, 'You do not own a homestead. Claim one with /house claim.');
      return;
    }
    if (!this.hubOriginFor(e)) {
      this.ctx.error(meta.entityId, 'You must be in the Hollow to tend your homestead.');
      return;
    }
    if (!Number.isInteger(slot) || slot < 0 || slot >= HOUSE_SLOT_COUNT) {
      this.ctx.error(meta.entityId, `Slots are numbered 1 to ${HOUSE_SLOT_COUNT}.`);
      return;
    }
    if (!(HOLLOW_HOUSE_OBJECT_KINDS as readonly string[]).includes(kind)) {
      this.ctx.error(
        meta.entityId,
        `Unknown decor kind. Kinds: ${HOLLOW_HOUSE_OBJECT_KINDS.join(', ')}.`,
      );
      return;
    }
    plot.objects = plot.objects.filter((o) => o.slot !== slot);
    plot.objects.push({ slot, kind });
    plot.objects.sort((a, b) => a.slot - b.slot);
    this.rev++;
    this.ctx.emit({
      type: 'log',
      text: `Placed the ${kind} on slot ${slot + 1}.`,
      color: '#8f8',
      pid: meta.entityId,
    });
  }

  housingRemove(slot: number, pid?: number): void {
    const r = this.ctx.resolve(pid);
    if (!r) return;
    const { meta, e } = r;
    if (e.dead) return;
    const plot = this.plotOwnedBy(this.ownerKeyFor(meta));
    if (!plot) {
      this.ctx.error(meta.entityId, 'You do not own a homestead. Claim one with /house claim.');
      return;
    }
    if (!this.hubOriginFor(e)) {
      this.ctx.error(meta.entityId, 'You must be in the Hollow to tend your homestead.');
      return;
    }
    if (!Number.isInteger(slot) || slot < 0 || slot >= HOUSE_SLOT_COUNT) {
      this.ctx.error(meta.entityId, `Slots are numbered 1 to ${HOUSE_SLOT_COUNT}.`);
      return;
    }
    const before = plot.objects.length;
    plot.objects = plot.objects.filter((o) => o.slot !== slot);
    if (plot.objects.length === before) {
      this.ctx.error(meta.entityId, 'That slot is already empty.');
      return;
    }
    this.rev++;
    this.ctx.emit({
      type: 'log',
      text: `Cleared slot ${slot + 1}.`,
      color: '#8f8',
      pid: meta.entityId,
    });
  }

  // "/house ..." chat routing (called from social/chat.ts). Returns true when
  // the message was a /house command (handled, even if it errored).
  handleChat(raw: string, pid: number): boolean {
    const m = /^\/house(?:\s+(\S+))?(?:\s+(\S+))?(?:\s+(\S+))?\s*$/i.exec(raw);
    if (!m) return false;
    const sub = (m[1] ?? '').toLowerCase();
    if (sub === 'claim') {
      this.housingClaim(pid);
      return true;
    }
    if (sub === 'place') {
      const slot = parseInt(m[2] ?? '', 10) - 1;
      this.housingPlace(Number.isFinite(slot) ? slot : -1, (m[3] ?? '').toLowerCase(), pid);
      return true;
    }
    if (sub === 'remove') {
      const slot = parseInt(m[2] ?? '', 10) - 1;
      this.housingRemove(Number.isFinite(slot) ? slot : -1, pid);
      return true;
    }
    // "/house" (or anything else): a self-only readout of your homestead.
    const meta = this.ctx.players.get(pid);
    if (!meta) return true;
    const plot = this.plotOwnedBy(this.ownerKeyFor(meta));
    if (!plot) {
      this.ctx.error(
        pid,
        'You own no homestead. Stand on a free plot in the Hollow and type /house claim.',
      );
    } else {
      const decor =
        plot.objects.length > 0
          ? plot.objects.map((o) => `${o.slot + 1}: ${o.kind}`).join(', ')
          : 'none';
      this.ctx.error(pid, `Your homestead: ${plot.plotId}. Decor: ${decor}.`);
      this.ctx.error(
        pid,
        `/house place <1-${HOUSE_SLOT_COUNT}> <${HOLLOW_HOUSE_OBJECT_KINDS.join('|')}>, /house remove <slot>.`,
      );
    }
    return true;
  }

  housingInfoFor(pid: number): import('../world_api/housing').HousingInfo | null {
    const meta = this.ctx.players.get(pid);
    const e = this.ctx.entities.get(pid);
    if (!meta || !e) return null;
    const key = this.ownerKeyFor(meta);
    const origin = this.hubOriginFor(e);
    return {
      origin,
      plots: HOLLOW_HOUSE_PLOTS.map((def) => {
        const owned = this.plots.get(def.id);
        return {
          plotId: def.id,
          x: def.x,
          z: def.z,
          rot: def.rot,
          ownerName: owned ? owned.ownerName : null,
          mine: !!owned && owned.ownerKey === key,
          objects: owned ? owned.objects.map((o) => ({ ...o })) : [],
        };
      }),
    };
  }

  serializeHousing(): HousingSave {
    return {
      plots: [...this.plots.values()].map((p) => ({
        plotId: p.plotId,
        ownerKey: p.ownerKey,
        ownerName: p.ownerName,
        objects: p.objects.map((o) => ({ ...o })),
      })),
    };
  }

  loadHousing(save: HousingSave | null | undefined): void {
    if (!save) return;
    const validPlotIds = new Set(HOLLOW_HOUSE_PLOTS.map((p) => p.id));
    const seenOwners = new Set<string>();
    for (const p of save.plots ?? []) {
      if (!p || typeof p.plotId !== 'string' || !validPlotIds.has(p.plotId)) continue;
      if (typeof p.ownerKey !== 'string' || p.ownerKey === '') continue;
      if (this.plots.has(p.plotId) || seenOwners.has(p.ownerKey)) continue;
      seenOwners.add(p.ownerKey);
      this.plots.set(p.plotId, {
        plotId: p.plotId,
        ownerKey: p.ownerKey,
        ownerName: typeof p.ownerName === 'string' ? p.ownerName : '?',
        objects: (p.objects ?? [])
          .filter(
            (o) =>
              o &&
              Number.isInteger(o.slot) &&
              o.slot >= 0 &&
              o.slot < HOUSE_SLOT_COUNT &&
              (HOLLOW_HOUSE_OBJECT_KINDS as readonly string[]).includes(o.kind),
          )
          .map((o) => ({ slot: o.slot, kind: o.kind })),
      });
    }
  }
}
