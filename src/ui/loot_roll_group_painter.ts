// Thin painter for the per-roll, group-visible vote strip painted under the
// loot-roll frame's action buttons. The pure view-core in loot_roll_group_view.ts
// owns the IWorld -> render-model mapping (which rolls are open, who has
// answered and how, the already-localized per-choice label). This file owns
// the DOM side: a keyed pool of one strip element per open roll, persisted
// across frames, its per-candidate chip text updated IN PLACE through the
// host's elided writers so a fresh answer from a party member flips a single
// chip's text without rebuilding anything.
//
// WRITE ROUTING: every per-frame DOM write goes through the writer facet
// (setText for the chip text, toggleClass for the choice/pending states and
// the viewer-is-candidate bold, setDisplay for the empty-state). The strip
// and its child chips are created once per pooled roll, in `createStrip`; no
// `innerHTML` writes per frame, no per-frame `createElement`. The host's
// elision cache is byte-identical on the hot path so a steady frame pays
// zero DOM mutations.
//
// KEYED POOL: each strip is keyed by rollId. The server's lootRollGroupStatus
// is server-stable in iteration order (and keyed by rollId, a strictly
// increasing server-assigned int), so the pool survives a "different rolls
// open" frame without reorder, and a resolved roll is simply dropped from
// the pool. The min-order reconcile matches the existing auras_painter and
// fct_painter patterns (src/ui/CLAUDE.md).
//
// OWNERSHIP: `LootRollGroupPainter` owns its strip elements for the lifetime
// of one loot-roll frame. The Hud owns the per-roll roll row (.loot-roll
// .panel); the painter owns the nested .loot-roll-group strip and its
// per-candidate chips. The Hud calls `paint(view)` once per reconcile to
// drive the pool; the painter returns the inserted strip node via
// `stripFor(rollId)` so the Hud can attach it to the matching roll row at
// construction time. (This is a more natural seam than building and then
// re-parenting the strip: a roll row is created/destroyed alongside its
// strip, keyed by the same rollId.)

import type { LootRollGroupView, LootRollGroupViewRoll } from './loot_roll_group_view';
import type { PainterHostWriters } from './painter_host';

// Class / property names the painter drives. Named, not inlined, so the
// painter references no bare DOM string literal.
const STRIP_CLASS = 'loot-roll-group';
const CHIP_CLASS = 'loot-roll-chip';
const NEED_CLASS = 'need';
const GREED_CLASS = 'greed';
const PASS_CLASS = 'pass';
const PENDING_CLASS = 'pending';
const VIEWER_CLASS = 'viewer';

// Display values used to toggle the strip visibility. The empty-state is
// shown when the local player's party has no open need-greed rolls; the
// element is otherwise hidden by `display: none` so the per-frame cost is
// just a single setDisplay on a node the host has cached.
const DISPLAY_NONE = 'none';
const DISPLAY_BLOCK = '';

export class LootRollGroupPainter {
  // Keyed pool: rollId -> { strip, chips: pid -> chip element }. The chips
  // map is a per-pool sub-pool so a fresh answer for the same rollId reuses
  // the same node (keyed by pid) without any DOM churn.
  private readonly pool = new Map<
    number,
    { strip: HTMLElement; chips: Map<number, HTMLElement> }
  >();
  // Lazy host: the parent element strips are appended to. Resolved on the
  // first paint() call (the host creates the element if it doesn't yet
  // exist) and cached for subsequent calls. Null until first paint.
  private host: HTMLElement | null = null;
  // A host-managed empty placeholder, shown when no rolls are open. Reused
  // across every empty-frame so the cost is one setDisplay.
  private emptyEl: HTMLElement | null = null;

  constructor(private readonly writers: PainterHostWriters) {}

  // Drive the pool against the current view. Same shape as auras_painter's
  // `paint`: walk the view in server order, reconcile the pool with the
  // minimum node moves, write per-candidate chip text/class in place. A
  // resolved roll is simply absent from the view, so the pool drops it.
  paint(view: LootRollGroupView, host: HTMLElement, emptyEl: HTMLElement | null): void {
    this.host = host;
    this.emptyEl = emptyEl;

    // Empty state: nothing open. Show the empty placeholder, hide every
    // pooled strip, and prune the pool (the host's elision keeps the
    // per-frame setDisplay on the empty element a no-op when it was already
    // shown).
    if (view.rolls.length === 0) {
      if (this.emptyEl) this.writers.setDisplay(this.emptyEl, DISPLAY_BLOCK);
      for (const { strip } of this.pool.values()) this.writers.setDisplay(strip, DISPLAY_NONE);
      this.pool.clear();
      return;
    }
    if (this.emptyEl) this.writers.setDisplay(this.emptyEl, DISPLAY_NONE);

    const seenRolls = new Set<number>();
    for (const roll of view.rolls) {
      seenRolls.add(roll.rollId);
      let entry = this.pool.get(roll.rollId);
      if (!entry) {
        const strip = this.createStrip(roll);
        this.host.appendChild(strip);
        entry = { strip, chips: new Map() };
        this.pool.set(roll.rollId, entry);
        this.writers.setDisplay(strip, DISPLAY_BLOCK);
      } else {
        this.writers.setDisplay(entry.strip, DISPLAY_BLOCK);
      }
      this.paintStrip(entry, roll);
    }
    // Drop resolved rolls (no longer in the view) by hiding their strip and
    // forgetting them; the next time they re-open a fresh strip is built.
    for (const [rollId, entry] of this.pool) {
      if (!seenRolls.has(rollId)) {
        this.writers.setDisplay(entry.strip, DISPLAY_NONE);
        this.pool.delete(rollId);
      }
    }
  }

  // Look up the DOM node a given roll row should attach the strip under.
  // Returns null when the roll is not in the active pool (a transient
  // mismatch between the roll row and the view is benign: the next paint
  // restores consistency).
  stripFor(rollId: number): HTMLElement | null {
    return this.pool.get(rollId)?.strip ?? null;
  }

  // Build a fresh EMPTY strip container. The per-candidate chips are owned
  // solely by paintStrip (keyed by pid in `entry.chips`); building them here
  // too would double every chip (an untracked set from createStrip plus the
  // tracked set paintStrip creates on first paint). The static ARIA role is a
  // constant, so a raw setAttribute is fine; the localized aria-label is a
  // player-visible string and is set by paintStrip through the setAttr writer.
  private createStrip(roll: LootRollGroupViewRoll): HTMLElement {
    const strip = document.createElement('div');
    strip.className = STRIP_CLASS;
    strip.setAttribute('role', 'group');
    strip.dataset.rollId = String(roll.rollId);
    // Hide by default; paint() shows it after appending. The pre-append
    // `display: none` keeps a one-frame stale node invisible.
    strip.style.display = DISPLAY_NONE;
    return strip;
  }

  // Update a pooled strip's chip texts + classes for the current roll view.
  // Per-chip writes route through the elided writer cache so a steady frame
  // (no fresh answer) is a no-op on the DOM.
  private paintStrip(
    entry: { strip: HTMLElement; chips: Map<number, HTMLElement> },
    roll: LootRollGroupViewRoll,
  ): void {
    // Localized strip aria-label, routed through the elided setAttr writer (a
    // steady frame re-writes nothing). Set here rather than in createStrip so
    // it always reflects the current localized view text.
    this.writers.setAttr(entry.strip, 'aria-label', roll.ariaLabel);
    const seenPids = new Set<number>();
    for (const viewEntry of roll.entries) {
      seenPids.add(viewEntry.pid);
      let chip = entry.chips.get(viewEntry.pid);
      if (!chip) {
        // A new candidate appeared (mid-vote party add). Build a fresh chip
        // in place; the pool will hold it for the rest of the roll.
        chip = document.createElement('span');
        chip.className = `${CHIP_CLASS} ${PENDING_CLASS}`;
        chip.dataset.pid = String(viewEntry.pid);
        const name = document.createElement('span');
        name.className = `${CHIP_CLASS}-name`;
        const label = document.createElement('span');
        label.className = `${CHIP_CLASS}-label`;
        chip.appendChild(name);
        chip.appendChild(document.createTextNode(' '));
        chip.appendChild(label);
        entry.strip.appendChild(chip);
        entry.chips.set(viewEntry.pid, chip);
      }
      const nameEl = chip.firstElementChild as HTMLElement;
      const labelEl = chip.lastElementChild as HTMLElement;
      this.writers.setText(nameEl, viewEntry.name);
      this.writers.setText(labelEl, viewEntry.label);
      // Choice class: drop all three + pending, then add the current one.
      // toggleClass on the four names keeps the writer cache small (one
      // per (chip, class) key) and never emits a duplicate.
      this.writers.toggleClass(chip, NEED_CLASS, viewEntry.choice === 'need');
      this.writers.toggleClass(chip, GREED_CLASS, viewEntry.choice === 'greed');
      this.writers.toggleClass(chip, PASS_CLASS, viewEntry.choice === 'pass');
      this.writers.toggleClass(chip, PENDING_CLASS, viewEntry.choice === 'pending');
      this.writers.toggleClass(chip, VIEWER_CLASS, roll.viewerIsCandidate);
    }
    // Candidates that disappeared (left the party mid-roll) drop their
    // chip from the pool; their DOM node is detached to keep the strip
    // visually clean.
    for (const [pid, chip] of entry.chips) {
      if (!seenPids.has(pid)) {
        chip.remove();
        entry.chips.delete(pid);
      }
    }
  }
}
