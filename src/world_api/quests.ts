import type { QuestProgress, QuestState } from '../sim/types';

export interface IWorldQuests {
  questLog: Map<string, QuestProgress>;
  questsDone: Set<string>;
  questState(questId: string): QuestState;
  acceptQuest(questId: string): void;
  turnInQuest(questId: string): void;
  abandonQuest(questId: string): void;
  // Refuse a refusable offer (a def carrying offerDialog, PHAA-471): completes the
  // quest with its normal rewards without running the objectives.
  refuseQuest(questId: string): void;
  acceptLinkedQuest(questId: string, fromPid: number): void;
}
