import { describe, expect, it } from 'vitest';
import {
  buildPerfOverlayView, defaultMetricsMap, FrameMeter, METRIC_REGISTRY, metricsPreset,
  overlayFractionFromPixel, overlayPixelPosition, PERF_METRIC_KEYS,
  type MetricsSample, type PerfMetricKey, type PerfOverlayViewConfig,
} from '../src/ui/perf_overlay_model';

function sample(over: Partial<MetricsSample> = {}): MetricsSample {
  return {
    fps: 60, frameTimeMs: 16.6, fps1Low: 50, fps01Low: 40, frameSamples: [16, 17, 16, 18, 15],
    online: true, connected: true, pingMs: 40, jitterMs: 5, snapshotHz: 20, connectionType: '4g',
    drawCalls: 300, triangles: 1_200_000, geometries: 80, textures: 50, programs: 20, renderScale: 1, gpu: 'Test GPU',
    memoryUsedMb: 400, memoryLimitMb: 2048, hitches: 0, entities: 12, backgrounded: false,
    ...over,
  };
}

function viewCfg(over: Partial<PerfOverlayViewConfig> = {}): PerfOverlayViewConfig {
  return { metrics: defaultMetricsMap(), thresholds: true, graph: true, ...over };
}

function allMetrics(): Record<PerfMetricKey, boolean> {
  return metricsPreset('everything');
}

describe('perf overlay metric registry', () => {
  it('defaults to the FPS + frame-time + ping trio only', () => {
    const m = defaultMetricsMap();
    expect(m.fps).toBe(true);
    expect(m.frameTime).toBe(true);
    expect(m.ping).toBe(true);
    expect(m.triangles).toBe(false);
    expect(m.memory).toBe(false);
  });

  it('exposes every registry key in PERF_METRIC_KEYS without duplicates', () => {
    expect(PERF_METRIC_KEYS.length).toBe(METRIC_REGISTRY.length);
    expect(new Set(PERF_METRIC_KEYS).size).toBe(PERF_METRIC_KEYS.length);
  });

  it('presets bulk-set visibility (minimal=fps only, everything=all on)', () => {
    const minimal = metricsPreset('minimal');
    expect(minimal.fps).toBe(true);
    expect(minimal.frameTime).toBe(false);
    expect(Object.values(allMetrics()).every(Boolean)).toBe(true);
  });
});

describe('buildPerfOverlayView', () => {
  it('emits only enabled, available rows in registry order', () => {
    const view = buildPerfOverlayView(sample(), viewCfg());
    expect(view.rows.map((r) => r.key)).toEqual(['fps', 'frameTime', 'ping']);
  });

  it('hides network rows when offline even if enabled', () => {
    const view = buildPerfOverlayView(sample({ online: false }), viewCfg({ metrics: allMetrics() }));
    const keys = view.rows.map((r) => r.key);
    expect(keys).not.toContain('ping');
    expect(keys).not.toContain('jitter');
    expect(keys).not.toContain('snapshot');
    // local metrics still present
    expect(keys).toContain('fps');
    expect(keys).toContain('entities');
  });

  it('hides Chromium-only rows when their source is null', () => {
    const view = buildPerfOverlayView(
      sample({ memoryUsedMb: null, memoryLimitMb: null, connectionType: null }),
      viewCfg({ metrics: allMetrics() }),
    );
    const keys = view.rows.map((r) => r.key);
    expect(keys).not.toContain('memory');
    expect(keys).not.toContain('connection');
  });

  it('color-codes FPS by threshold and respects the thresholds switch', () => {
    const sev = (fps: number, thresholds = true) =>
      buildPerfOverlayView(sample({ fps }), viewCfg({ thresholds })).rows.find((r) => r.key === 'fps')!.severity;
    expect(sev(72)).toBe('good');
    expect(sev(40)).toBe('warn');
    expect(sev(20)).toBe('bad');
    expect(sev(20, false)).toBe('none'); // thresholds off => no coloring
  });

  it('color-codes frame time the opposite direction (lower is better)', () => {
    const sev = (frameTimeMs: number) =>
      buildPerfOverlayView(sample({ frameTimeMs }), viewCfg()).rows.find((r) => r.key === 'frameTime')!.severity;
    expect(sev(10)).toBe('good');
    expect(sev(25)).toBe('warn');
    expect(sev(40)).toBe('bad');
  });

  it('drops the graph when disabled or with too few samples', () => {
    expect(buildPerfOverlayView(sample(), viewCfg({ graph: false })).graph).toBeNull();
    expect(buildPerfOverlayView(sample({ frameSamples: [16] }), viewCfg()).graph).toBeNull();
    expect(buildPerfOverlayView(sample(), viewCfg()).graph).not.toBeNull();
  });

  it('surfaces backgrounded + offline badges', () => {
    expect(buildPerfOverlayView(sample({ backgrounded: true }), viewCfg()).badges).toContain('backgrounded');
    expect(buildPerfOverlayView(sample({ online: true, connected: false }), viewCfg()).badges).toContain('offline');
    expect(buildPerfOverlayView(sample(), viewCfg()).badges).toEqual([]);
  });

  it('formats memory as a used/limit pair value descriptor', () => {
    const row = buildPerfOverlayView(sample(), viewCfg({ metrics: allMetrics() })).rows.find((r) => r.key === 'memory')!;
    expect(row.value).toEqual({ kind: 'memPair', usedMb: 400, limitMb: 2048 });
  });
});

describe('FrameMeter', () => {
  it('throttles repaints to roughly the configured interval', () => {
    const m = new FrameMeter();
    expect(m.step(1 / 60, 0)).toBe(false);      // first tick inside the gate
    expect(m.step(1 / 60, 100)).toBe(false);    // still < 250ms
    expect(m.step(1 / 60, 300)).toBe(true);     // gate elapsed
    expect(m.step(1 / 60, 400)).toBe(false);    // gate again
    expect(m.step(1 / 60, 600)).toBe(true);
  });

  it('smooths FPS toward the observed rate', () => {
    const m = new FrameMeter(300, 250, 60);
    for (let i = 0; i < 120; i++) m.step(1 / 30, i * 16); // sustained 30fps
    expect(m.fps()).toBeLessThan(40);
    expect(m.fps()).toBeGreaterThan(28);
    expect(m.frameTimeMs()).toBeGreaterThan(25);
  });

  it('reports lows only once enough samples exist', () => {
    const m = new FrameMeter();
    expect(m.lowFps(1)).toBeNull();
    for (let i = 0; i < 60; i++) m.step(1 / 60, i * 16);
    const low = m.lowFps(1);
    expect(low).not.toBeNull();
    expect(low!).toBeGreaterThan(0);
  });

  it('counts hitches and caps the sparkline length', () => {
    const m = new FrameMeter();
    for (let i = 0; i < 40; i++) m.step(1 / 60, i * 16); // smooth
    m.step(0.08, 1000); // one 80ms hitch
    expect(m.hitches()).toBe(1);
    expect(m.graphSamples(10).length).toBeLessThanOrEqual(10);
  });
});

describe('free positioning math', () => {
  it('maps normalized positions to clamped on-screen pixels', () => {
    const tl = overlayPixelPosition(0, 0, 1000, 800, 120, 60);
    expect(tl).toEqual({ left: 8, top: 8 });
    const br = overlayPixelPosition(1, 1, 1000, 800, 120, 60);
    expect(br.left).toBe(1000 - 120 - 8);
    expect(br.top).toBe(800 - 60 - 8);
  });

  it('clamps out-of-range fractions into the viewport', () => {
    const over = overlayPixelPosition(5, -5, 1000, 800, 120, 60);
    expect(over.left).toBe(1000 - 120 - 8);
    expect(over.top).toBe(8);
  });

  it('round-trips pixel<->fraction near the center', () => {
    const px = overlayPixelPosition(0.5, 0.5, 1000, 800, 120, 60);
    const frac = overlayFractionFromPixel(px.left, px.top, 1000, 800, 120, 60);
    expect(frac.x).toBeCloseTo(0.5, 2);
    expect(frac.y).toBeCloseTo(0.5, 2);
  });
});
