// Pure view-model coverage for the Player Info card (PHAA-711's "View Profile
// outside interest range" fallback, PHAA-821 follow-up). DOM-free: no fetch,
// no hud.ts, drives buildPlayerInfoCardViewModel directly.
import { describe, expect, it } from 'vitest';
import {
  buildPlayerInfoCardViewModel,
  type PublicCharacterSheet,
} from '../src/ui/player_info_card_view';

const BASE_SHEET: PublicCharacterSheet = {
  name: 'Aria',
  class: 'mage',
  level: 42,
  skin: 3,
  guild: null,
};

describe('buildPlayerInfoCardViewModel', () => {
  it('maps name/class/skin straight through and formats a level+class meta line', () => {
    const vm = buildPlayerInfoCardViewModel(BASE_SHEET);
    expect(vm.name).toBe('Aria');
    expect(vm.cls).toBe('mage');
    expect(vm.skin).toBe(3);
    expect(vm.metaLine).toContain('42');
    expect(vm.metaLine.toLowerCase()).toContain('mage');
  });

  it('guildLine is null when the sheet carries no guild (no guild row rendered)', () => {
    const vm = buildPlayerInfoCardViewModel(BASE_SHEET);
    expect(vm.guildLine).toBeNull();
  });

  it('guildLine carries the guild name through verbatim when present', () => {
    const vm = buildPlayerInfoCardViewModel({ ...BASE_SHEET, guild: 'Ashen Vale' });
    expect(vm.guildLine).toBe('Ashen Vale');
  });

  // The public sheet endpoint's own documented contract is gear/wallet/position-free
  // (server/character_sheet.ts 'public' visibility), but that is enforced server-side,
  // not by this client type. Since a JSON response is untyped at the fetch boundary,
  // pin that the view model only ever reads the 5 named fields and cannot forward
  // extra keys through to the card, even if a future/misbehaving response widened
  // the payload to include them.
  it('never forwards extra fields (gear/wallet/position) from an over-wide sheet payload', () => {
    const overWideSheet = {
      ...BASE_SHEET,
      gear: [{ slot: 'mainhand', itemId: 'sword_of_a_thousand_truths' }],
      wallet: { copper: 999_999 },
      pos: { x: 12, y: 0, z: 34 },
    } as unknown as PublicCharacterSheet;

    const vm = buildPlayerInfoCardViewModel(overWideSheet);
    expect(Object.keys(vm).sort()).toEqual(['cls', 'guildLine', 'metaLine', 'name', 'skin'].sort());
    const serialized = JSON.stringify(vm);
    expect(serialized).not.toMatch(/gear|wallet|thousand_truths|999999/i);
  });
});
