// New-Adventurer Tutorial — a one-time guided onboarding overlay.
//
// Brand-new characters used to spawn in Eastbrook with only an easily-missed
// combat-log hint. This overlay walks a first-time player through the five
// classic first steps: move → find the starter NPC → take the quest → slay the
// wolves → turn it in. Every step is detected by *observing* existing IWorld
// state (player/NPC positions, quest log, completed quests), so this module is
// pure presentation: it never writes sim state, never touches the wire
// protocol, and runs identically against the offline Sim and the online
// ClientWorld. Completion is remembered in localStorage so it shows only once.
//
// Reads through IWorld only (src/ CLAUDE.md). The starter ids below mirror the
// shipped zone-1 content (the same QUESTS the HUD already imports).

import type { IWorld } from '../world_api';
import type { Renderer } from '../render/renderer';
import type { Keybinds } from '../game/keybinds';
import { dist2d } from '../sim/types';
import { QUESTS } from '../sim/data';
import { t } from './i18n';

// Starter content the onboarding guides the player toward. These are stable
// shipped ids; the slay count is read live from the quest def so it can't drift.
const GIVER_NPC = 'marshal_redbrook';
const STARTER_QUEST = 'q_wolves';
const STARTER_MOB = 'forest_wolf';
const SPAWN = { x: 2, y: 0, z: -2 };
const MOVE_THRESHOLD = 3; // yards from spawn before "find your footing" is satisfied
const GIVER_RANGE = 7; // matches the sim's accept-quest reach (INTERACT_RANGE + 2)
const STORAGE_KEY = 'woc.tutorial.v1';
const DONE_LINGER_MS = 9000; // auto-dismiss the closing card after this long

export type TutorialStep = 'move' | 'seek' | 'talk' | 'slay' | 'return' | 'done';

const STEP_ORDER: TutorialStep[] = ['move', 'seek', 'talk', 'slay', 'return'];

export interface TutorialSnapshot {
  moved: boolean; // player has stepped away from the spawn point
  nearGiver: boolean; // player is within talk range of the starter NPC
  questActive: boolean; // starter quest is in the quest log
  questReady: boolean; // all objectives met, ready to turn in
  questDone: boolean; // starter quest has been turned in
}

// Pure state machine — unit-tested. Resolves the highest step the player has
// reached; each step's prompt is "do the thing that satisfies the next one".
export function computeTutorialStep(s: TutorialSnapshot): TutorialStep {
  if (s.questDone) return 'done';
  if (s.questReady) return 'return';
  if (s.questActive) return 'slay';
  if (s.nearGiver) return 'talk';
  if (s.moved) return 'seek';
  return 'move';
}

export class TutorialOverlay {
  private completed: boolean;
  private engaged = false; // decided to run for this (fresh) character
  private step: TutorialStep | null = null;
  private doneSince = 0;

  private root: HTMLElement | null = null;
  private titleEl!: HTMLElement;
  private stepEl!: HTMLElement;
  private bodyEl!: HTMLElement;
  private progressEl!: HTMLElement;
  private skipBtn!: HTMLButtonElement;
  private arrow: HTMLElement | null = null;

  constructor() {
    this.completed = readDone();
  }

  // Called every HUD frame. Cheap no-op once completed or never engaged.
  update(world: IWorld, renderer: Renderer, keybinds: Keybinds): void {
    if (this.completed) return;
    const p = world.player;
    if (!p) return;

    // Engage only for a genuinely fresh character: level 1, no quests at all.
    if (!this.engaged) {
      const fresh = p.level === 1 && world.questsDone.size === 0 && world.questLog.size === 0;
      if (!fresh) return;
      this.engaged = true;
    }

    const giver = this.findEntity(world, 'npc', GIVER_NPC);
    const qstate = world.questState(STARTER_QUEST);
    const snapshot: TutorialSnapshot = {
      moved: dist2d(p.pos, SPAWN) > MOVE_THRESHOLD,
      nearGiver: !!giver && dist2d(p.pos, giver.pos) <= GIVER_RANGE,
      questActive: world.questLog.has(STARTER_QUEST),
      questReady: qstate === 'ready',
      questDone: world.questsDone.has(STARTER_QUEST),
    };

    const next = computeTutorialStep(snapshot);
    if (next !== this.step) {
      this.step = next;
      if (next === 'done' && this.doneSince === 0) this.doneSince = performance.now();
      this.renderPanel(world, keybinds);
    } else if (this.step === 'slay') {
      // live-refresh the kill counter without rebuilding the whole panel
      this.progressEl.textContent = this.slayProgress(world);
    }

    if (this.step === 'done') {
      if (performance.now() - this.doneSince >= DONE_LINGER_MS) this.finish();
      this.hideArrow();
      return;
    }

    this.updateArrow(world, renderer);
  }

  // ---- internals --------------------------------------------------------

  private findEntity(world: IWorld, kind: string, templateId: string) {
    for (const e of world.entities.values()) {
      if (e.kind === kind && e.templateId === templateId) return e;
    }
    return null;
  }

  private nearestMob(world: IWorld, templateId: string) {
    const p = world.player;
    let best: typeof p | null = null;
    let bestD = Infinity;
    for (const e of world.entities.values()) {
      if (e.kind !== 'mob' || e.templateId !== templateId || e.dead) continue;
      const d = dist2d(p.pos, e.pos);
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  }

  private slayProgress(world: IWorld): string {
    const def = QUESTS[STARTER_QUEST];
    const needed = def?.objectives?.[0]?.count ?? 0;
    const current = world.questLog.get(STARTER_QUEST)?.counts?.[0] ?? 0;
    return t('hud.tutorial.slayProgress', { current: String(Math.min(current, needed)), needed: String(needed) });
  }

  private ensureDom(): void {
    if (this.root) return;
    const ui = document.getElementById('ui');
    if (!ui) return;

    const root = document.createElement('div');
    root.className = 'tut-card';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-live', 'polite');
    root.setAttribute('aria-labelledby', 'tut-title');

    const header = document.createElement('div');
    header.className = 'tut-head';
    this.titleEl = document.createElement('div');
    this.titleEl.className = 'tut-title';
    this.titleEl.id = 'tut-title';
    this.stepEl = document.createElement('div');
    this.stepEl.className = 'tut-step';
    header.append(this.titleEl, this.stepEl);

    this.bodyEl = document.createElement('div');
    this.bodyEl.className = 'tut-body';

    this.progressEl = document.createElement('div');
    this.progressEl.className = 'tut-progress';

    this.skipBtn = document.createElement('button');
    this.skipBtn.className = 'tut-skip';
    this.skipBtn.type = 'button';
    this.skipBtn.addEventListener('click', () => this.finish());

    root.append(header, this.bodyEl, this.progressEl, this.skipBtn);
    ui.appendChild(root);
    this.root = root;

    const arrow = document.createElement('div');
    arrow.className = 'tut-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '➤'; // ➤
    ui.appendChild(arrow);
    this.arrow = arrow;
  }

  private renderPanel(world: IWorld, keybinds: Keybinds): void {
    this.ensureDom();
    if (!this.root) return;

    const moveKeys = ['forward', 'turnLeft', 'back', 'turnRight']
      .map((id) => keybinds.primaryLabel(id)).filter(Boolean).join('/');
    const interactKey = keybinds.primaryLabel('interact');
    const questKey = keybinds.primaryLabel('questlog');
    const name = world.player.name || t('hud.core.you');

    const copy: Record<TutorialStep, { title: string; body: string }> = {
      move: { title: t('hud.tutorial.moveTitle'), body: t('hud.tutorial.moveBody', { moveKeys }) },
      seek: { title: t('hud.tutorial.seekTitle'), body: t('hud.tutorial.seekBody') },
      talk: { title: t('hud.tutorial.talkTitle'), body: t('hud.tutorial.talkBody', { interactKey }) },
      slay: { title: t('hud.tutorial.slayTitle'), body: t('hud.tutorial.slayBody') },
      return: { title: t('hud.tutorial.returnTitle'), body: t('hud.tutorial.returnBody', { interactKey }) },
      done: { title: t('hud.tutorial.doneTitle'), body: t('hud.tutorial.doneBody', { name, questKey }) },
    };

    const c = copy[this.step!];
    this.titleEl.textContent = c.title;
    this.bodyEl.textContent = c.body;

    const idx = STEP_ORDER.indexOf(this.step!);
    this.stepEl.textContent = idx >= 0
      ? t('hud.tutorial.stepLabel', { current: String(idx + 1), total: String(STEP_ORDER.length) })
      : '';

    if (this.step === 'slay') {
      this.progressEl.textContent = this.slayProgress(world);
      this.progressEl.style.display = '';
    } else {
      this.progressEl.style.display = 'none';
    }

    this.skipBtn.textContent = this.step === 'done' ? t('hud.tutorial.dismiss') : t('hud.tutorial.skip');
    this.root.classList.toggle('tut-done', this.step === 'done');
  }

  // Points an on-screen marker at the current objective (NPC or nearest wolf).
  private updateArrow(world: IWorld, renderer: Renderer): void {
    if (!this.arrow) return;
    let target: { x: number; y: number; z: number; scale?: number } | null = null;
    if (this.step === 'seek' || this.step === 'talk' || this.step === 'return') {
      target = this.findEntity(world, 'npc', GIVER_NPC)?.pos ?? null;
    } else if (this.step === 'slay') {
      target = this.nearestMob(world, STARTER_MOB)?.pos ?? null;
    }
    if (!target) { this.hideArrow(); return; }

    const v = renderer.worldToScreen(target.x, target.y + 2.2, target.z);
    const margin = 56;
    const w = window.innerWidth;
    const h = window.innerHeight;
    let sx = v.x;
    let sy = v.y;
    // Behind the camera projects inverted; mirror through screen centre so the
    // marker still points the right way.
    if (v.behind) { sx = w - v.x; sy = h - v.y; }
    const cx = w / 2;
    const cy = h / 2;
    const angle = Math.atan2(sy - cy, sx - cx);
    sx = Math.max(margin, Math.min(w - margin, sx));
    sy = Math.max(margin, Math.min(h - margin, sy));

    this.arrow.style.display = 'block';
    this.arrow.style.left = `${sx}px`;
    this.arrow.style.top = `${sy}px`;
    this.arrow.style.transform = `translate(-50%, -50%) rotate(${angle}rad)`;
  }

  private hideArrow(): void {
    if (this.arrow) this.arrow.style.display = 'none';
  }

  private finish(): void {
    this.completed = true;
    this.engaged = false;
    writeDone();
    this.root?.remove();
    this.arrow?.remove();
    this.root = null;
    this.arrow = null;
  }
}

function readDone(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) === 'done'; } catch { return false; }
}
function writeDone(): void {
  try { localStorage.setItem(STORAGE_KEY, 'done'); } catch { /* private mode */ }
}
