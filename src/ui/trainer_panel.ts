// Thin DOM painter for the Profession Trainer NPC panel (PHAA-465: Multiclass D).
//
// The consumer half of the pure-core + thin-painter split: it paints the
// secondary-class picker into the shared NPC-talk dialog element from the
// structured TrainerView (trainer_view.ts) and owns the interactive wiring
// (pick a class, "how it works" explainer, Back, Close). It composes the
// talents/vendor family of cold windows: the pure view decides which secondary
// classes an NPC offers and their copper cost; this consumer paints them.
//
// Instance-parameterized: Hud owns the dialog element id and passes it via
// deps.root(), plus the world reads (primaryCls / secondaryCls / copper /
// level / cost) and the commit + navigation callbacks. The module owns no state
// and never imports Hud. Interpolated names pass through esc(); every string is
// an existing or new t() key. No raw hex or px in TS.

import { NPCS } from '../sim/data';
import type { PlayerClass } from '../sim/types';
import { markDialogRoot } from './dialog_root';
import { classDisplayName } from './entity_i18n';
import { esc } from './esc';
import { formatMoney as formatLocalizedMoney, t } from './i18n';
import {
  buildTrainerView,
  TRAINER_MIN_LEVEL,
  TRAINER_SECONDARY_TREE_HALF_CAP,
} from './trainer_view';
import { svgIcon } from './ui_icons';

/**
 * Hud-supplied glue. The host owns the dialog element (root), the world reads
 * (all snapshot-derived, no send), the server-authoritative commit
 * (setSecondaryClass), and the navigation callbacks (back to the gossip menu,
 * close the dialog, re-arm the focus trap). The module never reaches into Hud.
 */
export interface TrainerPanelDeps {
  /** The shared NPC-talk dialog root (Hud owns the id; painter stays parameterized). */
  root(): HTMLElement;
  /** The player's primary class (filtered out of the pick list). */
  primaryClass(): PlayerClass;
  /** The player's currently-bound secondary class, or null when none. */
  secondaryClass(): PlayerClass | null;
  /** Number of PAID secondary-class changes so far (first pick is free). */
  secondaryChanges(): number;
  /** The player's current level (against the level gate). */
  playerLevel(): number;
  /** The player's current gold in copper (drives affordability). */
  copper(): number;
  /** Total talent points (for the half-cap the explainer surfaces). */
  totalTalentPoints(): number;
  /** Commit the pick to the server-authoritative world (re-render after). */
  setSecondaryClass(npcId: number, cls: PlayerClass): void;
  /** Return to the NPC gossip menu. */
  back(npcId: number): void;
  /** Close the whole dialog. */
  close(): void;
  /** Re-arm the dialog's focus trap (Hud owns the trap). */
  focusFirst(): void;
}

export class TrainerPanel {
  // "How it works" explainer is collapsed by default; toggled per open.
  private showHelp = false;

  constructor(private readonly deps: TrainerPanelDeps) {}

  /** Open (or re-render) the trainer panel for the given NPC. */
  open(npcId: number, npcTemplateId: string): void {
    this.render(npcId, npcTemplateId);
  }

  private render(npcId: number, npcTemplateId: string): void {
    const el = this.deps.root();
    const primaryCls = this.deps.primaryClass();
    const view = buildTrainerView({
      npcTemplateId,
      npcs: NPCS,
      primaryCls,
      currentSecondary: this.deps.secondaryClass(),
      secondaryChanges: this.deps.secondaryChanges(),
      playerLevel: this.deps.playerLevel(),
      minLevel: TRAINER_MIN_LEVEL,
      copper: this.deps.copper(),
    });
    markDialogRoot(el, { labelledBy: 'quest-dialog-title' });

    let html =
      `<div class="panel-title"><span id="quest-dialog-title">${esc(t('questUi.dialog.trainerTitle'))}</span>` +
      `<button type="button" class="x-btn" data-close aria-label="${esc(t('questUi.dialog.close'))}">${svgIcon('close')}</button></div>`;

    if (view.levelLocked) {
      html += `<div class="qd-text">${esc(t('questUi.dialog.trainerLevelLocked', { level: view.minLevel }))}</div>`;
    } else {
      for (const pick of view.picks) {
        const clsName = classDisplayName(pick.cls);
        const costText = pick.picked
          ? t('questUi.dialog.trainerCurrent')
          : pick.costCopper === 0
            ? t('questUi.dialog.trainerFree')
            : formatLocalizedMoney(pick.costCopper ?? 0);
        const disabled = pick.picked || !pick.affordable;
        const aria = t('questUi.dialog.trainerPickAria', { cls: clsName, cost: costText });
        html +=
          `<button type="button" class="qd-list-item" data-train-cls="${esc(pick.cls)}" aria-label="${esc(aria)}"${disabled ? ' disabled' : ''}>` +
          `${esc(clsName)} <span class="quest-muted">${esc(costText)}</span></button>`;
      }
    }

    // "How it works" explainer (in-game info): a collapsible primer on the GW1
    // multiclass build system, reachable straight from the trainer panel.
    html += `<button type="button" class="qd-list-item" data-help aria-expanded="${this.showHelp}"><span class="gold">?</span> ${esc(t('questUi.dialog.trainerHowTitle'))}</button>`;
    if (this.showHelp) {
      const halfPct = Math.round(TRAINER_SECONDARY_TREE_HALF_CAP * 100);
      html += `<div class="qd-text qd-trainer-help">${esc(t('questUi.dialog.trainerHowBody', { level: view.minLevel, pct: halfPct }))}</div>`;
    }
    html += `<button type="button" class="qd-list-item" data-back="1">${esc(t('questUi.dialog.back'))}</button>`;

    el.innerHTML = html;
    el.querySelectorAll('[data-train-cls]').forEach((item) => {
      item.addEventListener('click', () => {
        const cls = (item as HTMLElement).dataset.trainCls as PlayerClass;
        this.deps.setSecondaryClass(npcId, cls);
        this.render(npcId, npcTemplateId);
      });
    });
    el.querySelector('[data-help]')?.addEventListener('click', () => {
      this.showHelp = !this.showHelp;
      this.render(npcId, npcTemplateId);
    });
    el.querySelector('[data-back]')?.addEventListener('click', () => this.deps.back(npcId));
    el.querySelector('[data-close]')?.addEventListener('click', () => this.deps.close());
    el.style.display = 'block';
    this.deps.focusFirst();
  }
}
