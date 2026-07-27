// Collectible identity (PHAA-625/626): the data-as-code layer that gives every
// trackable in-world find a stable, tracked identity, independent of whatever
// content table actually places it. Today the only collectible KIND is a world
// readable (src/sim/content/readables.ts); future kinds (statues, seeds, ...)
// add their own arm to CollectibleDef and a case in ../collections.ts, never a
// new tracking system. `set` groups collectibles for the (sibling-ticket) UI
// panel, e.g. the flagship 'asphodelion' Book of the Plant pages (PHAA-628);
// absent means the collectible belongs to no named set yet.

import { READABLES } from './readables';

export type CollectibleKind = 'readable';

export interface CollectibleDef {
  id: string;
  kind: CollectibleKind;
  zoneId: string;
  set?: string;
}

export const COLLECTIBLES: CollectibleDef[] = READABLES.map((r) => ({
  id: r.id,
  kind: 'readable',
  zoneId: r.zoneId,
}));
