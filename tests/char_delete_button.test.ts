import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { deleteCharButtonHtml } from '../src/ui/char_delete_button';

const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
const shell = readFileSync(new URL('../src/styles/shell.css', import.meta.url), 'utf8');

describe('quiet character delete control', () => {
  it('is an icon-only control with an accessible name, not a danger CTA', () => {
    const html = deleteCharButtonHtml(false);
    expect(html).toContain('<svg');
    expect(html).toContain('aria-label=');
    expect(html).toContain('char-delete-btn');
    expect(html).not.toContain('btn-danger');
  });

  it('renders after the primary action in every character row', () => {
    const lines = main
      .split('\n')
      .filter((line) => line.includes('deleteCharButtonHtml(') && line.includes('char-actions'));
    expect(lines).toHaveLength(3);
    for (const primary of ['rename-btn', 'take-over-btn', 'enter-world-btn']) {
      const line = lines.find((candidate) => candidate.includes(primary));
      expect(line).toBeDefined();
      expect(line!.indexOf('deleteCharButtonHtml(')).toBeGreaterThan(line!.indexOf(primary));
    }
  });

  it('uses quiet styling and preserves the touch target floor', () => {
    const block = shell.slice(
      shell.indexOf('.char-delete-btn {'),
      shell.indexOf('.char-delete-btn .ui-icon'),
    );
    expect(block).toContain('background: transparent;');
    expect(block).toContain('border: 1px solid transparent;');
    const touch = shell.slice(shell.indexOf('body.mobile-touch .char-delete-btn {'));
    expect(touch.slice(0, 180)).toContain('width: 40px;');
    expect(touch.slice(0, 180)).toContain('height: 40px;');
  });
});
