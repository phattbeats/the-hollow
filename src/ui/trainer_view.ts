// Pure, host-agnostic view model for the Profession Trainer NPC panel
// (PHAA-465: Multiclass D, the trainer half of the HUD surface).
//
// Pure-core half of the pure-core + thin-painter split (root CLAUDE.md
// Conventions; reference vendor_view.ts, unit_portrait.ts). It owns the one
// thing the trainer picker decides that is worth testing without a DOM: which
// secondary classes this NPC offers, the current pick (or none), the copper
// cost to pick or change each one (or null when a pick is not legal), whether
// the level gate holds, and the confirm stage the recipe calls for ("pick /
// change secondary, show fee, confirm"). The DOM/i18n side lives in
// trainer_panel.ts; rendering is driven entirely off the structure returned
// here.
//
// DOM-free, Three-free, i18n-free, and free of any RNG or wall-clock call, so
// it stays deterministic and tests/trainer_view.test.ts can drive it directly
// with raw inputs (the painter wires those inputs from IWorldTrainer /
// cfg.playerClass / meta.secondaryClsChanges / meta.copper).

import type { PlayerClass } from '../sim/types';
// Pulled from sim/progression/trainer.ts so the cost schedule and the level
// gate are sourced from the sim, not re-declared in the view layer.
import { SECONDARY_CLASS_CHANGE_COST } from '../sim/progression/trainer';

// Cost tier for secondary-class changes PAID for so far (the very first pick
// is free and does not consume a tier). Mirrors the sim's
// SECONDARY_CLASS_CHANGE_COST so the UI cannot drift; re-exported here for
// tests and for the painter's display-only preview.
export const TRAINER_CHANGE_COST_TIERS = SECONDARY_CLASS_CHANGE_COST;

// The minimum level the sim requires to pick a secondary (mirrors
// SECONDARY_CLASS_MIN_LEVEL). Re-exported so the painter does not have to
// import the sim cost module just for the level gate copy.
export const TRAINER_MIN_LEVEL = 10;

// The "secondary cap" the issue calls out: a secondary class may spend at most
// half of the shared talent pool on its own tree (see sim/content/talents.ts
// validateAllocation; the dual-tree PHAA-463 plumbing is what makes this
// visible here). The painter renders it as a sub-cap hint below the shared
// pool counter on the talents window; the trainer panel surfaces the same
// number so a player knows the bound up front before picking.
export const TRAINER_SECONDARY_TREE_HALF_CAP = 0.5;

/**
 * One selectable secondary-class row inside the trainer dialog. The painter
 * projects this directly to a single `<button class="qd-list-item">`.
 *
 * - `picked = true` paints the row disabled with the "Current" badge.
 * - `picked = false` paints a clickable pick. When `costCopper === null`
 *   the row would still render as a button but is informational only; the
 *   painter's "pick" handler treats null as "ignore" (it cannot actually
 *   happen for an NPC's taught professions since the primary class is
 *   filtered out, but we keep the type defensive).
 * - `affordable = false` paints the row disabled with a "needs more gold"
 *   hint, so the user understands why the click does nothing.
 */
export interface TrainerPickVM {
  /** The class this row teaches as a secondary. */
  cls: PlayerClass;
  /** Is this row the player's currently-bound secondary class? */
  picked: boolean;
  /** Copper cost to pick this class now, or null when the pick is not legal. */
  costCopper: number | null;
  /** True when the player can afford this pick RIGHT NOW (cost <= copper). */
  affordable: boolean;
}

/**
 * Confirm stage: the picker has a row clicked but the spend has not happened
 * yet. The painter renders "Are you sure?" with the cost row from the picked
 * row; the "Yes" / "No" handlers map to `apply` / `clear` on the args. A null
 * `cls` paints a one-button footer (back) instead of a confirm dialog.
 */
export interface TrainerConfirmVM {
  /** The class the user is about to commit to. null when no row is pending. */
  cls: PlayerClass | null;
  /** Cost preview (copper) at the time the confirm was opened. */
  costCopper: number;
  /** True when the player can afford the pick at confirm time. */
  affordable: boolean;
}

/**
 * Full derived trainer view for a given NPC. The painter localizes the title
 * and gate text in a wrapper; this struct carries the deterministic data
 * only.
 *
 * - `levelLocked = true` paints the level-gate explainer and skips every
 *   pick row; the painter still paints the Back / Close / "How it works"
 *   controls so the user can return to the gossip menu.
 * - An NPC with no teachable professions renders an empty `picks` array.
 *   The painter falls back to the same level-gate copy as a defensive
 *   empty-state, matching what the inline code did for an NPC def that
 *   somehow ended up in the trainer dialog with no `trainer.professions`.
 * - `confirm` mirrors the recipe ("pick / change / show fee / confirm"): the
 *   painter swaps the pick list for a single confirmation row when a row is
 *   pending.
 */
export interface TrainerView {
  /** The player's current level blocks all picks. */
  levelLocked: boolean;
  /** The minimum level required to pick a secondary. Mirrors the sim gate. */
  minLevel: number;
  /** One row per teachable class (excluding the player's primary). */
  picks: TrainerPickVM[];
  /** Pending confirm stage, or null when the picker is idle. */
  confirm: TrainerConfirmVM | null;
}

/** Inputs to {@link buildTrainerView}, named so the painter's call site reads. */
export interface BuildTrainerViewArgs {
  /** The NPC's templateId (string id; for lookup against the NPC content table). */
  npcTemplateId: string;
  /** The NPC content table (read-only). The view finds `trainer.professions`. */
  npcs: Readonly<Record<string, { trainer?: { professions: readonly PlayerClass[] } }>>;
  /** The player's primary class; rows matching this are filtered out. */
  primaryCls: PlayerClass;
  /** The player's currently-bound secondary class, or null when none. */
  currentSecondary: PlayerClass | null;
  /** Number of PAID secondary-class changes so far (first pick is free). */
  secondaryChanges: number;
  /** The player's current level (against `minLevel`). */
  playerLevel: number;
  /** Minimum level to pick a secondary (mirrors SECONDARY_CLASS_MIN_LEVEL). */
  minLevel: number;
  /** The player's current gold in copper (drives `affordable`). */
  copper: number;
  /** Optional: the class the user just clicked but has not confirmed yet. */
  pendingCls?: PlayerClass | null;
  /** Optional: the pending class's cost preview at confirm time (copper). */
  pendingCostCopper?: number | null;
}

/**
 * Build the structured trainer view.
 *
 * Mirrors the sim's `secondaryClassCostFor` (sim/progression/trainer.ts)
 * byte-for-byte so the painter and the server can never disagree on cost:
 * - First-ever pick (`currentSecondary === null`) is free, cost 0.
 * - Switching to a different class pays the tier for `secondaryChanges`,
 *   capped at the last tier.
 * - The currently-picked class (when present) reports cost 0 and `picked: true`
 *   so the painter can render the "Current" badge and a non-clickable row.
 *
 * Confirm-stage rules (the `pendingCls` arg):
 * - When `pendingCls` is set AND matches a non-picked row, the painter
 *   renders the confirm dialog with that class + cost; the user can "Yes"
 *   (apply the spend) or "No" (clear).
 * - When `pendingCls` is set but matches the player's current secondary
 *   (a defensive no-op), the confirm is silently suppressed: no fee to
 *   confirm a class already bound.
 * - When `pendingCls` is null/undefined, the confirm is null and the
 *   painter renders the pick list as normal.
 */
export function buildTrainerView(args: BuildTrainerViewArgs): TrainerView {
  const levelLocked = args.playerLevel < args.minLevel;
  const baseView: TrainerView = {
    levelLocked,
    minLevel: args.minLevel,
    picks: [],
    confirm: null,
  };
  if (levelLocked) return baseView;

  const npc = args.npcs[args.npcTemplateId];
  const professions = npc?.trainer?.professions ?? [];
  const picks: TrainerPickVM[] = [];
  for (const cls of professions) {
    if (cls === args.primaryCls) continue;
    const picked = cls === args.currentSecondary;
    let costCopper: number | null;
    if (picked) {
      costCopper = 0;
    } else if (args.currentSecondary === null) {
      costCopper = 0;
    } else {
      const idx = Math.min(args.secondaryChanges, SECONDARY_CLASS_CHANGE_COST.length - 1);
      costCopper = SECONDARY_CLASS_CHANGE_COST[idx];
    }
    picks.push({
      cls,
      picked,
      costCopper,
      affordable: costCopper !== null && costCopper <= args.copper,
    });
  }

  // Confirm stage: a non-picked row is pending AND the player can see a fee
  // (i.e. it is a real change, not a no-op confirm of the current class).
  let confirm: TrainerConfirmVM | null = null;
  if (args.pendingCls && args.pendingCls !== args.primaryCls && args.pendingCls !== args.currentSecondary) {
    const costCopper = args.pendingCostCopper ?? 0;
    confirm = {
      cls: args.pendingCls,
      costCopper,
      affordable: costCopper <= args.copper,
    };
  }

  return { ...baseView, picks, confirm };
}