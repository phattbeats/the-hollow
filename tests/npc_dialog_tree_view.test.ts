// Pure-core tests for the branching NPC dialogue-tree walker (PHAA-553): the
// logic hud.ts consumes to render tone-tagged choice buttons and walk an NpcDef's
// dialogTree. Fixture tree only; the sim owns effects, this core owns navigation.

import { describe, expect, it } from 'vitest';
import type { NpcDialogTree } from '../src/sim/types';
import {
  dialogAdvance,
  dialogChoiceById,
  dialogChoicesAt,
  dialogGateAllows,
  dialogRootNode,
  NEUTRAL_DIALOG_STATE,
} from '../src/ui/npc_dialog_tree_view';

const TREE: NpcDialogTree = {
  root: 'start',
  nodes: {
    start: {
      npcLine: 'well met, friend.',
      choices: [
        {
          id: 'warm',
          tone: 'positive',
          label: 'good to see you.',
          next: 'warm_reply',
          effect: { disposition: 1 },
        },
        { id: 'curt', tone: 'neutral', label: 'what do you want?', next: 'curt_reply' },
        {
          id: 'rude',
          tone: 'negative',
          label: 'out of my way.',
          next: 'rude_reply',
          effect: { disposition: -1, setFlag: 'was_rude' },
        },
      ],
    },
    warm_reply: {
      npcLine: 'the warmth is mutual.',
      choices: [
        // Only offered once the player has been kind (disposition >= 2).
        {
          id: 'secret',
          tone: 'positive',
          label: 'tell me your secret.',
          requires: { minDisposition: 2 },
        },
        { id: 'bye', tone: 'neutral', label: 'farewell.' },
      ],
    },
    curt_reply: { npcLine: 'nothing, then.', choices: [] },
    rude_reply: {
      npcLine: 'as you say.',
      choices: [
        // A "make amends" branch that only appears once you have been rude.
        {
          id: 'sorry',
          tone: 'positive',
          label: 'apologies.',
          requires: { hasFlag: 'was_rude' },
          next: 'start',
        },
      ],
    },
  },
};

describe('npc_dialog_tree_view: root + node lookup', () => {
  it('resolves the root node', () => {
    expect(dialogRootNode(TREE)?.npcLine).toBe('well met, friend.');
  });

  it('returns null for a malformed root', () => {
    expect(dialogRootNode({ root: 'missing', nodes: {} })).toBeNull();
  });
});

describe('npc_dialog_tree_view: choices per node', () => {
  it('offers every ungated choice at the root', () => {
    const ids = dialogChoicesAt(TREE, 'start', NEUTRAL_DIALOG_STATE).map((c) => c.id);
    expect(ids).toEqual(['warm', 'curt', 'rude']);
  });

  it('returns no choices at a terminal node', () => {
    expect(dialogChoicesAt(TREE, 'curt_reply', NEUTRAL_DIALOG_STATE)).toEqual([]);
  });

  it('returns no choices for an unknown node', () => {
    expect(dialogChoicesAt(TREE, 'nope', NEUTRAL_DIALOG_STATE)).toEqual([]);
  });
});

describe('npc_dialog_tree_view: gating', () => {
  it('hides a disposition-gated choice below the threshold', () => {
    const ids = dialogChoicesAt(TREE, 'warm_reply', NEUTRAL_DIALOG_STATE).map((c) => c.id);
    expect(ids).toEqual(['bye']);
  });

  it('reveals it once disposition is high enough', () => {
    const state = { disposition: 3, flags: new Set<string>() };
    const ids = dialogChoicesAt(TREE, 'warm_reply', state).map((c) => c.id);
    expect(ids).toEqual(['secret', 'bye']);
  });

  it('gates a flag-required choice on the flag being present', () => {
    expect(dialogChoicesAt(TREE, 'rude_reply', NEUTRAL_DIALOG_STATE)).toEqual([]);
    const state = { disposition: -1, flags: new Set(['was_rude']) };
    expect(dialogChoicesAt(TREE, 'rude_reply', state).map((c) => c.id)).toEqual(['sorry']);
  });

  it('evaluates each gate condition (min/max/has/lacks)', () => {
    const kind = { disposition: 5, flags: new Set(['a']) };
    expect(dialogGateAllows(undefined, kind)).toBe(true);
    expect(dialogGateAllows({ minDisposition: 3 }, kind)).toBe(true);
    expect(dialogGateAllows({ minDisposition: 6 }, kind)).toBe(false);
    expect(dialogGateAllows({ maxDisposition: 5 }, kind)).toBe(true);
    expect(dialogGateAllows({ maxDisposition: 4 }, kind)).toBe(false);
    expect(dialogGateAllows({ hasFlag: 'a' }, kind)).toBe(true);
    expect(dialogGateAllows({ hasFlag: 'b' }, kind)).toBe(false);
    expect(dialogGateAllows({ lacksFlag: 'b' }, kind)).toBe(true);
    expect(dialogGateAllows({ lacksFlag: 'a' }, kind)).toBe(false);
  });
});

describe('npc_dialog_tree_view: choice resolution + advance', () => {
  it('resolves an offered choice by id', () => {
    expect(dialogChoiceById(TREE, 'start', 'warm', NEUTRAL_DIALOG_STATE)?.id).toBe('warm');
  });

  it('rejects an unknown or gated-away choice id', () => {
    expect(dialogChoiceById(TREE, 'start', 'nope', NEUTRAL_DIALOG_STATE)).toBeNull();
    expect(dialogChoiceById(TREE, 'warm_reply', 'secret', NEUTRAL_DIALOG_STATE)).toBeNull();
  });

  it('advances to the choice target, or null when the choice ends the conversation', () => {
    const warm = dialogChoiceById(TREE, 'start', 'warm', NEUTRAL_DIALOG_STATE)!;
    expect(dialogAdvance(warm)).toBe('warm_reply');
    const bye = dialogChoiceById(TREE, 'warm_reply', 'bye', NEUTRAL_DIALOG_STATE)!;
    expect(dialogAdvance(bye)).toBeNull();
  });
});
