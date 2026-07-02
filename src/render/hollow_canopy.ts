// The Hollow hub's canopy ceiling (PHAA-415 greener pass): foliage overhead
// closing the hub instance under a leaf roof, a bright leaf-lit "sky" showing
// through the gaps, and dappled light pooled on the floor, so the shrine
// clearing reads outdoors and overgrown instead of buried. Hub-only: the
// renderer calls buildHollowCanopy for hub instance origins alone, so the
// shared open-world terrain and the other interiors never see it.
//
// Deliberately light-free: everything here is geometry, emissive-free Lambert
// leaf blobs, and additive decals, so the point-light budget and the shader
// program set stay exactly what they were (see the note in hollow_props.ts).
import * as THREE from 'three';
import { DUNGEON_WALL_HEIGHT, TEMPLE_LAYOUT } from '../sim/dungeon_layout';
import { hash2 } from '../sim/rng';
import { radialGlowTexture } from './textures';

const CANOPY_Y = DUNGEON_WALL_HEIGHT + 2.2; // leaf layer floats above the walls
const SKY_Y = DUNGEON_WALL_HEIGHT + 5.5; // the lit gap plane above the leaves
const HALF_X = 26; // overhang past the |x|=23 walls so no seam shows

/**
 * Build the canopy group for one hub instance copy at origin (ox, oz).
 * Synchronous and fully procedural (no GLB loads).
 */
export function buildHollowCanopy(ox: number, oz: number): THREE.Group {
  const group = new THREE.Group();
  group.name = 'hollow-hub-canopy';
  const zMin = TEMPLE_LAYOUT.zMin - 6;
  const zMax = TEMPLE_LAYOUT.zMax + 6;

  // the lit sky-gap plane: a soft leaf-filtered daylight colour seen through
  // the holes in the leaf layer, fog-free so the gaps stay bright overhead
  const sky = new THREE.Mesh(
    new THREE.PlaneGeometry(HALF_X * 2 + 8, zMax - zMin + 8),
    new THREE.MeshBasicMaterial({ color: 0xa8cf7a, fog: false }),
  );
  sky.rotation.x = Math.PI / 2; // face down at the room
  sky.position.set(0, SKY_Y, (zMin + zMax) / 2);
  group.add(sky);

  // the leaf layer: overlapping flattened blobs on a jittered grid, with
  // deterministic gaps left open so the sky plane reads through in patches
  const leafMats = [
    new THREE.MeshLambertMaterial({ color: 0x2e4a1e }),
    new THREE.MeshLambertMaterial({ color: 0x3a5c26 }),
    new THREE.MeshLambertMaterial({ color: 0x486d2c }),
  ];
  const blobGeo = new THREE.SphereGeometry(1, 8, 6);
  for (let z = zMin; z <= zMax; z += 7) {
    for (let x = -HALF_X; x <= HALF_X; x += 7) {
      const r = hash2(x * 1.7, z * 2.3, 0);
      if (r < 0.16) continue; // the gap the light falls through
      const blob = new THREE.Mesh(blobGeo, leafMats[Math.floor(r * 971) % 3]);
      const s = 4.6 + hash2(x, z, 1) * 3.4;
      blob.scale.set(s, s * 0.34, s);
      blob.position.set(
        x + (hash2(x, z, 2) - 0.5) * 5,
        CANOPY_Y + (hash2(x, z, 3) - 0.5) * 1.6,
        z + (hash2(x, z, 4) - 0.5) * 5,
      );
      group.add(blob);
    }
  }

  // hanging fringe: short vine strands dangling from the canopy underside
  // along the room, breaking the hard line where leaves meet air
  const vineMat = new THREE.MeshLambertMaterial({ color: 0x466b2e });
  const strandGeo = new THREE.CylinderGeometry(0.05, 0.11, 1, 5);
  for (let i = 0; i < 26; i++) {
    const x = (hash2(i * 3.7, 11.3, 0) - 0.5) * 2 * (HALF_X - 4);
    const z = zMin + 4 + hash2(i * 1.9, 7.7, 0) * (zMax - zMin - 8);
    if (Math.abs(x) < 6 && Math.abs(z) < 8) continue; // keep the vase view clear
    const len = 1.6 + hash2(x, z, 5) * 2.6;
    const strand = new THREE.Mesh(strandGeo, vineMat);
    strand.scale.y = len;
    strand.position.set(x, CANOPY_Y - 1.2 - len / 2, z);
    group.add(strand);
  }

  // dappled light: warm green-gold pools on the floor under the canopy gaps,
  // the same additive decal trick the interiors use for torch pools
  const dappleTex = radialGlowTexture();
  const dappleMat = new THREE.MeshBasicMaterial({
    map: dappleTex,
    color: 0xafd97c,
    transparent: true,
    opacity: 0.22,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const dappleGeo = new THREE.CircleGeometry(1, 18).rotateX(-Math.PI / 2);
  for (let i = 0; i < 16; i++) {
    const x = (hash2(i * 5.1, 3.3, 0) - 0.5) * 38;
    const z = zMin + 8 + hash2(i * 2.7, 9.1, 0) * (zMax - zMin - 16);
    const pool = new THREE.Mesh(dappleGeo, dappleMat);
    pool.scale.setScalar(3.2 + hash2(x, z, 6) * 4.2);
    pool.position.set(x, 0.06, z);
    pool.renderOrder = 1; // over the floor it falls on
    group.add(pool);
  }

  group.position.set(ox, 0, oz);
  return group;
}
