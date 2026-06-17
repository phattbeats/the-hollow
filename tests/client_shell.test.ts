import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const mainTs = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const hudTs = readFileSync(new URL('../src/ui/hud.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

function splitGameUiTemplate(): { templateHtml: string; liveHtml: string } {
  const marker = '<template id="game-ui-template">';
  const start = html.indexOf(marker);
  const end = html.indexOf('</template>', start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  const templateHtml = html.slice(start, end + '</template>'.length);
  return {
    templateHtml,
    liveHtml: html.slice(0, start) + html.slice(end + '</template>'.length),
  };
}

describe('client HTML shell', () => {
  it('keeps game HUD controls out of the live startup DOM', () => {
    const { liveHtml, templateHtml } = splitGameUiTemplate();

    expect(templateHtml).toContain('id="ui"');
    expect(templateHtml).toContain('Release Spirit');
    expect(templateHtml).toContain('Combat Log');
    expect(templateHtml).toContain('id="chat-input"');

    expect(liveHtml).not.toContain('id="ui"');
    expect(liveHtml).not.toContain('Release Spirit');
    expect(liveHtml).not.toContain('Combat Log');
    expect(liveHtml).not.toContain('id="chat-input"');
  });

  it('offers the quest log in the mobile controls drawer', () => {
    expect(html).toContain('id="mobile-extra-controls"');
    expect(html).toContain('id="mobile-quest"');
    expect(html).toContain('aria-label="Quest Log"');
  });

  it('only displays mobile touch controls after the game is active', () => {
    expect(html).toContain('body.mobile-touch.game-active #mobile-controls');
    expect(html).not.toContain('body.mobile-touch #mobile-controls { position: absolute; inset: 0; display: block;');
  });

  it('does not expose inert scrollbars on fixed mobile game overlays', () => {
    expect(html).toContain('#ui { position: fixed; left: 0; top: 0; width: var(--app-vw); max-width: 100vw; height: var(--app-vh); overflow: hidden;');
    expect(html).toContain('body.mobile-touch.game-active #ui,\n  body.mobile-touch.game-active #nameplates,\n  body.mobile-touch.game-active #mobile-controls {\n    overflow: hidden;\n    scrollbar-width: none;');
    expect(html).toContain('body.mobile-touch.game-active #ui::-webkit-scrollbar,\n  body.mobile-touch.game-active #nameplates::-webkit-scrollbar,\n  body.mobile-touch.game-active #mobile-controls::-webkit-scrollbar');
    expect(html).toContain('height: 0;\n    display: none;');
    expect(html).toContain('body.mobile-touch.game-active::-webkit-scrollbar {\n    height: 0;');
    expect(html).toContain('body.mobile-touch.game-active *::-webkit-scrollbar {\n    height: 0;');
    expect(html).toContain('body.mobile-touch.game-active *::-webkit-scrollbar:horizontal {\n    height: 0;\n    display: none;');
  });

  it('suppresses mobile in-game text selection and touch callouts without blocking inputs', () => {
    expect(html).toContain('body.mobile-touch.game-active #mobile-controls *,\n  body.mobile-touch.game-active #bottom-bar,');
    expect(html).toContain('body.mobile-touch.game-active .mobile-btn {\n    user-select: none;\n    -webkit-user-select: none;\n    -webkit-touch-callout: none;');
    expect(html).toContain('body.mobile-touch.game-active input,\n  body.mobile-touch.game-active textarea,\n  body.mobile-touch.game-active select,');
    expect(html).toContain('-webkit-user-select: text;\n    -webkit-touch-callout: default;');
  });

  it('hides only the in-game community donate affordance on mobile', () => {
    expect(html).toContain('<a class="donate-cta"');
    expect(html).toContain('<a class="community-link donate"');
    expect(html).toContain('body.mobile-touch .community-link.donate {\n    display: none;');
    expect(html).not.toContain('body.mobile-touch .donate-cta {\n    display: none;');
  });

  it('renders the mobile XP bar as a ring around the top-left class circle', () => {
    expect(html).toContain('body.mobile-touch #xpbar {\n    display: none;\n  }');
    expect(html).toContain('body.mobile-touch #player-frame {\n    --xp-ring-start: 210deg;\n    --xp-ring-arc: 360deg;');
    expect(html).toContain('body.mobile-touch #player-frame::before {\n    content: "";');
    expect(html).toContain('width: 73px;\n    height: 73px;');
    expect(html).toContain('z-index: 2;');
    expect(html).toContain('conic-gradient(from var(--xp-ring-start),');
    expect(html).toContain('calc(var(--xp-fill, 0) * 360deg)');
    expect(html).toContain('transparent var(--xp-ring-arc) 360deg');
    expect(html).toContain('body.mobile-touch #player-frame {\n    position: fixed;\n    left: max(8px, env(safe-area-inset-left));\n    top: max(8px, env(safe-area-inset-top));\n    z-index: 21;');
    expect(html).toContain('body.mobile-touch #player-frame .portrait-wrap { z-index: 3; }');
    expect(html).toContain('body.mobile-touch #player-frame .uf-bars {\n    position: relative;\n    z-index: 1;');
    expect(html).toContain('-webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 7px), #000 calc(100% - 6px));');
    expect(html).toContain('body.mobile-touch #xpbar .fill,\n  body.mobile-touch #xpbar .ticks { display: none; }');
    expect(html).toContain('body.mobile-touch #player-frame::before {\n      left: -5px;\n      top: -5px;\n      width: 73px;\n      height: 73px;');
    expect(html).toContain('body.mobile-touch #target-frame {\n    left: max(8px, env(safe-area-inset-left));\n    top: calc(max(8px, env(safe-area-inset-top)) + 90px);');
    expect(html).toContain('body.mobile-touch #party-frames {\n    position: fixed;\n    left: max(8px, env(safe-area-inset-left));\n    top: calc(max(8px, env(safe-area-inset-top)) + 92px);');
    expect(html).toContain('body.mobile-touch #party-frames.below-target {\n    top: calc(max(8px, env(safe-area-inset-top)) + 148px);');
    expect(html).not.toContain('body.mobile-touch.mobile-left-handed #xpbar,');
    expect(hudTs).toContain("$('#xpbar').style.setProperty('--xp-fill', bar.fillFrac.toFixed(4));");
    expect(hudTs).toContain("$('#player-frame').style.setProperty('--xp-fill', bar.fillFrac.toFixed(4));");
  });

  it('keeps the mobile homepage scrollable with a sticky header', () => {
    expect(html).toContain('touch-action: pan-y; overscroll-behavior-y: auto;');
    expect(html).toContain('body.game-active {\n    overflow: hidden;\n    touch-action: none;');
    expect(html).toContain('-webkit-overflow-scrolling: touch;');
    expect(html).toContain('body.mobile-touch .homepage-header {\n    display: flex;\n    position: sticky;\n    top: 0;\n    z-index: 120;');
    expect(html).not.toContain('body.mobile-touch .homepage-header {\n    display: flex;\n    position: relative;');
    expect(mainTs).not.toContain("visualViewport?.addEventListener('scroll', syncAppViewport)");
  });

  it('lays out mobile More tray buttons horizontally', () => {
    expect(html).toContain('body.mobile-touch #mobile-extra-controls .mobile-btn');
    expect(html).toContain('flex-direction: row;');
    expect(html).toContain('body.mobile-touch #mobile-extra-controls .mobile-btn .ui-icon');
  });

  it('lays out the mobile mode cards side-by-side in landscape', () => {
    expect(html).toContain('@media (orientation: landscape) {\n    body.mobile-touch .mode-row {\n      flex-direction: row;');
    expect(html).toContain('width: min(620px, calc(100vw - 96px));');
    expect(html).toContain('body.mobile-touch .mode-card {\n      flex: 1 1 0;\n      width: auto;');
  });

  it('omits Meters from the mobile More tray while keeping the desktop window', () => {
    expect(html).toContain('id="meters-window"');
    expect(html).not.toContain('id="mobile-meters"');
  });

  it('keeps the mobile More and Autorun buttons in the combat row', () => {
    const combatControls = html.slice(html.indexOf('<div id="mobile-combat-controls">'), html.indexOf('<div id="mobile-extra-controls">'));
    const primaryButtons = [...combatControls.matchAll(/<button class="mobile-btn"/g)];
    const attack = combatControls.indexOf('id="mobile-attack-nearest"');
    const autorun = combatControls.indexOf('id="mobile-autorun"');
    const jump = combatControls.indexOf('id="mobile-jump"');

    expect(primaryButtons).toHaveLength(7);
    expect(attack).toBeGreaterThanOrEqual(0);
    expect(autorun).toBeGreaterThan(attack);
    expect(jump).toBeGreaterThan(autorun);
    expect(html).toContain('grid-template-columns: 124px repeat(6, 58px);');
    expect(html).toContain('grid-template-columns: 115px repeat(6, 54px);');
    expect(html).toContain('grid-template-columns: 96px repeat(6, 42px);');
    expect(html).toContain('pointer-events: auto; align-items: end; z-index: 30;');
    expect(html).toContain('body.mobile-touch #mobile-more {\n    position: static;');
  });

  it('keeps the mobile spell bar in a scrollable row between the joysticks', () => {
    expect(html).toContain('width: min(30vw, 132px);');
    expect(html).toContain('min-width: 112px;');
    expect(html).toContain('height: min(36vh, 172px);');
    expect(html).toContain('left: calc(max(18px, env(safe-area-inset-left)) + 134px);');
    expect(html).toContain('right: calc(max(18px, env(safe-area-inset-right)) + 134px);');
    expect(html).toContain('body.mobile-touch #actionbar {\n    display: flex;\n    flex-wrap: nowrap;');
    expect(html).toContain('overflow-x: auto;\n    overflow-y: hidden;');
    expect(html).toContain('touch-action: pan-x;');
    expect(html).toContain('body.mobile-touch .action-btn { width: 42px; height: 42px; flex: 0 0 42px;');
  });

  it('keeps the expanded mobile More tray inside the viewport', () => {
    expect(html).toContain('calc(100vw - 222px - max(12px, env(safe-area-inset-right, 0px)))');
    expect(html).toContain('calc(100vw - 208px - max(12px, env(safe-area-inset-right, 0px)))');
  });

  it('caps mobile quest and NPC panels instead of stretching them edge to edge', () => {
    expect(html).toContain('body.mobile-touch #quest-log-window,\n  body.mobile-touch #vendor-window,\n  body.mobile-touch #quest-dialog');
    expect(html).toContain('width: clamp(320px, 76vw, 680px);');
    expect(html).toContain('max-width: calc(100vw - 20px);');
    expect(html).toContain('transform: translateX(-50%);');
  });

  it('centers mobile Talents above touch controls', () => {
    expect(html).toContain('body.mobile-touch.mobile-window-open #ui {\n    z-index: 90;');
    expect(html).toContain('body.mobile-touch #talents-window {\n    position: fixed;');
    expect(html).toContain('top: 50%;');
    expect(html).toContain('transform: translate(-50%, -50%);');
    expect(html).toContain('z-index: 95 !important;');
  });
});
