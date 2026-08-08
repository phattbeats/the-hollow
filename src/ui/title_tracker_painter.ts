// Thin DOM painter for the HUD title tracker (PHAA-747).
//
// The consumer half of the pure-core + thin-painter split
// (title_tracker_view.ts is the pure core). The tracker is a per-frame HUD
// chrome widget: hud.update() calls updateTitleTracker(view, writers) every
// frame, and the painter elides every unchanged write through the shared
// PainterHostWriters facet (PainterHostWriters / makeWriterFacet, the same
// cache the unit_frame / xp_bar / quest_tracker painters share). The chip
// re-establishes only when the title id or earned count actually changes;
// an unchanged frame costs zero DOM writes.
//
// The painter owns NO IWorld reference and reads only the resolved view
// values. The HUD binds the chip to a single root element (`#title-tracker`)
// and toggles its visibility through the `display` writer (also elided).

import type { PainterHostWriters } from './painter_host';
import type { TitleTrackerInput, TitleTrackerView } from './title_tracker_view';
import { shouldShowTitleTracker, titleTrackerView } from './title_tracker_view';

/**
 * The chip's binding site. The painter does not cache DOM refs itself; the
 * HUD resolves `#title-tracker` once at construction and reuses the same
 * element every frame, exactly like the unit_frame family.
 */
export interface TitleTrackerRefs {
  root: HTMLElement;
  /** Inner element that holds the active title display text. */
  titleEl: HTMLElement;
  /** Inner element that holds the "+N unspent" badge, hidden when N is 0. */
  badgeEl: HTMLElement;
}

/** Inputs the HUD feeds each frame. */
export interface TitleTrackerPaintInput {
  refs: TitleTrackerRefs;
  writers: PainterHostWriters;
  state: TitleTrackerInput;
}

/**
 * Drive the title tracker chip for one frame. Resolves the view, elides
 * unchanged writes via the writers' host caches, and returns the resolved
 * view so the HUD can keep its own short-circuit if it wants (e.g. skip a
 * second pass when an event-driven recompute already happened). The HUD
 * uses the return value only as a `void`-style indicator today.
 */
export function updateTitleTracker(input: TitleTrackerPaintInput): TitleTrackerView {
  const { refs, writers, state } = input;
  const view = titleTrackerView(state);
  const show = shouldShowTitleTracker(state);

  // Root visibility: hidden entirely until the first title is earned, shown
  // thereafter. The writer elides a repeat of the same display value.
  writers.setDisplay(refs.root, show ? 'inline-flex' : 'none');

  if (!show) return view;

  // The active title text. The painter stores the RESOLVED English display
  // (the view emits it through TITLES[id].display); the HUD-localized
  // version is layered on top by an i18n lookup keyed on the title id. To
  // keep the painter allocation-light and i18n-free, the HUD is responsible
  // for the i18n indirection: see the comment in hud.updateTitleTracker
  // about the host-side localize pass. The painter writes the raw display
  // string the view returns, and the caller passes the localized text by
  // mutating state through a host-side wrapper. The simplest path is to
  // re-localize at the call site: see `localizeTitleTracker` below.
  writers.setText(refs.titleEl, view.display ?? '');

  // Prefix/suffix class: the painter styles the chip layout through a CSS
  // class toggle, so the host's CSS can pick `is-prefix` for "<title> <name>"
  // and the default for "<name> <title>". setText above carries the bare
  // display string; the host's CSS handles the surrounding name.
  writers.toggleClass(refs.root, 'is-prefix', view.prefix);

  // The unspent badge: hidden when zero (zero earned-but-not-equipped), shown
  // with the count otherwise. The host's CSS owns the badge visuals; the
  // painter only flips the visibility class and writes the count text.
  const showBadge = view.unspentCount > 0;
  writers.toggleClass(refs.badgeEl, 'is-on', showBadge);
  writers.setDisplay(refs.badgeEl, showBadge ? 'inline' : 'none');
  if (showBadge) {
    // The "+N" text is a host-localized format the caller passes in; the
    // painter just writes the already-formatted string. The HUD's call site
    // resolves the i18n template `hudChrome.titleTracker.unspentBadge`.
    writers.setText(refs.badgeEl, formatUnspentBadge(view.unspentCount));
  }

  return view;
}

/**
 * Host-side helper that builds the localized unspent badge text. Kept here
 * (not in the painter) because it routes through the i18n runtime, which
 * the painter deliberately avoids. The HUD calls this BEFORE the painter
 * each frame and passes the resulting string through a writer-driven text
 * node; this helper is the canonical pre-formatter.
 */
export function formatUnspentBadge(count: number): string {
  // The literal "+N" is intentionally English-only at the format layer; the
  // HUD wraps it through the i18n template `hudChrome.titleTracker.unspent`
  // which carries the per-locale copy. Keeping the format here means the
  // painter can stay i18n-free.
  return `+${Math.max(0, Math.floor(count))}`;
}
