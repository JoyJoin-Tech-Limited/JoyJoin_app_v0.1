/**
 * Offline critic-revise pipeline exit-code tests (AC-07):
 *  (a) dry-run against the current catalog MUST detect missing
 *      evidence/motiveOptions and exit non-zero (proves detection works)
 *  (b) a compliant synthetic fixture exits 0
 *  Both runs produce a machine-readable JSON report.
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
  it('(a) catalog dry-run exits non-zero and reports missing evidence/motiveOptions', () => {
    const { proc, report } = runPipeline([]);
    expect(proc.status).toBe(1);
    expect(report.mode.dryRun).toBe(true);
    expect(report.totals.stories).toBeGreaterThanOrEqual(2);
    expect(report.totals.failed).toBe(report.totals.stories);
    const codes = new Set(report.stories.flatMap((s) => s.violations.map((v) => v.code)));
    expect(codes.has('E202')).toBe(true);
    expect(codes.has('E203')).toBe(true);
    expect(proc.stdout).toContain('check-miniscript-story: FAIL');
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
});
