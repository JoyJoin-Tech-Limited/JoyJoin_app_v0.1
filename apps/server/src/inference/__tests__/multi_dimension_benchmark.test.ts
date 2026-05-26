import { describe, it, expect } from 'vitest';
import { classifyIndustryUnified, classifyIndustry } from '../industryClassifier';

function pickBest(a: Awaited<ReturnType<typeof classifyIndustryUnified>> | null, b: Awaited<ReturnType<typeof classifyIndustry>> | null) {
  const confA = a?.confidence ?? 0;
  const confB = b?.confidence ?? 0;
  if (!a && !b) return null;
  if (!a) return b;
  if (!b) return a;
  if (a.category.id !== b.category.id) return confA >= confB ? a : b;
  return confA >= confB + 0.1 ? a : b;
}

interface BenchmarkCase {
  input: string;
  intendedCategory: string;
  acceptAlternate?: string[];
  type: 'formal' | 'casual' | 'english' | 'sentence' | 'typo';
}

const TAXONOMY_CATEGORIES = new Set([
  'finance', 'tech', 'manufacturing', 'consumer_retail', 'real_estate',
  'healthcare', 'education', 'professional_services', 'media_creative',
  'logistics', 'government_public', 'life_services', 'energy_environment',
  'agriculture_food', 'culture_sports'
]);

const BENCHMARK: BenchmarkCase[] = [
  // ── Formal titles (30) ──
  { input: '前端工程师', intendedCategory: 'tech', type: 'formal' },
  { input: '后端开发', intendedCategory: 'tech', type: 'formal' },
  { input: '产品经理', intendedCategory: 'tech', type: 'formal' },
  { input: '数据分析师', intendedCategory: 'tech', type: 'formal' },
  { input: 'UI设计师', intendedCategory: 'tech', type: 'formal' },
  { input: '医生', intendedCategory: 'healthcare', type: 'formal' },
  { input: '护士', intendedCategory: 'healthcare', type: 'formal' },
  { input: '教师', intendedCategory: 'education', type: 'formal' },
  { input: '律师', intendedCategory: 'professional_services', type: 'formal' },
  { input: '会计', intendedCategory: 'professional_services', type: 'formal' },
  { input: '建筑师', intendedCategory: 'construction', type: 'formal' },
  { input: '记者', intendedCategory: 'media_creative', type: 'formal' },
  { input: '摄影师', intendedCategory: 'media_creative', type: 'formal' },
  { input: '厨师', intendedCategory: 'consumer_retail', type: 'formal' },
  { input: '司机', intendedCategory: 'logistics', type: 'formal' },
  { input: '运动员', intendedCategory: 'culture_sports', type: 'formal' },
  { input: '军人', intendedCategory: 'government_public', type: 'formal' },
  { input: '会计', intendedCategory: 'professional_services', type: 'formal' },
  { input: '公务员', intendedCategory: 'government_public', type: 'formal' },
  { input: '空乘', intendedCategory: 'life_services', acceptAlternate: ['logistics'], type: 'formal' },

  // ── Casual descriptions (20) ──
  { input: '搞前端的', intendedCategory: 'tech', type: 'casual' },
  { input: '写代码的', intendedCategory: 'tech', type: 'casual' },
  { input: '自己做设计', intendedCategory: 'tech', type: 'casual' },
  { input: '拍视频的', intendedCategory: 'media_creative', type: 'casual' },
  { input: '开网约车', intendedCategory: 'logistics', type: 'casual' },
  { input: '在律所上班', intendedCategory: 'professional_services', type: 'casual' },
  { input: '做金融的', intendedCategory: 'finance', type: 'casual' },
  { input: '在银行工作', intendedCategory: 'finance', type: 'casual' },
  { input: '自己开店', intendedCategory: 'consumer_retail', type: 'casual' },
  { input: '搞装修的', intendedCategory: 'construction', type: 'casual' },
  { input: '在工地上班', intendedCategory: 'construction', type: 'casual' },
  { input: '做公益的', intendedCategory: 'nonprofit', type: 'casual' },
  { input: '在家做手工卖', intendedCategory: 'consumer_retail', type: 'casual' },

  // ── Sentence format (15) ──
  { input: '我在腾讯做产品经理', intendedCategory: 'tech', type: 'sentence' },
  { input: '我现在是自由设计师', intendedCategory: 'tech', type: 'sentence' },
  { input: '刚毕业在找工作', intendedCategory: 'professional_services', type: 'sentence' },
  { input: '我做跨境电商的', intendedCategory: 'consumer_retail', type: 'sentence' },
  { input: '我在医院当护士', intendedCategory: 'healthcare', type: 'sentence' },
  { input: '我是一名软件工程师', intendedCategory: 'tech', type: 'sentence' },
  { input: '在美团送外卖', intendedCategory: 'logistics', type: 'sentence' },
  { input: '自己开了家咖啡店', intendedCategory: 'consumer_retail', type: 'sentence' },
  { input: '我在大厂做运营', intendedCategory: 'tech', type: 'sentence' },
  { input: '我教钢琴的', intendedCategory: 'culture_sports', acceptAlternate: ['education'], type: 'sentence' },
  { input: '帮客户做财务规划', intendedCategory: 'finance', type: 'sentence' },
  { input: '我搞人工智能的', intendedCategory: 'tech', type: 'sentence' },
  { input: '在政府部门上班', intendedCategory: 'government_public', type: 'sentence' },
  { input: '我给学生补课', intendedCategory: 'education', type: 'sentence' },
  { input: '我在剧场演出', intendedCategory: 'culture_sports', type: 'sentence' },

  // ── English & Mixed (15) ──
  { input: 'software engineer', intendedCategory: 'tech', type: 'english' },
  { input: 'product manager', intendedCategory: 'tech', type: 'english' },
  { input: 'data analyst', intendedCategory: 'tech', type: 'english' },
  { input: 'designer', intendedCategory: 'tech', acceptAlternate: ['media_creative'], type: 'english' },
  { input: 'teacher', intendedCategory: 'education', type: 'english' },
  { input: 'nurse', intendedCategory: 'healthcare', type: 'english' },
  { input: 'lawyer', intendedCategory: 'professional_services', type: 'english' },
  { input: 'UX designer', intendedCategory: 'tech', type: 'english' },
  { input: 'HR manager', intendedCategory: 'professional_services', type: 'english' },
  { input: 'Freelance photographer', intendedCategory: 'media_creative', type: 'english' },
  { input: 'Data scientist', intendedCategory: 'tech', type: 'english' },
  { input: 'Full stack dev', intendedCategory: 'tech', type: 'english' },
  { input: 'Construction worker', intendedCategory: 'construction', type: 'english' },
  { input: 'Chef', intendedCategory: 'consumer_retail', type: 'english' },
  { input: 'E-commerce manager', intendedCategory: 'consumer_retail', type: 'english' },

  // ── Typos & variations (20) ──
  { input: '前端工成师', intendedCategory: 'tech', type: 'typo' },
  { input: '后段开发', intendedCategory: 'tech', type: 'typo' },
  { input: '产品经理', intendedCategory: 'tech', type: 'typo' },
  { input: '医生', intendedCategory: 'healthcare', type: 'typo' },
  { input: '程式设计师', intendedCategory: 'tech', type: 'typo' },
  { input: '护师', intendedCategory: 'healthcare', type: 'typo' },
  { input: '老师', intendedCategory: 'education', type: 'typo' },
  { input: '快寄员', intendedCategory: 'logistics', type: 'typo' },
  { input: '会记', intendedCategory: 'professional_services', type: 'typo' },
  { input: '投资顾问', intendedCategory: 'finance', type: 'typo' },
  { input: '电⼦商務運营', intendedCategory: 'consumer_retail', type: 'typo' },
  { input: '室內設計師', intendedCategory: 'real_estate', acceptAlternate: ['professional_services', 'construction'], type: 'typo' },
  { input: 'IT支持', intendedCategory: 'tech', type: 'typo' },
  { input: '音乐人', intendedCategory: 'culture_sports', type: 'typo' },
  { input: '健身教练', intendedCategory: 'culture_sports', type: 'typo' },
  { input: '心理咨询师', intendedCategory: 'healthcare', type: 'typo' },
  { input: '活动策划', intendedCategory: 'professional_services', acceptAlternate: ['media_creative', 'gaming'], type: 'typo' },
  { input: '品牌公关', intendedCategory: 'media_creative', acceptAlternate: ['professional_services'], type: 'typo' },
];

const describeBenchmark = process.env.RUN_MULTI_BENCHMARK ? describe : describe.skip;

describeBenchmark('Multi-Dimension Occupation Benchmark', () => {
  it('should rate classification across 5 dimensions', async () => {
    console.log(`\n🧪 Multi-Dimension Benchmark — 100 Realistic User Inputs\n`);
    console.log('─'.repeat(80));

    const classifications = await Promise.all(BENCHMARK.map(async (test) => {
      const startTime = process.hrtime.bigint();
      try {
        const [catalog, ai] = await Promise.allSettled([
          classifyIndustryUnified({ description: test.input, context: { source: 'manual_input' } }),
          classifyIndustry(test.input),
        ]);
        const catRes = catalog.status === 'fulfilled' ? catalog.value : null;
        const aiRes = ai.status === 'fulfilled' ? ai.value : null;
        const result = pickBest(catRes, aiRes);
        const elapsed = Number(process.hrtime.bigint() - startTime) / 1e6;
        if (!result) return { test, elapsed, result: null, error: 'both failed' };
        return { test, elapsed, result, error: null };
      } catch (error: any) {
        return { test, elapsed: 0, result: null, error: error?.message ?? String(error) };
      }
    }));

    // Compute dimension metrics
    let totalFormal = 0, correctFormal = 0;
    let totalCasual = 0, correctCasual = 0;
    let totalSentence = 0, correctSentence = 0;
    let totalEnglish = 0, correctEnglish = 0;
    let totalTypo = 0, correctTypo = 0;
    let totalRecognized = 0;
    let totalTime = 0;
    const sourceCounts: Record<string, number> = {};
    const confidenceBuckets = { high: 0, medium: 0, low: 0 };
    let totalCategoryCorrect = 0;
    let totalSegmentGiven = 0;
    let totalNicheGiven = 0;
    let totalFallbackToLifeServices = 0;

    for (const { test, result, elapsed } of classifications) {
      totalTime += elapsed ?? 0;

      if (!result || (result.category.id === 'life_services' && test.intendedCategory !== 'life_services')) {
        if (result?.category.id === 'life_services' && test.intendedCategory !== 'life_services' && result.source !== 'ai') totalFallbackToLifeServices++;
        if (test.type === 'formal') { totalFormal++; }
        else if (test.type === 'casual') { totalCasual++; }
        else if (test.type === 'sentence') { totalSentence++; }
        else if (test.type === 'english') { totalEnglish++; }
        else if (test.type === 'typo') { totalTypo++; }
        continue;
      }

      totalRecognized++;

      const source = result.source;
      sourceCounts[source] = (sourceCounts[source] || 0) + 1;

      if (result.confidence >= 0.85) confidenceBuckets.high++;
      else if (result.confidence >= 0.60) confidenceBuckets.medium++;
      else confidenceBuckets.low++;

      const catMatch = result.category.id === test.intendedCategory ||
        (test.acceptAlternate?.includes(result.category.id) ?? false);
      if (catMatch) totalCategoryCorrect++;
      else console.log(`  ❌ ${test.type.padEnd(10)} "${test.input}" → ${result.category.id} (expected ${test.intendedCategory}) [${result.source}, conf=${(result.confidence*100).toFixed(0)}%]`);

      if (result.segment?.id) totalSegmentGiven++;
      if (result.niche?.id) totalNicheGiven++;

      if (test.type === 'formal') {
        totalFormal++;
        if (catMatch) correctFormal++;
      } else if (test.type === 'casual') {
        totalCasual++;
        if (catMatch) correctCasual++;
      } else if (test.type === 'sentence') {
        totalSentence++;
        if (catMatch) correctSentence++;
      } else if (test.type === 'english') {
        totalEnglish++;
        if (catMatch) correctEnglish++;
      } else if (test.type === 'typo') {
        totalTypo++;
        if (catMatch) correctTypo++;
      }
    }

    const avgTime = totalTime / classifications.length;
    const totalAll = classifications.length;
    const totalCorrect = correctFormal + correctCasual + correctSentence + correctEnglish + correctTypo;

    // ── Print results ──
    console.log('\n📊 MULTI-DIMENSION BENCHMARK RESULTS\n');

    console.log('DIMENSION 1 — CATEGORY ACCURACY BY INPUT TYPE');
    console.log('─'.repeat(50));
    for (const [name, total, correct] of [
      ['Formal titles', totalFormal, correctFormal],
      ['Casual desc', totalCasual, correctCasual],
      ['Sentence fmt', totalSentence, correctSentence],
      ['English/mix', totalEnglish, correctEnglish],
      ['Typos/vars', totalTypo, correctTypo],
    ] as const) {
      const pct = total > 0 ? (correct / total * 100).toFixed(1) : '-';
      console.log(`  ${name.padEnd(15)} ${correct}/${total} (${pct}%)`);
    }
    const totalPct = totalAll > 0 ? (totalCorrect / totalAll * 100).toFixed(1) : '-';
    console.log(`  ${'OVERALL'.padEnd(15)} ${totalCorrect}/${totalAll} (${totalPct}%)`);

    console.log('\nDIMENSION 2 — RECOGNITION RATE');
    console.log('─'.repeat(50));
    const recogRate = totalAll > 0 ? (totalRecognized / totalAll * 100).toFixed(1) : '-';
    console.log(`  Recognized:  ${totalRecognized}/${totalAll} (${recogRate}%)`);
    const lifeRate = totalAll > 0 ? (totalFallbackToLifeServices / totalAll * 100).toFixed(1) : '-';
    console.log(`  life_services fallback: ${totalFallbackToLifeServices}/${totalAll} (${lifeRate}%)`);

    console.log('\nDIMENSION 3 — GRANULARITY DEPTH');
    console.log('─'.repeat(50));
    const segRate = totalRecognized > 0 ? (totalSegmentGiven / totalRecognized * 100).toFixed(1) : '-';
    const nicheRate = totalRecognized > 0 ? (totalNicheGiven / totalRecognized * 100).toFixed(1) : '-';
    console.log(`  Category given:  ${totalRecognized}/${totalRecognized} (100%)`);
    console.log(`  Segment given:   ${totalSegmentGiven}/${totalRecognized} (${segRate}%)`);
    console.log(`  Niche given:     ${totalNicheGiven}/${totalRecognized} (${nicheRate}%)`);

    console.log('\nDIMENSION 4 — SOURCE DISTRIBUTION');
    console.log('─'.repeat(50));
    const srcOrder = ['seed', 'fuzzy', 'ontology', 'fallback', 'ai'] as const;
    for (const src of srcOrder) {
      const count = sourceCounts[src] || 0;
      const pct = totalRecognized > 0 ? (count / totalRecognized * 100).toFixed(1) : '0.0';
      console.log(`  ${src.padEnd(12)} ${String(count).padStart(3)}  (${pct}%)`);
    }

    console.log('\nDIMENSION 5 — CONFIDENCE DISTRIBUTION');
    console.log('─'.repeat(50));
    const totalConf = confidenceBuckets.high + confidenceBuckets.medium + confidenceBuckets.low;
    if (totalConf > 0) {
      console.log(`  High (≥85%):     ${confidenceBuckets.high}  (${(confidenceBuckets.high / totalConf * 100).toFixed(1)}%)`);
      console.log(`  Med  (60-84%):   ${confidenceBuckets.medium}  (${(confidenceBuckets.medium / totalConf * 100).toFixed(1)}%)`);
      console.log(`  Low  (<60%):     ${confidenceBuckets.low}  (${(confidenceBuckets.low / totalConf * 100).toFixed(1)}%)`);
    }

    console.log('\nDIMENSION 6 — PERFORMANCE');
    console.log('─'.repeat(50));
    console.log(`  Avg response:    ${avgTime.toFixed(0)}ms`);
    console.log(`  Total duration:  ${(totalTime / 1000).toFixed(1)}s`);

    console.log('\n' + '─'.repeat(80) + '\n');

    // Assert that category accuracy is above 70% overall
    const overallAccuracy = totalAll > 0 ? totalCorrect / totalAll : 0;
    expect(overallAccuracy).toBeGreaterThanOrEqual(0.70);
  }, 300000);
});
