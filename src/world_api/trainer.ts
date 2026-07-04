import type { PlayerClass } from '../sim/types';

// GW1 build system multiclassing (Phase 3): a Profession Trainer NPC lets a
// player pick, or later change, their secondary class (see content.trainer on
// NpcDef and setSecondaryClass in sim/progression/trainer.ts). State is
// server-authoritative like IWorldTalents: the client sends the command and
// mirrors whatever the server decides.
export interface IWorldTrainer {
  // The player's primary class (the one chosen at character creation; does
  // not change). The character sheet + charselect + nameplate-tooltip use
  // this together with `secondaryCls` to render "Ranger / Priest", and the
  // trainer painter uses it to filter its pick list.
  primaryCls: PlayerClass;
  // The player's currently-bound secondary class, or null when they have not
  // yet visited a Profession Trainer NPC (or the level gate holds). The
  // character sheet / charselect / nameplate-tooltip read this together with
  // `primaryCls` to render the "Primary / Secondary" subtitle.
  secondaryCls: PlayerClass | null;
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
