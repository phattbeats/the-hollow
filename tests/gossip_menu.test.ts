import { describe, expect, it } from 'vitest';
import { gossipMenuIsEmpty } from '../src/ui/gossip_menu';

const EMPTY = {
  questCount: 0,
  discussionCount: 0,
  hasVendor: false,
  hasMarket: false,
  hasRavenpost: false,
  hasTrainer: false,
  hasHearth: false,
  hasDialogTree: false,
  hasDelveBoard: false,
  hasJournal: false,
};

// Reproduces the tutorial bug report: after accepting/turning in the starter
// quest with the Marshal (the only content a fresh character's gossip menu
// ever has), the dialog should recognize the menu is now empty so the caller
// can close it, instead of leaving a dead greeting-only window on screen.
describe('gossipMenuIsEmpty', () => {
  it('is empty when the NPC has no quests, shop, board, or lore left to offer', () => {
    expect(gossipMenuIsEmpty(EMPTY)).toBe(true);
  });

  it('the Marshal case: quest just accepted/turned in, nothing else offered', () => {
    // Mirrors marshal_redbrook's gossip state for a brand-new tutorial
    // character right after acceptQuest/turnInQuest('q_wolves'): the quest is
    // no longer 'available'/'ready' so it drops out of the list, and none of
    // the other menu sources apply.
    expect(gossipMenuIsEmpty(EMPTY)).toBe(true);
  });

  it('stays non-empty with another offerable quest', () => {
    expect(gossipMenuIsEmpty({ ...EMPTY, questCount: 1 })).toBe(false);
  });

  it('stays non-empty with an in-progress discussion quest', () => {
    expect(gossipMenuIsEmpty({ ...EMPTY, discussionCount: 1 })).toBe(false);
  });

  it('stays non-empty for a vendor, market, ravenpost, trainer, hearth, dialog tree, delve board, or journal NPC', () => {
    expect(gossipMenuIsEmpty({ ...EMPTY, hasVendor: true })).toBe(false);
    expect(gossipMenuIsEmpty({ ...EMPTY, hasMarket: true })).toBe(false);
    expect(gossipMenuIsEmpty({ ...EMPTY, hasRavenpost: true })).toBe(false);
    expect(gossipMenuIsEmpty({ ...EMPTY, hasTrainer: true })).toBe(false);
    expect(gossipMenuIsEmpty({ ...EMPTY, hasHearth: true })).toBe(false);
    expect(gossipMenuIsEmpty({ ...EMPTY, hasDialogTree: true })).toBe(false);
    expect(gossipMenuIsEmpty({ ...EMPTY, hasDelveBoard: true })).toBe(false);
    expect(gossipMenuIsEmpty({ ...EMPTY, hasJournal: true })).toBe(false);
  });
});
