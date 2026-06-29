// Unit test for skinAwareBounds (src/guide/viewer/model.ts), the load-bearing primitive
// behind the /wiki/models turntable fix. It exists because several creature rigs have a
// scaled/animated armature whose SKINNED mesh sits far from the raw (pre-skinning) geometry
// box: framing or centering off Box3.setFromObject (which reads that raw box) renders them
// blank. skinAwareBounds instead walks each skinned vertex through its bones, so it tracks
// the POSED mesh. three's applyBoneTransform is CPU-only, so this runs in plain Node (no
// WebGL): we build a synthetic SkinnedMesh, pose a bone, and assert the bounds follow.
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { skinAwareBounds } from '../src/guide/viewer/model';

// A unit quad in the XY plane, every vertex bound fully to a single bone, wrapped in a root.
function makeRig(): { root: THREE.Object3D; bone: THREE.Bone; mesh: THREE.SkinnedMesh } {
  const positions = new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]);
  const count = positions.length / 3;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const skinIndex = new Uint16Array(count * 4); // all weight on bone 0
  const skinWeight = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) skinWeight[i * 4] = 1;
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));

  const bone = new THREE.Bone();
  const mesh = new THREE.SkinnedMesh(geo, new THREE.MeshBasicMaterial());
  const root = new THREE.Object3D();
  root.add(bone);
  root.add(mesh);
  root.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton([bone]));
  root.updateMatrixWorld(true);
  return { root, bone, mesh };
}

const center = (b: THREE.Box3): THREE.Vector3 => b.getCenter(new THREE.Vector3());
const size = (b: THREE.Box3): THREE.Vector3 => b.getSize(new THREE.Vector3());

describe('skinAwareBounds', () => {
  it('measures the bind pose at the geometry box', () => {
    const { root } = makeRig();
    const b = skinAwareBounds(root);
    expect(center(b).x).toBeCloseTo(0, 5);
    expect(center(b).y).toBeCloseTo(0, 5);
    expect(size(b).x).toBeCloseTo(2, 5);
    expect(size(b).y).toBeCloseTo(2, 5);
  });

  it('tracks the POSED mesh when a bone moves (the flinging-rig case)', () => {
    const { root, bone } = makeRig();
    // At bind the skinned mesh sits on the origin (the geometry box).
    expect(center(skinAwareBounds(root)).x).toBeCloseTo(0, 5);

    // The idle clip displaces the armature: the skinned mesh moves far from the bind box. The
    // mesh node itself does not move (its matrixWorld stays identity), so a non-skin-aware
    // walk would leave the bounds at the origin; only following the BONE tracks the pose.
    bone.position.set(10, 4, 0);
    root.updateMatrixWorld(true);

    const posed = skinAwareBounds(root);
    expect(center(posed).x).toBeCloseTo(10, 4);
    expect(center(posed).y).toBeCloseTo(4, 4);
  });

  it('reflects a scaled armature (the box the bind skeleton would otherwise shrink)', () => {
    const { root, bone } = makeRig();
    bone.scale.set(3, 3, 3);
    root.updateMatrixWorld(true);

    const posed = skinAwareBounds(root);
    // The skinned quad is now 3x: ~6 units across, not the raw geometry's 2.
    expect(size(posed).x).toBeCloseTo(6, 3);
    expect(size(posed).y).toBeCloseTo(6, 3);
    expect(posed.isEmpty()).toBe(false);
  });
});
