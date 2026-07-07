import type { GatherNodeType } from '../sim/data';

// Pure node-type -> visual lookup, split out of gather_nodes.ts so a Vitest
// can assert coverage against sim/content/gather_nodes.ts without importing
// three.js. Keep this in sync with NODE_GEOMETRY in gather_nodes.ts: every
// key here must have a matching geometry factory there.
export const NODE_COLOR: Record<GatherNodeType, number> = {
  amber: 0xd88a3a,
  heartwood: 0x6b4a2e,
  spore: 0x8fae5c,
};

export const NODE_Y_OFFSET: Record<GatherNodeType, number> = {
  amber: 0.45,
  heartwood: 0.9,
  spore: 0.25,
};
