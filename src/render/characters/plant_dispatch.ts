// Routes the Under-Shrine plant mobs (PHAA-531) from the GLB rig path to the
// seeded procedural generator (../plant_creature.ts). PlantCreatureVisual wraps
// a PlantCreature behind the same call surface renderer.ts drives every
// CharacterVisual through (update/playAttack/playHit/setShadow/.../dispose), so
// the per-entity LOD/shadow/ghost loop in renderer.ts needs no branching: it
// only ever sees a MobVisual (see index.ts).
//
// Plant mobs never carry skins/weapons/emotes/shapeshift forms, so those calls
// are no-ops. They are also never pooled (each entity's shape is seeded off its
// own id — see renderer.ts's visualPoolKeyFor — so recycling one entity's build
// for another would show the wrong creature) and never far-LOD-swapped (a
// handful of low-poly cave mobs; see plant_creature.ts's own "mob count is
// tiny" note).
import * as THREE from 'three';
import type { Entity } from '../../sim/types';
import type { OverheadEmoteId } from '../../world_api';
import { GFX } from '../gfx';
import { buildPlantCreature, type PlantCreature } from '../plant_creature';
import {
  hashStringToSeed,
  PLANT_MOB_ARCHETYPES,
  type PlantArchetype,
} from '../plant_creature_core';
import type { AnimState } from './anim_state';

const MIXER_DT_CAP = 0.3; // mirrors visual.ts: throttled entities never integrate a huge step
const DEATH_TILT_LERP = 6; // ease rate (1/s) toward the toppled-on-death pose
const GHOST_OPACITY = 0.34;
const SOUL_REND_OPACITY = 0.58;
const SOUL_REND_TINT = new THREE.Color(0x4f0505);

export function plantArchetypeFor(templateId: string): PlantArchetype | null {
  return PLANT_MOB_ARCHETYPES[templateId] ?? null;
}

// shared invisible click capsule, same pattern as visual.ts's clickGeo/clickMat
let clickGeoSingleton: THREE.CylinderGeometry | null = null;
function clickGeo(): THREE.CylinderGeometry {
  if (!clickGeoSingleton) {
    clickGeoSingleton = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
    clickGeoSingleton.translate(0, 0.5, 0);
  }
  return clickGeoSingleton;
}
let clickMatSingleton: THREE.Material | null = null;
function clickMat(): THREE.Material {
  clickMatSingleton ??= new THREE.MeshBasicMaterial();
  return clickMatSingleton;
}

export class PlantCreatureVisual {
  readonly root: THREE.Group;
  readonly height: number;
  readonly clickProxy: THREE.Mesh;

  private creature: PlantCreature;
  private casters: THREE.Mesh[] = [];
  private originalMaterials = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  private ghostMaterials = new Map<THREE.Material, THREE.Material>();
  private soulRendMaterials = new Map<THREE.Material, THREE.Material>();
  private ghosted = false;
  private soulRend = false;
  private shadowOn = true;
  private clock = 0;
  private pendingDt = 0;
  private tilt = 0;

  constructor(archetype: PlantArchetype, seed: number) {
    this.creature = buildPlantCreature(archetype, seed, {
      standardMaterials: GFX.standardMaterials,
    });
    this.root = this.creature.root;
    this.height = this.creature.height;

    this.root.updateMatrixWorld(true);
    this.root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = false;
      this.casters.push(mesh);
      this.originalMaterials.set(mesh, mesh.material);
    });

    // capsule from measured extents, same reasoning as CharacterVisual's own
    // click proxy: a height-derived sliver nearly misses a wide/splayed base
    const box = new THREE.Box3().setFromObject(this.root);
    const size = new THREE.Vector3();
    box.getSize(size);
    const radius = Math.max(0.4, Math.max(size.x, size.z) * 0.55);
    this.clickProxy = new THREE.Mesh(clickGeo(), clickMat());
    this.clickProxy.scale.set(radius * 2, this.height, radius * 2);
    this.clickProxy.visible = false;
    this.root.add(this.clickProxy);
  }

  update(dt: number, s: AnimState, animate: boolean): void {
    // corpses topple onto their side instead of holding an idle sway pose
    const wantTilt = s.dead ? Math.PI / 2 : 0;
    this.tilt += (wantTilt - this.tilt) * Math.min(1, dt * DEATH_TILT_LERP);
    this.creature.root.rotation.z = this.tilt;

    this.pendingDt = Math.min(MIXER_DT_CAP, this.pendingDt + dt);
    if (animate) {
      this.clock += this.pendingDt;
      this.creature.update(this.pendingDt, this.clock);
      this.pendingDt = 0;
    }
  }

  playAttack(): void {
    this.creature.triggerAttack();
  }

  playHit(): void {
    this.creature.triggerHit();
  }

  playEmote(_id: OverheadEmoteId): void {
    // no overhead emotes for mobs; renderer only calls this for player entities
  }

  setShadow(on: boolean): void {
    if (on === this.shadowOn) return;
    this.shadowOn = on;
    for (const m of this.casters) m.castShadow = on;
  }

  setProxyShadow(_on: boolean): void {
    // no baked far-LOD proxy mesh, see class doc above
  }

  setFar(_far: boolean): void {
    // no far-LOD swap, see class doc above
  }

  setGhost(on: boolean): void {
    this.ghosted = on;
    this.applyEffectMaterials();
  }

  setSoulRend(on: boolean): void {
    if (on === this.soulRend) return;
    this.soulRend = on;
    this.applyEffectMaterials();
  }

  setSkin(_skinIndex: number): void {
    // mobs have no alternate skin atlas
  }

  setWeapon(_weaponItemId: string | null): void {
    // mobs never carry an equippable weapon model
  }

  dispose(): void {
    this.creature.dispose();
  }

  private applyEffectMaterials(): void {
    for (const [mesh, original] of this.originalMaterials) {
      mesh.material = this.effectMaterial(original);
    }
  }

  private effectMaterial<T extends THREE.Material | THREE.Material[]>(material: T): T {
    if (Array.isArray(material)) return material.map((m) => this.effectSingleMaterial(m)) as T;
    return this.effectSingleMaterial(material) as T;
  }

  private effectSingleMaterial(material: THREE.Material): THREE.Material {
    if (this.soulRend) return this.soulRendMaterial(material);
    if (this.ghosted) return this.ghostMaterial(material);
    return material;
  }

  private ghostMaterial(material: THREE.Material): THREE.Material {
    const cached = this.ghostMaterials.get(material);
    if (cached) return cached;
    const ghost = material.clone();
    ghost.transparent = true;
    ghost.opacity = GHOST_OPACITY;
    ghost.depthWrite = false;
    this.ghostMaterials.set(material, ghost);
    return ghost;
  }

  private soulRendMaterial(material: THREE.Material): THREE.Material {
    const cached = this.soulRendMaterials.get(material);
    if (cached) return cached;
    const marked = material.clone();
    marked.transparent = true;
    marked.opacity = SOUL_REND_OPACITY;
    marked.depthWrite = false;
    const withColor = marked as THREE.Material & {
      color?: THREE.Color;
      emissive?: THREE.Color;
      emissiveIntensity?: number;
    };
    if (withColor.color) withColor.color.copy(SOUL_REND_TINT);
    if (withColor.emissive) {
      withColor.emissive.setHex(0x2a0000);
      withColor.emissiveIntensity = Math.max(withColor.emissiveIntensity ?? 0, 0.35);
    }
    this.soulRendMaterials.set(material, marked);
    return marked;
  }
}

/** Build the plant-creature visual for a mob entity, or null if it is not one
 *  of the seeded archetypes (the caller falls back to the GLB rig path). */
export function createPlantMobVisual(e: Entity): PlantCreatureVisual | null {
  const archetype = plantArchetypeFor(e.templateId);
  if (!archetype) return null;
  return new PlantCreatureVisual(archetype, hashStringToSeed(`${e.templateId}#${e.id}`));
}
