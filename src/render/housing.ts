// Housing v0: renders the Hollow hub homestead plots from IWorld.housingInfo.
// A claimed plot draws a small procedural cottage, its decor objects, and a
// signpost carrying the OWNER NAME (player data, spliced verbatim, not a
// translation key); an unclaimed plot draws a subtle marker (corner fence
// posts and an empty signpost), so no player-facing text originates here.
//
// The module reads the world only (never mutates it) and rebuilds its scene
// group when the serialized housing blob changes, which is rare (a claim or a
// decor edit), so the per-frame cost is one JSON.stringify of a tiny blob.
// All geometry is deterministic; no Math.random. Procedural materials go
// through surfaceMat() for dedup, like delve_props.ts.
//
// PHAA-405: every signpost also carries a glow ring (hidden by default), toggled
// by updateProximity() every frame from the renderer's cheap nearestHousingPlot()
// check (housing_proximity.ts). This is the ONLY per-frame write this module
// does outside a rebuild: a visibility flip plus an opacity write on the one
// active ring, so it stays within the per-frame cost budget.

import * as THREE from 'three';
// Mirror of src/sim/content/hollow.ts HOLLOW_HOUSE_SLOT_OFFSETS (render-local
// copy is avoided: import from the sim content, which is host-agnostic data).
import { HOLLOW_HOUSE_SLOT_OFFSETS } from '../sim/content/hollow';
import type { HousingInfo } from '../world_api/housing';
import { GFX, surfaceMat } from './gfx';

function woodMat(color: number): THREE.Material {
  return surfaceMat({ color, roughness: 0.85, metalness: 0, flatShading: !GFX.standardMaterials });
}

function stoneMat(color: number): THREE.Material {
  return surfaceMat({ color, roughness: 0.95, metalness: 0, flatShading: !GFX.standardMaterials });
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
  if (text) {
    g.fillStyle = '#f3e6c8';
    g.font = 'bold 34px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text.slice(0, 14), canvas.width / 2, canvas.height / 2 + 2);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 2;
  return tex;
}

// A soft radial-gradient glow, additive-blended so it reads as light rather
// than a flat decal. Hidden by default; updateProximity() toggles it and
// pulses its opacity while the player stands near this signpost.
function buildInteractGlow(): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const g = canvas.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255, 226, 150, 0.9)');
  grad.addColorStop(1, 'rgba(255, 226, 150, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, canvas.width, canvas.height);
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(1.4, 24), mat);
  mesh.name = 'houseInteractGlow';
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.03;
  mesh.visible = false;
  return mesh;
}

function buildSignpost(text: string): THREE.Group {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.6, 0.18), woodMat(0x6b5138));
  post.position.y = 0.8;
  g.add(post);
  const tex = makeSignBoardTexture(text);
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(1.9, 0.5, 0.08),
    new THREE.MeshBasicMaterial({ map: tex }),
  );
  // The post sat directly behind the board's centre (both at z=0), and its
  // 0.18-deep box stuck out past the board's 0.08-deep face on the front
  // side, clipping straight through the middle of the printed name. Push
  // the post fully behind the board (no z-overlap) so it reads as a back
  // support, never crossing the visible face.
  board.position.set(0, 1.35, 0.13);
  g.add(board);
  g.add(buildInteractGlow());
  return g;
}

// PHAA-405: this stone-and-thatch cottage is a placeholder shape. The Board
// wants owned plots to read as a shrine to the Hollow's plant-creature life
// (see the Under-Shrine mob family, src/sim/content/hollow.ts), not a
// generic house; that reskin is an art-direction call, tracked separately.
function buildCottage(): THREE.Group {
  const g = new THREE.Group();
  const walls = new THREE.Mesh(new THREE.BoxGeometry(4.6, 2.6, 4.0), stoneMat(0x8a7a63));
  walls.position.y = 1.3;
  g.add(walls);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.6, 1.9, 4), woodMat(0x7a4a33));
  roof.position.y = 3.55;
  roof.rotation.y = Math.PI / 4;
  g.add(roof);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.6, 0.1), woodMat(0x53402c));
  door.position.set(0, 0.8, 2.03);
  g.add(door);
  return g;
}

function buildDecor(kind: string): THREE.Object3D {
  const g = new THREE.Group();
  switch (kind) {
    case 'planter': {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 0.8), woodMat(0x6b5138));
      box.position.y = 0.2;
      g.add(box);
      const plant = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.6, 6), stoneMat(0x4a7a3a));
      plant.position.y = 0.7;
      g.add(plant);
      break;
    }
    case 'lantern': {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.4, 0.12), woodMat(0x4c3a28));
      post.position.y = 0.7;
      g.add(post);
      const lamp = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.34, 0.3),
        surfaceMat({
          color: 0xffdf9a,
          roughness: 0.4,
          metalness: 0,
          emissive: 0xffb85c,
          emissiveIntensity: 0.9,
          flatShading: !GFX.standardMaterials,
        }),
      );
      lamp.position.y = 1.45;
      g.add(lamp);
      break;
    }
    case 'crate': {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.75, 0.75), woodMat(0x8a6b45));
      box.position.y = 0.375;
      box.rotation.y = 0.35;
      g.add(box);
      break;
    }
    case 'bench': {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 0.45), woodMat(0x7a5c3d));
      seat.position.y = 0.5;
      g.add(seat);
      for (const dx of [-0.55, 0.55]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.5, 0.4), woodMat(0x5c452e));
        leg.position.set(dx, 0.25, 0);
        g.add(leg);
      }
      break;
    }
    case 'stool': {
      const top = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.24, 0.12, 8),
        woodMat(0x7a5c3d),
      );
      top.position.y = 0.5;
      g.add(top);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.5, 6), woodMat(0x5c452e));
      leg.position.y = 0.25;
      g.add(leg);
      break;
    }
    default:
      break; // unknown kind from a newer server: draw nothing
  }
  return g;
}

// Unclaimed marker: four low corner posts and an empty signboard.
function buildUnclaimedMarker(): THREE.Group {
  const g = new THREE.Group();
  for (const [dx, dz] of [
    [-2.6, -2.6],
    [2.6, -2.6],
    [-2.6, 2.6],
    [2.6, 2.6],
  ]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.7, 0.16), woodMat(0x6b5138));
    post.position.set(dx, 0.35, dz);
    g.add(post);
  }
  const sign = buildSignpost('');
  sign.position.set(0, 0, 3.4);
  g.add(sign);
  return g;
}

export class HousingView {
  private readonly group = new THREE.Group();
  private lastKey = '';
  // plotId -> its signpost's glow ring, rebuilt alongside the group in update().
  private glowByPlot = new Map<string, THREE.Mesh>();
  private nearPlotId: string | null = null;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly ground: (x: number, z: number) => number,
  ) {
    this.group.name = 'housing';
    this.scene.add(this.group);
  }

  update(info: HousingInfo | null): void {
    const key =
      info?.origin == null
        ? ''
        : JSON.stringify({
            o: info.origin,
            p: info.plots.map((p) => [p.plotId, p.ownerName, p.objects]),
          });
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.clear();
    this.glowByPlot.clear();
    if (!info || !info.origin) return;
    const { x: ox, z: oz } = info.origin;
    for (const plot of info.plots) {
      const wx = ox + plot.x;
      const wz = oz + plot.z;
      const holder = new THREE.Group();
      holder.position.set(wx, this.ground(wx, wz), wz);
      holder.rotation.y = plot.rot;
      if (plot.ownerName === null) {
        holder.add(buildUnclaimedMarker());
      } else {
        holder.add(buildCottage());
        const sign = buildSignpost(plot.ownerName);
        sign.position.set(-3.2, 0, 3.4);
        holder.add(sign);
        for (const obj of plot.objects) {
          const off = HOLLOW_HOUSE_SLOT_OFFSETS[obj.slot];
          if (!off) continue;
          const mesh = buildDecor(obj.kind);
          mesh.position.set(off.dx, 0, off.dz);
          holder.add(mesh);
        }
      }
      this.group.add(holder);
      const glow = holder.getObjectByName('houseInteractGlow') as THREE.Mesh | null;
      if (glow) this.glowByPlot.set(plot.plotId, glow);
    }
    // A rebuild replaces every mesh, including the previously-active glow;
    // re-apply proximity so the ring doesn't drop out for one frame.
    this.applyProximity();
  }

  /** Toggle the one active plot's glow ring; called every frame (cheap: a
   * visibility flip plus one opacity write, never a rebuild). */
  updateProximity(plotId: string | null, elapsedSec: number): void {
    this.nearPlotId = plotId;
    this.applyProximity(elapsedSec);
  }

  private applyProximity(elapsedSec = 0): void {
    for (const [plotId, glow] of this.glowByPlot) {
      const near = plotId === this.nearPlotId;
      glow.visible = near;
      if (near) {
        (glow.material as THREE.MeshBasicMaterial).opacity = 0.55 + 0.25 * Math.sin(elapsedSec * 3);
      }
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
