// The keyed-pool party-frames painter (frontend-modernization v0.16.0, P11c). It
// replaces the old per-rebuild innerHTML wipe + click/contextmenu re-attach
// (state.md top-risk 3) with a persistent node pool: one row per member key (pid),
// reused across rebuilds, listeners attached ONCE per row (in party_frame_row.ts),
// data updated IN PLACE through the host's six elided writers (decision 5a) and each
// member's own unit_frame family INSTANCE (decision 9).
//
// This file owns only the HOT path (reconcile + per-frame writes); every write here
// routes through the writer facet or the family painter, with NO raw style /
// className / innerHTML / setAttribute (a source-scan guard pins that). The one-time
// DOM construction (createElement, the static badge icons, the row attributes) lives
// in party_frame_row.ts, which the pool calls only when a row is first built.
//
// Reconcile: departed pids detach to a free list (their listeners intact for reuse),
// kept pids update in place, new pids take a free row or build one. The rows are
// re-appended in member order with the leave button last, so the mobile
// :first-child / :not(:first-child) rules still match; appendChild moves a node
// without dropping its keyboard focus or its listeners.

import type { PainterHostWriters } from './painter_host';
import {
  createLeaveButton,
  createPartyRow,
  PARTY_CREST_KEY_PREFIX,
  PARTY_LEADER_GLYPH,
  type PartyRow,
  type PartyRowDeps,
} from './party_frame_row';
import type { PartyFrameMember } from './party_frames';
import { unitFrameView } from './unit_frame';

// The class-color custom property the frame's name reads (`color: var(--cls)`); a
// token, not a literal color (decision 12).
const CLASS_COLOR_PROP = '--cls';
// The combat highlight class. dead / out-of-range are owned by the family's state
// classes; combat is the party-only extra (dead wins, so combat is off when dead).
const COMBAT_CLASS = 'combat';
// The container class that drops the frames below the target frame.
const BELOW_TARGET_CLASS = 'below-target';
// Badge visibility: '' reverts to the stylesheet display (shown), 'none' hides. The
// badges persist in the DOM and only their display toggles, so the icon cue survives
// forced-colors (where the combat box-shadow is dropped).
const BADGE_SHOWN = '';
const BADGE_HIDDEN = 'none';

/** What the pool needs from the Hud: the class-color resolver and the row actions. */
export interface PartyFramesPainterDeps {
  classCss: (cls: string) => string;
  onTarget: (pid: number) => void;
  onContextMenu: (pid: number, name: string, x: number, y: number) => void;
  onLeave: () => void;
  /** The localized "Leave Party" label, re-read each rebuild so an in-game language
   *  switch re-localizes it (through the elided setText). */
  leaveLabel: () => string;
}

export class PartyFramesPainter {
  // Active rows by member key (pid). One persistent node per key, reused across
  // rebuilds; the keyed pool the phase requires.
  private readonly pool = new Map<number, PartyRow>();
  // Detached rows kept for reuse (recycling a departed row to a new pid). The row's
  // listeners stay attached and read the live slot, so a recycled row is safe.
  private readonly free: PartyRow[] = [];
  private leaveBtn: HTMLButtonElement | null = null;
  private readonly rowDeps: PartyRowDeps;

  constructor(
    private readonly writers: PainterHostWriters,
    private readonly container: HTMLElement,
    private readonly deps: PartyFramesPainterDeps,
    private readonly doc: Document = document,
    // Injectable so a Node test can drive the pool without a DOM (the default builds
    // real rows in the browser).
    private readonly buildRow: typeof createPartyRow = createPartyRow,
  ) {
    this.rowDeps = { onTarget: deps.onTarget, onContextMenu: deps.onContextMenu };
  }

  /** Toggle the below-target offset on the container, every frame (cheap and elided),
   *  matching the inline `el.classList.toggle('below-target', ...)`. */
  setBelowTarget(on: boolean): void {
    this.writers.toggleClass(this.container, BELOW_TARGET_CLASS, on);
  }

  /** Reconcile the pool to `members` and repaint each in place. Called only when the
   *  party signature changed (the Hud short-circuits an unchanged party before this),
   *  so the reconcile cost is paid only on a real change. */
  sync(members: PartyFrameMember[], leader: number): void {
    const next = new Set<number>();
    for (const m of members) next.add(m.pid);
    // Detach rows whose member left; keep them (listeners intact) for reuse.
    for (const [pid, row] of this.pool) {
      if (!next.has(pid)) {
        row.el.remove();
        this.free.push(row);
        this.pool.delete(pid);
      }
    }
    // Create / reuse a row per member and update it in place, in member order.
    for (const m of members) {
      let row = this.pool.get(m.pid);
      if (!row) {
        row = this.free.pop() ?? this.buildRow(this.doc, this.writers, this.rowDeps, m);
        this.pool.set(m.pid, row);
      }
      // Update the LIVE slot BEFORE painting so the crest gate + listeners read the
      // current member, never a stale captured one (top-risk 3).
      row.slot.member = m;
      this.paintRow(row, m, leader);
      this.container.appendChild(row.el);
    }
    // Keep the leave button last and re-localize its label (elided).
    const leave = this.ensureLeaveButton();
    this.container.appendChild(leave);
    this.writers.setText(leave, this.deps.leaveLabel());
  }

  /** Re-localize every pooled and free row (the badge tooltips) plus the leave label
   *  after an in-game language switch. The keyed pool reuses row DOM and never
   *  rebuilds it, so the Hud calls this from refreshLocalizedDynamicUi (the
   *  woc:languagechange hook); without it the pooled tooltips would stay stale. */
  relocalize(): void {
    for (const row of this.pool.values()) row.relocalize();
    for (const row of this.free) row.relocalize();
    if (this.leaveBtn) this.writers.setText(this.leaveBtn, this.deps.leaveLabel());
  }

  /** Empty the frames (no party): detach every row + the leave button. Keeps the
   *  detached rows in the free list so a re-formed party reuses them. */
  clear(): void {
    for (const [pid, row] of this.pool) {
      row.el.remove();
      this.free.push(row);
      this.pool.delete(pid);
    }
    this.leaveBtn?.remove();
  }

  private paintRow(row: PartyRow, m: PartyFrameMember, leader: number): void {
    // The class-color token + the combat class are the party-only writes the four
    // original writers cannot express (decision 5a's setStyleProp / toggleClass).
    this.writers.setStyleProp(row.el, CLASS_COLOR_PROP, this.deps.classCss(m.cls));
    const inCombat = !!m.inCombat && !m.dead;
    this.writers.toggleClass(row.el, COMBAT_CLASS, inCombat);
    // The shared frame (name / level / hp + resource fills / dead + out-of-range
    // classes) through the family instance, byte-faithful to the inline markup.
    row.painter.paint(
      unitFrameView({
        present: true,
        hpFrac: m.hp / Math.max(1, m.mhp),
        hpText: '',
        resourceKind: m.rtype,
        resFrac: m.res / Math.max(1, m.mres),
        resText: '',
        levelText: `${leader === m.pid ? PARTY_LEADER_GLYPH : ''}${m.level}`,
        name: m.name,
        portraitKey: `${PARTY_CREST_KEY_PREFIX}${m.cls}`,
        absorb: null,
        dead: !!m.dead,
        outOfRange: m.oor,
      }),
    );
    // The dead / combat / out-of-range badge icons: persistent, only display toggles
    // (the non-color cue that stays distinguishable under forced-colors).
    this.writers.setDisplay(row.badges.dead, m.dead ? BADGE_SHOWN : BADGE_HIDDEN);
    this.writers.setDisplay(row.badges.combat, inCombat ? BADGE_SHOWN : BADGE_HIDDEN);
    this.writers.setDisplay(row.badges.oor, m.oor ? BADGE_SHOWN : BADGE_HIDDEN);
  }

  private ensureLeaveButton(): HTMLButtonElement {
    if (!this.leaveBtn) this.leaveBtn = createLeaveButton(this.doc, this.deps.onLeave);
    return this.leaveBtn;
  }
}
