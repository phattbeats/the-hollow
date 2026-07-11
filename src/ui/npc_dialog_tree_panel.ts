// Thin DOM painter for a branching NPC dialogue tree (PHAA-562), the consumer of
// the pure npc_dialog_tree_view walker. hud.ts composes it into the shared
// #quest-dialog element (reusing that window's focus trap), so this stays a
// sibling module rather than another method bank on the hud coordinator: it owns
// only the DOM for one node (the NPC's line plus the tone-tagged choice buttons)
// and calls back for navigation and consequence.
//
// The walker (dialogChoicesAt / dialogAdvance) decides WHICH choices are offered
// and WHERE each leads; a choice's EFFECT is never applied here (it resolves
// server-side via the onChoose callback -> world.dialogChoose). Tone tags the
// button accent only; the choice's spoken line always carries the meaning, so no
// information is color-only.

import type { DialogChoiceDef, NpcDialogTree } from '../sim/types';
import { markDialogRoot } from './dialog_root';
import { esc } from './esc';
import { type DialogViewState, dialogChoicesAt } from './npc_dialog_tree_view';
import { svgIcon } from './ui_icons';

export interface NpcDialogTreePanelDeps {
  // The #quest-dialog element to paint into (already owned by the gossip window).
  el: HTMLElement;
  npcName: string;
  npcTitle: string;
  tree: NpcDialogTree;
  nodeId: string;
  // The player's persisted state for THIS npc, read fresh so `requires` gates
  // evaluate against authoritative disposition/flags.
  state: DialogViewState;
  // Localized text resolvers (hud passes tEntity-backed lookups).
  resolveNpcLine: (nodeId: string) => string;
  resolveChoiceLabel: (choiceId: string) => string;
  closeAria: string;
  continueLabel: string;
  // A player picked an offered choice: hud sends its effect (if any) and advances.
  onChoose: (choice: DialogChoiceDef) => void;
  // Terminal node (no offered choices): return to the gossip menu.
  onContinue: () => void;
  onClose: () => void;
  focusFirst: () => void;
}

const TONE_CLASS: Record<DialogChoiceDef['tone'], string> = {
  positive: 'qd-choice-positive',
  neutral: 'qd-choice-neutral',
  negative: 'qd-choice-negative',
};

export function renderNpcDialogTreePanel(deps: NpcDialogTreePanelDeps): void {
  const { el, tree, nodeId, state } = deps;
  markDialogRoot(el, { labelledBy: 'quest-dialog-title' });
  const choices = dialogChoicesAt(tree, nodeId, state);
  let html = `<div class="panel-title"><span id="quest-dialog-title">${esc(deps.npcName)}<span class="quest-muted"> &lt;${esc(deps.npcTitle)}&gt;</span></span><button type="button" class="x-btn" data-close aria-label="${esc(deps.closeAria)}">${svgIcon('close')}</button></div>`;
  html += `<div class="qd-text">"${esc(deps.resolveNpcLine(nodeId))}"</div>`;
  for (const choice of choices) {
    const label = deps.resolveChoiceLabel(choice.id);
    html += `<button type="button" class="qd-list-item qd-choice ${TONE_CLASS[choice.tone]}" data-choice="${esc(choice.id)}">${esc(label)}</button>`;
  }
  el.innerHTML = html;
  el.querySelectorAll('[data-choice]').forEach((item) => {
    item.addEventListener('click', () => {
      const id = (item as HTMLElement).dataset.choice ?? '';
      const choice = choices.find((c) => c.id === id);
      if (choice) deps.onChoose(choice);
    });
  });
  if (choices.length === 0) {
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.type = 'button';
    btn.textContent = deps.continueLabel;
    btn.addEventListener('click', () => deps.onContinue());
    el.appendChild(btn);
  }
  el.querySelector('[data-close]')?.addEventListener('click', () => deps.onClose());
  el.style.display = 'block';
  deps.focusFirst();
}
