// The 3D map-editor viewport: a frozen Sim + the real game Renderer, flown with
// a free orbit camera instead of the game's player-follow camera.
//
// Scope note (PHAA-676, slice 4/8, "core viewport"): upstream's Editor3DViewport
// (v0.20 #1306) drives live terrain-brush/placement/undo editing through Renderer
// hooks this fork's renderer.ts does not have (editorCam, setEditorBrush,
// rebuildTerrain(region), rebakeTerrainNormals, surfacePoint, a live
// PlacedAssetsView instancer). Those are slice 5 (authoring) work, not ported
// here. This module only boots the engine, frames the camera on the map's hub,
// and flies a free camera over the static result. Renderer.sync() is never
// called: it is written for a ticking, player-driven world (view culling,
// adaptive resolution, per-entity LOD), none of which applies to a frozen
// preview, so this loop positions the camera and calls webgl.render() directly.

import { assetsReady } from '../../render/assets/preload';
import { Renderer } from '../../render/renderer';
import { setActiveWorldContent } from '../../sim/data';
import { Sim } from '../../sim/sim';
import { terrainHeight } from '../../sim/world';
import { t } from '../../ui/i18n';
import { type AssetPathResolver, type CustomMap, customMapToWorldContent } from '../custom_map';
import { el } from '../dom';
import { EditorCamera } from './editor_camera';

export class Editor3DViewport {
  private canvas!: HTMLCanvasElement;
  private nameplates!: HTMLDivElement;
  private readonly cam = new EditorCamera();
  private renderer: Renderer | null = null;
  private raf = 0;
  private lastT = 0;
  private disposed = false;
  private seed = 20061;
  private map: CustomMap;
  // Bumped by start()/reload()/dispose(); an in-flight start() that awoke with a
  // stale token abandons before touching the (possibly already torn down) canvas.
  private generation = 0;
  private visible = true;

  // drag state
  private dragMode: 'none' | 'orbit' | 'pan' = 'none';
  private lastPointerX = 0;
  private lastPointerY = 0;
  private readonly keysDown = new Set<string>();

  constructor(
    private readonly parent: HTMLElement,
    map: CustomMap,
    private readonly resolveAssetPath: AssetPathResolver,
  ) {
    this.map = map;
    this.createSurfaces();
  }

  private createSurfaces(): void {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'editor-3d-canvas';
    this.nameplates = document.createElement('div');
    this.nameplates.className = 'editor-3d-nameplates';
    this.parent.append(this.canvas, this.nameplates);
  }

  // assetsReady() rejects if any GLB/texture in the manifest fails to load (a
  // corrupt file, a broken self-host deploy). Match src/main.ts's boot path
  // (fatalOverlay): surface it instead of an unhandled rejection + blank stage.
  private showLoadError(err: unknown): void {
    this.canvas.remove();
    this.nameplates.remove();
    const message = err instanceof Error ? err.message : String(err);
    this.parent.appendChild(
      el('div', 'ed-3d-load-error', t('editor.viewport.assetsFailed', { error: message })),
    );
  }

  async start(): Promise<void> {
    const gen = ++this.generation;
    if (!this.canvas.isConnected) this.createSurfaces();
    this.seed = this.map.meta.seed;
    const world = customMapToWorldContent(this.map, this.resolveAssetPath);
    setActiveWorldContent(world);
    try {
      await assetsReady();
    } catch (err) {
      if (this.disposed || gen !== this.generation) return;
      this.showLoadError(err);
      return;
    }
    if (this.disposed || gen !== this.generation) return;
    const sim = new Sim({ seed: this.seed, playerClass: 'warrior', world });
    this.renderer = new Renderer(sim, this.canvas, this.nameplates);
    const hub = this.map.content.zones[0]?.hub ?? { x: 0, z: 0 };
    this.cam.target.set(hub.x, terrainHeight(hub.x, hub.z, this.seed), hub.z);
    this.attachEvents();
    if (this.visible) {
      this.lastT = performance.now();
      this.loop();
    }
  }

  get ready(): boolean {
    return this.renderer !== null;
  }

  private loop = (): void => {
    if (this.disposed || !this.visible || !this.renderer) return;
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastT) / 1000);
    this.lastT = now;
    this.applyFly(dt);
    const pose = this.cam.pose();
    this.renderer.camera.position.copy(pose.pos);
    this.renderer.camera.lookAt(pose.target);
    this.renderer.webgl.render(this.renderer.scene, this.renderer.camera);
    this.raf = requestAnimationFrame(this.loop);
  };

  private applyFly(dt: number): void {
    if (this.keysDown.size === 0) return;
    const forward = (this.keysDown.has('w') ? 1 : 0) - (this.keysDown.has('s') ? 1 : 0);
    const right = (this.keysDown.has('d') ? 1 : 0) - (this.keysDown.has('a') ? 1 : 0);
    const up = (this.keysDown.has('e') ? 1 : 0) - (this.keysDown.has('q') ? 1 : 0);
    if (forward !== 0 || right !== 0 || up !== 0) this.cam.fly(forward, right, up, dt);
  }

  private attachEvents(): void {
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.canvas.addEventListener('contextmenu', this.onContextMenu);
  }

  private detachEvents(): void {
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
    this.keysDown.clear();
  }

  private onContextMenu = (ev: Event): void => ev.preventDefault();

  private onPointerDown = (ev: PointerEvent): void => {
    this.dragMode = ev.button === 2 || ev.shiftKey || ev.button === 1 ? 'pan' : 'orbit';
    this.lastPointerX = ev.clientX;
    this.lastPointerY = ev.clientY;
    this.canvas.setPointerCapture(ev.pointerId);
  };

  private onPointerMove = (ev: PointerEvent): void => {
    if (this.dragMode === 'none') return;
    const dx = ev.clientX - this.lastPointerX;
    const dy = ev.clientY - this.lastPointerY;
    this.lastPointerX = ev.clientX;
    this.lastPointerY = ev.clientY;
    if (this.dragMode === 'orbit') this.cam.orbit(dx, dy);
    else this.cam.pan(dx, dy);
  };

  private onPointerUp = (): void => {
    this.dragMode = 'none';
  };

  private onWheel = (ev: WheelEvent): void => {
    ev.preventDefault();
    this.cam.zoom(ev.deltaY);
  };

  private onKeyDown = (ev: KeyboardEvent): void => {
    const k = ev.key.toLowerCase();
    if (k === 'w' || k === 'a' || k === 's' || k === 'd' || k === 'q' || k === 'e') {
      this.keysDown.add(k);
    }
  };

  private onKeyUp = (ev: KeyboardEvent): void => {
    this.keysDown.delete(ev.key.toLowerCase());
  };

  /** Swap to a different document (New / Open) without leaking the GL context. */
  async reload(map: CustomMap): Promise<void> {
    this.generation++;
    this.map = map;
    this.detachEvents();
    this.teardownEngine();
    await this.start();
  }

  setVisible(v: boolean): void {
    this.parent.style.display = v ? '' : 'none';
    if (v === this.visible) return;
    this.visible = v;
    if (!v) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
      return;
    }
    if (this.renderer) {
      this.lastT = performance.now();
      this.loop();
    }
  }

  dispose(): void {
    this.disposed = true;
    this.generation++;
    cancelAnimationFrame(this.raf);
    this.detachEvents();
    this.teardownEngine();
  }

  private teardownEngine(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (this.renderer) {
      try {
        this.renderer.webgl.setAnimationLoop(null);
        this.renderer.webgl.dispose();
        this.renderer.webgl.forceContextLoss();
      } catch {
        // GL teardown is best-effort.
      }
    }
    this.renderer = null;
  }
}
