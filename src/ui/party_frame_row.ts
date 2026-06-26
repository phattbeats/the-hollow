// One pooled party-frame row: the ONE-TIME DOM builder + the live-slot event
// handlers for the keyed-pool party painter (frontend-modernization v0.16.0, P11c).
//
// This is the BUILDER half (the per-frame update half is party_frames_painter.ts).
// It runs only when a row is first created (or recycled to a fresh free slot), never
// on the hot path, so it freely uses the DOM creation primitives (createElement,
// className, innerHTML for the static badge icons, the role / tabindex attributes)
// that the per-frame painter must NOT touch. Each row is a unit_frame family
// INSTANCE (decision 9): createPartyRow builds the row's element set and wires its
// own UnitFramePainter, so the painter drives name / level / hp / resource / dead /
// out-of-range through the SAME write-elided family path the player and target use,
// while the party-only extras (the class-color custom property, the combat class, the
// dead / combat / out-of-range badges, the crest) layer on top.
//
// The keyed-pool correctness rule (state.md top-risk 3): the click / contextmenu /
// keydown listeners are attached ONCE here and read a LIVE MUTABLE slot record, never
// a member captured by value. When the painter recycles a row to a different pid it
// overwrites slot.member in place, so the handlers always act on the row's current
// member, not a stale one.

import { t } from './i18n';
import { iconDataUrl } from './icons';
import type { PainterHostWriters } from './painter_host';
import type { PartyFrameMember } from './party_frames';
import { svgIcon } from './ui_icons';
import { UnitFramePainter } from './unit_frame_painter';

// Bar fill precision: the inline block wrote `scaleX(<frac>.toFixed(3))`, so the
// party instance quantizes to three decimals (keeping the rendered transform AND its
// write-elision cache key byte-identical to the old markup).
export const PARTY_BAR_SCALE_PRECISION = 3;
// The crest icon edge in px (the inline block passed 20 to iconDataUrl).
const CREST_ICON_SIZE = 20;
// The portrait-gate key prefix: the crest repaints only when the member's class
// changes (a row recycled to a same-class member keeps its crest).
export const PARTY_CREST_KEY_PREFIX = 'crest:';
// The out-of-range badge glyph (a resize arrow), kept as a named constant rather than
// a bare literal. The dead / combat badges are the svgIcon skull / arena icons.
const OUT_OF_RANGE_GLYPH = '⤢';
// The leader marker glyph prefixed to the level chip, byte-faithful to the inline
// `info.leader === m.pid ? '★' : ''`.
export const PARTY_LEADER_GLYPH = '★';

/** A pooled row's live, mutable member record. The painter overwrites `member` in
 *  place every rebuild; the row's listeners and the crest gate read it live, so a row
 *  recycled to a different pid acts on the current member, not a captured one. */
export interface PartyRowSlot {
  member: PartyFrameMember;
}

/** Row interaction callbacks the Hud supplies (target on click / Enter / Space, the
 *  context menu on right-click or the Menu key). */
export interface PartyRowDeps {
  onTarget: (pid: number) => void;
  onContextMenu: (pid: number, name: string, x: number, y: number) => void;
}

/** A pooled row: its container element, the live slot, the per-row family painter the
 *  pool drives, the badge elements whose display the pool toggles per state, and a
 *  relocalize hook the pool calls on a language switch (the row DOM is never rebuilt). */
export interface PartyRow {
  el: HTMLElement;
  slot: PartyRowSlot;
  painter: UnitFramePainter;
  badges: { dead: HTMLElement; combat: HTMLElement; oor: HTMLElement };
  relocalize: () => void;
}

// The pointer-vs-keyboard context-menu position. A pointer contextmenu carries real
// client coords; the keyboard Menu key (Shift+F10) fires contextmenu at 0,0, so fall
// back to the focused row's on-screen box so the menu does not open in the corner.
function contextMenuCoords(ev: MouseEvent): { x: number; y: number } {
  if (ev.clientX > 0 || ev.clientY > 0) return { x: ev.clientX, y: ev.clientY };
  const el = ev.currentTarget as HTMLElement | null;
  const rect = el?.getBoundingClientRect?.();
  return rect ? { x: rect.left, y: rect.bottom } : { x: ev.clientX, y: ev.clientY };
}

/**
 * The row's three event handlers, each reading the LIVE slot (never a member captured
 * by value), so a recycled row targets its current member. Exported pure so a test
 * can drive them directly: mutate slot.member and the next call acts on the new pid.
 */
export function partyRowHandlers(slot: PartyRowSlot, deps: PartyRowDeps) {
  return {
    click: (): void => deps.onTarget(slot.member.pid),
    contextmenu: (ev: MouseEvent): void => {
      ev.preventDefault();
      const { x, y } = contextMenuCoords(ev);
      deps.onContextMenu(slot.member.pid, slot.member.name, x, y);
    },
    keydown: (ev: KeyboardEvent): void => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        deps.onTarget(slot.member.pid);
      }
    },
  };
}

// A persistent, hidden-by-default state badge (skull / arena icon) the pool shows via
// the elided setDisplay. Built once; only its display toggles per frame. The badge is
// a DECORATIVE status cue (aria-hidden): the row's accessible name stays the member's
// identity (name + level), not the badge glyph; the localized `title` is a sighted
// hover tooltip the pool re-localizes on a language switch (see relocalize).
function buildBadge(doc: Document, modifier: 'dead' | 'combat' | 'oor', icon: string): HTMLElement {
  const badge = doc.createElement('span');
  badge.className = `pf-badge ${modifier}`;
  badge.setAttribute('aria-hidden', 'true');
  badge.innerHTML = icon;
  return badge;
}

/**
 * Build one pooled party row and its per-row family painter. Runs once per row; the
 * pool then updates the row in place through the painter + the elided writers. The
 * crest is repainted only on a class change (the family's portrait gate), and the
 * bar fills keep the inline `.toFixed(3)` precision via formatScaleX.
 */
export function createPartyRow(
  doc: Document,
  writers: PainterHostWriters,
  deps: PartyRowDeps,
  member: PartyFrameMember,
): PartyRow {
  const slot: PartyRowSlot = { member };

  const row = doc.createElement('div');
  row.className = 'party-frame panel';
  // A keyboard-focusable target that selects on activation and opens the context menu
  // on the Menu key; the member name reaches the accessible name through the visible
  // text below, so it stays correct as the pool recycles the row (no per-frame aria).
  row.setAttribute('role', 'button');
  row.tabIndex = 0;

  const nameRow = doc.createElement('div');
  nameRow.className = 'pfm-name';

  const id = doc.createElement('span');
  id.className = 'pfm-id';
  const crest = doc.createElement('img');
  crest.className = 'pfm-crest';
  crest.alt = '';
  const nameText = doc.createElement('span');
  nameText.className = 'pfm-name-text';
  id.append(crest, nameText);

  const meta = doc.createElement('span');
  meta.className = 'pfm-meta';
  const deadBadge = buildBadge(doc, 'dead', svgIcon('skull'));
  const combatBadge = buildBadge(doc, 'combat', svgIcon('arena'));
  const oorBadge = buildBadge(doc, 'oor', '');
  oorBadge.textContent = OUT_OF_RANGE_GLYPH;
  // Re-localize the three badge tooltips (called once now, and again by the pool on a
  // language switch, since the keyed pool reuses the row DOM and never rebuilds it).
  const relocalize = () => {
    deadBadge.title = t('hud.social.status.dead');
    combatBadge.title = t('hud.social.status.combat');
    oorBadge.title = t('hud.errors.outOfRange');
  };
  relocalize();
  const lead = doc.createElement('span');
  lead.className = 'lead';
  meta.append(deadBadge, combatBadge, oorBadge, lead);

  nameRow.append(id, meta);

  const hpBar = doc.createElement('div');
  hpBar.className = 'bar hp';
  const hpFill = doc.createElement('div');
  hpFill.className = 'bar-fill';
  hpBar.append(hpFill);

  const resBar = doc.createElement('div');
  resBar.className = 'bar';
  const resFill = doc.createElement('div');
  resFill.className = 'bar-fill';
  resBar.append(resFill);

  row.append(nameRow, hpBar, resBar);

  const handlers = partyRowHandlers(slot, deps);
  row.addEventListener('click', handlers.click);
  row.addEventListener('contextmenu', handlers.contextmenu);
  row.addEventListener('keydown', handlers.keydown);

  const painter = new UnitFramePainter(
    writers,
    {
      frame: row,
      name: nameText,
      level: lead,
      hpFill,
      resource: { container: resBar, fill: resFill },
    },
    {
      stateClasses: true,
      formatScaleX: (frac) => `scaleX(${frac.toFixed(PARTY_BAR_SCALE_PRECISION)})`,
      // The crest is the party "portrait": repainted only when the class key changes,
      // reading the LIVE slot so a recycled row gets the new member's crest.
      repaintPortrait: () => {
        crest.src = iconDataUrl('crest', `class_${slot.member.cls}`, CREST_ICON_SIZE);
      },
    },
  );

  return {
    el: row,
    slot,
    painter,
    relocalize,
    badges: { dead: deadBadge, combat: combatBadge, oor: oorBadge },
  };
}

/** Build the persistent "Leave Party" button (created once, its click listener
 *  attached once). The pool keeps it last in the container and re-localizes its label
 *  through the elided setText each rebuild. */
export function createLeaveButton(doc: Document, onLeave: () => void): HTMLButtonElement {
  const btn = doc.createElement('button');
  btn.className = 'btn';
  btn.id = 'party-leave';
  btn.addEventListener('click', onLeave);
  return btn;
}
