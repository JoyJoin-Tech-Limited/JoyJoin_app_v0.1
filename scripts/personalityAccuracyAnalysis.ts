/**
 * 性格测试精准度分析脚本
 * 运行10000次模拟测试，分析原型分布和维度区分度
 */

import { personalityQuestionsV2, TraitScores } from '../client/src/data/personalityQuestionsV2';
import { archetypeTraitScores } from '../client/src/lib/archetypeTraitScores';

const SCORE_RANGE = {
  A: { min: 0, max: 32 },
  O: { min: 0, max: 38 },
  C: { min: 0, max: 24 },
  E: { min: 0, max: 20 },
  X: { min: 0, max: 42 },
};

const P_INTEGRATION = { X: 0.4, O: 0.3, A: 0.3 };

function accumulateTraitScores(answers: TraitScores[]): { A: number; O: number; C: number; E: number; X: number } {
  let A = 0, O = 0, C = 0, E = 0, X = 0;
  
  for (const ts of answers) {
    const pValue = ts.P || 0;
    A += (ts.A || 0) + pValue * P_INTEGRATION.A;
    O += (ts.O || 0) + pValue * P_INTEGRATION.O;
    C += (ts.C || 0);
    E += (ts.E || 0);
    X += (ts.X || 0) + pValue * P_INTEGRATION.X;
  }
  
  return { A, O, C, E, X };
}

function normalize(value: number, min: number, max: number): number {
  if (max === min) return 50;
  const normalized = ((value - min) / (max - min)) * 100;
  return Math.max(0, Math.min(100, normalized));
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

function findBestArchetype(normalizedScores: { A: number; O: number; C: number; E: number; X: number }) {
  const userVector = [
    normalizedScores.A,
    normalizedScores.O,
    normalizedScores.C,
    normalizedScores.E,
    normalizedScores.X
  ];
  
  let bestMatch = '';
  let bestSimilarity = -1;
  let secondMatch = '';
  let secondSimilarity = -1;
  
  for (const [name, traits] of Object.entries(archetypeTraitScores)) {
    const archetypeVector = [
      traits.affinity,
      traits.openness,
      traits.conscientiousness,
      traits.emotionalStability,
      traits.extraversion
    ];
    
    const similarity = cosineSimilarity(userVector, archetypeVector);
    
    if (similarity > bestSimilarity) {
      secondMatch = bestMatch;
      secondSimilarity = bestSimilarity;
      bestMatch = name;
      bestSimilarity = similarity;
    } else if (similarity > secondSimilarity) {
      secondMatch = name;
      secondSimilarity = similarity;
    }
  }
  
  return { primary: bestMatch, secondary: secondMatch, similarity: bestSimilarity };
}

function runSimulation(numUsers: number) {
  const archetypeCount: Record<string, number> = {};
  const dimensionStats = {
    A: { sum: 0, min: 100, max: 0, values: [] as number[] },
    O: { sum: 0, min: 100, max: 0, values: [] as number[] },
    C: { sum: 0, min: 100, max: 0, values: [] as number[] },
    E: { sum: 0, min: 100, max: 0, values: [] as number[] },
    X: { sum: 0, min: 100, max: 0, values: [] as number[] },
  };
  const similarityScores: number[] = [];
  const marginScores: number[] = [];
  
  for (let i = 0; i < numUsers; i++) {
    const answers = personalityQuestionsV2.map(q => {
      const idx = Math.floor(Math.random() * q.options.length);
      return q.options[idx].traitScores;
    });
    
    const accumulated = accumulateTraitScores(answers);
    
    const normalized = {
      A: normalize(accumulated.A, SCORE_RANGE.A.min, SCORE_RANGE.A.max),
      O: normalize(accumulated.O, SCORE_RANGE.O.min, SCORE_RANGE.O.max),
      C: normalize(accumulated.C, SCORE_RANGE.C.min, SCORE_RANGE.C.max),
      E: normalize(accumulated.E, SCORE_RANGE.E.min, SCORE_RANGE.E.max),
      X: normalize(accumulated.X, SCORE_RANGE.X.min, SCORE_RANGE.X.max),
    };
    
    for (const dim of ['A', 'O', 'C', 'E', 'X'] as const) {
      dimensionStats[dim].sum += normalized[dim];
      dimensionStats[dim].min = Math.min(dimensionStats[dim].min, normalized[dim]);
      dimensionStats[dim].max = Math.max(dimensionStats[dim].max, normalized[dim]);
      dimensionStats[dim].values.push(normalized[dim]);
    }
    
    const result = findBestArchetype(normalized);
    archetypeCount[result.primary] = (archetypeCount[result.primary] || 0) + 1;
    similarityScores.push(result.similarity);
    
    const userVector = [normalized.A, normalized.O, normalized.C, normalized.E, normalized.X];
    let similarities: { name: string; sim: number }[] = [];
    for (const [name, traits] of Object.entries(archetypeTraitScores)) {
      const archetypeVector = [
        traits.affinity,
        traits.openness,
        traits.conscientiousness,
        traits.emotionalStability,
        traits.extraversion
      ];
      similarities.push({ name, sim: cosineSimilarity(userVector, archetypeVector) });
    }
    similarities.sort((a, b) => b.sim - a.sim);
    if (similarities.length >= 2) {
      marginScores.push(similarities[0].sim - similarities[1].sim);
    }
  }
  
  return { archetypeCount, dimensionStats, similarityScores, marginScores };
}

function calculateStdDev(values: number[], mean: number): number {
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
}

function analyzeArchetypeSimilarity() {
  const archetypes = Object.entries(archetypeTraitScores);
  const similarityMatrix: Record<string, Record<string, number>> = {};
  
  for (const [name1, traits1] of archetypes) {
    similarityMatrix[name1] = {};
    const v1 = [traits1.affinity, traits1.openness, traits1.conscientiousness, traits1.emotionalStability, traits1.extraversion];
    
    for (const [name2, traits2] of archetypes) {
      const v2 = [traits2.affinity, traits2.openness, traits2.conscientiousness, traits2.emotionalStability, traits2.extraversion];
      similarityMatrix[name1][name2] = cosineSimilarity(v1, v2);
    }
  }
  
  return similarityMatrix;
}

function analyzeQuestionCoverage() {
  const dimensionCoverage: Record<string, number[]> = { A: [], O: [], C: [], E: [], X: [], P: [] };
  const questionAnalysis: { id: number; category: string; maxScores: TraitScores; dimensionSpread: number }[] = [];
  
  for (const q of personalityQuestionsV2) {
    const maxScores: TraitScores = {};
    let allScores: number[] = [];
    
    for (const opt of q.options) {
      for (const [dim, score] of Object.entries(opt.traitScores)) {
        const s = score as number;
        if (!maxScores[dim as keyof TraitScores] || s > (maxScores[dim as keyof TraitScores] || 0)) {
          maxScores[dim as keyof TraitScores] = s;
        }
        allScores.push(s);
      }
    }
    
    for (const [dim, score] of Object.entries(maxScores)) {
      if (score && score > 0) {
        dimensionCoverage[dim].push(q.id);
      }
    }
    
    const spread = allScores.length > 0 ? Math.max(...allScores) - Math.min(...allScores) : 0;
    questionAnalysis.push({ id: q.id, category: q.category, maxScores, dimensionSpread: spread });
  }
  
  return { dimensionCoverage, questionAnalysis };
}

console.log('='.repeat(80));
console.log('性格测试精准度分析报告');
console.log('='.repeat(80));

console.log('\n## 1. 12原型相似度矩阵分析\n');
const similarityMatrix = analyzeArchetypeSimilarity();
const archetypeNames = Object.keys(archetypeTraitScores);

console.log('高相似度原型对（>0.98，可能难以区分）:');
const highSimilarityPairs: { pair: string; similarity: number }[] = [];
for (let i = 0; i < archetypeNames.length; i++) {
  for (let j = i + 1; j < archetypeNames.length; j++) {
    const sim = similarityMatrix[archetypeNames[i]][archetypeNames[j]];
    if (sim > 0.98) {
      highSimilarityPairs.push({ pair: `${archetypeNames[i]} <-> ${archetypeNames[j]}`, similarity: sim });
    }
  }
}
if (highSimilarityPairs.length === 0) {
  console.log('  ✓ 无高度相似原型对');
} else {
  highSimilarityPairs.sort((a, b) => b.similarity - a.similarity);
  highSimilarityPairs.forEach(p => console.log(`  ⚠️ ${p.pair}: ${(p.similarity * 100).toFixed(2)}%`));
}

console.log('\n低相似度原型对（<0.90，区分度好）:');
const lowSimilarityPairs: { pair: string; similarity: number }[] = [];
for (let i = 0; i < archetypeNames.length; i++) {
  for (let j = i + 1; j < archetypeNames.length; j++) {
    const sim = similarityMatrix[archetypeNames[i]][archetypeNames[j]];
    if (sim < 0.90) {
      lowSimilarityPairs.push({ pair: `${archetypeNames[i]} <-> ${archetypeNames[j]}`, similarity: sim });
    }
  }
}
console.log(`  共${lowSimilarityPairs.length}对，区分度良好`);

console.log('\n## 2. 题目维度覆盖分析\n');
const { dimensionCoverage, questionAnalysis } = analyzeQuestionCoverage();
console.log('各维度被覆盖的题目数:');
for (const [dim, questions] of Object.entries(dimensionCoverage)) {
  const coverage = (questions.length / 12 * 100).toFixed(1);
  const status = questions.length >= 4 ? '✓' : '⚠️';
  console.log(`  ${status} ${dim}: ${questions.length}题 (${coverage}%) - 题号: [${questions.join(', ')}]`);
}

console.log('\n题目分数分布分析:');
questionAnalysis.forEach(q => {
  const dims = Object.entries(q.maxScores).filter(([_, v]) => v && v > 0).map(([k, v]) => `${k}:${v}`).join(', ');
  console.log(`  Q${q.id} [${q.category}]: ${dims}`);
});

console.log('\n## 3. 10000用户模拟测试\n');
console.log('运行中...');
const { archetypeCount, dimensionStats, similarityScores, marginScores } = runSimulation(10000);

console.log('\n原型匹配分布:');
const sortedArchetypes = Object.entries(archetypeCount).sort((a, b) => b[1] - a[1]);
const idealPercentage = 100 / 12;
console.log(`  理想均匀分布: 每原型约${idealPercentage.toFixed(1)}%`);
console.log('');
for (const [name, count] of sortedArchetypes) {
  const percentage = (count / 10000 * 100).toFixed(2);
  const deviation = Math.abs(parseFloat(percentage) - idealPercentage);
  const bar = '█'.repeat(Math.round(parseFloat(percentage) / 2));
  const status = deviation > 5 ? '⚠️' : '✓';
  console.log(`  ${status} ${name.padEnd(10)}: ${percentage.padStart(6)}% ${bar}`);
}

const unmatchedArchetypes = archetypeNames.filter(name => !archetypeCount[name]);
if (unmatchedArchetypes.length > 0) {
  console.log('\n  ❌ 未被匹配的原型:');
  unmatchedArchetypes.forEach(name => console.log(`    - ${name}`));
}

console.log('\n## 4. 维度分布统计\n');
for (const [dim, stats] of Object.entries(dimensionStats)) {
  const mean = stats.sum / 10000;
  const stdDev = calculateStdDev(stats.values, mean);
  const range = stats.max - stats.min;
  const status = range > 60 ? '✓' : '⚠️';
  console.log(`  ${status} ${dim}: 均值=${mean.toFixed(1)}, 标准差=${stdDev.toFixed(1)}, 范围=[${stats.min.toFixed(1)}, ${stats.max.toFixed(1)}], 跨度=${range.toFixed(1)}`);
}

console.log('\n## 5. 匹配质量分析\n');
const avgSimilarity = similarityScores.reduce((a, b) => a + b, 0) / similarityScores.length;
const avgMargin = marginScores.reduce((a, b) => a + b, 0) / marginScores.length;
const lowMarginCount = marginScores.filter(m => m < 0.01).length;

console.log(`  平均匹配相似度: ${(avgSimilarity * 100).toFixed(2)}%`);
console.log(`  平均区分边际: ${(avgMargin * 100).toFixed(3)}%`);
console.log(`  低区分度匹配(<1%边际): ${lowMarginCount}次 (${(lowMarginCount / 10000 * 100).toFixed(1)}%)`);

if (lowMarginCount > 1000) {
  console.log('  ⚠️ 警告: 超过10%的用户匹配结果区分度低，可能导致不稳定匹配');
}

console.log('\n## 6. 精准度问题总结\n');
const issues: string[] = [];

if (highSimilarityPairs.length > 0) {
  issues.push(`原型区分度问题: ${highSimilarityPairs.length}对原型相似度>98%`);
}

const underCoveredDims = Object.entries(dimensionCoverage).filter(([_, qs]) => qs.length < 4);
if (underCoveredDims.length > 0) {
  issues.push(`维度覆盖不足: ${underCoveredDims.map(([d]) => d).join(', ')}维度题目少于4题`);
}

const imbalancedArchetypes = sortedArchetypes.filter(([_, count]) => {
  const percentage = count / 10000 * 100;
  return Math.abs(percentage - idealPercentage) > 5;
});
if (imbalancedArchetypes.length > 0) {
  issues.push(`原型分布不均: ${imbalancedArchetypes.map(([name]) => name).join(', ')}偏离理想值>5%`);
}

const narrowDims = Object.entries(dimensionStats).filter(([_, stats]) => (stats.max - stats.min) < 60);
if (narrowDims.length > 0) {
  issues.push(`维度区分度低: ${narrowDims.map(([d]) => d).join(', ')}的分数范围<60`);
}

if (lowMarginCount > 1000) {
  issues.push(`匹配不稳定: ${(lowMarginCount / 100).toFixed(1)}%用户的匹配边际<1%`);
}

if (issues.length === 0) {
  console.log('  ✓ 未发现明显精准度问题');
} else {
  issues.forEach((issue, idx) => console.log(`  ${idx + 1}. ${issue}`));
}

console.log('\n## 7. A/B测试优化建议\n');
console.log('基于以上分析，建议以下A/B测试方向:\n');

if (highSimilarityPairs.length > 0) {
  console.log('A. 原型向量调整测试:');
  console.log('   - 对照组: 当前原型定义');
  console.log('   - 实验组: 增大相似原型间的维度差异');
  highSimilarityPairs.slice(0, 3).forEach(p => {
    console.log(`   - 关注: ${p.pair}`);
  });
  console.log('');
}

if (underCoveredDims.length > 0) {
  console.log('B. 题目权重调整测试:');
  console.log('   - 对照组: 当前题目分数');
  console.log('   - 实验组: 增加覆盖不足维度的分数权重');
  console.log('');
}

console.log('C. P维度分配比例测试:');
console.log('   - 对照组: X:40%, O:30%, A:30%');
console.log('   - 实验组A: X:50%, O:25%, A:25%');
console.log('   - 实验组B: X:33%, O:33%, A:34%');
console.log('');

console.log('D. 匹配算法测试:');
console.log('   - 对照组: 余弦相似度');
console.log('   - 实验组: 欧氏距离 + 归一化');
console.log('');

console.log('='.repeat(80));
console.log('分析完成');
console.log('='.repeat(80));
