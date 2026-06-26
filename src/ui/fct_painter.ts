// The pooled-div floating-combat-text (FCT) painter -- the per-frame HALF of the FCT
// split (P13b), filling in the seam P13a stood up (the pure fct_core descriptor + a
// dormant driver). It replaces the per-event createElement + setTimeout fct() in hud.ts
// with a FIXED-SIZE pre-allocated div ring: spawn() claims a free slot or evicts the
// oldest when the pool is full, and step() runs every frame from hud.update() (decision 8)
// to recycle each slot once its TTL elapses. The old path created a DOM node per combat
// event and leaned on setTimeout to remove it; under an AoE / boss burst that grew without
// bound. This ring caps the live node count at FCT_POOL_CAP and never allocates a node
// after construction.
//
// SCREEN-ANCHORED, byte-faithful to the old fct() and to WoW-style combat text: spawn()
// projects the head anchor ONCE (renderer.worldToScreen + the getUiScale author-space
// divide), writes left / top a single time, and leaves the number at that screen position
// for its ~1.25s life while the CSS @keyframes float it straight up. It does NOT re-project
// per frame, so a number pops over the unit and rises in SCREEN space (it does not slide
// with the camera) -- exactly how the classic / WoW damage numbers read, and identical to
// the old fct(). step() therefore only ages out expired slots; there is no per-frame
// position write, so an unchanged frame costs nothing.
//
// WRITE ROUTING (decisions 3 / 5a): every DOM write goes through the PainterHost
// write-elision facet -- setText for the number, toggleClass for the colour token + crit
// class, setStyleProp for left / top / animation, setDisplay for the show. So a no-op frame
// costs no DOM mutation and the skip-rate holds. The per-kind colour moved off el.style.color
// onto a CSS class token keyed by the descriptor kind (decision 12); the painter never names
// a hex (the colours live in hud.css's .fct-<token> rules). The crit rise stays on the
// .fct.crit CSS class (the crit keyframe rises -86px, the base -76px), never a descriptor
// distance, exactly as P13a's fct_core comment requires.
//
// POOL-LIFECYCLE RULES (the load-bearing correctness, state.md Top risk 2):
//  - FIXED CAP: FCT_POOL_CAP nodes are pre-allocated in the constructor; spawn() never
//    calls createElement. At cap, spawn() EVICTS the oldest live entry (live[] is kept in
//    spawn order, so live[0] is the oldest) and reuses its node, so the live node count is
//    bounded by FCT_POOL_CAP forever.
//  - ANIMATION RESTART: a recycled node has already played its CSS rise; re-using it must
//    REPLAY the animation. A node off the free list was detached in an earlier frame's
//    step(), so re-appending it restarts the animation naturally (the browser observed the
//    disconnect). Only a same-tick EVICTED node is still attached when reused -- a same-tick
//    detach + re-append is an unobserved move that does NOT restart the animation -- so
//    spawn() forces the restart there with the reflow trick (animation:none -> read
//    offsetWidth -> restore), routed through the elided setStyleProp. Normal play never
//    evicts (the pool is far above a boss pull), so it pays no reflow; only a genuine
//    over-cap AoE burst does.
//  - NO STALE CLOSURE: the painter holds no per-slot listener (FCT is decorative,
//    pointer-events:none), so the P11c / P12b capture-by-value hazard cannot occur; the only
//    mutable slot state is read synchronously inside spawn() / step().
//
// ACCESSIBILITY (decision 10): the combat-text live region (a coalesced, polite aria-live
// summary of FCT) is DEFERRED to P15a, which owns the cross-window a11y infra. FCT divs
// themselves are decorative transient text (not focusable, pointer-events:none), so this
// painter introduces no focus trap and no announced text. TODO(P15a): build the polite
// role=status combat-text live region (a FCT_ANNOUNCE_CADENCE_MS-coalesced summary, never
// raw per-damage streaming) over this surface and aria-hide the raw .fct nodes so the
// summary does not double-announce.

import { describeFct, type FctColorToken, type FctDescriptor, type FctEvent } from './fct_core';
import type { PainterHostWriters } from './painter_host';

/**
 * The projection the painter needs from the renderer: a world point -> the UNZOOMED
 * viewport point plus a behind-camera flag (renderer.worldToScreen's exact return shape,
 * {x, y, behind}). Injected so a Node test drives the pool without Three.js.
 */
export type FctProject = (
  x: number,
  y: number,
  z: number,
) => { x: number; y: number; behind: boolean };

/**
 * Max simultaneous on-screen floaters. Pre-allocated as DOM nodes in the constructor;
 * spawn() evicts the oldest once the pool is full. Chosen comfortably above a boss pull's
 * worth of simultaneous numbers so normal play never evicts, while a runaway AoE stays
 * bounded (the old createElement path had no ceiling at all).
 */
export const FCT_POOL_CAP = 64;

// Class / style-property names the painter drives. Named (not inlined) so the painter
// references no bare DOM string magic and -- crucially -- no hex / px colour literal
// (decision 12); the colours live in hud.css's .fct-<token> rules.
const FCT_BASE_CLASS = 'fct';
const FCT_CRIT_CLASS = 'crit';
// The colour token becomes the class `fct-<token>` (e.g. 'fct-heal'); hud.css maps each to
// the live hex. Deriving it from the token keeps the painter and the descriptor's token
// vocabulary (fct_core) in one place rather than duplicating an 11-row table.
const FCT_COLOR_CLASS_PREFIX = 'fct-';
const LEFT_PROP = 'left';
const TOP_PROP = 'top';
const ANIMATION_PROP = 'animation';
const ANIMATION_SUSPEND = 'none'; // suspend the CSS rise...
const ANIMATION_RESTORE = ''; // ...then restore the stylesheet animation to replay it.
const DISPLAY_SHOWN = '';

function colorClass(token: FctColorToken): string {
  return `${FCT_COLOR_CLASS_PREFIX}${token}`;
}

/**
 * One pre-allocated pool slot. `node` is permanent; the rest is rewritten on each spawn.
 * `colorClass` is the colour class currently applied to the node, tracked so a reuse toggles
 * the previous one off before the new one on (toggleClass elides per (element, class), so the
 * painter must turn the old class off explicitly). `bornAt` + `ttlMs` drive the TTL recycle.
 * live[] is kept in spawn order, so the array position (not a stored counter) is the FIFO key.
 */
interface FctSlot {
  readonly node: HTMLElement;
  colorClass: string | null;
  bornAt: number;
  ttlMs: number;
}

export class FctPainter {
  // Free slots (detached nodes ready to reuse). A slot is in exactly one of free / live.
  private readonly free: FctSlot[] = [];
  // Live slots in spawn order: new spawns append, TTL / eviction removes while preserving
  // order, so live[0] is always the oldest -> the eviction victim.
  private readonly live: FctSlot[] = [];
  private readonly random: () => number;

  constructor(
    private readonly writers: PainterHostWriters,
    private readonly mount: HTMLElement,
    private readonly project: FctProject,
    private readonly getScale: () => number,
    opts: { cap?: number; doc?: Document; random?: () => number } = {},
  ) {
    const { cap = FCT_POOL_CAP, doc = document, random = Math.random } = opts;
    // Math.random for the horizontal jitter is allowed on the PAINTER (not the pure core);
    // a test injects a deterministic draw.
    this.random = random;
    for (let i = 0; i < cap; i++) {
      const node = doc.createElement('div');
      node.className = FCT_BASE_CLASS;
      this.free.push({ node, colorClass: null, bornAt: 0, ttlMs: 0 });
    }
  }

  /**
   * Spawn a floater for `event` at frame clock `now`. Builds the pure descriptor with an
   * injected jitter draw, projects the head anchor ONCE and behind-culls exactly as the live
   * fct() did (no slot claimed if behind), claims a free slot or evicts the oldest, writes the
   * text + colour / crit classes, positions the node in author space, attaches it, and (only
   * when an attached node was evicted) replays the CSS rise.
   */
  spawn(event: FctEvent, now: number): void {
    const d = describeFct(event, this.random());
    const v = this.project(d.anchor.x, d.anchor.y, d.anchor.z);
    if (v.behind) return; // faithful to the live `if (v.behind) return;` -- waste no slot.
    // A free node was detached in an earlier frame, so re-appending restarts its CSS rise
    // naturally; an evicted node is still attached and needs the forced restart below.
    let slot = this.free.pop();
    const evicted = slot === undefined;
    if (slot === undefined) slot = this.live.shift() as FctSlot;
    slot.bornAt = now;
    slot.ttlMs = d.ttlMs;
    this.applyContent(slot, d);
    this.position(slot.node, v, d.jitterOffset, this.getScale());
    this.writers.setDisplay(slot.node, DISPLAY_SHOWN);
    this.mount.appendChild(slot.node);
    if (evicted) this.restartAnimation(slot.node);
    this.live.push(slot);
  }

  /**
   * Advance every live floater one frame: recycle the ones whose TTL elapsed. Runs from
   * hud.update()'s every-frame tier (decision 8: no second rAF). The number is screen-frozen
   * (spawn positioned it once), so there is NO per-frame position write -- step() only ages
   * out slots. An empty pool returns immediately, so the no-combat steady state holds the
   * perf gate by construction.
   */
  step(now: number): void {
    if (this.live.length === 0) return;
    // Reverse walk so splicing an expired slot does not skip its neighbour.
    for (let i = this.live.length - 1; i >= 0; i--) {
      const slot = this.live[i];
      if (now - slot.bornAt >= slot.ttlMs) {
        slot.node.remove();
        this.live.splice(i, 1);
        this.free.push(slot);
      }
    }
  }

  /** Live floater count -- the bound the perf-gate AoE burst asserts never exceeds the cap. */
  liveCount(): number {
    return this.live.length;
  }

  // --- internals ---

  /** Text + colour-token class + crit class, all through the elided writers. Switches the
   *  colour class by toggling the previous one off and the new one on (so a recycled node
   *  never keeps a stale colour). */
  private applyContent(slot: FctSlot, d: FctDescriptor): void {
    this.writers.setText(slot.node, d.text);
    const cls = colorClass(d.colorToken);
    if (slot.colorClass !== cls) {
      if (slot.colorClass !== null) this.writers.toggleClass(slot.node, slot.colorClass, false);
      this.writers.toggleClass(slot.node, cls, true);
      slot.colorClass = cls;
    }
    this.writers.toggleClass(slot.node, FCT_CRIT_CLASS, d.crit);
  }

  /** Position via left / top in author space: (projected x + jitter) / uiScale and
   *  y / uiScale, written ONCE at spawn. EXACTLY the live fct() formula -- the getUiScale
   *  divide is load-bearing because worldToScreen returns the UNZOOMED viewport point while
   *  #ui is scaled by `zoom`, so an undivided write mispositions whenever uiScale != 1. */
  private position(
    node: HTMLElement,
    v: { x: number; y: number },
    jitterOffset: number,
    scale: number,
  ): void {
    this.writers.setStyleProp(node, LEFT_PROP, `${(v.x + jitterOffset) / scale}px`);
    this.writers.setStyleProp(node, TOP_PROP, `${v.y / scale}px`);
  }

  /** Replay the CSS rise on a same-tick EVICTED (still-attached) node. A same-tick detach +
   *  re-append does NOT restart a CSS animation, so force it: set animation:none, read
   *  offsetWidth to flush the 'none', then restore the stylesheet animation. Both writes route
   *  through the elided setStyleProp; the offsetWidth read is the only direct DOM touch and is
   *  what forces the reflow. Free / TTL-recycled nodes restart on re-append, so this is not
   *  called for them -- normal play pays no reflow. */
  private restartAnimation(node: HTMLElement): void {
    this.writers.setStyleProp(node, ANIMATION_PROP, ANIMATION_SUSPEND);
    void node.offsetWidth;
    this.writers.setStyleProp(node, ANIMATION_PROP, ANIMATION_RESTORE);
  }
}
