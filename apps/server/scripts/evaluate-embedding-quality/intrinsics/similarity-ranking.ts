import type { EmbeddingClient } from '../../../src/embeddingClient';
import { getAllTriplets } from '../lib/triplet-set';
import { getDomainSummary } from '../lib/triplet-set';
import type { TestResult } from '../lib/report';
import { verdict } from '../lib/report';

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export async function testSimilarityRanking(client: EmbeddingClient): Promise<TestResult[]> {
  const triplets = getAllTriplets();
  let passed = 0;
  let warned = 0;
  let failed = 0;
  const minDelta = 0.05;
  const details: string[] = [];

  for (const t of triplets) {
    const [vecAnchor, vecPos, vecNeg] = await Promise.all([
      client.embed(t.anchor),
      client.embed(t.positive),
      client.embed(t.negative),
    ]);

    if (!vecAnchor || !vecPos || !vecNeg) {
      failed++;
      details.push(`  [${t.domain}] embedding returned null — check server`);
      continue;
    }

    const cosPos = cosineSimilarity(vecAnchor.vector, vecPos.vector);
    const cosNeg = cosineSimilarity(vecAnchor.vector, vecNeg.vector);
    const delta = cosPos - cosNeg;

    if (cosPos > cosNeg) {
      if (delta >= minDelta) {
        passed++;
      } else {
        warned++;
        details.push(`  [${t.domain}] delta=${delta.toFixed(3)} (< ${minDelta}) — positive barely beats negative`);
      }
    } else {
      failed++;
      details.push(`  [${t.domain}] FAIL: cosPos=${cosPos.toFixed(3)} ≤ cosNeg=${cosNeg.toFixed(3)} (delta=${delta.toFixed(3)})`);
    }
  }

  const total = triplets.length;
  const ratio = passed / total;
  const v = verdict(ratio, 0.8);
  const domainSummary = getDomainSummary();

  return [
    {
      name: `Similarity ranking (${total} triplets across ${Object.keys(domainSummary).length} domains)`,
      verdict: v,
      detail: [
        `${passed} passed, ${warned} warned, ${failed} failed`,
        ...(details.length > 0 ? details.slice(0, 5) : []),
      ].join('\n'),
      metric: Math.round(ratio * 1000) / 10,
      threshold: 80,
    },
  ];
}
