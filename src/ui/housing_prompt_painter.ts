// Thin painter for the housing signpost interact prompt. The pure model lives
// in housing_prompt_view.ts; this only flips #housing-prompt's text/display,
// routed through the elided writer facet like every other per-frame painter.

import type { HousingPromptView } from './housing_prompt_view';
import type { PainterHostWriters } from './painter_host';

export class HousingPromptPainter {
  constructor(
    private readonly writers: PainterHostWriters,
    private readonly el: HTMLElement, // #housing-prompt
  ) {}

  paint(view: HousingPromptView): void {
    this.writers.setDisplay(this.el, view.visible ? 'block' : 'none');
    if (view.visible) this.writers.setText(this.el, view.text);
  }
}
