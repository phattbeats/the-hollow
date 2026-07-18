// Selectable display titles (PHAA-762, child 1 of PHAA-686). Folds the
// existing kind:'title' MILESTONES (veteran/champion/eternal, see
// ../types.ts) in as the pool's first entries so they gain equip semantics
// without changing grantXp's auto-unlock rule (../combat/damage.ts). Future
// titles granted by achievements/quests/events land here too, without ever
// going through MilestoneDef.
import type { TitleDef } from '../types';

export const TITLES: TitleDef[] = [
  { id: 'veteran', unlockedByMilestone: 'veteran' },
  { id: 'champion', unlockedByMilestone: 'champion' },
  { id: 'eternal', unlockedByMilestone: 'eternal' },
];
