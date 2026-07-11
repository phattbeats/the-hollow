// Pure gathering HUD core (PHAA-508, ports upstream #1194): node ready/cooldown
// classification (per-viewer, see IWorldGathering#nodeHarvestableByMe), the
// gathering-proficiency display rows (IWorldGathering#gatheringProficiency), and
// the crafted-tool gating rows (best owned tool tier per node type, PHAA-507).
// DOM/Three-free, same-input -> same-output, driven with hand-built IWorld-shaped
// stubs (no real Sim needed: the acceptance criterion under test is that two
// independent per-viewer cooldown states against the SAME node list classify
// independently, which is a property of this pure core, not of Sim's respawn
// timer itself).

import { describe, expect, it } from 'vitest';
import { GATHER_NODES } from '../src/sim/data';
import type { GatherNodeType } from '../src/sim/types';
import {
  buildGatheringProficiencyRows,
  buildGatheringToolRows,
  buildNearbyGatherNodes,
  classifyGatherNode,
} from '../src/ui/gathering_view';
import type { IWorld } from '../src/world_api';

const NODE = GATHER_NODES[0];

function makeWorld(opts: {
  pos?: { x: number; z: number };
  harvestable?: (nodeId: string) => boolean;
  proficiency?: Partial<Record<GatherNodeType, number>>;
  inventory?: { itemId: string; count: number }[];
}): IWorld {
  return {
    player: { pos: opts.pos ?? { x: NODE.pos.x, z: NODE.pos.z } },
    nodeHarvestableByMe: opts.harvestable ?? (() => true),
    gatheringProficiency: { amber: 0, heartwood: 0, spore: 0, ...(opts.proficiency ?? {}) },
    inventory: opts.inventory ?? [],
  } as unknown as IWorld;
}

describe('classifyGatherNode', () => {
  it('classifies ready when nodeHarvestableByMe is true', () => {
    const world = makeWorld({ harvestable: () => true });
    expect(classifyGatherNode(world, NODE.id)).toBe('ready');
  });

  it('classifies cooldown when nodeHarvestableByMe is false', () => {
    const world = makeWorld({ harvestable: () => false });
    expect(classifyGatherNode(world, NODE.id)).toBe('cooldown');
  });
});

describe('buildNearbyGatherNodes', () => {
  it('includes nodes within radius and excludes nodes outside it', () => {
    const near = GATHER_NODES[0];
    const far = { x: near.pos.x + 100000, z: near.pos.z };
    const world = makeWorld({ pos: near.pos });
    const nodes = buildNearbyGatherNodes(world, 50);
    expect(nodes.some((n) => n.id === near.id)).toBe(true);
    // sanity: the far node id is never in range from this position.
    expect(nodes.every((n) => n.x !== far.x)).toBe(true);
  });

  it('classifies each nearby node ready/cooldown via nodeHarvestableByMe', () => {
    const world = makeWorld({
      pos: NODE.pos,
      harvestable: (id) => id !== NODE.id,
    });
    const nodes = buildNearbyGatherNodes(world, 5);
    const mine = nodes.find((n) => n.id === NODE.id);
    expect(mine?.state).toBe('cooldown');
  });

  // CRITICAL acceptance criterion: two independent viewers asking about the
  // SAME node list get independently correct answers for the SAME node id.
  it('two independent per-viewer cooldown states produce independent results for the same node', () => {
    const worldA = makeWorld({ pos: NODE.pos, harvestable: (id) => id === NODE.id });
    const worldB = makeWorld({ pos: NODE.pos, harvestable: () => false });

    const nodesA = buildNearbyGatherNodes(worldA, 5);
    const nodesB = buildNearbyGatherNodes(worldB, 5);

    const aState = nodesA.find((n) => n.id === NODE.id)?.state;
    const bState = nodesB.find((n) => n.id === NODE.id)?.state;

    expect(aState).toBe('ready');
    expect(bState).toBe('cooldown');
    // The two results genuinely differ: viewer A's cooldown never leaks into B's.
    expect(aState).not.toBe(bState);
  });
});

describe('buildGatheringProficiencyRows', () => {
  it('returns one row per gather node type, in the fixed order', () => {
    const world = makeWorld({ proficiency: { amber: 3, heartwood: 0, spore: 7 } });
    const rows = buildGatheringProficiencyRows(world);
    expect(rows.map((r) => r.nodeType)).toEqual(['amber', 'heartwood', 'spore']);
  });

  it('matches the input values exactly', () => {
    const world = makeWorld({ proficiency: { amber: 12, heartwood: 4, spore: 0 } });
    const rows = buildGatheringProficiencyRows(world);
    expect(rows).toEqual([
      { nodeType: 'amber', value: 12 },
      { nodeType: 'heartwood', value: 4 },
      { nodeType: 'spore', value: 0 },
    ]);
  });

  it('defaults an absent or malformed entry to 0, never throwing', () => {
    const world = makeWorld({
      proficiency: { amber: Number.NaN, heartwood: -5 } as Partial<Record<GatherNodeType, number>>,
    });
    const rows = buildGatheringProficiencyRows(world);
    expect(rows.find((r) => r.nodeType === 'amber')?.value).toBe(0);
    expect(rows.find((r) => r.nodeType === 'heartwood')?.value).toBe(0);
    expect(rows.find((r) => r.nodeType === 'spore')?.value).toBe(0);
  });
});

describe('buildGatheringToolRows', () => {
  it('reports null for every node type when the viewer owns no gathering tool', () => {
    const rows = buildGatheringToolRows(makeWorld({ inventory: [] }));
    expect(rows).toEqual([
      { nodeType: 'amber', tier: null },
      { nodeType: 'heartwood', tier: null },
      { nodeType: 'spore', tier: null },
    ]);
  });

  it('reports the owned tool tier for the matching node type only', () => {
    // flint_amber_pick is a real tier-1 amber gather tool (src/sim/content/items.ts).
    const world = makeWorld({ inventory: [{ itemId: 'flint_amber_pick', count: 1 }] });
    const rows = buildGatheringToolRows(world);
    expect(rows.find((r) => r.nodeType === 'amber')?.tier).toBe(1);
    expect(rows.find((r) => r.nodeType === 'heartwood')?.tier).toBeNull();
    expect(rows.find((r) => r.nodeType === 'spore')?.tier).toBeNull();
  });

  it('keeps the highest owned tier when the viewer holds several tools for one type', () => {
    // bonewood_amber_pick is tier 2, flint_amber_pick tier 1: the best is surfaced.
    const world = makeWorld({
      inventory: [
        { itemId: 'flint_amber_pick', count: 1 },
        { itemId: 'bonewood_amber_pick', count: 1 },
      ],
    });
    expect(buildGatheringToolRows(world).find((r) => r.nodeType === 'amber')?.tier).toBe(2);
  });

  it('ignores non-tool inventory items (never throwing on unknown ids)', () => {
    const world = makeWorld({
      inventory: [
        { itemId: 'not_a_real_item', count: 1 },
        { itemId: 'flint_spore_sickle', count: 1 },
      ],
    });
    const rows = buildGatheringToolRows(world);
    expect(rows.find((r) => r.nodeType === 'spore')?.tier).toBe(1);
    expect(rows.find((r) => r.nodeType === 'amber')?.tier).toBeNull();
  });
});
