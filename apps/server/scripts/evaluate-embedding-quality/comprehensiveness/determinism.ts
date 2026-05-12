import type { EmbeddingClient } from '../../../src/embeddingClient';
import type { TestResult } from '../lib/report';

const TEST_TEXT = '喜欢把轻松聊天聊出层次感，最近迷上了咖啡馆探店和城市散步。Social tag: 温柔倾听者';
const REPEAT_COUNT = 20;

export async function testDeterminism(client: EmbeddingClient): Promise<TestResult[]> {
  const results: TestResult[] = [];

  const first = await client.embed(TEST_TEXT);
  if (!first) {
    return [{ name: 'Determinism (same input → same vector)', verdict: 'FAIL', detail: 'first call returned null' }];
  }

  let allIdentical = true;
  let mismatches = 0;

  for (let i = 0; i < REPEAT_COUNT; i++) {
    const r = await client.embed(TEST_TEXT);
    if (!r) {
      mismatches++;
      continue;
    }
    for (let j = 0; j < first.vector.length; j++) {
      if (first.vector[j] !== r.vector[j]) {
        allIdentical = false;
        mismatches++;
        break;
      }
    }
  }

  if (allIdentical && mismatches === 0) {
    results.push({
      name: `Determinism (${REPEAT_COUNT} identical calls)`,
      verdict: 'PASS',
      detail: `all ${REPEAT_COUNT} calls returned bit-identical vectors`,
    });
  } else {
    const pct = ((REPEAT_COUNT - mismatches) / REPEAT_COUNT * 100).toFixed(0);
    results.push({
      name: `Determinism (${REPEAT_COUNT} calls)`,
      verdict: mismatches === 0 ? 'PASS' : mismatches < REPEAT_COUNT * 0.3 ? 'WARN' : 'FAIL',
      detail: `${REPEAT_COUNT - mismatches}/${REPEAT_COUNT} identical (${pct}%)`,
    });
  }

  // Also verify dimensions are consistent across different inputs
  const dims = new Set<number>();
  dims.add(first.dimensions);
  for (let i = 0; i < 5; i++) {
    const r = await client.embed(`test input ${i}`);
    if (r) dims.add(r.dimensions);
  }

  if (dims.size === 1) {
    results.push({
      name: 'Dimension consistency',
      verdict: 'PASS',
      detail: `all return ${[...dims][0]} dims`,
    });
  } else {
    results.push({
      name: 'Dimension consistency',
      verdict: 'FAIL',
      detail: `inconsistent dimensions: ${[...dims].join(', ')}`,
    });
  }

  return results;
}
