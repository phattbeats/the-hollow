// GW1 build system, Multiclass A (PHAA-462): secondary profession data model +
// persistence. Covers abilitiesKnownAt merging a secondary class's kit in at
// its own normal learn levels (Tyler-Ask: druid forms must merge intact when
// druid is secondary), PlayerMeta/CharacterState back-compat load, and the
// IWorld secondaryCls seam parity between Sim and ClientWorld.

import { describe, expect, it } from 'vitest';
import { abilitiesKnownAt, CLASSES } from '../src/sim/content/classes';
import { Sim } from '../src/sim/sim';
import { clearFiestaAugments, fiestaRestoreChar } from '../src/sim/social/fiesta';

function makeWorld() {
  return new Sim({ seed: 7, playerClass: 'warrior', noPlayer: true });
}

describe('abilitiesKnownAt secondary-class merge', () => {
  it('merges a secondary class kit in at its own learn levels alongside the primary', () => {
    const level = 10;
    const primaryOnly = abilitiesKnownAt('warrior', level);
    const merged = abilitiesKnownAt('warrior', level, undefined, 'mage');
    const primaryIds = new Set(primaryOnly.map((k) => k.def.id));
    const mergedIds = new Set(merged.map((k) => k.def.id));
    for (const id of primaryIds) expect(mergedIds.has(id)).toBe(true);
    // Every mage ability learnable by `level` should show up in the merge too.
    for (const id of CLASSES.mage.abilities) {
      const def = merged.find((k) => k.def.id === id);
      const mageOnly = abilitiesKnownAt('mage', level).find((k) => k.def.id === id);
      if (mageOnly) expect(def).toBeTruthy();
    }
  });

  it('druid forms merge intact when druid is the secondary class', () => {
    const level = 30;
    const merged = abilitiesKnownAt('warrior', level, undefined, 'druid');
    const mergedIds = new Set(merged.map((k) => k.def.id));
    expect(mergedIds.has('bear_form')).toBe(true);
    expect(mergedIds.has('cat_form')).toBe(true);
    expect(mergedIds.has('travel_form')).toBe(true);
  });

  it('secondary abilities stay level-gated at their own learn level, not granted early', () => {
    const lowLevel = 1;
    const merged = abilitiesKnownAt('warrior', lowLevel, undefined, 'druid');
    const mergedIds = new Set(merged.map((k) => k.def.id));
    // bear_form has a learnLevel above 1 in the druid kit; it must not appear yet.
    const bearForm = CLASSES.druid.abilities.includes('bear_form');
    expect(bearForm).toBe(true);
    expect(mergedIds.has('bear_form')).toBe(false);
  });

  it('a class set as its own secondary is a no-op (no duplicate abilities)', () => {
    const level = 20;
    const merged = abilitiesKnownAt('warrior', level, undefined, 'warrior');
    const primaryOnly = abilitiesKnownAt('warrior', level);
    expect(merged.map((k) => k.def.id)).toEqual(primaryOnly.map((k) => k.def.id));
  });

  it('no secondary class (null/undefined) behaves exactly like before', () => {
    const level = 25;
    const withNull = abilitiesKnownAt('priest', level, undefined, null);
    const withUndefined = abilitiesKnownAt('priest', level);
    expect(withNull.map((k) => k.def.id)).toEqual(withUndefined.map((k) => k.def.id));
  });
});

describe('secondaryCls persistence (PlayerMeta / CharacterState)', () => {
  it('defaults to null for a fresh character', () => {
    const sim = makeWorld();
    const pid = sim.addPlayer('warrior', 'Fresh');
    expect(sim.meta(pid)!.secondaryCls).toBeNull();
    expect(sim.serializeCharacter(pid)!.secondaryCls).toBeNull();
  });

  it('round-trips through serializeCharacter -> addPlayer({state})', () => {
    const sim = makeWorld();
    const pid = sim.addPlayer('warrior', 'MultiClasser');
    sim.setPlayerLevel(20, pid);
    sim.meta(pid)!.secondaryCls = 'druid';
    const state = sim.serializeCharacter(pid)!;
    expect(state.secondaryCls).toBe('druid');

    const sim2 = makeWorld();
    const pid2 = sim2.addPlayer('warrior', 'MultiClasser', { state });
    expect(sim2.meta(pid2)!.secondaryCls).toBe('druid');
    const known = sim2.meta(pid2)!.known.map((k) => k.def.id);
    expect(known).toContain('bear_form');
  });

  it('a legacy save with no secondaryCls field loads with null (back-compat)', () => {
    const sim = makeWorld();
    const pid = sim.addPlayer('warrior', 'Legacy');
    const full = sim.serializeCharacter(pid)!;
    const legacy: Record<string, unknown> = { ...full };
    delete legacy.secondaryCls;

    const sim2 = makeWorld();
    const pid2 = sim2.addPlayer('warrior', 'Legacy', { state: legacy as never });
    expect(sim2.meta(pid2)!.secondaryCls).toBeNull();
    expect(() => sim2.serializeCharacter(pid2)).not.toThrow();
  });

  it('exposes secondaryCls through the IWorldTalents seam on the offline Sim', () => {
    const sim = makeWorld();
    const pid = sim.addPlayer('warrior', 'Seamed');
    expect(sim.secondaryCls).toBeNull();
    sim.meta(pid)!.secondaryCls = 'mage';
    expect(sim.secondaryCls).toBe('mage');
  });
});

describe('secondaryCls survives Ashen Coliseum 2v2 Fiesta rebuilds', () => {
  it('clearFiestaAugments keeps the secondary kit in meta.known', () => {
    const sim = makeWorld();
    const pid = sim.addPlayer('warrior', 'Fiestagoer');
    sim.setPlayerLevel(30, pid);
    const meta = sim.meta(pid)!;
    meta.secondaryCls = 'druid';
    meta.fiestaAugments = ['dummy_augment']; // any non-empty value so the early return is skipped
    const e = sim.entities.get(meta.entityId)!;
    clearFiestaAugments(meta, e);
    expect(meta.known.map((k) => k.def.id)).toContain('bear_form');
  });

  it('fiestaRestoreChar keeps the secondary kit in meta.known after a bout ends', () => {
    const sim = makeWorld();
    const pid = sim.addPlayer('warrior', 'Fiestagoer2');
    sim.setPlayerLevel(30, pid);
    const meta = sim.meta(pid)!;
    meta.secondaryCls = 'druid';
    meta.fiestaRestore = { level: 30, xp: meta.xp, talents: meta.talents };
    const e = sim.entities.get(meta.entityId)!;
    fiestaRestoreChar(meta, e);
    expect(meta.known.map((k) => k.def.id)).toContain('bear_form');
  });
});
