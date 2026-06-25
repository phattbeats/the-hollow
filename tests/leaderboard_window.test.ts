// WCAG-chrome + no-magic source guard for the leaderboard window DOM painter.
//
// The painter's DOM/async methods need a document + a resolved Promise, so they are
// not exercised in this Node suite; the pure decisions it renders are covered by
// tests/leaderboard_view.test.ts. This guard pins the a11y-bearing markup (real
// close button + the loading live region + focus-return) and the decision-12
// contract for a DOM painter (no literal colors in TS; the page size is a named
// constant).

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const src = readFileSync(new URL('../src/ui/leaderboard_window.ts', import.meta.url), 'utf8');
const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('leaderboard_window: WCAG chrome (live region + focusable controls + focus-return)', () => {
  it('drives the panel from the pure view core', () => {
    expect(code).toContain('buildLeaderboardView(');
  });

  it('gives the close control a real button with an aria-label', () => {
    expect(code).toContain('class="x-btn" data-close aria-label=');
    expect(code).toContain("t('hudChrome.leaderboard.close')");
  });

  it('marks the in-flight loading state as a live region (aria-busy + role=status)', () => {
    expect(code).toContain('role="status" aria-busy="true"');
    expect(code).toContain("t('game.leaderboard.loading')");
  });

  it('renders the rejection/offline error as an alert with the localized retry copy', () => {
    expect(code).toContain('role="alert"');
    expect(code).toContain("t('game.leaderboard.retry')");
  });

  it('renders the dialog role + labelledby for the window', () => {
    expect(code).toContain("setAttribute('role', 'dialog')");
    expect(code).toContain("setAttribute('aria-labelledby', 'leaderboard-title')");
    expect(code).toContain('id="leaderboard-title"');
  });

  it('renders the pager controls as real buttons', () => {
    expect(code).toContain('class="lb-page-btn" data-leaderboard-page="prev"');
    expect(code).toContain('class="lb-page-btn" data-leaderboard-page="next"');
  });

  it('captures + restores the opener focus on open/close (WCAG 2.2 AA focus-return)', () => {
    expect(code).toContain('this.openerFocus = this.deps.captureFocus()');
    expect(code).toContain('this.deps.restoreFocus(this.openerFocus)');
  });

  it('escapes the server-supplied player names before interpolating them into HTML', () => {
    // Names are server-validated, but the src/ui invariant routes all player text
    // through esc(); match the sibling questlog painter (no raw-name innerHTML).
    expect(code).toContain('${esc(r.name)}');
    expect(code).toContain('${esc(standing.name)}');
    expect(code).not.toMatch(/\$\{r\.name\}/);
    expect(code).not.toMatch(/\$\{standing\.name\}/);
  });
});

describe('leaderboard_window: no magic values (decision 12, DOM painter)', () => {
  it('carries no literal hex or rgb color in TS (colors live in the stylesheet)', () => {
    const hex = code.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
    const rgb = code.match(/\brgba?\s*\(/g) ?? [];
    expect(hex, `hex colors: ${hex.join(', ')}`).toEqual([]);
    expect(rgb, `rgb colors: ${rgb.join(', ')}`).toEqual([]);
  });

  it('carries no literal em dash in source (the sticky-rank placeholder is an entity)', () => {
    expect(src.includes('—'), 'em dash found').toBe(false);
  });

  it('names the page size instead of an inline literal', () => {
    expect(code).toContain('LEADERBOARD_PAGE_SIZE');
    expect(code).not.toContain(', 50)');
  });
});
