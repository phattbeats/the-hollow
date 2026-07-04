import type { PlayerClass } from '../sim/types';

// GW1 build system multiclassing (Phase 3): a Profession Trainer NPC lets a
// player pick, or later change, their secondary class (see content.trainer on
// NpcDef and setSecondaryClass in sim/progression/trainer.ts). State is
// server-authoritative like IWorldTalents: the client sends the command and
// mirrors whatever the server decides.
export interface IWorldTrainer {
  // Number of secondary-class changes PAID for so far (the very first pick is
  // free and does not count). Drives the escalating gold cost in
  // secondaryClassCost. Persisted in CharacterState alongside secondaryCls.
  secondaryClsChanges: number;
  // Gold cost, in copper, to set the secondary class to `cls` right now, or
  // null if `cls` is not a legal pick (the player's own primary class, or
  // already the current secondary class).
  secondaryClassCost(cls: PlayerClass): number | null;
  setSecondaryClass(npcId: number, cls: PlayerClass): void;
}
