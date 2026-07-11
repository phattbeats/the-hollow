// Pure view core for branching NPC dialogue trees (PHAA-553): the walker behind
// the choice buttons hud.ts renders when an NpcDef carries a `dialogTree`. It
// generalizes quest_offer_view.ts's 3-stage machine to an N-node tree.
//
// DOM-free and world-free so it Node-tests directly (the npc_intro_view.ts /
// quest_offer_view.ts pattern); hud.ts is the thin consumer that resolves each
// npcLine/label through tEntity and paints the tone-tagged buttons. This core
// owns exactly two decisions: WHICH choices are offered at a node (after gating)
// and WHICH node a choice advances to.
//
// Navigation is deterministic and safe to walk client-side because it is pure
// static content; a choice's EFFECT (a disposition nudge, a persistent flag) is
// never applied here. It resolves server-side via the dialogChoose command, and
// the resulting persisted state flows back in as the DialogViewState below so
// `requires` gates evaluate against authoritative data.

import {
  type DialogChoiceDef,
  type DialogGate,
  type DialogNodeDef,
  dialogGatePasses,
  type NpcDialogTree,
} from '../sim/types';

// The player's persisted dialog state for the ONE npc whose tree is open: their
// disposition toward that npc (0 when never talked to) and the conversation
// flags they have accumulated. Read-only here; the sim owns the writes.
export interface DialogViewState {
  disposition: number;
  flags: ReadonlySet<string>;
}

// A neutral, first-meeting state (no disposition, no flags): the default a
// consumer passes before any server state has arrived.
export const NEUTRAL_DIALOG_STATE: DialogViewState = {
  disposition: 0,
  flags: new Set(),
};

// The node a tree opens on, or null if the tree is malformed (root missing from
// `nodes`). A malformed tree opens nothing rather than throwing.
export function dialogRootNode(tree: NpcDialogTree): DialogNodeDef | null {
  return tree.nodes[tree.root] ?? null;
}

export function dialogNode(tree: NpcDialogTree, nodeId: string): DialogNodeDef | null {
  return tree.nodes[nodeId] ?? null;
}

// Whether a choice's `requires` gate is satisfied by the current state. A choice
// with no gate is always offered; every condition present in the gate must hold.
export function dialogGateAllows(gate: DialogGate | undefined, state: DialogViewState): boolean {
  return dialogGatePasses(gate, state.disposition, state.flags);
}

// The choices offered at a node given the player's state: the node's choices
// with any whose gate is unmet dropped. Empty for an unknown or terminal node
// (the consumer shows a "Farewell" close in that case).
export function dialogChoicesAt(
  tree: NpcDialogTree,
  nodeId: string,
  state: DialogViewState,
): DialogChoiceDef[] {
  const node = tree.nodes[nodeId];
  if (!node) return [];
  return node.choices.filter((c) => dialogGateAllows(c.requires, state));
}

// Resolve a chosen choice by id IFF it is currently offered at the node (gate
// satisfied and belonging to this node), else null. This is the guard the
// consumer runs before sending dialogChoose: a gated-away or unknown choice id
// never advances the conversation and never sends an effect.
export function dialogChoiceById(
  tree: NpcDialogTree,
  nodeId: string,
  choiceId: string,
  state: DialogViewState,
): DialogChoiceDef | null {
  return dialogChoicesAt(tree, nodeId, state).find((c) => c.id === choiceId) ?? null;
}

// The node id a choice advances the conversation to, or null when the choice
// ends it (no `next`). Pure lookup on the choice; call dialogChoiceById first to
// prove the choice is legal.
export function dialogAdvance(choice: DialogChoiceDef): string | null {
  return choice.next ?? null;
}
