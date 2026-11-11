/**
 * D3 AC-7 source lock: the clock and the config never enter the formation core.
 *
 * `runGreedyPoolMatchingCore` must receive the already-resolved per-person floor
 * as a plain number. If it could see `hoursUntilEvent` or a `MatchingThresholdsConfig`
 * it would become a second place that decides the floor, and the scan's
 * "resolve once per scan" contract (and its single log line) would drift.
 *
 * The same file also locks the R1/`strongTieDeficitExempt` consumers so nobody
 * re-hardcodes 60 next to a resolved floor — R1 is a consumer, not an owner.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const TEST_FILE_DIR = path.dirname(fileURLToPath(import.meta.url));
const SERVER_SRC = path.resolve(TEST_FILE_DIR, '..');
const POOL_FORMATION = path.join(SERVER_SRC, 'matching/poolFormation.ts');

const source = readFileSync(POOL_FORMATION, 'utf8');

function coreSignature(): string {
  const start = source.indexOf('export async function runGreedyPoolMatchingCore(');
  expect(start).toBeGreaterThanOrEqual(0);
  const end = source.indexOf('): Promise<MatchGroup[]> {', start);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe('matching core — D3 source lock', () => {
  it('takes the resolved pair floor as a parameter', () => {
    const signature = coreSignature();
    expect(signature).toMatch(/pairFloor\??:\s*number\s*\|\s*null/);
    // The floor is threaded in; the core never resolves it.
    expect(source).not.toMatch(/resolvePairFloor/);
    expect(source).not.toMatch(/pairFloorRollout/);
    expect(source).not.toMatch(/from ['"]\.\.\/lib\/matchingThresholds['"]/);
  });

  it('accepts no clock and no threshold config in its parameter list', () => {
    const signature = coreSignature();
    expect(signature).not.toMatch(/hoursUntilEvent/);
    expect(signature).not.toMatch(/MatchingThresholdsConfig/);
    expect(signature).not.toMatch(/\bDate\b/);
    expect(signature).not.toMatch(/currentThreshold/);
  });

  it('binds admission, R1, and the strong-tie exemption to the one resolved number', () => {
    const signature = coreSignature();
    expect(signature).toMatch(/pairFloor\??:\s*number\s*\|\s*null\s*=\s*null/);

    // Both rulers are aliases of the resolved floor, never a second constant.
    expect(source).toContain('const effectiveMinPairScore = pairFloor ?? minPairScore;');
    expect(source).toContain(
      'const strongTieThreshold = pairFloor ?? MAGNETISM_STRONG_TIE_THRESHOLD;',
    );
    // 60 appears only as the documented fallback: the import + that one line.
    expect((source.match(/MAGNETISM_STRONG_TIE_THRESHOLD/g) ?? []).length).toBe(2);

    // Admission gate.
    expect(source).toContain('bestAvgScore >= effectiveMinPairScore');
    // Pool-level no-deadlock exemption.
    expect(source).toContain('>= strongTieThreshold');

    // EVERY R1 evaluation passes the resolved threshold — commit gate, the
    // table-viability backstop, and both redistribution phases. A call without
    // the third argument silently falls back to 60.
    const r1Calls = source.match(/groupSatisfiesStrongTieRule\([^)]*\)/g) ?? [];
    expect(r1Calls.length).toBeGreaterThanOrEqual(4);
    for (const call of r1Calls) {
      expect(call).toContain('strongTieThreshold');
    }
  });
});
