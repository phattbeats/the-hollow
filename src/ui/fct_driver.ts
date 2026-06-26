// Per-frame floating-combat-text (FCT) driver -- the scaffolding HALF of the FCT split
// (P13a). It exists and ticks every frame from hud.update()'s every-frame tier (decision
// 8: folded into the existing `hud` perf bucket, NOT a second rAF), but this phase it is
// DORMANT: no spawn site feeds it, so its pool is always empty, step() returns
// immediately, and it writes nothing. The live FCT on screen still comes entirely from
// the per-event createElement + setTimeout fct() in hud.ts (and showSelfNote, whose
// cross-file caller is main.ts), which is UNCHANGED -- visible FCT is byte-identical to
// before this phase.
//
// The point of landing the driver dormant is that P13b only has to swap the spawn
// implementation onto a proven, already-ticking driver: it reroutes the 8 FCT spawn
// sites onto spawn(), fills in the pooled-div ring + worldToScreen projection +
// getUiScale author-space divide + ttl eviction inside step(), and deletes the old
// fct(). The driver consumes the PainterHost write-elision facet now (decisions 3 / 5a)
// so every DOM write P13b adds is elided by construction; there is deliberately no
// raw-write path for P13b to lean on.

import { describeFct, type FctDescriptor, type FctEvent } from './fct_core';
import type { PainterHostWriters } from './painter_host';

/**
 * One live on-screen FCT entry. The pool stays empty until P13b reroutes the spawn sites,
 * so no entry is ever created this phase; the shape exists to wire the core -> driver ->
 * elided-writer seam P13b fills in. `node` is the pooled div the painter positions,
 * `descriptor` the resolved spawn descriptor, and `bornAt` the per-frame clock at spawn
 * (so step() can evict once now - bornAt >= descriptor.ttlMs).
 */
interface FctLiveEntry {
  readonly node: HTMLElement;
  readonly descriptor: FctDescriptor;
  readonly bornAt: number;
}

export class FctDriver {
  // The on-screen pool. EMPTY this phase: nothing calls spawn() until P13b migrates the
  // FCT spawn sites here, so the driver is dormant and step() is a no-op.
  private readonly live: FctLiveEntry[] = [];

  constructor(private readonly writers: PainterHostWriters) {}

  /**
   * The spawn seam P13b reroutes the FCT spawn sites onto. UNWIRED this phase: no caller
   * invokes it, so `live` stays empty and the driver spawns nothing. P13b will acquire a
   * pooled div for `node`, push the entry, and let step() project + evict it. The
   * descriptor (color token, head-offset anchor, injected jitter, ttl) comes from the
   * pure core so the migration is a faithful swap of the live fct().
   */
  spawn(node: HTMLElement, event: FctEvent, jitter01: number, now: number): void {
    this.live.push({ node, descriptor: describeFct(event, jitter01), bornAt: now });
  }

  /**
   * Advance every live entry one frame. DORMANT this phase: `live` is empty, so this
   * returns immediately -- zero DOM writes, zero allocation -- and must not regress the
   * per-frame perf gate (frameP95 / hudHotDomSkipRate). The loop body is the seam P13b
   * fills in: it projects each entry's anchor, positions / fades the pooled div through
   * the elided facet (`this.writers`, never a raw style/textContent write), and frees the
   * node once its ttl elapses.
   */
  step(now: number): void {
    if (this.live.length === 0) return;
    for (const entry of this.live) {
      if (now - entry.bornAt >= entry.descriptor.ttlMs) {
        this.writers.setDisplay(entry.node, 'none');
      } else {
        this.writers.setText(entry.node, entry.descriptor.text);
      }
    }
  }
}
