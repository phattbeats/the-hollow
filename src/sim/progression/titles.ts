// Selectable display titles (PHAA-762, child 1 of PHAA-686): the
// select/equip command for the title registry (content/titles.ts), kept
// decoupled from MilestoneDef so future titles can unlock via
// achievements/quests/events instead. grantXp's milestone auto-unlock rule
// (../combat/damage.ts) is untouched; this module only reads
// unlockedMilestones to decide whether a launch title is equippable.
import { TITLES_BY_ID } from '../data';
import type { PlayerMeta } from '../sim';
import type { SimContext } from '../sim_context';

// True if the title is in the registry and the player has unlocked it.
export function isTitleUnlocked(meta: PlayerMeta, titleId: string): boolean {
  const def = TITLES_BY_ID[titleId];
  if (!def || def.unlockedByMilestone === undefined) return false;
  return meta.unlockedMilestones.has(def.unlockedByMilestone);
}

// Server-authoritative select/equip: validates the title exists and is
// unlocked before accepting. `titleId: null` clears the active title, always
// allowed. Reuses items.ts's generic "cannot equip" wording (already matched
// by the client i18n matcher) rather than adding a bespoke error string.
export function equipTitle(ctx: SimContext, titleId: string | null, pid?: number): boolean {
  const r = ctx.resolve(pid);
  if (!r) return false;
  if (titleId !== null && !isTitleUnlocked(r.meta, titleId)) {
    ctx.error(r.e.id, 'You cannot equip that.');
    return false;
  }
  r.meta.activeTitle = titleId;
  return true;
}
