// Pure derivation of the per-roll, group-visible "who has answered how" status
// the loot-roll frame paints under its action buttons. Maps the
// `IWorld.lootRollGroupStatus()` mirror (added by PHAA-568, the port of upstream
// #1599) into a stable render model the painter consumes: one roll entry per
// open need-greed roll the local player's party is voting on, each carrying
// the per-candidate choice (need/greed/pass, or pending while undecided) along
// with the already-localized label string the painter drops in directly.
//
// Kept DOM-free, Three-free, and i18n-aware in exactly one place: this file
// owns the only call to `t()` for the group-status labels so the painter never
// imports the i18n surface. Same input maps to the same view (the function is
// a pure derivation) so a Vitest drives it against both a `Sim` and a
// `ClientWorld` stub without any time/randomness dependencies.
//
// Choice strings are intentionally hard-cut on the LootRollChoice union so a
// new variant (e.g. "disenchant") added to the seam must also be handled here;
// the discriminated union collapses the four cases to one return and the test
// pins them so the gate reddens if a future case is forgotten.

import type { LootRollChoice, LootRollGroupStatus } from '../sim/types';
import type { IWorld } from '../world_api';
import { t } from './i18n';

// Stable choice label returned for each per-candidate entry. The 'pending'
// sentinel is the "still deciding" state, surfaced as a "Waiting..." label so
// the strip reads as "Player (Waiting...)" until the local server emit lands.
export type GroupChoice = LootRollChoice | 'pending';

export interface LootRollGroupViewEntry {
  pid: number;
  name: string;
  choice: GroupChoice;
  // The already-localized human label for `choice`. The painter drops this
  // into the per-row chip text node as-is, so no painter-side `t()` calls
  // are needed.
  label: string;
}

export interface LootRollGroupViewRoll {
  rollId: number;
  itemName: string;
  // The quality is exposed so the painter can color the row's nameplate the
  // same way the action-row already does. Item ids are NOT included: the
  // existing roll row is keyed by id+iconography, and the strip is purely
  // the vote tally.
  quality: LootRollGroupStatus['quality'];
  // True when the local player is one of the candidates (they may still
  // answer or have already answered). Drives whether the painter needs to
  // keep a hover/focus affordance and whether the local-pid chip is bolded.
  viewerIsCandidate: boolean;
  entries: LootRollGroupViewEntry[];
}

export interface LootRollGroupView {
  rolls: LootRollGroupViewRoll[];
}

// Map a single server-side `LootRollGroupStatus` to a view roll. Pure: the
// `viewerPid` is the local player pid, used to set `viewerIsCandidate` and to
// keep the local player's chip recognizable in the strip. Same input +
// viewerPid gives the same output (no Date.now / Rng / DOM), so the
// architecture-test's reference-stability probe accepts it.
export function lootRollGroupRollView(
  status: LootRollGroupStatus,
  viewerPid: number,
): LootRollGroupViewRoll {
  const entries: LootRollGroupViewEntry[] = status.entries.map((entry) => {
    if (entry.choice) {
      return {
        pid: entry.pid,
        name: entry.name,
        choice: entry.choice,
        // The three-cases are spelled out (rather than a Record lookup) so the
        // t() call's `TranslationKey` literal type is preserved at compile
        // time without a `satisfies` dance; a new choice added to the seam
        // must add a `case` here, which is the only compile-time check we
        // get for "the catalog has a label for this choice".
        label: t(
          entry.choice === 'need'
            ? 'hudChrome.lootRollGroup.need'
            : entry.choice === 'greed'
              ? 'hudChrome.lootRollGroup.greed'
              : 'hudChrome.lootRollGroup.pass',
        ),
      };
    }
    return {
      pid: entry.pid,
      name: entry.name,
      choice: 'pending',
      label: t('hudChrome.lootRollGroup.pending'),
    };
  });
  return {
    rollId: status.rollId,
    itemName: status.itemName,
    quality: status.quality,
    viewerIsCandidate: status.entries.some((entry) => entry.pid === viewerPid),
    entries,
  };
}

// One entry per open need-greed roll the local player's party is voting on,
// in the order the server emits them (server-stable, never shuffled, so the
// painter can re-use its keyed pool by rollId without reordering on every
// frame).
export function lootRollGroupView(world: IWorld, viewerPid: number): LootRollGroupView {
  const rolls: LootRollGroupViewRoll[] = [];
  for (const status of world.lootRollGroupStatus()) {
    rolls.push(lootRollGroupRollView(status, viewerPid));
  }
  return { rolls };
}

