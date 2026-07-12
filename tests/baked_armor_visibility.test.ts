import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { VISUALS } from '../src/render/characters/manifest';
import { EQUIP_SLOTS } from '../src/sim/types';

// PHAA-502 T2a quick win: the male KayKit player GLBs ship built-in accessory
// meshes (Knight_Helmet, Knight_Cape) kept via `VisualDef.show`. T2a gates their
// visibility on the wearer's `equippedItems` through the new `bakedArmorSlots`
// map + `setBakedArmorVisibility`, so equipping a helm reveals the helmet mesh
// and unequipping hides it, with zero new assets.
//
// The render layer (assets.ts / visual.ts) is source-tested here, not runtime-
// imported: importing them fires the module-load GLB preload sweep, which has no
// server to fetch from under vitest. Every render/characters test in this repo
// follows the same pattern (see skin_load_retry.test.ts). The manifest is pure
// data and imports cleanly, so its contract is asserted directly.

describe('baked-armor visibility (PHAA-502 T2a) - manifest contract', () => {
  it('player_warrior gates both helmet meshes on the helmet slot and the cape on the chest slot', () => {
    // The KayKit knight helmet is two skinned meshes (dome + visor); both must be
    // gated or a bare warrior keeps half a helmet on (the visor read as a helmet).
    expect(VISUALS.player_warrior.bakedArmorSlots).toEqual({
      Knight_Helmet: 'helmet',
      Knight_HelmetVisor: 'helmet',
      Knight_Cape: 'chest',
    });
  });

  it('every baked node is also kept in that def `show` list (must stay in the graph)', () => {
    for (const [key, def] of Object.entries(VISUALS)) {
      if (!def.bakedArmorSlots) continue;
      const shown = new Set(def.show ?? []);
      for (const node of Object.keys(def.bakedArmorSlots)) {
        expect(shown.has(node), `${key}: ${node} is gated but not in \`show\``).toBe(true);
      }
    }
  });

  it('every baked gating slot is a real EquipSlot', () => {
    const slots = new Set<string>(EQUIP_SLOTS);
    for (const [key, def] of Object.entries(VISUALS)) {
      for (const slot of Object.values(def.bakedArmorSlots ?? {})) {
        expect(slots.has(slot), `${key}: ${slot} is not an EquipSlot`).toBe(true);
      }
    }
  });

  it('bakedArmorSlots is players-only (mobs/NPCs/forms have no equip state)', () => {
    for (const [key, def] of Object.entries(VISUALS)) {
      if (def.bakedArmorSlots) {
        expect(key.startsWith('player_'), `${key} unexpectedly declares bakedArmorSlots`).toBe(
          true,
        );
      }
    }
  });

  it('player_paladin gates its built-in helmet and cape (PHAA-609 batch 1)', () => {
    expect(VISUALS.player_paladin.bakedArmorSlots).toEqual({
      Paladin_Helmet: 'helmet',
      Paladin_Cape: 'chest',
    });
  });

  it('player_warrior_f and player_paladin_f gate the chibi knight outfit armor pieces (PHAA-609 batch 1)', () => {
    const expected = {
      armorhelmet: 'helmet',
      amorplastron: 'chest',
      amorshoulders: 'shoulder',
      amorarm: 'shoulder',
      armorceinturethighs: 'waist',
      armorskirt: 'waist',
      armorknees: 'legs',
      armorlegs: 'legs',
      armorthights: 'legs',
      armorshoe: 'feet',
    };
    expect(VISUALS.player_warrior_f.bakedArmorSlots).toEqual(expected);
    expect(VISUALS.player_paladin_f.bakedArmorSlots).toEqual(expected);
  });
});

// Guards the PHAA-609 batch-1 node names against the real GLBs: a rename or a
// re-export that drops a mesh would silently no-op the toggle (setBakedArmorVisibility
// skips missing nodes rather than throwing), so this asserts the wired names actually
// exist as mesh nodes in the shipped files.
describe('baked-armor visibility (PHAA-609 batch 1) - GLB node names exist', () => {
  function meshNodeNames(relPath: string): Set<string> {
    const buf = readFileSync(new URL(`../public/${relPath}`, import.meta.url));
    const jsonLen = buf.readUInt32LE(12);
    const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
    const names = new Set<string>();
    for (const node of json.nodes ?? []) {
      if (node.mesh !== undefined && node.name) names.add(node.name);
    }
    return names;
  }

  it('paladin.glb contains Paladin_Helmet and Paladin_Cape', () => {
    const nodes = meshNodeNames('models/chars/players/paladin.glb');
    for (const key of Object.keys(VISUALS.player_paladin.bakedArmorSlots ?? {})) {
      expect(nodes.has(key), `paladin.glb missing node ${key}`).toBe(true);
    }
  });

  it('chibi_female_knight.glb contains every wired armor node', () => {
    const nodes = meshNodeNames('models/chars/players/chibi_female_knight.glb');
    for (const key of Object.keys(VISUALS.player_warrior_f.bakedArmorSlots ?? {})) {
      expect(nodes.has(key), `chibi_female_knight.glb missing node ${key}`).toBe(true);
    }
  });
});

// The toggle helper + its two call sites (assembleModel on construction, setArmor
// on a live equip diff) and the unequip-detecting equality fix all live in files
// that cannot be runtime-imported here (see the note above). Pin them by source so
// a refactor that drops any one of them fails loudly.
describe('baked-armor visibility (PHAA-502 T2a) - render wiring', () => {
  const assetsSrc = readFileSync(
    new URL('../src/render/characters/assets.ts', import.meta.url),
    'utf8',
  );
  const visualSrc = readFileSync(
    new URL('../src/render/characters/visual.ts', import.meta.url),
    'utf8',
  );

  it('assets.ts exports setBakedArmorVisibility and gates on equipped slot presence', () => {
    expect(assetsSrc).toContain('export function setBakedArmorVisibility');
    // the gate: a baked node is visible only while its slot carries an item id
    expect(assetsSrc).toContain('obj.visible = armorByItemId?.[slot] != null');
  });

  it('assembleModel applies the baked toggle on construction', () => {
    expect(assetsSrc).toContain('setBakedArmorVisibility(root, def, armorByItemId)');
  });

  it('setArmor re-applies the baked toggle on a live equip diff', () => {
    expect(visualSrc).toContain('setBakedArmorVisibility(this.model, this.def, next)');
  });

  it('armorMapEquals detects an unequip (a slot count change), not just value changes', () => {
    // Without the length guard, {chest: x} -> {} reads as equal and the cape
    // never hides on unequip. The fix compares key counts before values.
    expect(visualSrc).toContain('if (ak.length !== Object.keys(b).length) return false');
  });
});
