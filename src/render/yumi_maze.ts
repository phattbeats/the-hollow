// Protect Yumi! (PHAA-573) maze renderer. The gameplay maze lives entirely in
// the sim (sim/yumi_maze_layout.ts builds the braided 13x13 grid, sim/colliders
// turns its wall/shell rects into the collision OBBs); this module is the pure
// VISUAL body for those colliders so the corridors a player walks are not
// invisible. It reads the same deterministic layout and builds one instanced
// wall mesh + a floor slab per match slot, positioned at the slot origin. It
// never mutates the world; the renderer owns lifecycle (build once per slot,
// dispose on teardown), mirroring the Ashen Coliseum interior it sits beside.

import * as THREE from 'three';
import {
  YUMI_MAZE_WALL_HALF,
  YUMI_MAZE_WALL_HEIGHT,
  yumiMazeLayout,
} from '../sim/yumi_maze_layout';

// One built maze slot: the scene group plus the geometries/materials it owns,
// so the renderer can dispose it cleanly when the band unloads.
export interface YumiMazeView {
  group: THREE.Group;
  dispose(): void;
}

// Warm sandstone walls and a muted clay floor: reads as a distinct objective
// arena, gameplay-neutral (the collision body is the sim's, this is only skin).
const WALL_COLOR = 0xb8a888;
const FLOOR_COLOR = 0x6f6350;
const SHELL_COLOR = 0x8f8069;

/**
 * Build the visual maze for one match slot. `ox`/`oz` are the slot origin in
 * world coordinates (see data.ts yumiMazeOrigin); the layout is instance-local
 * so every slot shares one deterministic shape. `seed` defaults to the maze's
 * fixed seed, matching sim/colliders so walls and collision line up exactly.
 */
export function buildYumiMaze(ox: number, oz: number, y = 0): YumiMazeView {
  const layout = yumiMazeLayout();
  const group = new THREE.Group();
  group.position.set(ox, y, oz);
  group.matrixAutoUpdate = false;

  const owned: Array<{ dispose(): void }> = [];
  const height = YUMI_MAZE_WALL_HEIGHT;

  // Floor slab: covers the full shell footprint, sitting just under the walls.
  const span = layout.halfExtent * 2;
  const floorGeo = new THREE.BoxGeometry(span, 0.5, span);
  const floorMat = new THREE.MeshStandardMaterial({
    color: FLOOR_COLOR,
    roughness: 0.95,
    metalness: 0,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.position.set(0, -0.25, 0);
  floor.receiveShadow = true;
  floor.updateMatrix();
  floor.matrixAutoUpdate = false;
  group.add(floor);
  owned.push(floorGeo, floorMat);

  // A unit box reused by both instanced meshes; each wall stub scales/positions
  // one instance. Walls and shell are separate meshes only so the shell can wear
  // a slightly different tone (it reads as the outer perimeter).
  const unit = new THREE.BoxGeometry(1, 1, 1);
  owned.push(unit);

  const addInstanced = (stubs: typeof layout.walls, color: number) => {
    if (stubs.length === 0) return;
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0 });
    const mesh = new THREE.InstancedMesh(unit, mat, stubs.length);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const m = new THREE.Matrix4();
    for (let i = 0; i < stubs.length; i++) {
      const w = stubs[i];
      // Stubs are half-extents; give thin merged rects a floor thickness so the
      // wall body is never a zero-width sliver.
      const sx = Math.max(w.hw * 2, YUMI_MAZE_WALL_HALF * 2);
      const sz = Math.max(w.hd * 2, YUMI_MAZE_WALL_HALF * 2);
      m.compose(
        new THREE.Vector3(w.x, height / 2, w.z),
        new THREE.Quaternion(),
        new THREE.Vector3(sx, height, sz),
      );
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.updateMatrix();
    mesh.matrixAutoUpdate = false;
    group.add(mesh);
    owned.push(mat, mesh);
  };

  addInstanced(layout.walls, WALL_COLOR);
  addInstanced(layout.shell, SHELL_COLOR);

  group.updateMatrix();

  return {
    group,
    dispose() {
      for (const o of owned) o.dispose();
    },
  };
}
