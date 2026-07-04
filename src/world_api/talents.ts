import type { Role, SavedLoadout, TalentAllocation } from '../sim/content/talents';
import type { PlayerClass } from '../sim/types';

export interface IWorldTalents {
  // Talents & Specializations. State is server-authoritative; the client stages
  // edits locally and commits via applyTalents (the server re-validates).
  talents: TalentAllocation;
  talentSpec: string | null;
  talentRole: Role | null;
  loadouts: SavedLoadout[];
  activeLoadout: number;
  // GW1 build system multiclassing (Phase 3): the second class whose kit is
  // merged into known abilities, or null if none has been set (see PHAA-464
  // for the trainer NPC that sets it). Server-authoritative like talents.
  secondaryCls: PlayerClass | null;
  talentPoints(): { total: number; spent: number };
  applyTalents(alloc: TalentAllocation): void;
  respec(): void;
  setSpec(specId: string | null): void;
  saveLoadout(name: string, bar: (string | null)[], alloc?: TalentAllocation): void;
  switchLoadout(index: number): void;
  deleteLoadout(index: number): void;
}
