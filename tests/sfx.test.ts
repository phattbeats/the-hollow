import { beforeEach, describe, expect, it } from 'vitest';
import { sfx } from '../src/game/sfx';

// The footstep "jingling" bug: foot clips are ~0.48s but steps fire every ~0.22s
// at a run, so flat retriggers overlap two pitch-jittered copies of one sample and
// comb-filter into a metallic ring. footstep() must (a) shape each play into a
// short transient that is stopped before the next step and (b) alternate pitch
// per step. These tests pin both behaviours via a minimal WebAudio stub.

interface FakeSource {
  buffer: { duration: number } | null;
  playbackRate: { value: number };
  onended: (() => void) | null;
  started: boolean;
  stopAt: number | null;
  connect(n: unknown): unknown;
  start(): void;
  stop(t?: number): void;
}

const sources: FakeSource[] = [];
let nowT = 0;

function installAudioStub(): void {
  sources.length = 0;
  nowT += 1000; // monotonic across tests so the singleton's cooldown map never blocks
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, setTargetAtTime() {} });
  class FakeCtx {
    get currentTime() { return nowT; }
    destination = {};
    listener = {} as Record<string, unknown>;
    createGain() { return { gain: param(), connect(n: unknown) { return n; }, disconnect() {} }; }
    createPanner() {
      return {
        panningModel: '', distanceModel: '', refDistance: 0, maxDistance: 0, rolloffFactor: 0,
        setPosition() {}, connect(n: unknown) { return n; }, disconnect() {},
      };
    }
    createBufferSource(): FakeSource {
      const s: FakeSource = {
        buffer: null, playbackRate: { value: 1 }, onended: null, started: false, stopAt: null,
        connect(n: unknown) { return n; },
        start() { this.started = true; },
        stop(t?: number) { this.stopAt = t ?? 0; },
      };
      sources.push(s);
      return s;
    }
    resume() { return Promise.resolve(); }
  }
  (globalThis as never as { AudioContext: unknown }).AudioContext = FakeCtx;
}

beforeEach(() => {
  installAudioStub();
  // Neutralize the ±jitter so alternation is the only pitch variable under test.
  Math.random = () => 0.5;
  sfx.init();
  // Inject decoded buffers directly (skip async fetch/decode in preload).
  const buffers = (sfx as unknown as { buffers: Map<string, { duration: number }> }).buffers;
  buffers.set('foot_grass', { duration: 0.48 });
});

describe('footstep audio', () => {
  it('shapes each footfall into a transient stopped before the next step', () => {
    sfx.footstep(0, 0, 0, 'grass', true, true);
    const src = sources.at(-1)!;
    expect(src.started).toBe(true);
    // running release 0.17s + tail margin → stopped well under the ~0.22s gap,
    // and far under the raw 0.48s clip that caused the overlap ring.
    expect(src.stopAt).not.toBeNull();
    expect(src.stopAt! - nowT).toBeLessThan(0.22);
  });

  it('alternates pitch between consecutive steps (left/right foot)', () => {
    sfx.footstep(0, 0, 0, 'grass', false, true);
    const a = sources.at(-1)!.playbackRate.value;
    nowT += 0.5; // clear the per-key cooldown so the next step actually plays
    sfx.footstep(0, 0, 0, 'grass', false, true);
    const b = sources.at(-1)!.playbackRate.value;
    expect(Math.abs(a - b)).toBeGreaterThan(0.05);
  });
});
