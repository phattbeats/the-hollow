// Book of Asphodelia deed + title catalog (PHAA-713, renamed from "Book of
// Deeds"). PHAA-744 ships the engine + wire only: these tables are
// deliberately EMPTY placeholders so src/sim/deeds.ts compiles and is
// testable with zero content. Real deeds/titles land in later Book of
// Asphodelia children (PHAA-745+).

import type { DeedDef, TitleDef } from '../types';

export const DEEDS: Record<string, DeedDef> = {};

export const TITLES: Record<string, TitleDef> = {};
