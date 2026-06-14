import { describe, expect, it } from 'vitest';
import { placeAbilityOnSlot, clearSlot } from '../src/ui/hotbar';

describe('hotbar ability placement', () => {
  it('places a spellbook ability onto the target action slot', () => {
    const slots = ['fireball', 'frost_armor', 'arcane_intellect', null];

    const next = placeAbilityOnSlot(slots, 'polymorph', 1);

    expect(next).toEqual(['fireball', 'polymorph', 'arcane_intellect', null]);
    expect(slots).toEqual(['fireball', 'frost_armor', 'arcane_intellect', null]); // immutable
  });

  it('replaces the occupied target slot when the bar is full (issue #97)', () => {
    const full = ['a', 'b', 'c', 'd'];

    // a freshly learned spell ("ice_barrier") dropped onto slot 2 evicts 'c'
    const next = placeAbilityOnSlot(full, 'ice_barrier', 2);

    expect(next).toEqual(['a', 'b', 'ice_barrier', 'd']);
  });

  it('swaps instead of duplicating when the ability is already on the bar', () => {
    const slots = ['fireball', 'frost_armor', 'arcane_intellect', null];

    const next = placeAbilityOnSlot(slots, 'arcane_intellect', 0);

    expect(next).toEqual(['arcane_intellect', 'frost_armor', 'fireball', null]);
  });

  it('is a no-op when dropping onto the slot it already occupies', () => {
    const slots = ['fireball', 'frost_armor', null];
    expect(placeAbilityOnSlot(slots, 'fireball', 0)).toEqual(slots);
  });

  it('clears a slot so a full bar can make room (issue #97)', () => {
    const full = ['a', 'b', 'c', 'd'];

    const next = clearSlot(full, 1);

    expect(next).toEqual(['a', null, 'c', 'd']);
    expect(full).toEqual(['a', 'b', 'c', 'd']); // immutable
  });

  it('ignores out-of-range indices', () => {
    const slots = ['a', 'b'];
    expect(placeAbilityOnSlot(slots, 'x', 5)).toEqual(slots);
    expect(clearSlot(slots, -1)).toEqual(slots);
  });
});
