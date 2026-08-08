// Pure, host-agnostic view model for the HUD title tracker (PHAA-747).
//
// The pure-core half of the pure-core + thin-painter split (root CLAUDE.md
// Conventions; reference xp_bar.ts / unit_frame.ts). The title tracker is a
// small chip that sits in the HUD chrome and surfaces the player's currently-
// equipped title plus a count of unspent (earned-but-not-equipped) titles.
// It is a per-frame HUD widget: hud.update() drives the painter every frame
// through the PainterHostWriters elision facet, and the painter elides every
// unchanged write via the host's hotWriteCache. The core returns ONLY the
// discriminated values the painter writes (chip text, optional "unspent"
// badge, optional prefix/postfix ordering). No DOM, no i18n, no time/random.
//
// The player identity uses a STABLE key the painter diffs against: the title
// id itself. The same id always renders the same chip; a swap is a one-shot
// write the painter rebuilds on. The earned-titles count is the same: a
// stable integer the painter writes via setText, elided when unchanged.

import { TITLES } from '../sim/data';
import type { TitleDef } from '../sim/types';

/** The HUD title tracker widget state, after a single derivation. */
export interface TitleTrackerView {
  /** The resolved active title display string, or null when no title is equipped. */
  display: string | null;
  /** Title id the painter uses as its establish-write key (stable across renders). */
  titleKey: string | null;
  /** True iff the title should render as a prefix (e.g. "Sir <name>") vs suffix ("<name> the Wayfarer"). */
  prefix: boolean;
  /** Count of earned-but-not-equipped titles. The painter shows a "+N" badge when > 0. */
  unspentCount: number;
  /**
   * Total earned titles. The painter uses this to hide the badge entirely
   * when unspentCount is 0 (a player with no titles equipped AND only one
   * earned sees nothing extra; with 3 earned and 1 equipped, "+2" appears).
   */
  totalEarned: number;
}

/** Inputs the painter feeds the builder each frame. */
export interface TitleTrackerInput {
  /** Currently-equipped title id, or null when no title is set. */
  activeTitle: string | null;
  /** Set of title ids the player has earned (the picker rows come from this). */
  earnedTitles: ReadonlySet<string>;
}

/**
 * Build the title tracker view-model from the player's current title + earned
 * set. The returned view is allocation-light: every field is a primitive
 * (string | number | boolean | null). The painter owns its own caches.
 */
export function titleTrackerView(input: TitleTrackerInput): TitleTrackerView {
  const { activeTitle, earnedTitles } = input;

  let display: string | null = null;
  let prefix = false;
  let titleKey: string | null = null;

  if (activeTitle !== null) {
    const def: TitleDef | undefined = TITLES[activeTitle];
    if (def) {
      display = def.display;
      prefix = def.prefix === true;
      titleKey = def.id;
    }
  }

  const totalEarned = earnedTitles.size;
  // Unspent = earned - (active ? 1 : 0). A player with no active title has
  // every earned title as "unspent" the tracker can flag.
  const unspentCount = totalEarned - (activeTitle !== null ? 1 : 0);

  return {
    display,
    titleKey,
    prefix,
    unspentCount,
    totalEarned,
  };
}

/**
 * True iff the chip should be rendered at all (a player with zero earned
 * titles AND no active title has nothing to show). The painter hides the
 * chip when this returns false so the chrome area stays clean until the
 * first title is earned.
 */
export function shouldShowTitleTracker(input: TitleTrackerInput): boolean {
  return input.activeTitle !== null || input.earnedTitles.size > 0;
}
