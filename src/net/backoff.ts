// Full-jitter exponential backoff for the auto-reconnect schedule
// (src/net/online.ts). A deterministic 1s/2s/4s/8s/15s schedule makes every
// dropped client replay the identical delays, so a server restart (or any
// mass-disconnect) re-hammers the server in lockstep on each retry step.
// Full jitter draws the actual delay uniformly from [0.5x, 1.5x) of the
// deterministic step (capped at maxDelayMs), spreading the population's
// retries across that band instead of a shared beat.
//
// Reconnect-delay jitter is not sim/gameplay logic (src/net/CLAUDE.md: never
// read Math.random into gameplay), so plain Math.random() is fine here; it
// never feeds a Rng-seeded sim outcome, only a client-local retry timer.

export function computeBackoffDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
): number {
  const step = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
  const jittered = step * (0.5 + Math.random());
  return Math.min(maxDelayMs, Math.round(jittered));
}
