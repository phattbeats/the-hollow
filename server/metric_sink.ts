// The per-request metric recording seam, adapted from upstream's
// server/http/middleware/metric_sink.ts (levy-street/world-of-claudecraft#1491,
// primitive 5/6 of the PHAA-519 REST decomposition). Upstream records inside a
// middleware onion where every route carries its :param template; our routes
// are an inline ladder in server/main.ts with no per-route template, so the
// adaptation records at the single top-level entry point (routeHttpRequest)
// via res 'finish'/'close' and DERIVES a bounded route template from the
// concrete path instead:
//   - numeric path segments collapse to ':id', 64-hex segments to ':token';
//   - any request that ends 404 collapses to '(unmatched)', so a scanner
//     inventing random /api/<noise> paths can never mint new label values;
//   - a hard cap on distinct templates (TEMPLATE_CAP) collapses overflow to
//     '(other)', bounding exporter cardinality no matter what a client sends.
// Nothing request-derived beyond that template (no ip, account, token, query,
// or body) ever becomes a metric label; the full ip rides only on the
// MetricEvent for the access log, which truncates it before writing.

import type * as http from 'node:http';

/** One recorded request. `route` is a bounded TEMPLATE, never a concrete path. */
export interface MetricEvent {
  route: string;
  method: string;
  status: number;
  durationMs: number;
  /** The resolved client IP (X-Forwarded-For aware). For the access log only. */
  ip?: string;
}

/** A pluggable sink for MetricEvent records. */
export interface MetricSink {
  record(event: MetricEvent): void;
}

/** A sink that discards every event; the default until a real one is wired. */
export const noopMetricSink: MetricSink = {
  record() {},
};

/**
 * Fan one event out to every sink (the access-log sink and the Prometheus sink
 * share one recording point). Each record() is wrapped so a throwing sink
 * neither stops the remaining sinks nor propagates out into the request path;
 * a sink is expected to already swallow its own errors, so this is a
 * belt-and-suspenders guard, not a substitute for that.
 */
export function teeMetricSink(...sinks: MetricSink[]): MetricSink {
  return {
    record(event: MetricEvent): void {
      for (const sink of sinks) {
        try {
          sink.record(event);
        } catch {
          // One sink failing must never break the others or the request path.
        }
      }
    },
  };
}

/** A numeric id path segment. */
const NUMERIC_SEGMENT_RE = /^\d+$/;
/** A 64-hex token path segment (the newToken() shape). */
const HEX64_SEGMENT_RE = /^[a-f0-9]{64}$/i;

/** Collapse id-shaped segments so a million distinct ids share one series. */
export function routeTemplateForPath(path: string): string {
  return path
    .split('/')
    .map((seg) => {
      if (NUMERIC_SEGMENT_RE.test(seg)) return ':id';
      if (HEX64_SEGMENT_RE.test(seg)) return ':token';
      return seg;
    })
    .join('/');
}

/** The route label every 404 collapses to (scanner noise must not mint series). */
export const UNMATCHED_ROUTE = '(unmatched)';
/** The route label overflow templates collapse to once TEMPLATE_CAP is reached. */
export const OVERFLOW_ROUTE = '(other)';
/**
 * Hard ceiling on distinct route templates this process will ever emit. The
 * real route set is far smaller; the cap is the backstop that bounds exporter
 * cardinality even if a non-404 route echoes attacker-shaped paths.
 */
export const TEMPLATE_CAP = 200;

const seenTemplates = new Set<string>();

/** Test-only: reset the template cap accounting. */
export function resetRouteTemplates(): void {
  seenTemplates.clear();
}

function boundedTemplate(path: string, status: number): string {
  if (status === 404) return UNMATCHED_ROUTE;
  const template = routeTemplateForPath(path);
  if (seenTemplates.has(template)) return template;
  if (seenTemplates.size >= TEMPLATE_CAP) return OVERFLOW_ROUTE;
  seenTemplates.add(template);
  return template;
}

/**
 * Record one MetricEvent for `req`/`res` against `sink` when the response
 * finishes (or the socket closes first: status 0 marks an aborted request).
 * Call once per instrumented request from the top-level router. `now` is an
 * injectable clock for deterministic duration assertions in tests; defaults to
 * Date.now. Recording never throws into the request path.
 */
export function instrumentRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  sink: MetricSink,
  ip?: string,
  now: () => number = Date.now,
): void {
  const started = now();
  const path = (req.url ?? '').split('?')[0];
  let recorded = false;
  const record = (status: number) => {
    if (recorded) return;
    recorded = true;
    try {
      sink.record({
        route: boundedTemplate(path, status),
        method: (req.method ?? 'GET').toUpperCase(),
        status,
        durationMs: now() - started,
        ip,
      });
    } catch {
      // A metric write must never break the request it is measuring.
    }
  };
  // Observability must never break routing: a bare stub res (some existing
  // routing tests drive routeHttpRequest with a writeHead/end-only fake) has
  // no event emitter, so such a request simply goes unrecorded.
  if (typeof res.on !== 'function') return;
  res.on('finish', () => record(res.statusCode));
  res.on('close', () => record(res.writableFinished ? res.statusCode : 0));
}
