// PHAA-653: spike into upstream #1726 (merge a character's skinned rig parts
// into one draw). Finding: naively adopting that merge is unsafe here, on BOTH
// player rig families, because it collides with the PHAA-502 T2a/PHAA-609
// `bakedArmorSlots` visibility toggle (setBakedArmorVisibility resolves a node
// by NAME at runtime; a node folded into a merged mesh stops being found by
// name and gets stuck at whatever visibility the merge left it, i.e. always on).
//
//  - KayKit adult rigs (knight.glb, paladin.glb, ...) are meshopt-compressed +
//    KHR_mesh_quantization: every body part carries its OWN skin/inverse-bind
//    matrices, so today's `sameBindData` check in assets.ts already blocks the
//    merge for them (that block is exactly the "9 draws" cost upstream #1726
//    fixes upstream by proving a single dequantization transform T per part).
//    Porting that fix as-is would start merging player_warrior's
//    Knight_Helmet/Knight_HelmetVisor/Knight_Cape into the body.
//  - The chibi female rigs are NOT quantized and ship as ONE shared skin across
//    every node, so today's merge already CAN fire wherever two nodes share a
//    material/parent/local-transform bucket key, no upstream code needed. The
//    GLB test below proves that real collision exists in chibi_female_knight.glb
//    (used by player_warrior_f / player_paladin_f, PHAA-609 batch 1): three
//    nodes gating DIFFERENT equip slots (waist vs legs) share one bucket key.
//
// assets.ts's `mergeSkinnedParts` now takes a `protectedNames` set
// (`bakedArmorNodeNamesForUrl` in manifest.ts) and refuses to merge any node
// named in ANY VisualDef's `bakedArmorSlots` for that url. This is the guard
// that must exist BEFORE porting upstream #1726's rig_merge.ts (or any future
// one-draw-per-character work): it protects both rig families, including a
// KayKit body's baked accessories once that merge stops being blocked by
// quantization noise.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bakedArmorNodeNamesForUrl, VISUALS } from '../src/render/characters/manifest';

describe('PHAA-653 rig-merge guard - bakedArmorNodeNamesForUrl (manifest, pure)', () => {
  it("collects every node bakedArmorSlots names for a url, e.g. player_warrior's knight.glb", () => {
    const names = bakedArmorNodeNamesForUrl(VISUALS.player_warrior.url);
    expect(names).toEqual(new Set(['Knight_Helmet', 'Knight_HelmetVisor', 'Knight_Cape']));
  });

  it('returns an empty set for a url no VisualDef gates via bakedArmorSlots', () => {
    expect(bakedArmorNodeNamesForUrl('models/chars/players/nonexistent.glb').size).toBe(0);
  });

  it('unions across every VisualDef that shares a url (several classes can point at one GLB)', () => {
    for (const def of Object.values(VISUALS)) {
      if (!def.bakedArmorSlots) continue;
      const names = bakedArmorNodeNamesForUrl(def.url);
      for (const node of Object.keys(def.bakedArmorSlots)) {
        expect(names.has(node), `${def.url}: expected ${node} in the protected set`).toBe(true);
      }
    }
  });
});

describe('assets.ts wiring (source-pinned; render module cannot runtime-import under vitest)', () => {
  const assetsSrc = readFileSync(
    new URL('../src/render/characters/assets.ts', import.meta.url),
    'utf8',
  );

  it('optimizedScene passes the per-url protected-node set into mergeSkinnedParts', () => {
    expect(assetsSrc).toContain('mergeSkinnedParts(root, bakedArmorNodeNamesForUrl(url))');
  });

  it('mergeSkinnedParts refuses to bucket a protected node', () => {
    expect(assetsSrc).toContain('if (protectedNames.has(sm.name)) return;');
  });
});

// Real-asset evidence for the chibi-family half of the finding: three nodes
// gating DIFFERENT equip slots per the PHAA-609 wiring (armorceinturethighs ->
// waist; armorknees, armorlegs -> legs) share one merge bucket key today
// (same skin, same material, same parent, same identity local transform).
// Without the guard, mergeSkinnedParts would fuse all three into one mesh,
// making waist and legs armor visibility inseparable, and neither name would
// resolve afterward (the merged node's name is derived from whichever part the
// traversal visits first), so setBakedArmorVisibility's lookup by name would
// silently no-op for all three and the merged mesh would stay stuck visible.
interface GlbNode {
  name: string;
  mesh?: number;
  skin?: number;
}
interface GlbJson {
  nodes: GlbNode[];
  meshes: { primitives: { material?: number }[] }[];
}

describe('chibi_female_knight.glb - real bucket-key collision across equip slots', () => {
  function readGlbJson(path: string): GlbJson {
    const buf = readFileSync(path);
    const jsonLen = buf.readUInt32LE(12);
    return JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
  }

  it('armorceinturethighs (waist) buckets identically to armorknees/armorlegs (legs)', () => {
    const path = resolve(process.cwd(), 'public/models/chars/players/chibi_female_knight.glb');
    const j = readGlbJson(path);
    const bucketKeyOf = (nodeName: string) => {
      const node = j.nodes.find((n) => n.name === nodeName);
      if (!node) throw new Error(`node ${nodeName} should exist`);
      const mesh = j.meshes[node.mesh as number];
      const matIndex = mesh.primitives[0].material;
      // mirrors assets.ts's bucket key: bones (here, the shared single skin) /
      // material / parent / local transform. This GLB has one skin (index 0)
      // shared by every node and every listed node has an identity local
      // transform (no matrix/TRS override), so the key collapses to skin+material.
      return `skin=${node.skin}|mat=${matIndex}`;
    };
    const waist = bucketKeyOf('armorceinturethighs');
    const legsA = bucketKeyOf('armorknees');
    const legsB = bucketKeyOf('armorlegs');
    expect(waist).toBe(legsA);
    expect(waist).toBe(legsB);
  });
});
