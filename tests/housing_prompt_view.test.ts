import { describe, expect, it } from 'vitest';
import { housingPromptView } from '../src/ui/housing_prompt_view';
import type { HousingInfo } from '../src/world_api/housing';

const housing: HousingInfo = {
  origin: { x: 0, z: 0 },
  plots: [{ plotId: 'p1', x: 0, z: 0, rot: 0, ownerName: 'Faddick', mine: false, objects: [] }],
};

describe('housingPromptView', () => {
  it('hides when no plot is nearby', () => {
    expect(housingPromptView(null, housing)).toEqual({ visible: false, text: '' });
  });

  it('prompts to claim an unclaimed plot', () => {
    const view = housingPromptView({ plotId: 'p1', claimed: false, mine: false }, housing);
    expect(view.visible).toBe(true);
    expect(view.text).toBe('Claim this plot');
  });

  it("prompts to manage the viewer's own plot", () => {
    const view = housingPromptView({ plotId: 'p1', claimed: true, mine: true }, housing);
    expect(view.visible).toBe(true);
    expect(view.text).toBe('Manage your homestead');
  });

  it("names the owner when visiting someone else's plot", () => {
    const view = housingPromptView({ plotId: 'p1', claimed: true, mine: false }, housing);
    expect(view.visible).toBe(true);
    expect(view.text).toBe("Visit Faddick's home");
  });
});
