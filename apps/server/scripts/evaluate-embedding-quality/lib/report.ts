export type TestVerdict = 'PASS' | 'WARN' | 'FAIL';

export interface TestResult {
  name: string;
  verdict: TestVerdict;
  detail: string;
  metric?: number;
  threshold?: number;
}

export interface PhaseReport {
  phase: string;
  results: TestResult[];
  summary: { pass: number; warn: number; fail: number };
}

function categorizeVerdict(metric: number, threshold: number, higherIsBetter: boolean): TestVerdict {
  if (higherIsBetter) {
    if (metric >= threshold) return 'PASS';
    if (metric >= threshold * 0.7) return 'WARN';
    return 'FAIL';
  }
  if (metric <= threshold) return 'PASS';
  if (metric <= threshold * 1.5) return 'WARN';
  return 'FAIL';
}

export function verdict(metric: number, threshold: number, higherIsBetter = true): TestVerdict {
  return categorizeVerdict(metric, threshold, higherIsBetter);
}

export function printReport(report: PhaseReport): void {
  const icon: Record<TestVerdict, string> = { PASS: '✅', WARN: '⚠️ ', FAIL: '❌' };
  console.log(`\n--- ${report.phase} ---`);
  for (const r of report.results) {
    const meta = r.metric !== undefined ? `  (metric=${r.metric}, threshold=${r.threshold})` : '';
    console.log(`  ${icon[r.verdict]} ${r.name}${meta}`);
    if (r.verdict !== 'PASS' && r.detail) {
      console.log(`       ${r.detail}`);
    }
  }
  const { pass, warn, fail } = report.summary;
  const total = pass + warn + fail;
  console.log(`  → ${pass}/${total} pass, ${warn} warn, ${fail} fail`);
}

export function summarize(results: TestResult[]): PhaseReport['summary'] {
  return {
    pass: results.filter((r) => r.verdict === 'PASS').length,
    warn: results.filter((r) => r.verdict === 'WARN').length,
    fail: results.filter((r) => r.verdict === 'FAIL').length,
  };
}
