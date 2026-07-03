// Cold-open intro overlay - a one-time, presentation-only cinematic shown to a
// fresh character before the first-errand tutorial (tutorial.ts). It frames the
// amnesia mystery, then gives the player a beat to reorient in the shrine and
// follow the light toward Brother Greenpaw. Modeled on tutorial.ts: a thin
// DOM-bound consumer of a pure view-core (cold_open_view.ts), reading IWorld
// only through isFreshCharacter and remembering completion in localStorage so it
// shows once. It never writes sim state, never touches the wire protocol, and
// runs identically against the offline Sim and the online ClientWorld.

import type { IWorld } from '../world_api';
import { coldOpenAdvance, coldOpenCardAt } from './cold_open_view';
import { t } from './i18n';
import { isFreshCharacter } from './tutorial';

const STORAGE_KEY = 'hollow.coldopen.v1';

export class ColdOpenOverlay {
  private completed: boolean;
  private engaged = false;
  private index = 0;

  private root: HTMLElement | null = null;
  private backdrop: HTMLElement | null = null;
  private titleEl!: HTMLElement;
  private bodyEl!: HTMLElement;
  private advanceBtn!: HTMLButtonElement;
  private skipBtn!: HTMLButtonElement;

  constructor() {
    this.completed = readDone();
  }

  // Called every HUD frame, before the tutorial. Returns true while the intro is
  // on screen so the caller holds the tutorial coachmark back until it is
  // dismissed ("shown before the tutorial"). Cheap no-op once completed or for a
  // character that is not genuinely fresh (isFreshCharacter is id-guarded
  // against the online pre-snapshot placeholder - see tutorial.ts).
  update(world: IWorld): boolean {
    if (this.completed) return false;
    if (!this.engaged) {
      if (!isFreshCharacter(world)) return false;
      this.engaged = true;
      this.index = 0;
      this.render();
    }
    return this.engaged && !this.completed;
  }

  // ---- internals --------------------------------------------------------

  private ensureDom(): void {
    if (this.root) return;
    const ui = document.getElementById('ui');
    if (!ui) return;

    // A non-interactive dim behind the card. pointer-events stay off (in CSS) so
    // the intro never traps world input; only the card's buttons are clickable.
    const backdrop = document.createElement('div');
    backdrop.className = 'cold-open-backdrop';
    backdrop.setAttribute('aria-hidden', 'true');

    const root = document.createElement('div');
    root.className = 'cold-open';
    // A narrated intro the player reads and dismisses. role="dialog" with a label
    // fits the modal-style card; it never traps focus (presentation-only).
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-labelledby', 'cold-open-title');

    this.titleEl = document.createElement('div');
    this.titleEl.className = 'cold-open-title';
    this.titleEl.id = 'cold-open-title';

    this.bodyEl = document.createElement('div');
    this.bodyEl.className = 'cold-open-body';

    const actions = document.createElement('div');
    actions.className = 'cold-open-actions';

    this.skipBtn = document.createElement('button');
    this.skipBtn.className = 'cold-open-skip';
    this.skipBtn.type = 'button';
    this.skipBtn.addEventListener('click', () => this.finish());

    this.advanceBtn = document.createElement('button');
    this.advanceBtn.className = 'cold-open-advance';
    this.advanceBtn.type = 'button';
    this.advanceBtn.addEventListener('click', () => this.advance());

    actions.append(this.skipBtn, this.advanceBtn);
    root.append(this.titleEl, this.bodyEl, actions);
    ui.append(backdrop, root);
    this.backdrop = backdrop;
    this.root = root;
  }

  private render(): void {
    this.ensureDom();
    if (!this.root) return;
    const card = coldOpenCardAt(this.index);
    if (!card) {
      this.finish();
      return;
    }
    this.titleEl.textContent = t('coldOpen.title');
    this.bodyEl.textContent = t(card.bodyKey);
    this.advanceBtn.textContent = t(card.advanceKey);
    this.skipBtn.textContent = t('coldOpen.skip');
    // Offer Skip only while cards remain; the final card's advance button ("Begin")
    // already dismisses, so a second dismiss control there would be redundant.
    this.skipBtn.style.display = card.isLast ? 'none' : '';
    // Move focus to the primary action so Enter/Space advances the card.
    this.advanceBtn.focus();
  }

  private advance(): void {
    const next = coldOpenAdvance(this.index);
    if (next === null) {
      this.finish();
      return;
    }
    this.index = next;
    this.render();
  }

  private finish(): void {
    this.completed = true;
    this.engaged = false;
    writeDone();
    this.root?.remove();
    this.backdrop?.remove();
    this.root = null;
    this.backdrop = null;
  }
}

function readDone(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'done';
  } catch {
    return false;
  }
}
function writeDone(): void {
  try {
    localStorage.setItem(STORAGE_KEY, 'done');
  } catch {
    /* private mode */
  }
}
