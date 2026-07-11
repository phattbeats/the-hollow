// Thin painter for the world-readable interact prompt. The pure model lives in
// readable_prompt_view.ts; this only flips #readable-prompt's text/display,
// routed through the elided writer facet like every other per-frame painter.
// Mirrors housing_prompt_painter.ts.

import type { PainterHostWriters } from './painter_host';
import type { ReadablePromptView } from './readable_prompt_view';

export class ReadablePromptPainter {
  constructor(
    private readonly writers: PainterHostWriters,
    private readonly el: HTMLElement, // #readable-prompt
  ) {}

  paint(view: ReadablePromptView): void {
    this.writers.setDisplay(this.el, view.visible ? 'block' : 'none');
    if (view.visible) this.writers.setText(this.el, view.text);
  }
}
