// Regression for the mobile "frequent disconnection" reports: iOS Safari and
// Android Chrome both suspend JS timers AND kill the underlying socket while
// a tab is backgrounded, often without ever delivering a close event to the
// frozen page, and any pending reconnect setTimeout is itself throttled to
// roughly once a minute in the background. Purely event-driven reconnect
// (onclose -> backoff -> retry) then leaves a player stuck on a zombie
// "connected" socket, or several backoff steps behind, right when they
// foreground the app again. src/net/online.ts's ClientWorld now listens for
// visibilitychange and force-checks the real socket state on resume; this
// file pins that behavior directly (world_api_parity.test.ts's StubWebSocket
// is OPEN-only and never exercises reconnect).
import { afterEach, describe, expect, it } from 'vitest';
import { ClientWorld } from '../src/net/online';
import type { PlayerClass } from '../src/sim/types';

const PROBE_CLASS: PlayerClass = 'warrior';

class StubWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  readyState = StubWebSocket.OPEN;
  sent: string[] = [];
  constructor(public readonly url: string) {
    StubWebSocket.instances.push(this);
  }
  send(data: string): void {
    this.sent.push(data);
  }
  close(): void {
    this.readyState = StubWebSocket.CLOSED;
  }
  static instances: StubWebSocket[] = [];
}

// Fake document: just enough of the EventTarget + visibilityState surface for
// the ctor's addEventListener / handleVisibilityChange's read / endSession's
// removeEventListener. Exposes setVisible() so a test can flip state and fire
// the listener the way a real 'visibilitychange' event would.
function makeFakeDocument() {
  let visibilityState: 'visible' | 'hidden' = 'visible';
  const listeners = new Set<() => void>();
  return {
    get visibilityState() {
      return visibilityState;
    },
    addEventListener(type: string, cb: () => void) {
      if (type === 'visibilitychange') listeners.add(cb);
    },
    removeEventListener(type: string, cb: () => void) {
      if (type === 'visibilitychange') listeners.delete(cb);
    },
    setVisible(visible: boolean) {
      visibilityState = visible ? 'visible' : 'hidden';
      for (const cb of [...listeners]) cb();
    },
    listenerCount: () => listeners.size,
  };
}

type FakeDocument = ReturnType<typeof makeFakeDocument>;

function withDomStubs<T>(fn: (doc: FakeDocument) => T): T {
  const g = globalThis as Record<string, unknown>;
  const prevWebSocket = g.WebSocket;
  const prevWindow = g.window;
  const prevDocument = g.document;
  const timers: Array<{ id: number; fn: () => void }> = [];
  let nextId = 1;
  const doc = makeFakeDocument();
  g.WebSocket = StubWebSocket as unknown;
  g.document = doc as unknown;
  g.window = {
    setInterval: () => 0,
    clearInterval: () => undefined,
    // Reconnect scheduling under test: capture without auto-firing, so a
    // test can assert whether a NEW timer replaced a cleared one.
    setTimeout: (fn: () => void) => {
      const id = nextId++;
      timers.push({ id, fn });
      return id;
    },
    clearTimeout: (id: number) => {
      const idx = timers.findIndex((t) => t.id === id);
      if (idx !== -1) timers.splice(idx, 1);
    },
  };
  try {
    return fn(doc);
  } finally {
    g.WebSocket = prevWebSocket;
    g.window = prevWindow;
    g.document = prevDocument;
  }
}

describe('ClientWorld visibilitychange reconnect (mobile background/foreground)', () => {
  afterEach(() => {
    StubWebSocket.instances = [];
  });

  it('registers exactly one visibilitychange listener at construction and removes it on close()', () => {
    withDomStubs((doc) => {
      const world = new ClientWorld('t', 1, PROBE_CLASS, 'http://localhost');
      expect(doc.listenerCount()).toBe(1);
      world.close();
      expect(doc.listenerCount()).toBe(0);
    });
  });

  it('foregrounding onto a zombie socket (still "open" per JS state, but the real transport is dead) drives a fresh reconnect', () => {
    withDomStubs((doc) => {
      const world = new ClientWorld('t', 1, PROBE_CLASS, 'http://localhost');
      const first = StubWebSocket.instances[0];
      expect(first.readyState).toBe(StubWebSocket.OPEN);

      // Simulate the OS killing the transport out from under the page while
      // backgrounded: the readyState the browser now reports has moved off
      // OPEN, but onclose was never delivered to the frozen page, so
      // ClientWorld.connected is still whatever it was (true, once hello
      // landed) and no reconnect is scheduled.
      (world as unknown as { connected: boolean }).connected = true;
      first.readyState = StubWebSocket.CLOSED;

      doc.setVisible(false);
      expect(StubWebSocket.instances.length).toBe(1); // hidden: no reconnect attempt
      expect((world as unknown as { connected: boolean }).connected).toBe(true);

      doc.setVisible(true);
      // No close event was ever delivered for this zombie socket, so the
      // resume handler must drive the same "connected -> false, schedule a
      // reconnect" path a real close would have, instead of doing nothing
      // because ClientWorld still (wrongly) believes it is connected.
      expect((world as unknown as { connected: boolean }).connected).toBe(false);
      expect((world as unknown as { reconnectTimer: unknown }).reconnectTimer).not.toBeUndefined();
      world.close();
    });
  });

  it('foregrounding onto a socket killed DURING the initial handshake (before `hello`, so `connected` never became true) still drives a fresh reconnect', () => {
    withDomStubs((doc) => {
      const world = new ClientWorld('t', 1, PROBE_CLASS, 'http://localhost');
      const first = StubWebSocket.instances[0];

      // No `hello` has landed yet: `connected` is still false, exactly as it
      // would be if the tab were backgrounded mid-handshake. The OS kills
      // the transport without ever delivering onopen/onclose to the frozen
      // page, so the only observable change is the socket's own readyState.
      expect((world as unknown as { connected: boolean }).connected).toBe(false);
      first.readyState = StubWebSocket.CLOSED;

      doc.setVisible(false);
      expect(StubWebSocket.instances.length).toBe(1); // hidden: no reconnect attempt

      doc.setVisible(true);
      // The old `connected`-gated check would no-op here forever (connected
      // was already false, so nothing looked wrong). Keying off readyState
      // must still schedule a reconnect.
      expect((world as unknown as { reconnectTimer: unknown }).reconnectTimer).not.toBeUndefined();
      world.close();
    });
  });

  it('foregrounding while the handshake socket is still genuinely CONNECTING leaves it alone', () => {
    withDomStubs((doc) => {
      const world = new ClientWorld('t', 1, PROBE_CLASS, 'http://localhost');
      const first = StubWebSocket.instances[0];
      first.readyState = StubWebSocket.CONNECTING;

      doc.setVisible(false);
      doc.setVisible(true);
      // Still legitimately in-flight: no forced reconnect, no second socket.
      expect(StubWebSocket.instances.length).toBe(1);
      expect((world as unknown as { reconnectTimer: unknown }).reconnectTimer).toBeUndefined();
      world.close();
    });
  });

  it('foregrounding while a backoff timer is still pending retries immediately instead of waiting out the delay', () => {
    withDomStubs((doc) => {
      const world = new ClientWorld('t', 1, PROBE_CLASS, 'http://localhost');
      const first = StubWebSocket.instances[0];

      // A real close: readyState moves off OPEN and onclose fires, scheduling
      // the backoff reconnectTimer via the stubbed window.setTimeout above
      // (captured, not auto-fired).
      first.readyState = StubWebSocket.CLOSED;
      first.onclose?.();
      expect(StubWebSocket.instances.length).toBe(1); // still waiting on backoff

      doc.setVisible(true);
      // Foregrounding must not wait for the captured backoff timer to fire;
      // it opens a new socket right away.
      expect(StubWebSocket.instances.length).toBe(2);
      world.close();
    });
  });

  it('does nothing while the socket is genuinely open', () => {
    withDomStubs((doc) => {
      const world = new ClientWorld('t', 1, PROBE_CLASS, 'http://localhost');
      expect(StubWebSocket.instances.length).toBe(1);
      doc.setVisible(false);
      doc.setVisible(true);
      expect(StubWebSocket.instances.length).toBe(1);
      world.close();
    });
  });
});

// endSession() is shared by 3 call sites (close(), reconnect-attempts-exhausted,
// and a fatal server rejection in onMessage) and each one must drop the
// visibilitychange listener or ClientWorld leaks forever (document holds a live
// reference to the bound handler). The suite above only ever exercises close().
describe('ClientWorld endSession() teardown (all 3 call sites)', () => {
  afterEach(() => {
    StubWebSocket.instances = [];
  });

  it('close() removes the visibilitychange listener', () => {
    withDomStubs((doc) => {
      const world = new ClientWorld('t', 1, PROBE_CLASS, 'http://localhost');
      expect(doc.listenerCount()).toBe(1);
      world.close();
      expect(doc.listenerCount()).toBe(0);
      expect((world as unknown as { sessionEnded: boolean }).sessionEnded).toBe(true);
    });
  });

  it('exhausting reconnect attempts removes the visibilitychange listener and fires onDisconnect', () => {
    withDomStubs((doc) => {
      const world = new ClientWorld('t', 1, PROBE_CLASS, 'http://localhost');
      const first = StubWebSocket.instances[0];
      expect(doc.listenerCount()).toBe(1);

      let disconnectReason: string | null = null;
      world.onDisconnect = (reason) => {
        disconnectReason = reason;
      };
      // Fast-forward past RECONNECT_MAX_ATTEMPTS without actually driving 40
      // real reconnect cycles: the exhaustion check only reads this counter.
      (world as unknown as { reconnectAttempts: number }).reconnectAttempts = 1_000_000;
      first.readyState = StubWebSocket.CLOSED;
      first.onclose?.();

      expect(doc.listenerCount()).toBe(0);
      expect((world as unknown as { sessionEnded: boolean }).sessionEnded).toBe(true);
      expect(disconnectReason).toBe('Connection to the server was lost.');
      // No further reconnect was scheduled once the session ended for good.
      expect((world as unknown as { reconnectTimer: unknown }).reconnectTimer).toBeUndefined();
    });
  });

  it('a fatal (non-transient) server rejection removes the visibilitychange listener and fires onDisconnect', () => {
    withDomStubs((doc) => {
      const world = new ClientWorld('t', 1, PROBE_CLASS, 'http://localhost');
      const first = StubWebSocket.instances[0];
      expect(doc.listenerCount()).toBe(1);

      let disconnectReason: string | null = null;
      world.onDisconnect = (reason) => {
        disconnectReason = reason;
      };
      // Any error other than the transient 'character already in world'
      // conflict window ends the session outright (kick/moderation/takeover).
      first.onmessage?.({ data: JSON.stringify({ t: 'error', error: 'banned' }) });

      expect(doc.listenerCount()).toBe(0);
      expect((world as unknown as { sessionEnded: boolean }).sessionEnded).toBe(true);
      expect(disconnectReason).toBe('banned');
      // A fatal rejection must not leave a reconnect scheduled either.
      expect((world as unknown as { reconnectTimer: unknown }).reconnectTimer).toBeUndefined();
    });
  });

  it('the transient reconnect-conflict rejection does NOT end the session (regression guard for the endSession fatal path)', () => {
    withDomStubs((doc) => {
      const world = new ClientWorld('t', 1, PROBE_CLASS, 'http://localhost');
      const first = StubWebSocket.instances[0];
      // Mid-reconnect (attempts > 0): the transient conflict window applies.
      (world as unknown as { reconnectAttempts: number }).reconnectAttempts = 1;
      first.onmessage?.({
        data: JSON.stringify({ t: 'error', error: 'character already in world' }),
      });

      expect(doc.listenerCount()).toBe(1);
      expect((world as unknown as { sessionEnded: boolean }).sessionEnded).toBe(false);
      world.close();
    });
  });
});
