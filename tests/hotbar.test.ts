import { describe, expect, it } from 'vitest';
import { clearHotbarSlot, placeAbilityOnSlot, syncHotbarSlotMap } from '../src/ui/hotbar';

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
});

describe('hotbar slot clearing', () => {
  it('clears an occupied slot', () => {
    const slotMap = ['fireball', 'frostbolt', null];

    expect(clearHotbarSlot(slotMap, 1)).toEqual(['fireball', null, null]);
  });

  it('leaves an empty slot stable', () => {
    const slotMap = ['fireball', null, 'blink'];

    expect(clearHotbarSlot(slotMap, 1)).toEqual(['fireball', null, 'blink']);
  });

  it('does not mutate the input array', () => {
    const slotMap = ['fireball', 'frostbolt', null];

    clearHotbarSlot(slotMap, 1);

    expect(slotMap).toEqual(['fireball', 'frostbolt', null]);
  });

  it('ignores out-of-range slots', () => {
    const slotMap = ['fireball', 'frostbolt', null];

    expect(clearHotbarSlot(slotMap, -1)).toEqual(slotMap);
    expect(clearHotbarSlot(slotMap, 3)).toEqual(slotMap);
  });
});

describe('hotbar slot sync', () => {
  it('preserves a missing already-known ability as a cleared slot', () => {
    const slots = ['fireball', null, 'blink'];

    expect(syncHotbarSlotMap(slots, ['fireball', 'frostbolt', 'blink'], new Set())).toEqual(slots);
  });

  it('places a newly learned ability into the first empty slot', () => {
    const slots = ['fireball', null, 'blink'];

    expect(syncHotbarSlotMap(slots, ['fireball', 'frostbolt', 'blink'], new Set(['frostbolt']))).toEqual([
      'fireball',
      'frostbolt',
      'blink',
    ]);
  });

  it('drops abilities that are no longer known', () => {
    const slots = ['fireball', 'frostbolt', 'blink'];

    expect(syncHotbarSlotMap(slots, ['fireball', 'blink'], new Set())).toEqual(['fireball', null, 'blink']);
  });
});
