import { describe, expect, it } from 'vitest';
import { CLASSES } from '../src/sim/content/classes';
import { placeAbilityOnSlot } from '../src/ui/hotbar';

describe('hotbar ability placement', () => {
  it('places a spellbook ability onto the target action slot', () => {
    const slots = ['fireball', 'frost_armor', 'arcane_intellect', null];

    const next = placeAbilityOnSlot(slots, 'polymorph', 1);

    expect(next).toEqual(['fireball', 'polymorph', 'arcane_intellect', null]);
    expect(slots).toEqual(['fireball', 'frost_armor', 'arcane_intellect', null]);
  });

  it('swaps instead of duplicating when the spellbook ability is already on the bar', () => {
    const slots = ['fireball', 'frost_armor', 'arcane_intellect', null];

    const next = placeAbilityOnSlot(slots, 'arcane_intellect', 0);

    expect(next).toEqual(['arcane_intellect', 'frost_armor', 'fireball', null]);
  });

  it('places the mage overflow spell onto a full non-Attack action bar', () => {
    const barSlots = 11;
    const mageAbilities = CLASSES.mage.abilities;
    const slots = mageAbilities.slice(0, barSlots);
    const targetIndex = 4;
    const displacedAbility = slots[targetIndex];

    expect(slots).toHaveLength(barSlots);
    expect(mageAbilities[barSlots]).toBe('ice_barrier');
    expect(slots).not.toContain('ice_barrier');

    const next = placeAbilityOnSlot(slots, 'ice_barrier', targetIndex);
    const occupied = next.filter((id) => id !== null);

    expect(next[targetIndex]).toBe('ice_barrier');
    expect(next).not.toContain(displacedAbility);
    expect(occupied).toHaveLength(barSlots);
    expect(new Set(occupied).size).toBe(occupied.length);
    expect(slots).toEqual(mageAbilities.slice(0, barSlots));
  });
});
