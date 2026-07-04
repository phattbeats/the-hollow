// Pure derivation of the housing signpost interact prompt (PHAA-405 follow-up):
// while the player stands close enough to make the signpost glow
// (render/housing_proximity.ts), this decides the localized hint text
// ("Claim", "Manage your homestead", or "Visit <name>'s home"). DOM/Three-free
// so tests drive it directly against a plain NearbyHousingPlot + HousingInfo.

import type { HousingInfo } from '../world_api/housing';
import { t } from './i18n';

// Mirrors render/housing_proximity.ts's NearbyHousingPlot shape (not imported
// directly: src/ui pure cores stay render-free, see tests/architecture.test.ts).
export interface NearbyHousingPlot {
  plotId: string;
  claimed: boolean;
  mine: boolean;
}

export interface HousingPromptView {
  visible: boolean;
  text: string;
}

const HIDDEN: HousingPromptView = { visible: false, text: '' };

export function housingPromptView(
  near: NearbyHousingPlot | null,
  housing: HousingInfo | null,
): HousingPromptView {
  if (!near) return HIDDEN;
  if (!near.claimed) return { visible: true, text: t('housingUi.prompt.claim') };
  if (near.mine) return { visible: true, text: t('housingUi.prompt.manage') };
  const owner = housing?.plots.find((p) => p.plotId === near.plotId)?.ownerName ?? '';
  return { visible: true, text: t('housingUi.prompt.visit', { name: owner }) };
}
