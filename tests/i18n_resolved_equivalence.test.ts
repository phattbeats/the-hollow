import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { assertDeterministic } from './helpers/i18n_determinism';

// Byte-equivalence safety net for the i18n scaling refactor. Every
// behavior-preserving change must leave the resolved 14-locale table
// byte-identical; this asserts the table's deterministic SHA-256 still matches
// the committed baseline. The baseline changes ONLY in a change that
// deliberately changes resolved output - a drift here is a bug, not a re-baseline.
//
// We invoke the real hash script as a subprocess so the test exercises exactly
// the code path the build gate uses (and avoids re-implementing the esbuild
// bundling inside the Vitest transform pipeline).

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scriptPath = path.join(root, 'scripts/i18n_resolved_hash.mjs');
const baselinePath = path.join(root, 'src/ui/i18n.resolved.sha256');
const buildScript = path.join(root, 'scripts/i18n_build.mjs');
// The resolved table is a generated DIRECTORY of per-locale modules + a barrel
// (the per-locale emit split), not a single file. A directory pathspec makes both
// `git ls-files --error-unmatch` and `git diff --exit-code` cover every slice.
const generatedPath = 'src/ui/i18n.resolved.generated';
// The flat TranslationKey union is emitted by the SAME generator but lives in the
// catalog directory (its type is the catalog's public surface); it follows the
// same contract: tracked, regen-byte-identical, deterministic. In override mode
// (I18N_OUT_DIR set) the generator emits it INTO the override directory as
// translation_keys.generated.ts, so the perturbed-env runs below exercise this
// emit hermetically, never touching the committed file.
const keysPath = 'src/ui/i18n.catalog/translation_keys.generated.ts';

describe('i18n resolved-table byte equivalence', () => {
  it('matches the committed baseline hash', () => {
    const out = execFileSync(process.execPath, [scriptPath], { cwd: root, encoding: 'utf8' });
    const match = out.match(/locales=(\d+) bytes=(\d+) sha256=([0-9a-f]{64})/);
    expect(match, `unexpected hash script output: ${out}`).toBeTruthy();
    const [, locales, , sha256] = match!;
    expect(Number(locales)).toBe(21);

    const baseline = readFileSync(baselinePath, 'utf8').trim();
    expect(sha256).toBe(baseline);
  });

  it('the --check gate passes against the committed baseline', () => {
    // execFileSync throws on a non-zero exit, which fails the test.
    expect(() =>
      execFileSync(process.execPath, [scriptPath, '--check'], { cwd: root, encoding: 'utf8' }),
    ).not.toThrow();
  });
});

describe('i18n resolved-artifact reproducibility', () => {
  it('the generated dense artifact is committed (tracked by git)', () => {
    // `git diff --exit-code` silently ignores an untracked path, so the
    // reproducibility assertion below is only meaningful once the artifact is
    // committed. Fail loudly if someone regenerates but forgets to commit it.
    // A directory pathspec errors only if NO file under it is tracked.
    expect(() =>
      execFileSync('git', ['ls-files', '--error-unmatch', '--', generatedPath], {
        cwd: root,
        encoding: 'utf8',
      }),
    ).not.toThrow();
  });

  it('regenerating src/ui/i18n.resolved.generated/ leaves the committed directory unchanged', () => {
    // The dense generated artifact is the tsc safety net and is committed. Like
    // the media manifest, it must regenerate byte-identically: a drift here means
    // the generator is non-deterministic or the committed directory is stale. The
    // generator replaces the directory atomically, so a removed locale would also
    // surface as a deletion in the diff.
    execFileSync(process.execPath, [buildScript], { cwd: root, encoding: 'utf8' });
    expect(() =>
      execFileSync('git', ['diff', '--exit-code', '--', generatedPath], {
        cwd: root,
        encoding: 'utf8',
      }),
    ).not.toThrow();
  });

  it('regenerates byte-identically across two perturbed-env runs (determinism)', () => {
    // The committed directory keeps the freshness check above; this ADDS the stronger
    // determinism guarantee - double-generate into two throwaway temp dirs under
    // perturbed TZ / LC_ALL / temp-path and assert every emitted slice is byte-identical
    // across the runs (a hidden locale/timezone/path dependency would surface as a diff).
    // outFiles omitted => the whole emitted tree (all per-locale slices + barrel) is compared.
    expect(() => assertDeterministic({ script: buildScript })).not.toThrow();
  }, 15000);
});

describe('flat TranslationKey union reproducibility', () => {
  it('the generated key union is committed (tracked by git)', () => {
    // Same rationale as the resolved directory: `git diff --exit-code` silently
    // ignores an untracked path, so the freshness assertion below is only
    // meaningful while the union stays committed. tsc also depends on it: a
    // fresh clone must typecheck without running the build first.
    expect(() =>
      execFileSync('git', ['ls-files', '--error-unmatch', '--', keysPath], {
        cwd: root,
        encoding: 'utf8',
      }),
    ).not.toThrow();
  }, 15000);

  it('regenerating leaves the committed key union unchanged', () => {
    // TranslationKey re-exports this union, so a stale file weakens (or falsely
    // strengthens) type checking repo-wide. Like the slices, it must regenerate
    // byte-identically from the catalog: a drift means the committed file is
    // stale or the emit is non-deterministic.
    execFileSync(process.execPath, [buildScript], { cwd: root, encoding: 'utf8' });
    expect(() =>
      execFileSync('git', ['diff', '--exit-code', '--', keysPath], {
        cwd: root,
        encoding: 'utf8',
      }),
    ).not.toThrow();
  }, 15000);

  it('appears in the determinism outFiles byte-identically across perturbed runs', () => {
    // Pins BOTH halves of the override contract: the generator honors
    // I18N_OUT_DIR for the union emit (assertDeterministic throws "did not emit"
    // if the file lands anywhere else), and the emitted bytes are identical
    // across the two perturbed-env runs.
    expect(() =>
      assertDeterministic({ script: buildScript, outFiles: ['translation_keys.generated.ts'] }),
    ).not.toThrow();
  }, 15000);
});
