import { describe, expect, it } from 'vitest';
import { HOLLOW_HOUSE_OBJECT_KINDS } from '../src/sim/content/hollow';
import { buildHousingWindowView } from '../src/ui/housing_view';

describe('buildHousingWindowView', () => {
  it('reports every slot empty when the plot has no decor', () => {
    const view = buildHousingWindowView(4, []);
    expect(view.slots).toEqual([
      { slot: 0, kind: null },
      { slot: 1, kind: null },
      { slot: 2, kind: null },
      { slot: 3, kind: null },
    ]);
    expect(view.kinds).toEqual(HOLLOW_HOUSE_OBJECT_KINDS);
  });

  it('fills in occupied slots by their decor kind', () => {
    const view = buildHousingWindowView(4, [
      { slot: 1, kind: 'lantern' },
      { slot: 3, kind: 'bench' },
    ]);
    expect(view.slots).toEqual([
      { slot: 0, kind: null },
      { slot: 1, kind: 'lantern' },
      { slot: 2, kind: null },
      { slot: 3, kind: 'bench' },
    ]);
  });

  it('drops an object whose kind is not in the known catalog (a newer/older server)', () => {
    const view = buildHousingWindowView(2, [{ slot: 0, kind: 'throne' }]);
    expect(view.slots).toEqual([
      { slot: 0, kind: null },
      { slot: 1, kind: null },
    ]);
  });
});
