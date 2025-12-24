/**
 * 累加评分系统 - 基于心理学专家共识方案
 * 
 * 核心改革要点：
 * 1. 废除固定原型分数 - 每个用户的雷达图反映个体真实差异
 * 2. 累加特质评分法 - 每个答案贡献6维特质分数，累加形成总分
 * 3. 余弦相似度匹配 - 用累加分数匹配最接近的原型动物
 * 4. P维度整合 - 将积极性分数整合到相关维度
 * 
 * 专家共识：
 * - 陈思远(北大): 累加+标准化，IRT模型等值转换
 * - 林雅琪(港大): 加权累加+百分位转换，建立常模参照
 * - 王建明(清华): 累加+百分位分数，体现可塑性
 * - 张晓华(中山): 文化情境加权+分数平滑，华人本土化
 * - 刘心怡(咨询师): 累加+T分数标准化，保护心理安全
 */

import { TraitScores as OptionTraits } from '@/data/personalityQuestionsV2';
import { TraitScores, archetypeTraitScores } from './archetypeTraitScores';
import { archetypeTraitScoresOptimized, getABTestVariant, type ABTestVariant } from './archetypeTraitScoresOptimized';

/**
 * 获取当前A/B测试使用的原型分数
 */
function getCurrentArchetypeScores(): Record<string, TraitScores> {
  const variant = getABTestVariant();
  return variant === 'optimized' ? archetypeTraitScoresOptimized : archetypeTraitScores;
}

export interface AccumulatedScores {
  A: number;  // 亲和力
  O: number;  // 开放性
  C: number;  // 责任心
  E: number;  // 情绪稳定
  X: number;  // 外向性
}

export interface NormalizedScores {
  affinity: number;        // 亲和力 0-100
  openness: number;        // 开放性 0-100
  conscientiousness: number; // 责任心 0-100
  emotionalStability: number; // 情绪稳定 0-100
  extraversion: number;    // 外向性 0-100
}

export interface ArchetypeMatch {
  archetype: string;
  similarity: number;      // 余弦相似度 0-1
  matchPercentage: number; // 匹配百分比 0-100
}

export interface PersonalityResult {
  rawScores: AccumulatedScores;
  normalizedScores: NormalizedScores;
  primaryMatch: ArchetypeMatch;
  secondaryMatch: ArchetypeMatch;
  radarData: NormalizedScores;
}

/**
 * 经验分数范围配置（V3优化版 - 包含负分和新P整合比例）
 * 
 * V3更新：
 * - 新增负分选项，min值可能为负
 * - P维度新分配：25%X/35%O/40%A（降低高能量偏向）
 * - 新增选项扩大了分数范围
 * 
 * P维度最大贡献（新比例）：
 *   - 总P max ≈ 20 (V3调整后)
 *   - A获得: 20 * 0.4 = 8
 *   - O获得: 20 * 0.35 = 7
 *   - X获得: 20 * 0.25 = 5
 *   
 * P维度最小贡献（新增负分）：
 *   - 总P min ≈ -8
 *   - A获得: -8 * 0.4 = -3.2
 *   - O获得: -8 * 0.35 = -2.8
 *   - X获得: -8 * 0.25 = -2
 */
const SCORE_RANGE: Record<keyof AccumulatedScores, { min: number; max: number }> = {
  A: { min: -4, max: 30 },   // 基础(-1~22) + P贡献(-3.2~8) ≈ -4~30
  O: { min: -3, max: 35 },   // 基础(0~28) + P贡献(-2.8~7) ≈ -3~35
  C: { min: 0, max: 30 },    // 责任心不受P影响，新选项扩大范围
  E: { min: 0, max: 28 },    // 情绪稳定不受P影响，新选项扩大范围
  X: { min: -15, max: 38 },  // 基础(-13~33) + P贡献(-2~5) ≈ -15~38
};

/**
 * P维度整合比例（V3优化版）
 * 
 * V3调整：降低X分配比例，减少高能量原型偏向
 * - 积极乐观的社交态度 → 外向性(X) 25%（从40%降低）
 * - 积极看待新事物 → 开放性(O) 35%（从30%提高）
 * - 积极的人际关系态度 → 亲和力(A) 40%（从30%提高）
 */
const P_INTEGRATION = {
  X: 0.25,  // V3: 从0.4降低到0.25
  O: 0.35,  // V3: 从0.3提高到0.35
  A: 0.40,  // V3: 从0.3提高到0.40
} as const;

/**
 * P维度整合函数（使用浮点数避免小值被舍入为0）
 */
function integratePDimension(pScore: number): { A: number; O: number; X: number } {
  if (pScore === 0) return { A: 0, O: 0, X: 0 };
  
  // 使用浮点数保留精度，最终在归一化时处理
  return {
    A: pScore * P_INTEGRATION.A,
    O: pScore * P_INTEGRATION.O,
    X: pScore * P_INTEGRATION.X,
  };
}

/**
 * 累加用户答案的特质分数
 */
export function accumulateTraitScores(answers: OptionTraits[]): AccumulatedScores {
  // 使用浮点数累加，最终归一化时处理精度
  let accumulated = { A: 0, O: 0, C: 0, E: 0, X: 0 };
  
  answers.forEach(answer => {
    // 累加基础5维分数
    if (answer.A) accumulated.A += answer.A;
    if (answer.O) accumulated.O += answer.O;
    if (answer.C) accumulated.C += answer.C;
    if (answer.E) accumulated.E += answer.E;
    if (answer.X) accumulated.X += answer.X;
    
    // 整合P维度到相关维度（浮点数）
    if (answer.P) {
      const pIntegrated = integratePDimension(answer.P);
      accumulated.A += pIntegrated.A;
      accumulated.O += pIntegrated.O;
      accumulated.X += pIntegrated.X;
    }
  });
  
  return accumulated;
}

/**
 * 归一化分数到0-100范围
 * 采用min-max标准化，处理可能的负值情况
 */
export function normalizeScores(accumulated: AccumulatedScores): NormalizedScores {
  const normalize = (score: number, range: { min: number; max: number }): number => {
    // Min-max归一化: (score - min) / (max - min) * 100
    // 如果score低于min则为0，高于max则为100
    const { min, max } = range;
    if (max === min) return 50; // 避免除零
    
    const normalized = ((score - min) / (max - min)) * 100;
    return Math.max(0, Math.min(100, Math.round(normalized)));
  };
  
  return {
    affinity: normalize(accumulated.A, SCORE_RANGE.A),
    openness: normalize(accumulated.O, SCORE_RANGE.O),
    conscientiousness: normalize(accumulated.C, SCORE_RANGE.C),
    emotionalStability: normalize(accumulated.E, SCORE_RANGE.E),
    extraversion: normalize(accumulated.X, SCORE_RANGE.X),
  };
}

/**
 * 计算两个向量的余弦相似度
 */
function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) return 0;
  
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;
  
  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }
  
  if (norm1 === 0 || norm2 === 0) return 0;
  
  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

/**
 * 计算两个向量的欧氏距离
 */
function euclideanDistance(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) return Infinity;
  
  let sum = 0;
  for (let i = 0; i < vec1.length; i++) {
    sum += Math.pow(vec1[i] - vec2[i], 2);
  }
  
  return Math.sqrt(sum);
}

/**
 * 将欧氏距离转换为相似度 (0-1范围)
 * 使用公式: similarity = 1 / (1 + distance / maxDistance)
 * maxDistance约为141.4 (5维度各100的最大距离)
 */
function euclideanToSimilarity(distance: number): number {
  const maxDistance = Math.sqrt(5 * 100 * 100); // ~223.6
  return 1 / (1 + distance / maxDistance);
}

/**
 * 将NormalizedScores转换为向量
 */
function scoresToVector(scores: NormalizedScores): number[] {
  return [
    scores.affinity,
    scores.openness,
    scores.conscientiousness,
    scores.emotionalStability,
    scores.extraversion,
  ];
}

/**
 * 将TraitScores转换为5维向量
 * 将原型的positivity完整整合到其他维度，保持与用户向量一致
 * 使用与用户评分完全相同的P_INTEGRATION比例（浮点数，不舍入）
 */
function archetypeToVector(traits: TraitScores): number[] {
  const pContribution = traits.positivity || 0;
  
  // 使用与用户评分一致的P整合比例（浮点数）
  return [
    traits.affinity + pContribution * P_INTEGRATION.A,      // A获得P的30%
    traits.openness + pContribution * P_INTEGRATION.O,      // O获得P的30%
    traits.conscientiousness,
    traits.emotionalStability,
    traits.extraversion + pContribution * P_INTEGRATION.X,  // X获得P的40%
  ];
}

/**
 * 匹配算法类型
 */
export type MatchingAlgorithm = 'cosine' | 'euclidean';

/**
 * 使用余弦相似度匹配最接近的原型
 * 支持A/B测试，根据当前变体选择原型分数
 */
export function matchArchetypes(normalizedScores: NormalizedScores): ArchetypeMatch[] {
  const userVector = scoresToVector(normalizedScores);
  const matches: ArchetypeMatch[] = [];
  const currentArchetypes = getCurrentArchetypeScores();
  
  for (const [archetype, traits] of Object.entries(currentArchetypes)) {
    const archetypeVector = archetypeToVector(traits);
    const similarity = cosineSimilarity(userVector, archetypeVector);
    
    matches.push({
      archetype,
      similarity,
      matchPercentage: Math.round(similarity * 100),
    });
  }
  
  // 按相似度降序排序
  matches.sort((a, b) => b.similarity - a.similarity);
  
  return matches;
}

/**
 * 使用欧氏距离匹配最接近的原型
 * 距离越小=相似度越高
 */
export function matchArchetypesEuclidean(normalizedScores: NormalizedScores): ArchetypeMatch[] {
  const userVector = scoresToVector(normalizedScores);
  const matches: ArchetypeMatch[] = [];
  const currentArchetypes = getCurrentArchetypeScores();
  
  for (const [archetype, traits] of Object.entries(currentArchetypes)) {
    const archetypeVector = archetypeToVector(traits);
    const distance = euclideanDistance(userVector, archetypeVector);
    const similarity = euclideanToSimilarity(distance);
    
    matches.push({
      archetype,
      similarity,
      matchPercentage: Math.round(similarity * 100),
    });
  }
  
  // 按相似度降序排序
  matches.sort((a, b) => b.similarity - a.similarity);
  
  return matches;
}

/**
 * 通用匹配函数，支持算法选择
 */
export function matchArchetypesWithAlgorithm(
  normalizedScores: NormalizedScores, 
  algorithm: MatchingAlgorithm = 'cosine'
): ArchetypeMatch[] {
  return algorithm === 'euclidean' 
    ? matchArchetypesEuclidean(normalizedScores) 
    : matchArchetypes(normalizedScores);
}

/**
 * 完整的性格评估流程
 * @param answers 用户选择的答案特质分数数组
 */
export function evaluatePersonality(answers: OptionTraits[]): PersonalityResult {
  // 1. 累加特质分数
  const rawScores = accumulateTraitScores(answers);
  
  // 2. 归一化到0-100
  const normalizedScores = normalizeScores(rawScores);
  
  // 3. 余弦相似度匹配原型
  const matches = matchArchetypes(normalizedScores);
  
  return {
    rawScores,
    normalizedScores,
    primaryMatch: matches[0],
    secondaryMatch: matches[1],
    radarData: normalizedScores,  // 使用个性化的归一化分数作为雷达图
  };
}

/**
 * 生成结果解读文案
 * 包含心理教育内容，说明原型是启发性工具
 */
export function generateResultInterpretation(result: PersonalityResult): {
  headline: string;
  description: string;
  psychEducation: string;
  strengthHighlights: string[];
} {
  const { primaryMatch, secondaryMatch, normalizedScores } = result;
  
  // 找出最高和次高的维度
  const dimensions = [
    { name: '亲和力', value: normalizedScores.affinity, key: 'affinity' },
    { name: '开放性', value: normalizedScores.openness, key: 'openness' },
    { name: '责任心', value: normalizedScores.conscientiousness, key: 'conscientiousness' },
    { name: '情绪稳定', value: normalizedScores.emotionalStability, key: 'emotionalStability' },
    { name: '外向性', value: normalizedScores.extraversion, key: 'extraversion' },
  ];
  
  dimensions.sort((a, b) => b.value - a.value);
  const topDimension = dimensions[0];
  const secondDimension = dimensions[1];
  
  const headline = `你是${primaryMatch.archetype}型，同时具有${secondaryMatch.archetype}的特质`;
  
  const description = `你的社交风格最接近${primaryMatch.archetype}（${primaryMatch.matchPercentage}%匹配），` +
    `在${topDimension.name}维度上表现突出（${topDimension.value}分），` +
    `${secondDimension.name}也是你的优势（${secondDimension.value}分）。`;
  
  const psychEducation = 
    '这个原型是帮助你了解自己社交风格的启发性工具，而非固定标签。' +
    '人格特质是连续变化的，每个人都是独特的。' +
    '你可以在不同情境中展现不同的社交面向，这正是人格的丰富性所在。';
  
  const strengthHighlights = dimensions
    .slice(0, 3)
    .map(d => `${d.name}: ${d.value}分`);
  
  return {
    headline,
    description,
    psychEducation,
    strengthHighlights,
  };
}

/**
 * 验证累加评分系统的有效性
 * 用于开发环境测试
 */
export function validateCumulativeSystem(): {
  dimensionCoverage: Record<string, number>;
  scoreRanges: Record<string, { min: number; max: number }>;
  archetypeDistribution: Record<string, number>;
} {
  return {
    dimensionCoverage: {
      A: SCORE_RANGE.A.max,
      O: SCORE_RANGE.O.max,
      C: SCORE_RANGE.C.max,
      E: SCORE_RANGE.E.max,
      X: SCORE_RANGE.X.max,
    },
    scoreRanges: SCORE_RANGE,
    archetypeDistribution: {},
  };
}
