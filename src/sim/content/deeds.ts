// Book of Asphodelia content tables. PHAA-744 ships the engine/wire layer only:
// these stay empty placeholders so src/sim/deeds.ts compiles and is testable.
// PHAA-745 (creative-gated) fills these in with the authored deed/title roster.

import type { DeedDef, TitleDef } from '../types';

export const DEEDS: Record<string, DeedDef> = {};

export const TITLES: Record<string, TitleDef> = {};
