import type { EmbeddingClient } from '../../../src/embeddingClient';
import type { TestResult } from '../lib/report';

const TERMS = [
  // Archetypes
  '开心柯基', '太阳鸡', '慵懒猫', '孤狼', '狐狸', '树懒',
  '小熊猫', '萨摩耶', '布偶猫', '金毛', '边牧', '龙猫',

  // Interests / activities
  '剧本杀', '飞盘', 'Livehouse', 'citywalk', '精酿啤酒',
  '攀岩', '胶片摄影', 'vintage', '露营', '烘焙',

  // Social tag patterns
  'Social tag: 温柔倾听者',
  'Social tag: 社交恐怖分子',
  'Social tag: 记录生活',
  'Social tag: 文艺青年',

  // Intent patterns
  'make_friends', 'networking', 'dating',
  '寻找有趣的灵魂', '拓宽社交圈',

  // Deep interest patterns
  'Deep interests: 机器学习',
  'Deep interests: 独立音乐',
  'Favorite reason: 喜欢发现隐藏在巷子里的小店',

  // Event types
  '饭局', '酒局', '桌游局',
];

const NEAR_ZERO_THRESHOLD = 1e-6;

interface TermResult {
  term: string;
  norm: number;
  firstFew: number[];
}

export async function testVocabularyCoverage(client: EmbeddingClient): Promise<TestResult[]> {
  const termResults: TermResult[] = [];

  for (const term of TERMS) {
    const result = await client.embed(term);
    if (!result) {
      termResults.push({ term, norm: 0, firstFew: [] });
      continue;
    }
    const norm = Math.sqrt(result.vector.reduce((s, v) => s + v * v, 0));
    termResults.push({ term, norm, firstFew: result.vector.slice(0, 3) });
  }

  const nearZero = termResults.filter((r) => r.norm < NEAR_ZERO_THRESHOLD);
  const covered = termResults.filter((r) => r.norm >= NEAR_ZERO_THRESHOLD);
  const coverage = covered.length / TERMS.length;

  const arity = 12;
  const activity = 10;
  const socialTag = 4;
  const intent = 5;
  const deep = 3;
  const event = 3;
  const pattern = deep + event;

  const domainBreakdown = [
    { domain: 'Archetypes', count: arity, covered: termResults.slice(0, arity).filter((r) => r.norm >= NEAR_ZERO_THRESHOLD).length },
    { domain: 'Activities', count: activity, covered: termResults.slice(arity, arity + activity).filter((r) => r.norm >= NEAR_ZERO_THRESHOLD).length },
    { domain: 'Social tags', count: socialTag, covered: termResults.slice(arity + activity, arity + activity + socialTag).filter((r) => r.norm >= NEAR_ZERO_THRESHOLD).length },
    { domain: 'Intent', count: intent, covered: termResults.slice(arity + activity + socialTag, arity + activity + socialTag + intent).filter((r) => r.norm >= NEAR_ZERO_THRESHOLD).length },
    { domain: 'Patterns', count: pattern, covered: termResults.slice(arity + activity + socialTag + intent).filter((r) => r.norm >= NEAR_ZERO_THRESHOLD).length },
  ];

  const results: TestResult[] = [
    {
      name: 'Vocabulary coverage',
      verdict: coverage >= 0.90 ? 'PASS' : coverage >= 0.75 ? 'WARN' : 'FAIL',
      detail: `${covered.length}/${TERMS.length} terms have non-zero embeddings`,
      metric: Math.round(coverage * 1000) / 10,
      threshold: 90,
    },
    ...domainBreakdown.map((d) => ({
      name: `  ${d.domain}`,
      verdict: d.covered >= d.count * 0.8 ? 'PASS' as const : d.covered >= d.count * 0.5 ? 'WARN' as const : 'FAIL' as const,
      detail: `${d.covered}/${d.count} covered`,
      metric: d.covered,
      threshold: Math.round(d.count * 0.8),
    })),
  ];

  if (nearZero.length > 0) {
    results.push({
      name: 'Near-zero terms',
      verdict: 'WARN',
      detail: nearZero.map((r) => r.term).join(', '),
    });
  }

  return results;
}
