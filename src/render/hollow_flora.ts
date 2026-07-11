import * as THREE from 'three';
import { hash2 } from '../sim/rng';
import { terrainHeight } from '../sim/world';
import { GFX } from './gfx';
import { hollowFloraLayout } from './hollow_flora_core';
import { buildPlantCreature } from './plant_creature';

// Otherworldly garden flora for the Hollow Reaches starter zone (PHAA-581).
//
// Reuses the procedural plant-creature generator (PHAA-437) as STATIC decor:
// hollowFloraLayout picks empty spots clustered around each NPC camp/post, and
// this painter grows one plant-creature per placement at rest pose. They never
// tick (no per-frame update wiring, no colliders): pure cosmetic dressing that
// makes the starter ground read lush and strange before the vanilla first zone.
//
// Placement is deterministic and gameplay-neutral. Lean tiers shed some of the
// flora (a cosmetic-richness knob, never actionable information), keeping the
// draw cost of these small procedural meshes bounded on weak hardware.

export interface HollowFloraView {
  group: THREE.Group;
}

export function buildHollowFlora(seed: number): HollowFloraView {
  const group = new THREE.Group();
  group.name = 'hollow_flora';

  const placements = hollowFloraLayout(seed);
  // Cosmetic-only thinning on lean tiers: keep a deterministic subset.
  const keepFrac = GFX.leanFoliage ? (GFX.standardMaterials ? 0.6 : 0.4) : 1;

  for (const p of placements) {
    if (keepFrac < 1 && hash2(Math.round(p.x), Math.round(p.z), seed + 407) > keepFrac) continue;
    const plant = buildPlantCreature(p.archetype, p.seed, {
      standardMaterials: GFX.standardMaterials,
    });
    const root = plant.root;
    root.position.set(p.x, terrainHeight(p.x, p.z, seed), p.z);
    root.rotation.y = p.rotY;
    root.scale.setScalar(p.scale);
    // rest pose only: settle idle sway to t=0 once, then leave it static.
    plant.update(0, 0);
    group.add(root);
  }
  return { group };
}
