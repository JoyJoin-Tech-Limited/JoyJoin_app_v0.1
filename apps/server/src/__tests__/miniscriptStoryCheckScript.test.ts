/**
 * Offline critic-revise pipeline exit-code tests (AC-07):
 *  (a) dry-run against the current catalog exits 0 — the Wave 1.1 catalog
 *      regen made both curated stories V2-complete (motiveOptions + per-act
 *      evidence + evidenceReactions), so a healthy catalog MUST pass
 *  (b) a compliant synthetic fixture exits 0
 *  (c) a non-compliant synthetic fixture (no motiveOptions/evidence) exits
 *      non-zero with E202/E203 (proves detection still works)
 *  All runs produce a machine-readable JSON report.
 */
import { describe, it, expect, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';

vi.setConfig({ testTimeout: 120_000 });

const repoRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../../..');

function runPipeline(extraArgs: string[]) {
  const dir = mkdtempSync(join(tmpdir(), 'miniscript-check-'));
  const reportPath = join(dir, 'report.json');
  const proc = spawnSync(
    process.execPath,
    ['--import', 'tsx/esm', 'scripts/check/check-miniscript-story.mts', '--ci', '--report', reportPath, ...extraArgs],
    { cwd: repoRoot, encoding: 'utf8', timeout: 90_000 },
  );
  const report = JSON.parse(readFileSync(reportPath, 'utf8')) as {
    mode: { llm: boolean; dryRun: boolean };
    totals: { stories: number; passed: number; failed: number; fatals: number };
    stories: Array<{ title: string; pass: boolean; violations: Array<{ code: string; level: string }> }>;
  };
  rmSync(dir, { recursive: true, force: true });
  return { proc, report };
}

describe('check-miniscript-story offline pipeline', () => {
  it('(a) catalog dry-run exits 0 — Wave 1.1 catalog is V2-complete', () => {
    const { proc, report } = runPipeline([]);
    expect(proc.status).toBe(0);
    expect(report.mode.dryRun).toBe(true);
    expect(report.totals.stories).toBeGreaterThanOrEqual(2);
    expect(report.totals.failed).toBe(0);
    expect(report.totals.fatals).toBe(0);
    // Both curated stories pass: motiveOptions + per-act evidence +
    // evidenceReactions are all present, so no E202/E203/E204 may appear.
    const codes = new Set(report.stories.flatMap((s) => s.violations.map((v) => v.code)));
    expect(codes.has('E202')).toBe(false);
    expect(codes.has('E203')).toBe(false);
    expect(codes.has('E204')).toBe(false);
    expect(report.stories.every((s) => s.pass)).toBe(true);
    expect(proc.stdout).toContain('check-miniscript-story: PASS');
  }, 90_000);

  it('(b) compliant synthetic fixture exits 0', () => {
    const { proc, report } = runPipeline([
      '--fixture',
      'scripts/check/fixtures/miniscript-story-compliant.fixture.json',
    ]);
    expect(proc.status).toBe(0);
    expect(report.totals.failed).toBe(0);
    expect(report.totals.fatals).toBe(0);
    expect(report.stories[0]?.pass).toBe(true);
    expect(proc.stdout).toContain('check-miniscript-story: PASS');
  }, 90_000);

  it('(c) non-compliant fixture exits non-zero with E202/E203 (detection still works)', () => {
    const { proc, report } = runPipeline([
      '--fixture',
      'scripts/check/fixtures/miniscript-story-noncompliant.fixture.json',
    ]);
    expect(proc.status).toBe(1);
    expect(report.totals.failed).toBe(report.totals.stories);
    const codes = new Set(report.stories.flatMap((s) => s.violations.map((v) => v.code)));
    expect(codes.has('E202')).toBe(true);
    expect(codes.has('E203')).toBe(true);
    expect(proc.stdout).toContain('check-miniscript-story: FAIL');
  }, 90_000);
});
