// Thin DOM painter for the Dungeon Finder window (PHAA-736).
//
// The consumer half of the pure-core + thin-painter split: it paints
// #dungeon-finder-window from the structured DungeonFinderPanelView
// (dungeon_finder_view.ts) and wires the role-select / queue / leave / close
// dispatch back through IWorld + injected callbacks. It holds no Sim reference
// and reaches into Hud only through its deps, mirroring arena_window.ts's shape
// (a much smaller window: one dungeon, one role picker, no ladder/party state).

import type { Role } from '../sim/content/talents';
import type { IWorld } from '../world_api';
import { markDialogRoot } from './dialog_root';
import { buildDungeonFinderView, type DungeonFinderRoleOption } from './dungeon_finder_view';
import { dungeonDisplayName } from './entity_i18n';
import { esc } from './esc';
import { type TranslationKey, t } from './i18n';
import { svgIcon } from './ui_icons';

const ROLE_LABEL_KEY: Record<Role, TranslationKey> = {
  tank: 'hudChrome.dungeonFinder.roleTank',
  healer: 'hudChrome.dungeonFinder.roleHealer',
  dps: 'hudChrome.dungeonFinder.roleDps',
};

/** Hud-supplied glue; the window renders entirely from IWorld + these callbacks. */
export interface DungeonFinderWindowDeps {
  root(): HTMLElement;
  world(): IWorld;
  closeOthers(): void;
  captureFocus(): HTMLElement | null;
  restoreFocus(target: HTMLElement | null): void;
}

export class DungeonFinderWindow {
  private selectedRole: Role | null = null;
  private lastSig = '';
  private openerFocus: HTMLElement | null = null;

  constructor(private readonly deps: DungeonFinderWindowDeps) {}

  get isOpen(): boolean {
    return this.deps.root().style.display === 'block';
  }

  /** Open if closed, close if open (the minimap button / keybind). */
  toggle(): void {
    if (this.isOpen) {
      this.close();
      return;
    }
    this.deps.closeOthers();
    this.openerFocus = this.deps.captureFocus();
    const root = this.deps.root();
    markDialogRoot(root, { labelledBy: 'dungeon-finder-title' });
    root.style.display = 'block';
    this.lastSig = '';
    this.selectedRole = null;
    this.render();
    (root.querySelector('[data-close]') as HTMLElement | null)?.focus();
  }

  close(): void {
    const el = this.deps.root();
    if (el.style.display !== 'block') {
      this.openerFocus = null;
      return;
    }
    el.style.display = 'none';
    this.deps.restoreFocus(this.openerFocus);
    this.openerFocus = null;
  }

  /** Re-localize the open window after an in-game language switch (see
   *  arena_window.ts's relocalize for why this is text-independent otherwise). */
  relocalize(): void {
    if (!this.isOpen) return;
    this.lastSig = '';
    this.render();
  }

  render(): void {
    const world = this.deps.world();
    const view = buildDungeonFinderView({
      info: world.dungeonFinderInfo,
      playerClass: world.cfg.playerClass,
    });
    const sig = view.kind === 'offline' ? 'offline' : view.sig;
    if (sig === this.lastSig) return;
    this.lastSig = sig;

    const root = this.deps.root();
    const title = `<div class="panel-title"><span id="dungeon-finder-title">${esc(t('hudChrome.dungeonFinder.title'))}</span><button type="button" class="x-btn" data-close aria-label="${esc(t('hudChrome.dungeonFinder.close'))}">${svgIcon('close')}</button></div>`;

    if (view.kind === 'offline') {
      root.innerHTML = `${title}<div class="dungeon-finder-offline">${esc(t('hudChrome.dungeonFinder.offlineNote'))}</div>`;
      return;
    }

    if (view.kind === 'queued') {
      const status = t('hudChrome.dungeonFinder.queuedStatus', {
        role: t(ROLE_LABEL_KEY[view.role]),
        dungeon: dungeonDisplayName(view.dungeonId),
        position: view.position,
      });
      root.innerHTML = `${title}<div class="dungeon-finder-status">${esc(status)}</div><button type="button" class="dungeon-finder-leave">${esc(t('hudChrome.dungeonFinder.leaveButton'))}</button>`;
      root
        .querySelector('.dungeon-finder-leave')
        ?.addEventListener('click', () => world.dungeonFinderQueueLeave());
      root.querySelector('[data-close]')?.addEventListener('click', () => this.close());
      return;
    }

    const dungeonName = dungeonDisplayName(view.dungeonId);
    const hint = t('hudChrome.dungeonFinder.idleHint', { dungeon: dungeonName });
    const roleButtons = view.roles
      .map((r: DungeonFinderRoleOption) => {
        const selected = this.selectedRole === r.role;
        return `<button type="button" class="dungeon-finder-role${selected ? ' selected' : ''}" data-role="${r.role}" ${r.available ? '' : 'disabled'}>${esc(t(ROLE_LABEL_KEY[r.role]))}</button>`;
      })
      .join('');
    root.innerHTML = `${title}<div class="dungeon-finder-hint">${esc(hint)}</div><div class="dungeon-finder-roles">${roleButtons}</div><button type="button" class="dungeon-finder-queue" ${this.selectedRole ? '' : 'disabled'}>${esc(t('hudChrome.dungeonFinder.queueButton'))}</button>`;
    for (const btn of root.querySelectorAll<HTMLButtonElement>('.dungeon-finder-role')) {
      btn.addEventListener('click', () => {
        this.selectedRole = btn.dataset.role as Role;
        this.lastSig = '';
        this.render();
      });
    }
    root.querySelector('.dungeon-finder-queue')?.addEventListener('click', () => {
      if (this.selectedRole) world.dungeonFinderQueueJoin(this.selectedRole);
    });
    root.querySelector('[data-close]')?.addEventListener('click', () => this.close());
  }
}
