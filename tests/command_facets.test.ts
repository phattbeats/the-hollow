import { describe, it, expect } from 'vitest';

import { COMMAND_FACETS, COMMAND_NAMES, DISPATCH_ONLY_COMMANDS } from '../src/world_api';

// W6: facet tags on the shared command table. COMMAND_FACETS is APPEND-ONLY
// metadata mapping each wire command to the IWorld facet whose method sends it; the
// protocol vocabulary stays COMMAND_NAMES (W0b). This pins the W6 cluster's tags
// (combat/targeting/loot/telemetry) and the table-consistency invariants without
// touching the W0b gate. It never loosens command_schema.test.ts: a renamed token
// surfaces there first; here it surfaces as an orphaned tag.

// The exact tags W6 lands. Append (never edit) a slice's block as later clusters
// (W7-W10) tag their facets' commands.
const W6_TAGS: Readonly<Record<string, string>> = {
  cast: 'IWorldCombat',
  castSlot: 'IWorldCombat',
  attack: 'IWorldCombat',
  stopattack: 'IWorldCombat',
  release: 'IWorldCombat',
  target: 'IWorldTargeting',
  tab: 'IWorldTargeting',
  targetNearestFriendly: 'IWorldTargeting',
  tabFriendly: 'IWorldTargeting',
  lootRoll: 'IWorldLoot',
  telemetry: 'IWorldTelemetry',
};

describe('command facet tags (W6)', () => {
  const names = new Set<string>(COMMAND_NAMES);
  const dispatchOnly = new Set<string>(DISPATCH_ONLY_COMMANDS);
  const tags = COMMAND_FACETS as Readonly<Record<string, string>>;

  it('tags only real wire tokens that exist in COMMAND_NAMES', () => {
    const orphans = Object.keys(tags)
      .filter((cmd) => !names.has(cmd))
      .sort();
    expect(orphans, `tagged commands missing from COMMAND_NAMES:\n${orphans.join('\n')}`).toEqual(
      [],
    );
  });

  it('never tags a dispatch-only token (those are not client sends)', () => {
    const leaked = Object.keys(tags)
      .filter((cmd) => dispatchOnly.has(cmd))
      .sort();
    expect(leaked, `dispatch-only tokens must not be facet-tagged:\n${leaked.join('\n')}`).toEqual(
      [],
    );
  });

  it('tags every W6 combat/targeting/loot/telemetry command with its facet', () => {
    for (const [cmd, facet] of Object.entries(W6_TAGS)) {
      expect(tags[cmd], `facet tag for '${cmd}'`).toBe(facet);
    }
  });

  it('does not tag targetNearest (RL/server-only) or activeLootRolls (no wire command)', () => {
    expect('targetNearest' in tags).toBe(false);
    expect('activeLootRolls' in tags).toBe(false);
  });
});
