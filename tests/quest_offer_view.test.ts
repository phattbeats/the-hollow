// Pure-core tests for the branching quest-offer dialog stage machine (PHAA-471),
// the logic behind hud.renderQuestDetail's choice buttons when a QuestDef carries
// offerDialog (Brother Greenpaw's q_what_fills).

import { describe, expect, it } from 'vitest';
import { questOfferAdvance, questOfferChoices } from '../src/ui/quest_offer_view';

describe('quest_offer_view: choices per stage', () => {
  it('offers all three choices at the initial offer', () => {
    expect(questOfferChoices('offer')).toEqual(['accept', 'complain', 'refuse']);
  });

  it('drops the complain choice after the player has complained once', () => {
    expect(questOfferChoices('complained')).toEqual(['accept', 'refuse']);
  });

  it('offers no choices after a refusal (the quest is already complete)', () => {
    expect(questOfferChoices('refused')).toEqual([]);
  });
});

describe('quest_offer_view: stage transitions', () => {
  it('complain advances offer -> complained, refuse advances to refused', () => {
    expect(questOfferAdvance('offer', 'complain')).toBe('complained');
    expect(questOfferAdvance('offer', 'refuse')).toBe('refused');
    expect(questOfferAdvance('complained', 'refuse')).toBe('refused');
  });

  it('accept leaves the dialog (null) from any offering stage', () => {
    expect(questOfferAdvance('offer', 'accept')).toBeNull();
    expect(questOfferAdvance('complained', 'accept')).toBeNull();
  });

  it('rejects choices not offered at the stage', () => {
    expect(questOfferAdvance('complained', 'complain')).toBeNull();
    expect(questOfferAdvance('refused', 'accept')).toBeNull();
    expect(questOfferAdvance('refused', 'refuse')).toBeNull();
  });
});
