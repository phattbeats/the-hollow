// Pure derivation of the world-readable interact prompt (PHAA-552): while the
// player stands close enough to a world-placed book (render/readable_proximity.ts),
// show the localized "Read" hint. DOM/Three-free so tests drive it directly
// against a plain NearbyReadable. Mirrors housing_prompt_view.ts.

import { t } from './i18n';

// Mirrors render/readable_proximity.ts's NearbyReadable shape (not imported
// directly: src/ui pure cores stay render-free, see tests/architecture.test.ts).
export interface NearbyReadable {
  id: string;
}

export interface ReadablePromptView {
  visible: boolean;
  text: string;
}

const HIDDEN: ReadablePromptView = { visible: false, text: '' };

export function readablePromptView(near: NearbyReadable | null): ReadablePromptView {
  if (!near) return HIDDEN;
  return { visible: true, text: t('readableUi.prompt.read') };
}
