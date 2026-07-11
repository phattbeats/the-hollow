// ---------------------------------------------------------------------------
// Branching NPC dialogue (PHAA-553). The player walks an NpcDef.dialogTree and
// picks a toned response at each node; navigation is client-side static content
// (the pure npc_dialog_tree_view walker), so the only thing crossing this seam
// is CONSEQUENCE. `dialogChoose` resolves a picked choice server-side (look up
// the choice in the speaking NPC's tree, re-check its gate, apply its effect),
// and `dialogState` is the per-player read the UI feeds back into the gate
// evaluation. Effects in v1 are a per-NPC disposition plus persistent flags; no
// rewards or quest gating (the hooks exist for later depth). See
// src/sim/dialog/dialog_commands.ts (offline Sim) and server/game.ts (dispatch).
// ---------------------------------------------------------------------------

// Per-player dialog state: disposition toward each NPC (by npc id; absent = 0,
// never talked to) and the persistent conversation flags. The wire + read shape.
export interface DialogStateView {
  disposition: Record<string, number>;
  flags: string[];
}

export interface IWorldDialog {
  /** Resolve a picked dialogue choice server-side (applies its disposition/flag effect). */
  dialogChoose(npcId: string, choiceId: string): void;
  /** This player's persisted dialog state, fed into the pure walker's gate checks. */
  dialogState(): DialogStateView;
}
