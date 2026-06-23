import { describe, it, expect, vi } from 'vitest';
import {
  trackWebGLContext,
  releaseTrackedWebGLContexts,
  installWebGLContextRelease,
} from '../src/render/context_release';

function fakeHolder() {
  return { forceContextLoss: vi.fn(), dispose: vi.fn() };
}

describe('context_release', () => {
  it('force-loses then disposes every tracked context and clears the set', () => {
    releaseTrackedWebGLContexts(); // reset shared module state
    const a = fakeHolder();
    const b = fakeHolder();
    trackWebGLContext(a);
    trackWebGLContext(b);

    releaseTrackedWebGLContexts();

    expect(a.forceContextLoss).toHaveBeenCalledTimes(1);
    expect(a.dispose).toHaveBeenCalledTimes(1);
    expect(b.forceContextLoss).toHaveBeenCalledTimes(1);
    expect(b.dispose).toHaveBeenCalledTimes(1);

    // Cleared: a second release does not touch the already-released holders.
    releaseTrackedWebGLContexts();
    expect(a.forceContextLoss).toHaveBeenCalledTimes(1);
  });

  it('untracks a holder so it is not released after dispose-early', () => {
    releaseTrackedWebGLContexts();
    const a = fakeHolder();
    const untrack = trackWebGLContext(a);
    untrack();

    releaseTrackedWebGLContexts();

    expect(a.forceContextLoss).not.toHaveBeenCalled();
    expect(a.dispose).not.toHaveBeenCalled();
  });

  it('swallows a failing holder so one bad context cannot block the rest', () => {
    releaseTrackedWebGLContexts();
    const bad = {
      forceContextLoss: vi.fn(() => { throw new Error('context already lost'); }),
      dispose: vi.fn(() => { throw new Error('gone'); }),
    };
    const good = fakeHolder();
    trackWebGLContext(bad);
    trackWebGLContext(good);

    expect(() => releaseTrackedWebGLContexts()).not.toThrow();
    expect(good.forceContextLoss).toHaveBeenCalledTimes(1);
    expect(good.dispose).toHaveBeenCalledTimes(1);
  });

  it('releases tracked contexts when the page-teardown event fires', () => {
    releaseTrackedWebGLContexts();
    const listeners: Record<string, (() => void) | undefined> = {};
    const target = {
      addEventListener: (type: string, cb: () => void) => { listeners[type] = cb; },
    };
    const a = fakeHolder();
    trackWebGLContext(a);

    installWebGLContextRelease(target);
    expect(listeners.pagehide).toBeTypeOf('function');

    listeners.pagehide!();
    expect(a.forceContextLoss).toHaveBeenCalledTimes(1);
    expect(a.dispose).toHaveBeenCalledTimes(1);
  });
});
