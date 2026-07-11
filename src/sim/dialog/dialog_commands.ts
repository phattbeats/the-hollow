// Server-authoritative resolver for branching NPC dialogue (PHAA-553). A
// self-contained sim system behind the SimContext seam (the greenpaw_hearth.ts /
// quest_commands.ts pattern): ctx-first free functions, no method cluster on the
// Sim coordinator, `src/sim`-pure (no DOM/Three/render/ui/net, no Math.random /
// Date.now; enforced by tests/architecture.test.ts).
//
// The split of responsibility (see NpcDialogTree in types.ts): the client walks
// the tree and renders the toned choices; only a choice carrying an `effect`
// reaches here, over the dialogChoose command. This module re-resolves the
// choice from the AUTHORITATIVE content (never trusting a client-sent effect),
// re-checks its gate against the player's persisted state (never applying a
// choice the client should not have offered), and applies the consequence: a
// clamped per-NPC disposition nudge and/or a persistent conversation flag. No
// player-visible text is emitted here, so the sim stays language-agnostic and
// this adds no i18n matcher surface.

import { NPCS } from '../data';
import type { SimContext } from '../sim_context';
import {
  type DialogChoiceDef,
  type DialogStateSave,
  dialogGatePasses,
  dist2d,
  type Entity,
  INTERACT_RANGE,
  type NpcDialogTree,
} from '../types';

// Disposition is a small signed band: warm choices climb, cold ones fall, and it
// never runs away. v1 uses it only to gate dialogue branches (never rewards).
const DISPOSITION_MIN = -10;
const DISPOSITION_MAX = 10;

// You must be within talking range of the NPC for a choice to resolve (matches
// feedGreenpaw's proximity buffer; the client only opens a tree on interact, but
// the server re-validates every effect).
const TALK_RANGE = INTERACT_RANGE + 2;

// Live per-player dialog state on PlayerMeta: disposition toward each NPC (by npc
// id) and the persistent conversation flags. Map/Set for O(1) membership, mirror
// of the questLog runtime convention; serialized to DialogStateSave for JSONB.
export interface DialogRuntimeState {
  disposition: Map<string, number>;
  flags: Set<string>;
}

export function freshDialogState(): DialogRuntimeState {
  return { disposition: new Map(), flags: new Set() };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function findChoice(tree: NpcDialogTree, choiceId: string) {
  for (const node of Object.values(tree.nodes)) {
    const choice = node.choices.find((c) => c.id === choiceId);
    if (choice) return choice;
  }
  return null;
}

function nearNpc(ctx: SimContext, player: Entity, npcId: string): boolean {
  for (const e of ctx.entities.values()) {
    if (e.kind !== 'npc' || e.templateId !== npcId) continue;
    if (dist2d(player.pos, e.pos) <= TALK_RANGE) return true;
  }
  return false;
}

// The pure consequence of a picked choice: re-check its gate against the current
// state, then apply its effect (clamped disposition nudge, flag set). Mutates
// `state` in place and returns whether anything was applied (false for a gated,
// effect-less, or no-op choice). Content-free and ctx-free so it unit-tests
// directly; dialogChoose is the thin ctx wrapper that resolves + range-checks.
export function applyDialogChoice(
  state: DialogRuntimeState,
  npcId: string,
  choice: DialogChoiceDef,
): boolean {
  const disposition = state.disposition.get(npcId) ?? 0;
  if (!dialogGatePasses(choice.requires, disposition, state.flags)) return false;
  const effect = choice.effect;
  if (!effect) return false;
  let applied = false;
  if (typeof effect.disposition === 'number' && effect.disposition !== 0) {
    state.disposition.set(
      npcId,
      clamp(disposition + effect.disposition, DISPOSITION_MIN, DISPOSITION_MAX),
    );
    applied = true;
  }
  if (effect.setFlag) {
    state.flags.add(effect.setFlag);
    applied = true;
  }
  return applied;
}

// Apply the picked choice's server-authoritative effect for the resolved player.
// Silently no-ops on any invalid input (unknown npc/tree/choice, out of range,
// gate unmet, or a pure-flavor choice with no effect) rather than erroring: the
// navigation the client already did is legitimate, this is only the consequence.
export function dialogChoose(ctx: SimContext, npcId: string, choiceId: string, pid?: number): void {
  const r = ctx.resolve(pid);
  if (!r) return;
  const { meta, e } = r;
  if (e.dead) return;
  const tree = NPCS[npcId]?.dialogTree;
  if (!tree) return;
  if (!nearNpc(ctx, e, npcId)) return;
  const choice = findChoice(tree, choiceId);
  if (!choice) return;
  // The gate re-check and effect application (including rejecting a choice the
  // client should not have offered) live in the pure applyDialogChoice.
  applyDialogChoice(meta.dialogState, npcId, choice);
}

// The player's dialog state as the read the UI feeds into the gate walker.
export function dialogStateView(ctx: SimContext, pid?: number): DialogStateSave {
  const r = ctx.resolve(pid);
  if (!r) return { disposition: {}, flags: [] };
  return serializeDialogState(r.meta.dialogState);
}

export function serializeDialogState(ds: DialogRuntimeState): DialogStateSave {
  return { disposition: Object.fromEntries(ds.disposition), flags: [...ds.flags] };
}

export function loadDialogState(save: DialogStateSave | null | undefined): DialogRuntimeState {
  const ds = freshDialogState();
  if (!save) return ds;
  if (save.disposition && typeof save.disposition === 'object') {
    for (const [npcId, value] of Object.entries(save.disposition)) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        ds.disposition.set(npcId, clamp(value, DISPOSITION_MIN, DISPOSITION_MAX));
      }
    }
  }
  if (Array.isArray(save.flags)) {
    for (const flag of save.flags) if (typeof flag === 'string') ds.flags.add(flag);
  }
  return ds;
}
