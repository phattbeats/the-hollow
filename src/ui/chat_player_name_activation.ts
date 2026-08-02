// DOM wiring for the clickable/right-clickable chat sender name (PHAA-711):
// right-click (contextmenu), left-click/tap, and Enter/Space on focus all open
// the same player context menu. Left-click/tap opens the same menu as
// right-click because right-click alone is unreachable on mobile, where chat
// names were previously dead text.
//
// Extracted from Hud.chatLogFrom so the "one activation per gesture, no path
// double-fires another's work" contract is unit-tested directly
// (tests/chat_player_name_activation.test.ts) against a tiny fake element,
// instead of only reachable through the full Hud DOM. Touches the DOM
// (addEventListener) so this is a sibling wiring module, not a
// tests/architecture.test.ts UI_PURE_CORES pure core; it is intentionally not
// registered there.

export function attachChatPlayerNameActivation(
  el: HTMLElement,
  activate: (x: number, y: number) => void,
): void {
  el.addEventListener('contextmenu', (ev) => {
    ev.preventDefault();
    activate((ev as MouseEvent).clientX, (ev as MouseEvent).clientY);
  });
  el.addEventListener('click', (ev) => {
    activate((ev as MouseEvent).clientX, (ev as MouseEvent).clientY);
  });
  el.addEventListener('keydown', (ev) => {
    const key = (ev as KeyboardEvent).key;
    if (key !== 'Enter' && key !== ' ') return;
    ev.preventDefault();
    const rect = el.getBoundingClientRect();
    activate(rect.left, rect.bottom);
  });
}
