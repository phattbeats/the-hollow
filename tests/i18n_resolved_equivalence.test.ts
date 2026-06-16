import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Byte-equivalence safety net for the i18n scaling refactor. Every
// behavior-preserving phase must leave the resolved 14-locale table
// byte-identical; this asserts the table's deterministic SHA-256 still matches
// the committed baseline. The baseline changes ONLY in a phase that
// deliberately changes resolved output - a drift here is a bug, not a re-baseline.
//
// We invoke the real hash script as a subprocess so the test exercises exactly
// the code path the build gate uses (and avoids re-implementing the esbuild
// bundling inside the Vitest transform pipeline).

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scriptPath = path.join(root, "scripts/i18n_resolved_hash.mjs");
const baselinePath = path.join(root, "src/ui/i18n.resolved.sha256");

describe("i18n resolved-table byte equivalence", () => {
  it("matches the committed baseline hash", () => {
    const out = execFileSync("node", [scriptPath], { cwd: root, encoding: "utf8" });
    const match = out.match(/locales=(\d+) bytes=(\d+) sha256=([0-9a-f]{64})/);
    expect(match, `unexpected hash script output: ${out}`).toBeTruthy();
    const [, locales, , sha256] = match!;
    expect(Number(locales)).toBe(14);

    const baseline = readFileSync(baselinePath, "utf8").trim();
    expect(sha256).toBe(baseline);
  });

  it("the --check gate passes against the committed baseline", () => {
    // execFileSync throws on a non-zero exit, which fails the test.
    expect(() =>
      execFileSync("node", [scriptPath, "--check"], { cwd: root, encoding: "utf8" }),
    ).not.toThrow();
  });
});
