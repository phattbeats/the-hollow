// Pure, host-agnostic view model for the Book of Asphodelia (PHAA-747).
//
// The pure-core half of the pure-core + thin-painter split (root CLAUDE.md
// Conventions; reference vendor_view.ts / arena_window_view.ts). The Book
// renders the player's auto-tracking deed roster (split into the engine's
// 11 DeedCategory groups), a title picker (the earned title the player has
// equipped via setActiveTitle, plus a list of unselected earned titles they
// can swap to), and a category filter. The DOM/i18n side lives in
// book_window.ts; rendering is driven entirely off the structure here.
//
// Reads only the IWorldDeeds seam (deedLog / deedsDone / earnedTitles /
// activeTitle) and the static DEEDS + TITLES content tables, so a Sim-shaped
// and a ClientWorld-shaped stub produce identical output (the offline/online
// parity guard the recipe asks for).
//
// DOM-free and i18n-free: rows carry the raw deed id + objective label + count
// discriminators the painter localizes; titles carry the raw id the title
// picker passes back through setActiveTitle. The hidden category is
// conceal-until-earned (a deed whose state is not 'done' is dropped from the
// roster; the cross-surface cross-surface PHAA-748 inherits that contract);
// every other category lists active + done deeds so the player can browse
// what is left to earn.
//
// Set membership is treated as authoritative: a deed in deedsDone is 'done'
// regardless of whether the engine wrote it to deedLog this session (the
// engine clears the on-disk deedLog of completed entries per PHAA-744 design,
// but deedsDone persists). A title in earnedTitles is selectable, even if the
// engine's titleReward path didn't surface it in deedLog yet. The view does
// not consult the content tables for completion math; the engine owns that.

import { DEEDS, TITLES } from '../sim/data';
import type { DeedCategory, DeedDef, DeedObjective, DeedProgress, TitleDef } from '../sim/types';

/**
 * Stable, engine-defined display order for the 11 DeedCategory values. The
 * engine declares the category set as a union in sim/types.ts; this is the
 * UI-display order. Hidden is intentionally LAST so the rest of the book
 * stays above the conceal-until-earned fold (a player who hasn't earned a
 * hidden deed never sees the hidden category at all, so the position is
 * conventional and not user-visible).
 */
export const BOOK_CATEGORY_ORDER: readonly DeedCategory[] = [
  'chronicle',
  'collection',
  'combat',
  'delve',
  'dungeon',
  'exploration',
  'feat',
  'progression',
  'pvp',
  'social',
  'hidden',
] as const;

/** A single objective on a deed row, with the player's live count alongside. */
export interface BookObjectiveView {
  /** The objective's stable label (raw English from DEEDS; the painter localizes). */
  label: string;
  /** The player's live count for this objective (parallel to DeedDef.objectives). */
  count: number;
  /** The objective's target count (from DeedDef.objectives[i].count). */
  target: number;
  /** True iff count >= target (the per-objective completion discriminator). */
  done: boolean;
}

/** One deed row in the book, after the engine's deedLog + deedsDone merge. */
export interface BookDeedRow {
  deedId: string;
  category: DeedCategory;
  /** Raw English name (the painter localizes through entity_i18n's 'deed' kind). */
  name: string;
  /** Raw English body text (the painter localizes through entity_i18n). */
  text: string;
  /** The deed's full objective list, with per-objective live counts. */
  objectives: BookObjectiveView[];
  /**
   * True when every objective is done, regardless of whether the engine
   * surfaced this in deedLog (deedsDone is authoritative). The painter
   * styles done rows distinctly.
   */
  done: boolean;
  /** Title id granted on completion, or null when this deed grants no title. */
  titleRewardId: string | null;
}

/** One category section in the book. */
export interface BookCategorySection {
  category: DeedCategory;
  /** The category's deeds, sorted by completion (active first, then done). */
  deeds: BookDeedRow[];
  /** done / total count for the category header. */
  doneCount: number;
  totalCount: number;
}

/** A title row in the title picker. */
export interface BookTitleRow {
  titleId: string;
  /** Raw display string (the painter localizes through entity_i18n's 'title'). */
  display: string;
  /** True iff this is the player's currently-equipped title. */
  active: boolean;
}

/**
 * The full Book view-model: the roster (per-category), the title picker, and
 * the per-category summary counts the chrome header shows.
 */
export interface BookView {
  /** The category sections, in BOOK_CATEGORY_ORDER. Hidden is empty until earned. */
  categories: BookCategorySection[];
  /** The title picker rows (every earned title), with the active one marked. */
  titles: BookTitleRow[];
  /** Total deeds done across all categories (excludes hidden until earned). */
  totalDone: number;
  /** Total deeds visible in the book (excludes hidden until earned). */
  totalDeeds: number;
  /** Earned title count (titles.length). */
  totalTitles: number;
}

/** Inputs the painter feeds the builder each render. */
export interface BookViewInput {
  /**
   * The player's live deedLog: a Map keyed by deedId with parallel counts and
   * the engine's state ('active' | 'done'). The engine materializes an entry
   * on first progress for each deed (PHAA-744 deeds.ts progressFor), so a
   * missing entry means the deed has never been touched.
   */
  deedLog: ReadonlyMap<string, DeedProgress>;
  /**
   * The set of completed deed ids. Authoritative for "done" (the engine may
   * evict from deedLog once a deed is in deedsDone).
   */
  deedsDone: ReadonlySet<string>;
  /**
   * The set of title ids the player has earned. Every id here is selectable
   * through setActiveTitle (the engine validates against this set).
   */
  earnedTitles: ReadonlySet<string>;
  /**
   * The player's currently-equipped title id, or null for none. The server
   * validates this against earnedTitles; the client mirrors the resolved
   * value.
   */
  activeTitle: string | null;
}

function buildDeedRow(def: DeedDef, input: BookViewInput): BookDeedRow {
  const isDone = input.deedsDone.has(def.id);
  const dp = input.deedLog.get(def.id);
  const objectives: BookObjectiveView[] = def.objectives.map((obj, i) => {
    const live = isDone ? obj.count : (dp?.counts[i] ?? 0);
    const done = live >= obj.count;
    return { label: obj.label, count: live, target: obj.count, done };
  });
  return {
    deedId: def.id,
    category: def.category,
    name: def.name,
    text: def.text,
    objectives,
    done: isDone,
    titleRewardId: def.titleReward ?? null,
  };
}

/**
 * Build the Book view-model. Categories appear in BOOK_CATEGORY_ORDER; a
 * category with no deeds renders as an empty section (the painter shows the
 * empty-state copy). Hidden deeds whose state is not 'done' are dropped, so a
 * player who hasn't earned any hidden deed never sees the hidden category
 * section.
 */
export function buildBookView(input: BookViewInput): BookView {
  // Group authored deeds by category, preserving BOOK_CATEGORY_ORDER.
  const byCategory = new Map<DeedCategory, DeedDef[]>();
  for (const cat of BOOK_CATEGORY_ORDER) byCategory.set(cat, []);
  for (const def of Object.values(DEEDS)) {
    const bucket = byCategory.get(def.category);
    if (bucket) bucket.push(def);
  }

  const categories: BookCategorySection[] = [];
  let totalDone = 0;
  let totalDeeds = 0;

  for (const cat of BOOK_CATEGORY_ORDER) {
    const deeds = byCategory.get(cat) ?? [];
    const isHidden = cat === 'hidden';
    const visibleDeeds: BookDeedRow[] = [];
    let catDone = 0;
    for (const def of deeds) {
      const isDone = input.deedsDone.has(def.id);
      // Hide deeds that aren't earned yet. Hidden category uses this strictly;
      // every other category shows its active deeds so the player can browse.
      if (isHidden && !isDone) continue;
      const row = buildDeedRow(def, input);
      visibleDeeds.push(row);
      if (isDone) catDone++;
    }
    // Within a category, active deeds sort before done; ties break by deedId
    // for stable ordering across renders (the painter diffs the section key).
    visibleDeeds.sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      return a.deedId.localeCompare(b.deedId);
    });

    categories.push({
      category: cat,
      deeds: visibleDeeds,
      doneCount: catDone,
      totalCount: visibleDeeds.length,
    });

    if (!isHidden) {
      totalDeeds += visibleDeeds.length;
      totalDone += catDone;
    }
  }

  // Title picker: every earned title, with the active one marked. Sort the
  // active title first, then the rest in stable id order for diff friendliness.
  const titles: BookTitleRow[] = [];
  for (const id of input.earnedTitles) {
    const def: TitleDef | undefined = TITLES[id];
    if (!def) continue; // engine guard: an earned id without a def is a bug upstream
    titles.push({
      titleId: def.id,
      display: def.display,
      active: def.id === input.activeTitle,
    });
  }
  titles.sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return a.titleId.localeCompare(b.titleId);
  });

  return {
    categories,
    titles,
    totalDone,
    totalDeeds,
    totalTitles: titles.length,
  };
}

/**
 * A single category summary line for the chrome header (the "Combat 12/25"
 * style line a category tab shows). Returns null when the category has no
 * visible deeds, so the painter can suppress empty headers.
 */
export function bookCategorySummary(section: BookCategorySection): string | null {
  if (section.totalCount === 0) return null;
  return `${section.doneCount}/${section.totalCount}`;
}

/**
 * True iff the player has earned any deed (so the HUD title tracker should
 * glow the unspent-title indicator; the painter drives the visual).
 */
export function hasAnyEarnedTitle(input: BookViewInput): boolean {
  return input.earnedTitles.size > 0;
}

/**
 * True iff the player has a title equipped. Used by the HUD title tracker to
 * gate the "show 'the <title>' chip" vs. "show 'No Title Set' hint" branch.
 */
export function hasActiveTitle(input: BookViewInput): boolean {
  return input.activeTitle !== null;
}
