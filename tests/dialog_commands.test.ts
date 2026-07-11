// Tests for the server-authoritative dialogue resolver (PHAA-553): the pure
// consequence logic (disposition nudge, flags, gate rejection), the
// serialize/load round trip, and end-to-end persistence through the real Sim
// character save/load wiring.

import { describe, expect, it } from 'vitest';
import {
  applyDialogChoice,
  freshDialogState,
  loadDialogState,
  serializeDialogState,
} from '../src/sim/dialog/dialog_commands';
import { Sim } from '../src/sim/sim';
import type { DialogChoiceDef } from '../src/sim/types';

const warm: DialogChoiceDef = {
  id: 'warm',
  tone: 'positive',
  label: 'x',
  effect: { disposition: 3 },
};
const cold: DialogChoiceDef = {
  id: 'cold',
  tone: 'negative',
  label: 'x',
  effect: { disposition: -4 },
};
const flagged: DialogChoiceDef = {
  id: 'promise',
  tone: 'positive',
  label: 'x',
  effect: { setFlag: 'gp.promised' },
};
const flavor: DialogChoiceDef = { id: 'chat', tone: 'neutral', label: 'x' };
const gated: DialogChoiceDef = {
  id: 'secret',
  tone: 'positive',
  label: 'x',
  requires: { minDisposition: 5 },
  effect: { disposition: 1 },
};

describe('applyDialogChoice: consequence', () => {
  it('nudges disposition toward the npc and reports it applied', () => {
    const s = freshDialogState();
    expect(applyDialogChoice(s, 'greenpaw', warm)).toBe(true);
    expect(s.disposition.get('greenpaw')).toBe(3);
    applyDialogChoice(s, 'greenpaw', warm);
    expect(s.disposition.get('greenpaw')).toBe(6);
  });

  it('keeps disposition per-npc (a nudge to one never touches another)', () => {
    const s = freshDialogState();
    applyDialogChoice(s, 'greenpaw', warm);
    applyDialogChoice(s, 'zebediah', cold);
    expect(s.disposition.get('greenpaw')).toBe(3);
    expect(s.disposition.get('zebediah')).toBe(-4);
  });

  it('clamps disposition to the [-10, 10] band', () => {
    const s = freshDialogState();
    for (let i = 0; i < 10; i++) applyDialogChoice(s, 'g', warm);
    expect(s.disposition.get('g')).toBe(10);
    for (let i = 0; i < 10; i++) applyDialogChoice(s, 'g', cold);
    expect(s.disposition.get('g')).toBe(-10);
  });

  it('sets a persistent flag', () => {
    const s = freshDialogState();
    expect(applyDialogChoice(s, 'g', flagged)).toBe(true);
    expect(s.flags.has('gp.promised')).toBe(true);
  });

  it('does nothing for a pure-flavor choice (no effect)', () => {
    const s = freshDialogState();
    expect(applyDialogChoice(s, 'g', flavor)).toBe(false);
    expect(s.disposition.size).toBe(0);
    expect(s.flags.size).toBe(0);
  });

  it('rejects a choice whose gate is unmet, applying nothing', () => {
    const s = freshDialogState();
    expect(applyDialogChoice(s, 'g', gated)).toBe(false);
    expect(s.disposition.get('g')).toBeUndefined();
    // Warm up past the gate, then it applies.
    applyDialogChoice(s, 'g', warm);
    applyDialogChoice(s, 'g', warm); // disposition 6 >= 5
    expect(applyDialogChoice(s, 'g', gated)).toBe(true);
    expect(s.disposition.get('g')).toBe(7);
  });
});

describe('serializeDialogState / loadDialogState', () => {
  it('round-trips disposition and flags', () => {
    const s = freshDialogState();
    s.disposition.set('greenpaw', 4);
    s.disposition.set('zebediah', -2);
    s.flags.add('gp.promised');
    const save = serializeDialogState(s);
    expect(save).toEqual({ disposition: { greenpaw: 4, zebediah: -2 }, flags: ['gp.promised'] });
    const back = loadDialogState(save);
    expect(back.disposition.get('greenpaw')).toBe(4);
    expect(back.disposition.get('zebediah')).toBe(-2);
    expect(back.flags.has('gp.promised')).toBe(true);
  });

  it('loads an empty default from an absent save (back-compat)', () => {
    const s = loadDialogState(undefined);
    expect(s.disposition.size).toBe(0);
    expect(s.flags.size).toBe(0);
  });

  it('drops malformed entries and clamps out-of-band disposition on load', () => {
    const s = loadDialogState({
      disposition: { good: 99, bad: Number.NaN, worse: -99 } as Record<string, number>,
      flags: ['ok', 123 as unknown as string],
    });
    expect(s.disposition.get('good')).toBe(10);
    expect(s.disposition.has('bad')).toBe(false);
    expect(s.disposition.get('worse')).toBe(-10);
    expect([...s.flags]).toEqual(['ok']);
  });
});

describe('dialog state persists through the real Sim save/load', () => {
  it('serializeCharacter writes dialogState and addPlayer restores it', () => {
    const sim = new Sim({ seed: 42, playerClass: 'warrior', autoEquip: false });
    const meta = sim.meta(sim.playerId)!;
    meta.dialogState.disposition.set('brother_greenpaw', 5);
    meta.dialogState.flags.add('gp.promised_fuel');

    const state = sim.serializeCharacter(sim.playerId)!;
    expect(state.dialogState).toEqual({
      disposition: { brother_greenpaw: 5 },
      flags: ['gp.promised_fuel'],
    });

    const sim2 = new Sim({ seed: 42, playerClass: 'warrior', autoEquip: false });
    const pid2 = sim2.addPlayer('warrior', 'Saved', { state });
    const restored = sim2.dialogState(pid2);
    expect(restored.disposition.brother_greenpaw).toBe(5);
    expect(restored.flags).toEqual(['gp.promised_fuel']);
  });

  it('a pre-PHAA-553 save with no dialogState loads clean', () => {
    const sim = new Sim({ seed: 7, playerClass: 'mage', autoEquip: false });
    const state = sim.serializeCharacter(sim.playerId)!;
    delete state.dialogState; // simulate a legacy save
    const sim2 = new Sim({ seed: 7, playerClass: 'mage', autoEquip: false });
    const pid2 = sim2.addPlayer('mage', 'Legacy', { state });
    expect(sim2.dialogState(pid2)).toEqual({ disposition: {}, flags: [] });
  });
});

// The ctx-level dialogChoose entry over a real Sim + Greenpaw entity: it resolves
// the choice from the authoritative NPC tree, range-checks against the speaking
// entity, and applies the effect. The pure applyDialogChoice / persistence are
// covered above; these exercise the thin ctx wrapper's rejection paths.
function findGreenpaw(sim: Sim) {
  return [...sim.entities.values()].find(
    (e) => e.kind === 'npc' && e.templateId === 'brother_greenpaw',
  )!;
}

function standAtGreenpaw(sim: Sim, pid: number): void {
  sim.enterDungeon('the_hollow', pid);
  const greenpaw = findGreenpaw(sim);
  const e = sim.entities.get(pid)!;
  e.pos = { ...greenpaw.pos };
  e.prevPos = { ...e.pos };
}

describe('dialogChoose: ctx entry over a real Sim', () => {
  it("applies a real choice's effect when the player is in range", () => {
    const sim = new Sim({ seed: 1, playerClass: 'warrior', autoEquip: false });
    const pid = sim.playerId;
    standAtGreenpaw(sim, pid);
    // 'kind' at the root carries a +2 disposition nudge.
    sim.dialogChoose('brother_greenpaw', 'kind', pid);
    expect(sim.dialogState(pid).disposition.brother_greenpaw).toBe(2);
  });

  it('sets a real flag choice', () => {
    const sim = new Sim({ seed: 1, playerClass: 'warrior', autoEquip: false });
    const pid = sim.playerId;
    standAtGreenpaw(sim, pid);
    // 'tribe' (in the warmed node) sets greenpaw.asked_tribe.
    sim.dialogChoose('brother_greenpaw', 'tribe', pid);
    expect(sim.dialogState(pid).flags).toContain('greenpaw.asked_tribe');
  });

  it('rejects a choice when the player is out of range', () => {
    const sim = new Sim({ seed: 1, playerClass: 'warrior', autoEquip: false });
    const pid = sim.playerId;
    standAtGreenpaw(sim, pid);
    const e = sim.entities.get(pid)!;
    e.pos = { x: e.pos.x + 100, y: e.pos.y, z: e.pos.z };
    sim.dialogChoose('brother_greenpaw', 'kind', pid);
    expect(sim.dialogState(pid).disposition.brother_greenpaw).toBeUndefined();
  });

  it('no-ops (no throw) on an unknown npc id', () => {
    const sim = new Sim({ seed: 1, playerClass: 'warrior', autoEquip: false });
    const pid = sim.playerId;
    standAtGreenpaw(sim, pid);
    expect(() => sim.dialogChoose('nobody_here', 'kind', pid)).not.toThrow();
    expect(sim.dialogState(pid).disposition).toEqual({});
  });

  it('no-ops on an unknown choice id', () => {
    const sim = new Sim({ seed: 1, playerClass: 'warrior', autoEquip: false });
    const pid = sim.playerId;
    standAtGreenpaw(sim, pid);
    sim.dialogChoose('brother_greenpaw', 'no_such_choice', pid);
    expect(sim.dialogState(pid).disposition).toEqual({});
    expect(sim.dialogState(pid).flags).toEqual([]);
  });
});
