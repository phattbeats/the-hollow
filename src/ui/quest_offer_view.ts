// Pure view core for the branching quest-offer dialog (PHAA-471): the stage machine
// behind the choice buttons hud.ts renders when a QuestDef carries offerDialog.
// DOM-free and world-free so it Node-tests directly; hud.renderQuestDetail is the
// thin consumer (the npc_intro_view.ts pattern).
//
// Stages: 'offer' shows the quest text with all three choices; 'complained' shows
// the NPC's complainReply and drops the complain choice (you only get to grouse
// once); 'refused' shows refuseReply with no choices (the refusal has already been
// sent, the panel closes back to gossip). 'accept' and 'refuse' are the two choices
// with effect; only 'refuse' changes sim state without accepting.

export type QuestOfferStage = 'offer' | 'complained' | 'refused';
export type QuestOfferChoice = 'accept' | 'complain' | 'refuse';

export function questOfferChoices(stage: QuestOfferStage): readonly QuestOfferChoice[] {
  switch (stage) {
    case 'offer':
      return ['accept', 'complain', 'refuse'];
    case 'complained':
      return ['accept', 'refuse'];
    case 'refused':
      return [];
  }
}

// The stage the panel moves to after a choice, or null when the choice leaves the
// dialog (accept hands off to the normal accept flow and back to gossip).
export function questOfferAdvance(
  stage: QuestOfferStage,
  choice: QuestOfferChoice,
): QuestOfferStage | null {
  if (!questOfferChoices(stage).includes(choice)) return null;
  if (choice === 'accept') return null;
  return choice === 'complain' ? 'complained' : 'refused';
}
