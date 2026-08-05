// The map-editor application coordinator (PHAA-676 slice 4/8 "core viewport",
// extended by PHAA-678 slice 6/8 "persistence + UX polish").
//
// Scope: boot the editor chrome, show a MapDoc in the 3D viewport and the 2D
// top-down view, and load/save it against the server (this slice) or a saved
// browser copy. Authoring (terrain paint, asset placement, undo) is a later
// slice - every Topbar action for it stays an explicit no-op stub here.

import { invalidateStaticColliders } from '../sim/colliders';
import { setActiveWorldContent } from '../sim/data';
import { invalidateTerrainEditIndex } from '../sim/world';
import { t } from '../ui/i18n';
import { Editor3DViewport } from './3d/viewport';
import { AssetBrowser } from './asset_browser';
import { assetById } from './asset_catalog.generated';
import { draw } from './canvas';
import {
  type AssetPathResolver,
  type CustomMap,
  customMapToWorldContent,
  newCustomMap,
} from './custom_map';
import { el } from './dom';
import { downloadMap, pickMapFile } from './file_io';
import { MapIO } from './map_io';
import { buildEntities, type EditorEntity } from './model';
import {
  EditorApiError,
  forkMap,
  getMap,
  listMyMaps,
  type MapFullWire,
  signedIn,
  uploadAsset,
} from './net';
import { parseMap } from './persist';
import { EditGeneration, shouldAutosave } from './save_lifecycle_core';
import { editorErrorKey } from './server_errors_core';
import { confirmDialog, promptDialog, Toasts } from './toasts';
import { type EditorTool, Toolbar } from './toolbar';
import { Topbar } from './topbar';
import { EditorTutorial } from './tutorial';
import { registerUserAssets, userAssetIdFor, userAssetPath } from './user_assets';
import { Camera } from './view';

const AUTOSAVE_MS = 30_000;
const AUTOSAVE_PREF_KEY = 'woc_editor_autosave';
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

// The real placement asset id -> GLB path resolver: the generated catalogue
// first, falling back to a signed-in user's own uploads.
const resolveAssetPath: AssetPathResolver = (assetId) =>
  assetById(assetId)?.path ?? userAssetPath(assetId) ?? undefined;

function genId(): string {
  return typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : String(Date.now());
}

export class EditorApp {
  private map: CustomMap;
  private entities: EditorEntity[] = [];

  private readonly topbar: Topbar;
  private readonly toolbar: Toolbar;
  private readonly toasts: Toasts;
  private readonly tutorial: EditorTutorial;
  private readonly assets: AssetBrowser;

  private readonly root: HTMLElement;
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
  private readonly autosaveTimer: number;

  // ---- persistence state --------------------------------------------------
  private readonly io = new MapIO();
  private readonly editGen = new EditGeneration();
  private dirty = false;
  private saving = false;
  private autosaveOn = false;
  private autosaveWarned = false;
  private placeAssetId: string | null = null;
  private placeAssetLabel: string | null = null;

  constructor(mount: HTMLElement) {
    const root = el('div', 'ed-root');
    mount.appendChild(root);
    this.root = root;

    this.topbar = new Topbar(root, {
      onNameChange: (name) => {
        this.map.meta.name = name;
        this.markDirty();
      },
      onNew: () => void this.newMap(),
      onOpen: () => void this.openFromServer(),
      onSave: () => void this.save(),
      onSaveAs: () => void this.saveAs(),
      onAutosaveToggle: () => this.setAutosave(!this.autosaveOn),
      onFork: () => void this.forkCurrent(),
      onImport: () => void this.importFile(),
      onExport: () => this.exportFile(),
      onUploadAsset: () => void this.uploadAsset(),
      onPlaytest: () => {},
      onViewMode: (mode) => this.setViewMode(mode),
      onUndo: () => {},
      onRedo: () => {},
      onHelp: () => this.tutorial.openHelp(),
    });
    this.topbar.setOffline(!signedIn());
    this.topbar.setForkEnabled(false);
    try {
      this.autosaveOn = localStorage.getItem(AUTOSAVE_PREF_KEY) === '1';
    } catch {
      this.autosaveOn = false;
    }
    this.topbar.setAutosave(this.autosaveOn);
    this.topbar.setUndoState(false, false);
    this.topbar.setSaveState(t('editor.topbar.neverSaved'));
    this.topbar.setViewMode(this.viewMode);

    const main = el('div', 'ed-main');
    root.appendChild(main);

    this.toolbar = new Toolbar(main, (tool) => {
      this.tool = tool;
      this.toolbar.setActive(tool);
      this.assets.setVisible(tool === 'place');
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

    this.assets = new AssetBrowser(this.stage, {
      onPick: (assetId, label) => {
        this.placeAssetId = assetId;
        this.placeAssetLabel = label;
        if (this.tool !== 'place') {
          this.tool = 'place';
          this.toolbar.setActive('place');
          this.assets.setVisible(true);
        }
      },
      confirm: (title, body) => confirmDialog(root, { title, body, danger: true }),
      toastError: (m) => this.toasts.error(m),
    });

    this.toasts = new Toasts(root);

    window.addEventListener('beforeunload', this.onBeforeUnload);
    this.autosaveTimer = window.setInterval(() => this.autosave(), AUTOSAVE_MS);

    this.map = newCustomMap(t('editor.untitledMap'), genId(), Date.now());
    void this.loadMap(this.map);
    this.setViewMode(this.viewMode);

    this.tutorial = new EditorTutorial(root);
    this.tutorial.maybeAutoStart();
  }

  private async loadMap(map: CustomMap): Promise<void> {
    this.map = map;
    this.dirty = false;
    this.topbar.setMapName(map.meta.name);
    this.topbar.setDirty(false);
    this.topbar.setForkEnabled(this.io.linkFor(map.meta.id) !== null);
    this.topbar.setSaveState(t('editor.topbar.neverSaved'));
    const world = customMapToWorldContent(map, resolveAssetPath);
    setActiveWorldContent(world);
    invalidateTerrainEditIndex();
    invalidateStaticColliders();
    this.entities = buildEntities(map.content);
    this.resize2d();
    if (this.viewport3d) {
      await this.viewport3d.reload(map);
    } else {
      this.viewport3d = new Editor3DViewport(this.stage3dHost, map, resolveAssetPath);
      await this.viewport3d.start();
    }
  }

  // ---- open / new / import / export ------------------------------------------

  /** True when it is safe to replace the working document (confirms if dirty). */
  private async confirmDiscard(): Promise<boolean> {
    if (!this.dirty) return true;
    return confirmDialog(this.root, {
      title: t('editor.confirm.discardTitle'),
      body: t('editor.confirm.discardBody', { name: this.map.meta.name }),
      confirmLabel: t('editor.confirm.discard'),
      danger: true,
    });
  }

  private async newMap(): Promise<void> {
    if (!(await this.confirmDiscard())) return;
    await this.loadMap(newCustomMap(t('editor.untitledMap'), genId(), Date.now()));
    this.toasts.info(t('editor.status.newMap'));
  }

  private async openFromServer(): Promise<void> {
    if (!signedIn()) return;
    try {
      const mine = await listMyMaps();
      if (mine.length === 0) return;
      const full = await getMap(mine[0].id);
      await this.openServerMap(full, true);
    } catch (err) {
      const key =
        err instanceof EditorApiError ? editorErrorKey(err.code, err.status) : editorErrorKey(null);
      this.toasts.error(t(key));
    }
  }

  private async openServerMap(full: MapFullWire, mine: boolean): Promise<void> {
    if (!(await this.confirmDiscard())) return;
    // Re-run the shared sanitizer over the wire document (defense in depth; the
    // server stores sanitizer output, but the editor never trusts a wire byte).
    const parsed = parseMap(full.doc);
    if (!parsed) {
      this.toasts.error(t('editor.serverError.invalid_map_doc'));
      return;
    }
    parsed.meta.name = full.name;
    await this.loadMap(parsed);
    if (mine) {
      this.io.setLink(parsed.meta.id, { serverId: full.id, version: full.version });
      this.topbar.setForkEnabled(true);
      this.topbar.setSaveState(t('editor.topbar.savedServer', { version: full.version }));
    } else {
      this.io.setLink(parsed.meta.id, null);
      this.topbar.setForkEnabled(false);
    }
    this.toasts.success(t('editor.status.opened', { name: full.name }));
  }

  private async importFile(): Promise<void> {
    if (!(await this.confirmDiscard())) return;
    const map = await pickMapFile();
    if (map) {
      await this.loadMap(map);
      this.toasts.success(t('editor.status.imported', { name: map.meta.name }));
    } else {
      this.toasts.error(t('editor.status.importFailed'));
    }
  }

  private exportFile(): void {
    this.map.meta.updatedAt = Date.now();
    downloadMap(this.map);
    this.toasts.success(t('editor.status.exported', { name: this.map.meta.name }));
  }

  // ---- save / autosave / fork -------------------------------------------------

  private markDirty(): void {
    this.dirty = true;
    this.editGen.bump();
    this.topbar.setDirty(true);
  }

  /**
   * Save locally + to the server. `auto` = fired by the autosave tick: it must
   * stay silent on success and must never open a dialog; any failure (conflict
   * included) turns autosave off with one explanatory toast.
   */
  private async save(auto = false): Promise<void> {
    if (this.saving) return;
    this.map.meta.updatedAt = Date.now();
    const generation = this.editGen.current;
    const okLocal = this.io.saveLocal(this.map);
    if (!okLocal) {
      if (auto) {
        this.autosaveErrored(t('editor.status.saveFailedLocal'));
        return;
      }
      this.toasts.error(t('editor.status.saveFailedLocal'));
    }
    if (!signedIn()) {
      if (okLocal) {
        this.finishSave(
          t('editor.status.savedLocalOnly', { name: this.map.meta.name }),
          null,
          generation,
          auto,
        );
      }
      return;
    }
    this.saving = true;
    this.topbar.setSaving(true);
    try {
      const link = await this.io.saveServer(this.map);
      this.finishSave(
        t('editor.status.savedServer', { name: this.map.meta.name, version: link.version }),
        link.version,
        generation,
        auto,
      );
    } catch (err) {
      if (auto) {
        this.autosaveErrored(
          t(
            err instanceof EditorApiError
              ? editorErrorKey(err.code, err.status)
              : editorErrorKey(null),
          ),
        );
        this.topbar.setSaveState(t('editor.topbar.savedLocal'));
      } else if (err instanceof EditorApiError && err.code === 'version_conflict') {
        await this.resolveConflict(err.serverVersion ?? 0);
      } else {
        const key =
          err instanceof EditorApiError
            ? editorErrorKey(err.code, err.status)
            : editorErrorKey(null);
        this.toasts.error(t(key));
        this.topbar.setSaveState(t('editor.topbar.savedLocal'));
      }
    } finally {
      this.saving = false;
      this.topbar.setSaving(false);
    }
  }

  /** An automatic save failed: turn the feature off and say why, once. */
  private autosaveErrored(reason: string): void {
    this.setAutosave(false);
    this.toasts.error(t('editor.status.autosaveOff', { reason }));
  }

  private finishSave(
    message: string,
    serverVersion: number | null,
    generation: number,
    quiet = false,
  ): void {
    const fin = this.editGen.finalize(generation);
    if (fin.clearDirty) {
      this.dirty = false;
      this.topbar.setDirty(false);
    }
    this.topbar.setSaveState(
      serverVersion === null
        ? t('editor.topbar.savedLocal')
        : t('editor.topbar.savedServer', { version: serverVersion }),
    );
    this.topbar.setForkEnabled(this.io.linkFor(this.map.meta.id) !== null);
    if (fin.clearDraft) this.io.draftClear(this.map.meta.id);
    if (!quiet) this.toasts.success(message);
  }

  private async resolveConflict(serverVersion: number): Promise<void> {
    const copy = await confirmDialog(this.root, {
      title: t('editor.confirm.conflictTitle'),
      body: t('editor.confirm.conflictBody', { version: serverVersion }),
      confirmLabel: t('editor.confirm.conflictSaveCopy'),
    });
    if (!copy) {
      this.topbar.setSaveState(t('editor.topbar.savedLocal'));
      return;
    }
    // A copy is a new document identity: new meta.id, no server link yet. Mint
    // and commit the new id only after the server accepts the copy, so a
    // failed fork never orphans the document under way (see resolveConflict's
    // caller: this runs on a 409 from a plain save, not a fresh document).
    const oldId = this.map.meta.id;
    const newId = genId();
    try {
      const generation = this.editGen.current;
      const link = await this.io.saveServerAsCopy({
        ...this.map,
        meta: { ...this.map.meta, id: newId },
      });
      this.map.meta.id = newId;
      this.io.setLink(oldId, null);
      this.io.saveLocal(this.map);
      this.finishSave(
        t('editor.status.savedServer', { name: this.map.meta.name, version: link.version }),
        link.version,
        generation,
      );
    } catch (err) {
      const key =
        err instanceof EditorApiError ? editorErrorKey(err.code, err.status) : editorErrorKey(null);
      this.toasts.error(t(key));
    }
  }

  private async saveAs(): Promise<void> {
    const name = await promptDialog(
      this.root,
      t('editor.prompt.saveAsTitle'),
      t('editor.prompt.nameLabel'),
      this.map.meta.name,
    );
    if (!name) return;
    this.map.meta.name = name;
    this.map.meta.id = genId();
    this.map.meta.createdAt = Date.now();
    this.topbar.setMapName(name);
    this.topbar.setForkEnabled(false);
    await this.save();
  }

  private async forkCurrent(): Promise<void> {
    const link = this.io.linkFor(this.map.meta.id);
    if (!link) return;
    try {
      const forked = await forkMap(link.serverId);
      this.toasts.success(t('editor.status.forked', { name: forked.name }));
      await this.openServerMap(forked, true);
    } catch (err) {
      const key =
        err instanceof EditorApiError ? editorErrorKey(err.code, err.status) : editorErrorKey(null);
      this.toasts.error(t(key));
    }
  }

  private setAutosave(on: boolean): void {
    this.autosaveOn = on;
    this.topbar.setAutosave(on);
    try {
      localStorage.setItem(AUTOSAVE_PREF_KEY, on ? '1' : '0');
    } catch {
      // Blocked storage: the toggle still works for this session.
    }
  }

  private autosave(): void {
    if (!this.dirty) return;
    const ok = this.io.draftSave(this.map);
    if (ok) {
      this.autosaveWarned = false;
    } else if (!this.autosaveWarned) {
      this.autosaveWarned = true;
      this.toasts.error(t('editor.status.autosaveFailed'));
    }
    if (
      shouldAutosave({
        enabled: this.autosaveOn,
        dirty: this.dirty,
        saving: this.saving,
        editing: false,
      })
    ) {
      void this.save(true);
    }
  }

  // ---- asset upload -------------------------------------------------------------

  private async uploadAsset(): Promise<void> {
    if (!signedIn()) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.glb,model/gltf-binary';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (!file.name.toLowerCase().endsWith('.glb')) {
        this.toasts.error(t('editor.upload.notGlb'));
        return;
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        this.toasts.error(t('editor.upload.tooLarge'));
        return;
      }
      this.toasts.info(t('editor.upload.uploading'));
      try {
        const bytes = await file.arrayBuffer();
        const name = file.name.replace(/\.glb$/i, '');
        const { asset, existing } = await uploadAsset(bytes, name);
        registerUserAssets([
          { id: asset.id, sha256: asset.sha256, name: asset.name, byteSize: asset.byteSize },
        ]);
        const assetId = userAssetIdFor(asset.sha256);
        this.placeAssetId = assetId;
        this.placeAssetLabel = asset.name ?? asset.sha256.slice(0, 8);
        this.tool = 'place';
        this.toolbar.setActive('place');
        this.assets.setVisible(true);
        this.assets.showUploaded(assetId);
        this.toasts.success(
          existing
            ? t('editor.upload.uploadedExisting')
            : t('editor.upload.uploaded', { name: this.placeAssetLabel }),
        );
      } catch (err) {
        const key =
          err instanceof EditorApiError
            ? editorErrorKey(err.code, err.status)
            : editorErrorKey(null);
        this.toasts.error(t(key));
      }
    };
    input.click();
  }

  // ---- view mode ----------------------------------------------------------------

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

  private readonly onBeforeUnload = (ev: BeforeUnloadEvent): void => {
    if (!this.dirty) return;
    ev.preventDefault();
    ev.returnValue = '';
  };

  dispose(): void {
    window.removeEventListener('beforeunload', this.onBeforeUnload);
    window.clearInterval(this.autosaveTimer);
    this.resizeObserver.disconnect();
    this.viewport3d?.dispose();
    this.tutorial.dispose();
  }
}
