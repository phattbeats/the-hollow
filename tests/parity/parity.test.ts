// The parity GATE.
//
// For every scenario this asserts two things:
//   1. INTERNALLY DETERMINISTIC: recording the same scenario twice is identical
//      (proves the harness itself adds no nondeterminism).
//   2. MATCHES THE COMMITTED GOLDEN: the recorded trace equals the checked-in
//      golden (proves current Sim behavior == the behavior captured when the
//      golden was minted).
//
// A red trace means behavior changed. Fix the change, NOT the harness. Regenerate
// goldens deliberately and reviewably with `UPDATE_PARITY=1 npx vitest run
// tests/parity` as its own commit.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { recordTrace } from './record';
import { SCENARIOS } from './scenarios';
import type { Trace } from './trace';

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDEN_DIR = join(HERE, 'golden');
const UPDATE = process.env.UPDATE_PARITY === '1';

function goldenPath(name: string): string {
  return join(GOLDEN_DIR, `${name}.json`);
}

// Normalize through JSON so the in-memory trace and the parsed golden compare as
// plain data (undefined-vs-missing and key order can't matter).
function plain(trace: Trace): unknown {
  return JSON.parse(JSON.stringify(trace));
}

// Vitest's default 5000ms per-test timeout is too tight for the heaviest scenarios
// recorded here. nythraxis_full_pull (a full 5-player raid pull: add waves, marks,
// phase transitions, long tick count) records in ~2.5s cold, and the determinism arm
// records it TWICE, so under full-suite CPU contention the pair intermittently blew
// the 5s cap and flaked the parity gate (observed 6.3s). This is a recording COST,
// not behavior drift: the trace is byte-identical run to run (proven in isolation).
// A generous cap keeps every scenario's two heavy recordings well clear on loaded CI
// hardware without weakening any behavior assertion.
const RECORD_TIMEOUT_MS = 30_000;

describe('parity gate', () => {
  for (const scenario of SCENARIOS) {
    describe(scenario.name, () => {
      it(
        'records deterministically (same scenario -> identical trace)',
        () => {
          const a = plain(recordTrace(scenario));
          const b = plain(recordTrace(scenario));
          expect(a).toEqual(b);
        },
        RECORD_TIMEOUT_MS,
      );

      it(
        UPDATE ? 'mints the golden' : 'matches the committed golden',
        () => {
          const trace = plain(recordTrace(scenario));
          const path = goldenPath(scenario.name);
          if (UPDATE) {
            mkdirSync(GOLDEN_DIR, { recursive: true });
            writeFileSync(path, `${JSON.stringify(trace, null, 2)}\n`);
            return;
          }
          expect(existsSync(path), `missing golden for ${scenario.name}; run UPDATE_PARITY=1`).toBe(
            true,
          );
          const golden = JSON.parse(readFileSync(path, 'utf8'));
          expect(trace).toEqual(golden);
        },
        RECORD_TIMEOUT_MS,
      );
    });
  }
});
