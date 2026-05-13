import type { EmbeddingClient } from '../../../src/embeddingClient';
import type { TestResult } from '../lib/report';

const PROFILES = [
  '喜欢把轻松聊天聊出层次感，最近迷上了咖啡馆探店和城市散步。Social tag: 温柔倾听者',
  '北京互联网行业产品经理，周末喜欢剧本杀和飞盘。养了一只布偶猫，寻找同样喜欢桌游的朋友。',
  '上海外企设计师，爱好摄影和citywalk。Social tag: 记录生活。',
  '深圳创业中，做AI方向。Deep interests: 机器学习, 量化交易, 攀岩, 精酿啤酒',
  'Top interests: 烘焙, 瑜伽, 读书会, 露营. 周末不是在烤箱前就是在山里。',
  'A tech enthusiast living in Shanghai, passionate about cross-cultural communication and board games.',
  '喜欢音乐和电影，周末经常去看livehouse。Social tag: 文艺青年。',
  '杭州电商运营，业余时间在做自己的饰品品牌。寻找能一起逛展、喝咖啡、聊人生的朋友。',
  '体制内工作，性格温和，喜欢周末逛公园和看书。有点社恐但渴望社交。',
  '健身教练，热爱运动和健康生活。Social tag: 自律给我自由。',
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

export async function testDiscriminativePower(client: EmbeddingClient): Promise<TestResult[]> {
  const vectors: number[][] = [];

  for (const p of PROFILES) {
    const r = await client.embed(p);
    if (!r) {
      return [{ name: 'Discriminative power', verdict: 'FAIL', detail: 'one or more embeddings returned null' }];
    }
    vectors.push(r.vector);
  }

  const similarities: number[] = [];
  for (let i = 0; i < vectors.length; i++) {
    for (let j = i + 1; j < vectors.length; j++) {
      similarities.push(cosineSimilarity(vectors[i], vectors[j]));
    }
  }

  const n = similarities.length;
  const mean = similarities.reduce((s, v) => s + v, 0) / n;
  const variance = similarities.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);
  const min = Math.min(...similarities);
  const max = Math.max(...similarities);

  const goodSpread = max - min > 0.3;
  const goodStd = std > 0.1;

  const verdictClass = goodSpread && goodStd ? 'PASS' as const : goodSpread || goodStd ? 'WARN' as const : 'FAIL' as const;

  const histogramBuckets = [0, 0.2, 0.4, 0.6, 0.8, 1.0];
  const histCounts = new Array(histogramBuckets.length - 1).fill(0);
  for (const s of similarities) {
    for (let b = 0; b < histogramBuckets.length - 1; b++) {
      if (s >= histogramBuckets[b] && s < histogramBuckets[b + 1]) {
        histCounts[b]++;
        break;
      }
    }
  }
  const histStr = histogramBuckets
    .slice(0, -1)
    .map((lo, i) => `[${lo.toFixed(1)},${histogramBuckets[i + 1].toFixed(1)}):${histCounts[i]}`)
    .join('  ');

  return [
    {
      name: 'Discriminative power',
      verdict: verdictClass,
      detail: `pairwise cosine: mean=${mean.toFixed(3)}, std=${std.toFixed(3)}, range=[${min.toFixed(3)},${max.toFixed(3)}]`,
      metric: Math.round(std * 1000),
      threshold: 100,
    },
    {
      name: '  Cosine distribution',
      verdict: 'PASS',
      detail: histStr,
    },
    {
      name: `  Samples: ${PROFILES.length} JoyJoin profiles → ${n} pairs`,
      verdict: 'PASS',
      detail: 'all combinations computed',
    },
  ];
}
