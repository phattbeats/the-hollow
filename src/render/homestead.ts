// Homestead v0: renders the open-world Hollow Reaches plots from
// IWorld.homesteadInfo. Every plot is already claimed and world-space (no
// viewer-relative origin to translate, unlike Housing v0's hub-instanced
// plots, src/render/housing.ts), so this draws a marker post carrying the
// OWNER NAME (player data, spliced verbatim, not a translation key) at each
// plot's world position.
//
// The module reads the world only (never mutates it) and rebuilds its scene
// group when the serialized homestead blob changes, which is rare (a new
// claim), so the per-frame cost is one JSON.stringify of a tiny blob. All
// geometry is deterministic; no Math.random. Procedural materials go through
// surfaceMat() for dedup, like housing.ts.

import * as THREE from 'three';
import type { HomesteadInfo } from '../world_api/homestead';
import { GFX, surfaceMat } from './gfx';

function woodMat(color: number): THREE.Material {
  return surfaceMat({ color, roughness: 0.85, metalness: 0, flatShading: !GFX.standardMaterials });
}

// A rounded-corner name board drawn onto a canvas; the classic low-res label.
function makeSignBoardTexture(text: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#5a4630';
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.strokeStyle = '#3a2d1e';
  g.lineWidth = 6;
  g.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);
  g.fillStyle = '#f3e6c8';
  g.font = 'bold 34px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text.slice(0, 14), canvas.width / 2, canvas.height / 2 + 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 2;
  return tex;
}

function buildMarker(ownerName: string): THREE.Group {
  const g = new THREE.Group();
  for (const [dx, dz] of [
    [-3.2, -3.2],
    [3.2, -3.2],
    [-3.2, 3.2],
    [3.2, 3.2],
  ]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.8, 0.16), woodMat(0x6b5138));
    post.position.set(dx, 0.4, dz);
    g.add(post);
  }
  const signPost = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.6, 0.18), woodMat(0x6b5138));
  signPost.position.set(0, 0.8, 4.2);
  g.add(signPost);
  const tex = makeSignBoardTexture(ownerName);
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(1.9, 0.5, 0.08),
    new THREE.MeshBasicMaterial({ map: tex }),
  );
  board.position.set(0, 1.35, 4.2);
  g.add(board);
  return g;
}

export class HomesteadView {
  private readonly group = new THREE.Group();
  private lastKey = '';

  constructor(
    private readonly scene: THREE.Scene,
    private readonly ground: (x: number, z: number) => number,
  ) {
    this.group.name = 'homestead';
    this.scene.add(this.group);
  }

  update(info: HomesteadInfo | null): void {
    const key = info ? JSON.stringify(info.plots.map((p) => [p.x, p.z, p.ownerName])) : '';
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.clear();
    if (!info) return;
    for (const plot of info.plots) {
      const holder = new THREE.Group();
      holder.position.set(plot.x, this.ground(plot.x, plot.z), plot.z);
      holder.add(buildMarker(plot.ownerName));
      this.group.add(holder);
    }
  }

  private clear(): void {
    for (const child of [...this.group.children]) {
      this.group.remove(child);
      child.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = mesh.material as THREE.Material | undefined;
        // dispose only unshared canvas-sign materials; surfaceMat() output is
        // a shared cache and must never be disposed here
        if (mat instanceof THREE.MeshBasicMaterial) {
          mat.map?.dispose();
          mat.dispose();
        }
      });
    }
  }

  dispose(): void {
    this.clear();
    this.scene.remove(this.group);
  }
}
