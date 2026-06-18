import { graphicsPresetLabel } from '../render/gfx';
import type { PerfMonitor, PerfSnapshot } from './perf';
import type { Settings } from './settings';

declare const __APP_VERSION__: string;
declare const __APP_BUILD_ID__: string;

const FIRST_REPORT_MS = 75_000;
const REPEAT_REPORT_MS = 5 * 60_000;
const MIN_REPORT_SECONDS = 20;
const MIN_REPORT_FRAMES = 30;
const SESSION_KEY = 'woc_perf_session_id';

export interface PerfReporterOptions {
  perf: PerfMonitor;
  settings: Settings;
  tokenProvider: () => string | null;
  characterIdProvider: () => number | null;
}

function storedSessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }
}

function browserFamily(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (ua.includes('edg/')) return 'edge';
  if (ua.includes('firefox/')) return 'firefox';
  if (ua.includes('chrome/') || ua.includes('crios/')) return 'chrome';
  if (ua.includes('safari/')) return 'safari';
  return 'other';
}

function osFamily(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (ua.includes('windows')) return 'windows';
  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ios')) return 'ios';
  if (ua.includes('mac os') || ua.includes('macintosh')) return 'macos';
  if (ua.includes('android')) return 'android';
  if (ua.includes('linux')) return 'linux';
  return 'other';
}

function gpuBucket(renderer: string): string {
  const r = renderer.toLowerCase();
  if (!r) return 'unknown';
  if (/swiftshader|llvmpipe|software/.test(r)) return 'software';
  if (/apple/.test(r)) {
    const chip = /(m[1-9][a-z0-9 ]*)/i.exec(renderer)?.[1]?.toLowerCase().replace(/\s+/g, '-');
    return chip ? `apple-${chip}` : 'apple';
  }
  if (/intel/.test(r)) {
    if (/iris/.test(r)) return 'intel-iris';
    if (/uhd|hd graphics/.test(r)) return 'intel-uhd';
    return 'intel';
  }
  if (/nvidia|geforce|rtx|gtx/.test(r)) return 'nvidia';
  if (/amd|radeon/.test(r)) return 'amd';
  return renderer.slice(0, 48).replace(/[^\w.-]+/g, '-').toLowerCase() || 'other';
}

function viewportBucket(width: number, height: number): string {
  const short = Math.min(width, height);
  const long = Math.max(width, height);
  if (short <= 480) return `mobile-${width}x${height}`;
  if (long >= 1800) return `wide-${width}x${height}`;
  if (long >= 1200) return `large-${width}x${height}`;
  return `medium-${width}x${height}`;
}

function scenarioFromUrl(): { source: 'gameplay' | 'benchmark'; zoneOrScenario: string } {
  const params = new URLSearchParams(location.search);
  const scenario = (params.get('perfScenario') ?? params.get('perf_scenario') ?? '').trim().slice(0, 80);
  if (scenario) return { source: 'benchmark', zoneOrScenario: scenario };
  return { source: 'gameplay', zoneOrScenario: 'gameplay' };
}

function payloadFromSnapshot(
  snapshot: PerfSnapshot,
  settings: Settings,
  sessionId: string,
  characterId: number | null,
): Record<string, unknown> | null {
  const renderer = snapshot.renderer;
  if (!renderer) return null;
  const memory = snapshot.browser.memory;
  const longTasks = snapshot.browser.longTasks;
  const device = snapshot.device;
  const viewportWidth = Math.max(1, Math.round(window.innerWidth));
  const viewportHeight = Math.max(1, Math.round(window.innerHeight));
  const scenario = scenarioFromUrl();
  return {
    schemaVersion: 1,
    releaseVersion: __APP_VERSION__,
    buildId: __APP_BUILD_ID__,
    sessionId,
    characterId,
    graphicsPreset: graphicsPresetLabel(settings.get('graphicsPreset')),
    gfxTier: renderer.tier,
    autoGovernor: renderer.autoGovernor,
    targetFps: renderer.budget.targetFps,
    renderScale: renderer.renderScale,
    effectiveRenderScale: renderer.effectiveRenderScale,
    fpsAvg: snapshot.fps,
    frameP95Ms: snapshot.frameMs.p95,
    frameP99Ms: snapshot.frameMs.p99,
    longFrameCount: snapshot.frameMs.long50,
    rendererCalls: renderer.calls,
    rendererTriangles: renderer.triangles,
    rendererTextures: renderer.textures,
    rendererPrograms: renderer.programs,
    contextLostCount: renderer.contextLost,
    longTaskCount: longTasks.count,
    longTaskP95Ms: longTasks.p95,
    memoryUsedMb: memory?.usedMB ?? null,
    memoryLimitMb: memory?.limitMB ?? null,
    dpr: device.dpr,
    viewportWidth,
    viewportHeight,
    viewportBucket: viewportBucket(viewportWidth, viewportHeight),
    deviceMemory: device.deviceMemory,
    hardwareConcurrency: device.hardwareConcurrency,
    mobileTouch: device.mobileTouch,
    browserFamily: browserFamily(device.userAgent),
    osFamily: osFamily(device.userAgent),
    glVendor: renderer.glVendor,
    glRenderer: renderer.glRenderer,
    glRendererBucket: gpuBucket(renderer.glRenderer),
    source: scenario.source,
    zoneOrScenario: scenario.zoneOrScenario,
    rawSummary: {
      seconds: snapshot.seconds,
      frames: snapshot.frames,
      windows: snapshot.windows,
      mainMs: snapshot.mainMs,
      rendererPhaseMs: renderer.phaseMs,
      assets: {
        preload: snapshot.assets.preload,
        byType: snapshot.assets.byType,
      },
      network: snapshot.network,
      input: snapshot.input,
      hud: snapshot.hud,
    },
  };
}

export function startPerfReporter(options: PerfReporterOptions): () => void {
  const params = new URLSearchParams(location.search);
  if (params.get('perfReport') === '0' || params.get('perf_report') === '0') return () => {};

  const sessionId = storedSessionId();
  let stopped = false;
  let timer: number | null = null;

  const schedule = (delay: number): void => {
    if (stopped) return;
    timer = window.setTimeout(send, delay);
  };

  const send = (): void => {
    timer = null;
    if (stopped) return;
    if (document.visibilityState !== 'visible') {
      schedule(REPEAT_REPORT_MS);
      return;
    }
    const snapshot = options.perf.report();
    if (snapshot.seconds < MIN_REPORT_SECONDS || snapshot.frames < MIN_REPORT_FRAMES) {
      schedule(15_000);
      return;
    }
    const body = payloadFromSnapshot(snapshot, options.settings, sessionId, options.characterIdProvider());
    if (!body) {
      schedule(REPEAT_REPORT_MS);
      return;
    }
    const token = options.tokenProvider();
    void fetch('/api/perf-report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {});
    schedule(REPEAT_REPORT_MS);
  };

  schedule(FIRST_REPORT_MS);
  return () => {
    stopped = true;
    if (timer !== null) window.clearTimeout(timer);
  };
}

export const perfReporterInternalsForTest = {
  browserFamily,
  osFamily,
  gpuBucket,
  viewportBucket,
  payloadFromSnapshot,
};
