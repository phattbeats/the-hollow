// The RED /metrics exporter core, ported from upstream's server/http/metrics.ts
// (levy-street/world-of-claudecraft#1491, primitive 5/6 of the PHAA-519 REST
// decomposition): a prom-client registry plus a MetricSink
// (server/metric_sink.ts) that turns each per-request MetricEvent into a
// Prometheus Counter increment and Histogram observation. RED = Rate (the
// request counter), Errors (the status label), and Duration (the latency
// histogram).
//
// CARDINALITY IS BOUNDED BY DESIGN. Every label value comes from a small fixed
// set: `route` is ALWAYS the bounded template metric_sink.ts derives (numeric
// ids and 64-hex tokens collapse to :params, 404s to '(unmatched)', overflow
// to '(other)'), never a concrete path; method is uppercased and status is the
// numeric code; the attack-signal labels (policy, key_kind, kind, route
// template) each come from a fixed set. Nothing request-derived (ip, account,
// token, query, body, concrete resource id) ever becomes a label.
//
// Alongside the two request-level RED metrics, the factory registers the four
// attack-signal counters (rate-limit 429s, auth failures, BOLA denials, tier-2
// pg limiter writes) on the SAME registry and exposes them as an
// AttackSignalSink; main.ts installs it process-wide via setAttackSignalSink
// (server/attack_signals.ts) so the scattered emission sites share this one
// exporter instance.
//
// EACH factory call builds its OWN Registry and registers the metrics ONLY on
// it (never the prom-client global default register), so many instances
// coexist in a test file with no duplicate-registration throw and no
// cross-talk. Server-side, language-agnostic: no t(), no DOM, no sim/client
// imports. prom-client is pinned EXACT at 15.1.3 (matching upstream), the one
// sanctioned server-only exception to the tiny-dependency-set rule; it never
// touches the client bundle.

import { timingSafeEqual } from 'node:crypto';
import type * as http from 'node:http';
import { Counter, collectDefaultMetrics, Histogram, Registry } from 'prom-client';
import type { AttackSignalKeyKind, AttackSignalSink, AuthFailureKind } from './attack_signals';
import type { MetricEvent, MetricSink } from './metric_sink';

/** The request-counter metric name (RED: Rate + Errors via the status label). */
export const HTTP_REQUESTS_TOTAL = 'http_requests_total';

/** The request-duration histogram metric name, in SECONDS (RED: Duration). */
export const HTTP_REQUEST_DURATION_SECONDS = 'http_request_duration_seconds';

/** Rate-limited (429) requests by policy and key kind (attack signal). */
export const RATE_LIMIT_HITS_TOTAL = 'rate_limit_hits_total';

/** Authentication failures by kind: bad_credentials or throttled (brute force). */
export const AUTH_FAILURES_TOTAL = 'auth_failures_total';

/** BOLA (requireOwnedCharacter) denials by route template (resource enumeration). */
export const BOLA_DENIED_TOTAL = 'bola_denied_total';

/** Tier-2 (pg) limiter upsert writes by policy; zero until that tier is ported. */
export const PG_LIMITER_WRITES_TOTAL = 'pg_limiter_writes_total';

/**
 * The complete, bounded label set shared by both request metrics. `route` is
 * the bounded template, `method` is uppercased, `status` is the numeric code
 * as a string. Nothing request-derived (ip, query, body) is ever added here.
 */
const HTTP_METRIC_LABELS = ['route', 'method', 'status'] as const;

/**
 * RED latency buckets in SECONDS: 5 ms up to 10 s. Chosen for typical API
 * request durations (sub-millisecond reads through multi-second slow paths).
 */
export const HTTP_DURATION_BUCKETS_SECONDS = [
  0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
] as const;

/** Milliseconds per second, for the durationMs to seconds conversion at observe time. */
const MS_PER_SECOND = 1000;

/** Options for {@link createHttpMetrics}. */
export interface CreateHttpMetricsOptions {
  /**
   * When true, attach prom-client's default process/runtime metrics (event
   * loop, heap, gc, ...) to THIS instance's registry only, never the global
   * register.
   */
  defaultMetrics?: boolean;
}

/** The exporter instance a caller wires into the server. */
export interface HttpMetrics {
  /** This instance's private registry (never the prom-client global default). */
  registry: Registry;
  /** The per-request sink to hand to instrumentRequest; record() never throws. */
  sink: MetricSink;
  /**
   * The four attack-signal counters on this instance's registry, behind the
   * AttackSignalSink contract; none of its methods ever throws. Boot installs
   * this process-wide via setAttackSignalSink (server/attack_signals.ts).
   */
  attackSignals: AttackSignalSink;
  /** The Prometheus exposition text for a /metrics response body. */
  metricsText(): Promise<string>;
  /** The Content-Type to send with the exposition text. */
  contentType: string;
}

/**
 * Build a self-contained RED metrics exporter. Each call creates a NEW
 * Registry and registers the request Counter and duration Histogram ONLY on
 * it, so instances are fully isolated (safe to build many in one test,
 * including one with defaultMetrics: true, with no duplicate-registration
 * throw and no cross-talk).
 *
 * The returned sink increments http_requests_total and observes
 * http_request_duration_seconds (durationMs / 1000) with the bounded label set
 * { route: event.route verbatim, method: uppercased, status: String(status) }.
 * It NEVER throws: the label build is guarded so a malformed event is dropped
 * rather than propagated into the request path.
 */
export function createHttpMetrics(opts: CreateHttpMetricsOptions = {}): HttpMetrics {
  const registry = new Registry();

  const requests = new Counter({
    name: HTTP_REQUESTS_TOTAL,
    help: 'Total HTTP requests handled, labeled by route template, method, and status.',
    labelNames: HTTP_METRIC_LABELS,
    registers: [registry],
  });

  const duration = new Histogram({
    name: HTTP_REQUEST_DURATION_SECONDS,
    help: 'HTTP request duration in seconds, labeled by route template, method, and status.',
    labelNames: HTTP_METRIC_LABELS,
    buckets: [...HTTP_DURATION_BUCKETS_SECONDS],
    registers: [registry],
  });

  const rateLimitHits = new Counter({
    name: RATE_LIMIT_HITS_TOTAL,
    help: 'Rate-limited (429) requests, labeled by policy name and key kind.',
    labelNames: ['policy', 'key_kind'],
    registers: [registry],
  });

  const authFailures = new Counter({
    name: AUTH_FAILURES_TOTAL,
    help: 'Authentication failures, labeled by kind (bad_credentials, throttled).',
    labelNames: ['kind'],
    registers: [registry],
  });

  const bolaDenials = new Counter({
    name: BOLA_DENIED_TOTAL,
    help: 'Object-level authorization (requireOwnedCharacter) denials, labeled by route template.',
    labelNames: ['route'],
    registers: [registry],
  });

  const pgLimiterWrites = new Counter({
    name: PG_LIMITER_WRITES_TOTAL,
    help: 'Tier-2 (pg) rate-limiter upsert writes, labeled by policy. Zero until that tier is ported.',
    labelNames: ['policy'],
    registers: [registry],
  });

  if (opts.defaultMetrics) {
    collectDefaultMetrics({ register: registry });
  }

  // Every attack-signal increment is guarded like sink.record below: a metric
  // write must never break the auth / rate-limit / BOLA path it observes.
  const attackSignals: AttackSignalSink = {
    rateLimitHit(policy: string, keyKind: AttackSignalKeyKind): void {
      try {
        rateLimitHits.inc({ policy, key_kind: keyKind });
      } catch {
        // Drop the sample rather than propagate into a rejection path.
      }
    },
    authFailure(kind: AuthFailureKind): void {
      try {
        authFailures.inc({ kind });
      } catch {
        // Drop the sample rather than propagate into a rejection path.
      }
    },
    bolaDenied(route: string): void {
      try {
        bolaDenials.inc({ route });
      } catch {
        // Drop the sample rather than propagate into a rejection path.
      }
    },
    pgLimiterWrite(policy: string): void {
      try {
        pgLimiterWrites.inc({ policy });
      } catch {
        // Drop the sample rather than propagate into a rejection path.
      }
    },
  };

  const sink: MetricSink = {
    record(event: MetricEvent): void {
      try {
        const labels = {
          route: event.route,
          method: event.method.toUpperCase(),
          status: String(event.status),
        };
        requests.inc(labels);
        duration.observe(labels, event.durationMs / MS_PER_SECOND);
      } catch {
        // A metric write must never break the request it is measuring; drop the
        // sample rather than propagate. prom-client is safe for the bounded
        // label set above, so this only guards a genuinely malformed event.
      }
    },
  };

  return {
    registry,
    sink,
    attackSignals,
    metricsText: () => registry.metrics(),
    contentType: registry.contentType,
  };
}

/** Constant-time secret compare; mirrors server/internal.ts's secretsMatch. */
function metricsTokenMatches(actual: string, expected: string): boolean {
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

const BEARER_PREFIX = 'Bearer ';

/**
 * Serve the token-gated /metrics exposition. The gate FAILS CLOSED as a 404
 * (never a 401/403): with METRICS_TOKEN unset the feature is off, and a
 * missing or mismatched `Authorization: Bearer <token>` is indistinguishable
 * from the endpoint not existing, so a scanner learns nothing. The token
 * compare is constant-time. `token` is injectable for tests; production reads
 * METRICS_TOKEN from the environment at request time (a restartless secret
 * rotation via the process manager picks up on the next boot, same as the
 * internal-secret gates).
 */
export async function handleMetricsRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  metrics: HttpMetrics,
  token: string | undefined = process.env.METRICS_TOKEN,
): Promise<void> {
  const notFound = () => {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'unknown endpoint' }));
  };
  if (!token || req.method !== 'GET') return notFound();
  const auth = req.headers.authorization ?? '';
  if (!auth.startsWith(BEARER_PREFIX)) return notFound();
  if (!metricsTokenMatches(auth.slice(BEARER_PREFIX.length), token)) return notFound();
  const body = await metrics.metricsText();
  res.writeHead(200, { 'Content-Type': metrics.contentType });
  res.end(body);
}
