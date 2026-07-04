import { describe, expect, it } from 'vitest';
import { ABILITIES, CLASSES } from '../src/sim/content/classes';
import type { PlayerClass } from '../src/sim/types';
import { CLASS_DETAILS, classPairLabel, SIGNATURE_ABILITIES } from '../src/ui/class_details_data';

// Guards the hand-maintained character-select showcase data against drift from
// the sim's source of truth. If a class's ability kit or roster changes, these
// assertions force the showcase metadata to be updated in the same change.

const classIds = Object.keys(CLASSES) as PlayerClass[];

describe('character-select class details parity', () => {
  it('covers every playable class exactly once', () => {
    for (const cls of classIds) {
      expect(CLASS_DETAILS[cls], `missing CLASS_DETAILS for ${cls}`).toBeTruthy();
      expect(SIGNATURE_ABILITIES[cls], `missing SIGNATURE_ABILITIES for ${cls}`).toBeTruthy();
    }
    expect(Object.keys(CLASS_DETAILS).sort()).toEqual([...classIds].sort());
    expect(Object.keys(SIGNATURE_ABILITIES).sort()).toEqual([...classIds].sort());
  });

  for (const cls of classIds) {
    describe(cls, () => {
      const picks = SIGNATURE_ABILITIES[cls];

      it('lists three signature abilities', () => {
        expect(picks).toHaveLength(3);
        expect(new Set(picks).size).toBe(3); // no duplicates
      });

      for (const id of picks) {
        it(`"${id}" is a real ability that ${cls} can learn`, () => {
          const ability = ABILITIES[id];
          expect(ability, `ability "${id}" does not exist`).toBeTruthy();
          expect(ability.class, `"${id}" belongs to ${ability?.class}, not ${cls}`).toBe(cls);
          expect(
            CLASSES[cls].abilities,
            `"${id}" is not in ${cls}'s learnable ability list`,
          ).toContain(id);
        });
      }
    });
  }
});

// PHAA-465: the charselect showcase reads "Primary / Secondary" once a
// character has picked a secondary profession at a trainer.
describe('classPairLabel (Primary / Secondary charselect labels)', () => {
  it('renders just the primary class when there is no secondary', () => {
    const label = classPairLabel('warrior', null);
    expect(label).not.toContain('/');
    expect(label.length).toBeGreaterThan(0);
  });

  it('renders "primary / secondary" when a secondary is set', () => {
    const primaryOnly = classPairLabel('warrior', null);
    const paired = classPairLabel('warrior', 'priest');
    expect(paired).toContain(primaryOnly);
    expect(paired).toContain('/');
    expect(paired).not.toBe(primaryOnly);
  });

  it('never mixes up which slot is primary vs secondary', () => {
    expect(classPairLabel('warrior', 'priest')).not.toBe(classPairLabel('priest', 'warrior'));
  });
});
