// PHAA-557 side-by-side harness (dev-only; dynamically imported from
// scripts/phaa557_chibi_lit_shadow_shot.mjs via the dev server, never from app
// code, so it stays out of the game bundle).
//
// Successor to the PHAA-550 spike: that harness raw-scene.add'd a foreign GLB,
// which left every mesh at castShadow=false and kept the GLB's own materials,
// so the chibi read shadowless and lighting-flat next to the roster. This one
// spawns a REGISTERED visual key through the real roster pipeline
// (prepareVisual/assembleModel/applyMaterials inside CharacterVisual), so the
// screenshot proves the production path: shadow flags and tier-correct lit
// materials come from the same code every other character uses. Reusable for
// the PHAA-539 per-class conversions.
import * as THREE from 'three';
import type { AnimState } from './anim_state';
import { preloadVisual } from './assets';
import { CharacterVisual } from './visual';

export interface RosterCompareResult {
  playerHeight: number;
  visualHeight: number;
  scale: number;
  playerPos: { x: number; y: number; z: number };
  spawnPos: { x: number; y: number; z: number };
}

const IDLE: AnimState = {
  speed: 0,
  moving: false,
  airborne: false,
  backwards: false,
  dead: false,
  casting: false,
  swimming: false,
  sitting: false,
};

/**
 * Spawn a registered visual key beside the live player through the production
 * character pipeline, height-matched via a live-scene bounding box (the
 * PHAA-434 trick).
 * @param game window.__game
 */
export async function spawnRosterCompare(
  game: { renderer: any; sim: any },
  opts: { key: string; offsetX?: number; entityColor?: number },
): Promise<RosterCompareResult> {
  const { renderer, sim } = game;
  const player = sim.player;
  if (!player) throw new Error('spawnRosterCompare: no sim.player');
  const view = renderer.views.get(player.id);
  if (!view) throw new Error(`spawnRosterCompare: no renderer view for player id ${player.id}`);

  // Measure the EXISTING character live, in world space (its rig is posed by
  // the running render loop, so this is the true on-screen height).
  view.group.updateWorldMatrix(true, true);
  const pbox = new THREE.Box3().setFromObject(view.group);
  const playerHeight = pbox.max.y - pbox.min.y;
  const pWorld = new THREE.Vector3();
  view.group.getWorldPosition(pWorld);

  await preloadVisual(opts.key);
  const visual = new CharacterVisual(opts.key, opts.entityColor ?? 0xffffff);
  // Settle into the idle clip (the game loop never ticks this instance).
  for (let i = 0; i < 30; i++) visual.update(1 / 20, IDLE, true);

  const root = visual.root;
  root.updateWorldMatrix(true, true);
  const rawBox = new THREE.Box3().setFromObject(root);
  const visualHeight = rawBox.max.y - rawBox.min.y;

  // Height-match so the style/shading comparison is apples to apples.
  const scale = playerHeight / visualHeight;
  root.scale.setScalar(scale);

  // Face the player's way and step one pace to the player's OWN right so the
  // two stand shoulder to shoulder, both broadside to the chase cam.
  const q = new THREE.Quaternion();
  view.group.getWorldQuaternion(q);
  root.quaternion.copy(q);
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(q).setY(0).normalize();
  const offset = opts.offsetX ?? 1.1;
  root.position.set(
    pWorld.x + right.x * offset,
    pbox.min.y - rawBox.min.y * scale,
    pWorld.z + right.z * offset,
  );
  root.updateWorldMatrix(true, true);
  root.name = `roster_compare_${opts.key}`;
  renderer.scene.add(root);

  const cp = new THREE.Vector3();
  root.getWorldPosition(cp);
  return {
    playerHeight,
    visualHeight,
    scale,
    playerPos: { x: pWorld.x, y: pbox.min.y, z: pWorld.z },
    spawnPos: { x: cp.x, y: cp.y, z: cp.z },
  };
}
