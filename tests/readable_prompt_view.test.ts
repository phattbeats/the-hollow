import { describe, expect, it } from 'vitest';
import { readablePromptView } from '../src/ui/readable_prompt_view';

describe('readablePromptView', () => {
  it('hides when no book is nearby', () => {
    expect(readablePromptView(null)).toEqual({ visible: false, text: '' });
  });

  it('prompts to read when a book is in range', () => {
    const view = readablePromptView({ id: 'torn_ledger_page' });
    expect(view.visible).toBe(true);
    expect(view.text).toBe('Read');
  });
});
