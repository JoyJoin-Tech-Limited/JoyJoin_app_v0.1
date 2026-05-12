import type { EmbeddingClient } from '../../../src/embeddingClient';
import type { TestResult } from '../lib/report';
import { verdict } from '../lib/report';

interface TranslationPair {
  zh: string;
  en: string;
  expectedMin: number;
  label: string;
}

const PAIRS: TranslationPair[] = [
  { zh: '喜欢旅行和美食', en: 'Love travel and food', expectedMin: 0.65, label: 'daily life' },
  { zh: '互联网行业产品经理', en: 'Product manager in tech industry', expectedMin: 0.60, label: 'career' },
  { zh: 'Social tag: 温柔倾听者', en: 'Social tag: gentle listener', expectedMin: 0.70, label: 'social tag' },
  { zh: '寻找能一起逛展、喝咖啡、聊人生的朋友', en: 'Looking for friends to explore exhibitions, drink coffee, and talk about life', expectedMin: 0.65, label: 'intent' },
  { zh: '周末喜欢剧本杀和飞盘', en: 'I enjoy murder mystery games and frisbee on weekends', expectedMin: 0.55, label: 'hobbies' },
  { zh: '喜欢把轻松聊天聊出层次感', en: 'I like to add depth to casual conversations', expectedMin: 0.60, label: 'bio nuance' },
  { zh: '有点社恐但渴望社交', en: 'A bit socially anxious but crave connection', expectedMin: 0.65, label: 'emotion' },
];

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

export async function testCrossLanguage(client: EmbeddingClient): Promise<TestResult[]> {
  const results: TestResult[] = [];
  let totalScore = 0;

  for (const pair of PAIRS) {
    const [rZh, rEn] = await Promise.all([
      client.embed(pair.zh),
      client.embed(pair.en),
    ]);

    if (!rZh || !rEn) {
      results.push({
        name: `Cross-language: ${pair.label}`,
        verdict: 'FAIL',
        detail: 'embedding returned null',
      });
      continue;
    }

    const sim = cosineSimilarity(rZh.vector, rEn.vector);
    totalScore += sim;
    const v = sim >= pair.expectedMin ? 'PASS' as const : sim >= pair.expectedMin * 0.7 ? 'WARN' as const : 'FAIL' as const;

    results.push({
      name: `Cross-language: ${pair.label}`,
      verdict: v,
      detail: `zh↔en cosine=${sim.toFixed(3)} (threshold=${pair.expectedMin})`,
      metric: Math.round(sim * 1000),
      threshold: Math.round(pair.expectedMin * 1000),
    });
  }

  const avg = totalScore / PAIRS.length;
  results.unshift({
    name: `Cross-language average (${PAIRS.length} pairs)`,
    verdict: verdict(avg, 0.65),
    detail: `avg cosine=${avg.toFixed(3)} across ${PAIRS.length} zh↔en pairs`,
    metric: Math.round(avg * 1000),
    threshold: 650,
  });

  return results;
}
