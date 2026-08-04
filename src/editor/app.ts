// The map-editor application coordinator (PHAA-676, slice 4/8, "core viewport").
//
// Scope: boot the editor chrome, show a MapDoc in the 3D viewport and the 2D
// top-down view, and load a saved map (read-only). Authoring (terrain paint,
// asset placement, undo) is slice 5; persistence/UX polish (real save, fork,
// import/export, asset upload, playtest, tutorial) is slice 6 - every Topbar
// action for those stays an explicit no-op stub here, wired up in its slice.
//
// No asset catalogue exists in this fork yet (see custom_map.ts), so placed
// assets resolve to nothing (a built-in-world map has none regardless).

import { invalidateStaticColliders } from '../sim/colliders';
import { setActiveWorldContent } from '../sim/data';
import { invalidateTerrainEditIndex } from '../sim/world';
import { t } from '../ui/i18n';
import { Editor3DViewport } from './3d/viewport';
import { draw } from './canvas';
import {
  type AssetPathResolver,
  type CustomMap,
  customMapToWorldContent,
  newCustomMap,
} from './custom_map';
import { el } from './dom';
import { buildEntities, type EditorEntity } from './model';
import { EditorApiError, getMap, listMyMaps, signedIn } from './net';
import { type EditorTool, Toolbar } from './toolbar';
import { Topbar } from './topbar';
import { Camera } from './view';

// Placeholder resolver: this fork has no generated asset-id -> path catalogue
// yet (see custom_map.ts's own note). A fresh/built-in map has zero placements,
// so this is never exercised before slice 5/6 wire in the real catalogue.
const NO_ASSET_CATALOG: AssetPathResolver = () => undefined;

function genId(): string {
  return typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : String(Date.now());
}

export class EditorApp {
  private map: CustomMap;
  private entities: EditorEntity[] = [];

  private readonly topbar: Topbar;
  private readonly toolbar: Toolbar;

  private readonly stage: HTMLElement;
  private readonly stage3dHost: HTMLElement;
  private readonly stage2dHost: HTMLElement;
  private readonly canvas2d: HTMLCanvasElement;
  private readonly ctx2d: CanvasRenderingContext2D;
  private readonly cam2d = new Camera({ x: 0, z: 0 }, 2);
  private viewport3d: Editor3DViewport | null = null;
  private viewMode: '3d' | '2d' = '3d';
  private tool: EditorTool = 'select';

  private drag2d: { x: number; y: number } | null = null;
  private readonly resizeObserver: ResizeObserver;

  constructor(mount: HTMLElement) {
    const root = el('div', 'ed-root');
    mount.appendChild(root);

    this.topbar = new Topbar(root, {
      onNameChange: (name) => {
        this.map.meta.name = name;
      },
      onNew: () => void this.loadMap(newCustomMap(t('editor.untitledMap'), genId(), Date.now())),
      onOpen: () => void this.openFromServer(),
      onSave: () => {},
      onSaveAs: () => {},
      onAutosaveToggle: () => {},
      onFork: () => {},
      onImport: () => {},
      onExport: () => {},
      onUploadAsset: () => {},
      onPlaytest: () => {},
      onViewMode: (mode) => this.setViewMode(mode),
      onUndo: () => {},
      onRedo: () => {},
      onHelp: () => {},
    });
    this.topbar.setOffline(!signedIn());
    this.topbar.setForkEnabled(false);
    this.topbar.setAutosave(false);
    this.topbar.setUndoState(false, false);
    this.topbar.setSaveState(t('editor.topbar.neverSaved'));
    this.topbar.setViewMode(this.viewMode);

    const main = el('div', 'ed-main');
    root.appendChild(main);

    this.toolbar = new Toolbar(main, (tool) => {
      this.tool = tool;
      this.toolbar.setActive(tool);
    });
    this.toolbar.setActive(this.tool);

    this.stage = el('div', 'ed-stage');
    main.appendChild(this.stage);
    this.stage3dHost = el('div', 'editor-3d-host');
    this.stage2dHost = el('div', 'editor-2d-host');
    this.stage.append(this.stage3dHost, this.stage2dHost);

    this.canvas2d = document.createElement('canvas');
    this.stage2dHost.appendChild(this.canvas2d);
    const ctx = this.canvas2d.getContext('2d');
    if (!ctx) throw new Error('2d canvas context unavailable');
    this.ctx2d = ctx;
    this.attach2dEvents();
    this.resizeObserver = new ResizeObserver(() => this.resize2d());
    this.resizeObserver.observe(this.stage2dHost);

    this.map = newCustomMap(t('editor.untitledMap'), genId(), Date.now());
    void this.loadMap(this.map);
    this.setViewMode(this.viewMode);
  }

  private async loadMap(map: CustomMap): Promise<void> {
    this.map = map;
    this.topbar.setMapName(map.meta.name);
    this.topbar.setDirty(false);
    const world = customMapToWorldContent(map, NO_ASSET_CATALOG);
    setActiveWorldContent(world);
    invalidateTerrainEditIndex();
    invalidateStaticColliders();
    this.entities = buildEntities(map.content);
    this.resize2d();
    if (this.viewport3d) {
      await this.viewport3d.reload(map);
    } else {
      this.viewport3d = new Editor3DViewport(this.stage3dHost, map, NO_ASSET_CATALOG);
      await this.viewport3d.start();
    }
  }

  private async openFromServer(): Promise<void> {
    if (!signedIn()) return;
    try {
      const mine = await listMyMaps();
      if (mine.length === 0) return;
      const full = await getMap(mine[0].id);
      await this.loadMap(full.doc);
    } catch (err) {
      if (!(err instanceof EditorApiError)) throw err;
      // A failed load leaves the current document untouched; slice 6 (persistence
      // UX) surfaces this to the user via toasts.ts.
    }
  }

  private setViewMode(mode: '3d' | '2d'): void {
    this.viewMode = mode;
    this.topbar.setViewMode(mode);
    this.stage3dHost.style.display = mode === '3d' ? '' : 'none';
    this.stage2dHost.style.display = mode === '2d' ? '' : 'none';
    this.viewport3d?.setVisible(mode === '3d');
    if (mode === '2d') this.draw2d();
  }

  // ---- 2D view (pan/zoom only; read-only display, no marker dragging) --------

  private resize2d(): void {
    const rect = this.stage2dHost.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    if (this.canvas2d.width !== w || this.canvas2d.height !== h) {
      this.canvas2d.width = w;
      this.canvas2d.height = h;
    }
    if (this.viewMode === '2d') this.draw2d();
  }

  private draw2d(): void {
    const vp = { width: this.canvas2d.width, height: this.canvas2d.height };
    draw(this.ctx2d, this.cam2d, vp, {
      entities: this.entities,
      roads: this.map.content.roads ?? [],
      selectedKey: null,
      hoverKey: null,
      terrainEdits: this.map.terrainEdits,
      placements: this.map.placements,
      biomePaint: this.map.biomePaint ?? null,
      blockers: this.map.blockers ?? [],
      blockerPreview: null,
      region: null,
      brush: null,
      spawn: this.map.playerStart ?? null,
    });
  }

  private attach2dEvents(): void {
    this.canvas2d.addEventListener('pointerdown', (ev) => {
      this.drag2d = { x: ev.clientX, y: ev.clientY };
      this.canvas2d.setPointerCapture(ev.pointerId);
    });
    this.canvas2d.addEventListener('pointermove', (ev) => {
      if (!this.drag2d) return;
      const dx = ev.clientX - this.drag2d.x;
      const dy = ev.clientY - this.drag2d.y;
      this.drag2d = { x: ev.clientX, y: ev.clientY };
      this.cam2d.panByPixels(dx, dy);
      this.draw2d();
    });
    this.canvas2d.addEventListener('pointerup', () => {
      this.drag2d = null;
    });
    this.canvas2d.addEventListener(
      'wheel',
      (ev) => {
        ev.preventDefault();
        const rect = this.canvas2d.getBoundingClientRect();
        const anchor = { sx: ev.clientX - rect.left, sy: ev.clientY - rect.top };
        const factor = Math.exp(-ev.deltaY * 0.001);
        this.cam2d.zoomAt(anchor, factor, {
          width: this.canvas2d.width,
          height: this.canvas2d.height,
        });
        this.draw2d();
      },
      { passive: false },
    );
  }

  dispose(): void {
    this.resizeObserver.disconnect();
    this.viewport3d?.dispose();
  }
}
