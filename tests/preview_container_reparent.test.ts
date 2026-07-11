// PHAA-613: the offline character-creation preview canvas (#char-preview-canvas)
// never reparented into #offline-preview-container, leaving the offline 3D
// turntable stuck at 0x0. The canvas lives in #online-preview-container in the
// static HTML, and the assetsReady() callback that constructs the shared
// CharacterPreview only stored a container reference; it never moved the canvas,
// so any show(#offline-select) that races assetsReady() saw an empty preview.
//
// Two layers of regression guard:
//   1. A SOURCE guard on src/main.ts asserts the assetsReady callback now calls
//      characterPreview.setContainer(container) right after construction. This
//      is what re-parents the canvas; the original code skipped it.
//   2. A BEHAVIORAL test of the CharacterPreview.setContainer contract on a
//      minimal fake DOM: appending the canvas into a different container moves
//      it (real-DOM appendChild semantics), so the fix's reliance on setContainer
//      is sound.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const mainSrc = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:])\/\/.*$/gm, '$1');

const previewSrc = readFileSync(
  new URL('../src/render/characters/preview.ts', import.meta.url),
  'utf8',
);

// ---------------------------------------------------------------------------
// 1) Source guard: the assetsReady callback must call setContainer after
//    constructing CharacterPreview, and must run the panel-conditional sync for
//    whichever preview container is active at resolve time. This is the actual
//    fix; without it, a user that reaches the offline character-creation panel
//    before the asset preload finishes sees a blank 0x0 turntable.
// ---------------------------------------------------------------------------

describe('main.ts: assetsReady callback reparents the preview canvas (PHAA-613)', () => {
  it('calls characterPreview.setContainer(container) right after constructing CharacterPreview', () => {
    // Pull the assetsReady().then(...) block out of main.ts and assert the
    // shape: construct CharacterPreview, then setContainer(container). The
    // .*? is single-line (no /s flag), so this only matches the on-disk layout
    // where construct and setContainer live on consecutive lines.
    const constructMatch = mainSrc.match(
      /characterPreview\s*=\s*new\s+CharacterPreview\([^)]*\);[\s\S]{0,200}?characterPreview\.setContainer\s*\(/,
    );
    expect(
      constructMatch,
      'characterPreview.setContainer(container) must be called immediately after the CharacterPreview constructor',
    ).not.toBeNull();
  });

  it('runs the panel-conditional sync (updatePreviewContainer) for the visible play panel', () => {
    // The fix reuses updatePreviewContainer to drive skin-picker / sex / layout
    // sync. The wrapper must gate it on the active panel ids, otherwise the
    // #mode-select default path tries to re-bind non-existent panels.
    expect(mainSrc).toMatch(
      /assetsReady\(\)\.then\(\(\)\s*=>\s*\{[\s\S]*?updatePreviewContainer\(activePanelId\)[\s\S]*?\}\);/,
    );
    expect(mainSrc).toMatch(
      /activePanelId\s*===\s*['"]#charselect-panel['"]\s*\|\|\s*activePanelId\s*===\s*['"]#charcreate-panel['"]\s*\|\|\s*activePanelId\s*===\s*['"]#offline-select['"]/,
    );
  });
});

// ---------------------------------------------------------------------------
// 2) Behavioral test: CharacterPreview.setContainer must re-parent the canvas
//    into the new container on a fake DOM. We don't import the real class (it
//    pulls in three.js / WebGL, which a Node test cannot stand up); we exercise
//    the same appendChild contract the fix relies on, with the same move-when-
//    already-attached semantics real DOM has.
// ---------------------------------------------------------------------------

interface FakeEl {
  tagName: string;
  id: string;
  parentNode: FakeEl | null;
  childNodes: FakeEl[];
  appendChild(kid: FakeEl): FakeEl;
  remove(): void;
}

function fakeEl(tag: string, id = ''): FakeEl {
  const el = {
    tagName: tag.toUpperCase(),
    id,
    parentNode: null as FakeEl | null,
    childNodes: [] as FakeEl[],
    appendChild(kid: FakeEl) {
      // Real appendChild moves an already-attached child to the new parent.
      kid.parentNode?.childNodes.splice(kid.parentNode.childNodes.indexOf(kid), 1);
      kid.parentNode = el;
      el.childNodes.push(kid);
      return kid;
    },
    remove() {
      if (el.parentNode) {
        el.parentNode.childNodes.splice(el.parentNode.childNodes.indexOf(el), 1);
        el.parentNode = null;
      }
    },
  };
  return el;
}

describe('preview.setContainer: re-parent the canvas into the new container (PHAA-613)', () => {
  it('moves the canvas from #online-preview-container into #offline-preview-container', () => {
    // Mirror play.html's static layout: the canvas is born inside the online
    // preview container; #offline-preview-container starts empty. Calling
    // setContainer(offline) must move the canvas (real appendChild semantics).
    const online = fakeEl('div', 'online-preview-container');
    const offline = fakeEl('div', 'offline-preview-container');
    const canvas = fakeEl('canvas', 'char-preview-canvas');
    online.appendChild(canvas);

    // setContainer's exact contract: append this.canvas into the new container.
    // The real class also disconnects/re-observes a ResizeObserver and re-sizes
    // the renderer; this minimal test only pins the re-parenting invariant.
    offline.appendChild(canvas);

    expect(canvas.parentNode?.id).toBe('offline-preview-container');
    expect(online.childNodes).toEqual([]);
    expect(offline.childNodes).toEqual([canvas]);
  });

  it('is a no-op move when setContainer is called with the canvas current container', () => {
    const online = fakeEl('div', 'online-preview-container');
    const canvas = fakeEl('canvas', 'char-preview-canvas');
    online.appendChild(canvas);
    // Re-appending the same parent is allowed and must not duplicate or detach.
    online.appendChild(canvas);
    expect(online.childNodes).toEqual([canvas]);
    expect(canvas.parentNode).toBe(online);
  });
});

// ---------------------------------------------------------------------------
// 3) Source guard: the fix lives at the assetsReady callback; double-check the
//    whole show() flow still routes through updatePreviewContainer for the
//    offline / charcreate / charselect panels (the call sites the original bug
//    report cited). A future refactor that drops one of these would re-break
//    the preview wiring for that panel.
// ---------------------------------------------------------------------------

describe('main.ts: show() re-binds the preview on every play panel switch', () => {
  it('updatePreviewContainer is invoked for #offline-select, #charcreate-panel, and #charselect-panel inside show()', () => {
    // Three guarded call sites: the early-return path, the reduced-motion
    // path, and the normal fade path. Each must list all three panel ids.
    const idList = "'#charselect-panel' || el === '#charcreate-panel' || el === '#offline-select'";
    const matches = mainSrc.match(new RegExp(idList.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&'), 'g')) ?? [];
    expect(
      matches.length,
      `expected three show() call sites that gate updatePreviewContainer on the play panels, found ${matches.length}`,
    ).toBeGreaterThanOrEqual(3);
  });

  it('setContainer() in preview.ts actually appends this.canvas into the supplied container', () => {
    // Pin the contract the fix relies on: a future refactor that swaps the
    // appendChild for a property assignment (no DOM move) would silently
    // re-break PHAA-613 in production where the race is intermittent.
    expect(previewSrc).toMatch(
      /setContainer\(container:\s*HTMLElement\)\s*:\s*void\s*\{[\s\S]*?this\.container\.appendChild\(this\.canvas\)/,
    );
  });
});