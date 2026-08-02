// Pure, host-agnostic view model for the Player Info card: the "View Profile"
// fallback for a player outside interest range (PHAA-711), fed by the public,
// unauthenticated GET /api/public/characters/:name/sheet endpoint.
//
// Scope is deliberately narrow: map the wire sheet to exactly the strings/ids
// renderPlayerInfoCard needs. It picks named fields rather than spreading the
// sheet, so even if a future server response widened the payload, this view
// model still cannot leak anything beyond name/class/skin/level/guild (in
// particular: no gear, wallet, or position, matching the endpoint's own
// documented public-visibility subset).
//
// DOM-free, Three-free, deterministic (registered in tests/architecture.test.ts
// UI_PURE_CORES); tests/player_info_card_view.test.ts drives it directly.

import type { PlayerClass } from '../sim/types';
import { classDisplayName } from './entity_i18n';
import { formatNumber, t } from './i18n';

// The safe subset GET /api/public/characters/:name/sheet returns
// (server/character_sheet.ts, visibility 'public'): no gear, wallet, or
// position. Declared here (not imported from server/) so the client bundle
// never pulls in server-only (Node/pg) code.
export interface PublicCharacterSheet {
  name: string;
  class: PlayerClass;
  level: number;
  skin: number;
  guild: string | null;
}

export interface PlayerInfoCardViewModel {
  name: string;
  cls: PlayerClass;
  skin: number;
  metaLine: string;
  guildLine: string | null;
}

export function buildPlayerInfoCardViewModel(sheet: PublicCharacterSheet): PlayerInfoCardViewModel {
  return {
    name: sheet.name,
    cls: sheet.class,
    skin: sheet.skin,
    metaLine: t('itemUi.equipment.levelClass', {
      level: formatNumber(sheet.level, { maximumFractionDigits: 0 }),
      className: classDisplayName(sheet.class),
    }),
    guildLine: sheet.guild,
  };
}
