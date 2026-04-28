/**
 * Comprehensive Personality Assessment Simulation
 * 10,000 用户全流程模拟测试
 * 
 * 测试维度：
 * 1. 准确度 - 精确匹配率、相似匹配率
 * 2. 满意度 - 基于问题数量、流程体验
 * 3. 覆盖率 - L1/L2/L3 题目使用情况
 * 4. 混淆分析 - 原型间误判矩阵
 */

import { questionsV4 } from '../packages/shared/src/personality/questionsV4';
import { initializeEngineState, selectNextQuestion, processAnswer } from '../packages/shared/src/personality/adaptiveEngine';
import { findBestMatchingArchetypesV2 } from '../packages/shared/src/personality/matcherV2';
import { archetypePrototypes } from '../packages/shared/src/personality/prototypes';
import { DEFAULT_ASSESSMENT_CONFIG, TraitKey } from '../packages/shared/src/personality/types';

const NUM_SIMULATIONS = 10000;
const ALL_ARCHETYPES = Object.keys(archetypePrototypes);
const ALL_TRAITS: TraitKey[] = ['A', 'C', 'E', 'O', 'X', 'P'];

// 相似原型定义（用于计算相似匹配率）
const SIMILAR_ARCHETYPES: Record<string, string[]> = {
  "corgi": ["rooster", "hamster_praise"],
  "rooster": ["corgi", "dolphin_calm", "hamster_praise"],
  "hamster_praise": ["rooster", "koala", "corgi"],
  "fox": ["octopus", "owl"],
  "dolphin_calm": ["koala", "rooster", "elephant"],
  "spider": ["turtle", "elephant"],
  "koala": ["dolphin_calm", "hamster_praise", "elephant"],
  "turtle": ["elephant", "spider", "owl"],
  "octopus": ["fox", "owl"],
  "owl": ["turtle", "octopus", "cat"],
  "cat": ["owl", "dolphin_calm"],
  "elephant": ["turtle", "koala", "spider"]
};

interface SimulationResult {
  trueArchetype: string;
  predictedArchetype: string;
  confidence: number;
  questionsAsked: number;
  isExactMatch: boolean;
  isSimilarMatch: boolean;
  traitScores: Record<TraitKey, number>;
  satisfactionScore: number;
}

// 根据用户偏好选择答案 - 基于目标特质分数与当前选项的一致性
function selectAnswerByBias(question: typeof questionsV4[0], targetTraits: Record<TraitKey, number>): string {
  let bestOption = question.options[0];
  let bestScore = -Infinity;
  
  for (const option of question.options) {
    let score = 0;
    for (const trait of ALL_TRAITS) {
      const optionTraitScore = option.traitScores[trait] || 0;
      const targetValue = targetTraits[trait]; // 0-100 scale
      
      // 如果目标特质高(>70)且选项给正分，加分
      // 如果目标特质低(<30)且选项给负分，加分
      if (targetValue > 70 && optionTraitScore > 0) {
        score += optionTraitScore * (targetValue - 50) / 50;
      } else if (targetValue < 30 && optionTraitScore < 0) {
        score += Math.abs(optionTraitScore) * (50 - targetValue) / 50;
      } else if (targetValue >= 30 && targetValue <= 70) {
        // 中等特质，根据偏离程度决定
        score += optionTraitScore * (targetValue - 50) / 100;
      } else {
        // 高特质但负分选项，或低特质但正分选项，惩罚
        if ((targetValue > 70 && optionTraitScore < 0) || 
            (targetValue < 30 && optionTraitScore > 0)) {
          score -= Math.abs(optionTraitScore) * 0.5;
        }
      }
    }
    // 添加随机性以模拟真实用户的不一致性
    score += (Math.random() - 0.5) * 3;
    
    if (score > bestScore) {
      bestScore = score;
      bestOption = option;
    }
  }
  
  return bestOption.value;
}

// 计算满意度分数 (0-100)
function calculateSatisfaction(questionsAsked: number, isExactMatch: boolean, confidence: number): number {
  // 基础分
  let score = 50;
  
  // 问题数量影响 (8-12题最佳)
  if (questionsAsked <= 10) score += 20;
  else if (questionsAsked <= 12) score += 15;
  else if (questionsAsked <= 14) score += 10;
  else if (questionsAsked <= 16) score += 5;
  else score -= (questionsAsked - 16) * 2;
  
  // 结果准确度影响
  if (isExactMatch) score += 20;
  else score += 10;
  
  // 置信度影响
  score += confidence * 10;
  
  // 添加随机满意度波动
  score += (Math.random() - 0.5) * 10;
  
  return Math.max(0, Math.min(100, score));
}

// 获取用户的目标特质分数（带噪声）
function generateTargetTraits(archetype: string): Record<TraitKey, number> {
  const prototype = archetypePrototypes[archetype];
  if (!prototype) return { A: 50, C: 50, E: 50, O: 50, X: 50, P: 50 };
  
  const targetTraits: Record<TraitKey, number> = {} as Record<TraitKey, number>;
  for (const trait of ALL_TRAITS) {
    const baseValue = prototype.traitProfile[trait];
    // 添加 ±10 的随机噪声，模拟用户不完美符合原型
    const noise = (Math.random() - 0.5) * 20;
    targetTraits[trait] = Math.max(15, Math.min(95, baseValue + noise));
  }
  return targetTraits;
}

// 模拟单个用户完成测评
function simulateUser(trueArchetype: string): SimulationResult {
  const config = { ...DEFAULT_ASSESSMENT_CONFIG, useV2Matcher: true };
  let state = initializeEngineState(config);
  const askedQuestions: string[] = [];
  const targetTraits = generateTargetTraits(trueArchetype);
  
  // 运行测评直到完成
  while (true) {
    const question = selectNextQuestion(state);
    if (!question) break;
    
    askedQuestions.push(question.id);
    const answer = selectAnswerByBias(question, targetTraits);
    state = processAnswer(state, question, answer);
    
    // 安全限制
    if (askedQuestions.length >= 20) break;
  }
  
  // 获取匹配结果 - 使用归一化后的特质分数
  const normalizedTraits: Record<TraitKey, number> = {} as Record<TraitKey, number>;
  for (const trait of ALL_TRAITS) {
    normalizedTraits[trait] = state.traitConfidences[trait]?.score || 50;
  }
  const matchResults = findBestMatchingArchetypesV2(normalizedTraits);
  const predictedArchetype = matchResults[0]?.archetype || "unknown";
  const confidence = matchResults[0]?.confidence || 0;
  
  const isExactMatch = predictedArchetype === trueArchetype;
  const isSimilarMatch = isExactMatch || 
    (SIMILAR_ARCHETYPES[trueArchetype]?.includes(predictedArchetype) || false);
  
  return {
    trueArchetype,
    predictedArchetype,
    confidence,
    questionsAsked: askedQuestions.length,
    isExactMatch,
    isSimilarMatch,
    traitScores: normalizedTraits,
    satisfactionScore: calculateSatisfaction(askedQuestions.length, isExactMatch, confidence)
  };
}

// 收集各原型的特质分数分布
function analyzeTraitDistributions(results: SimulationResult[]) {
  console.log("\n" + "═".repeat(65));
  console.log("【特质分数分布分析 - 用于阈值校准】");
  console.log("═".repeat(65));
  
  const traitsByArchetype: Record<string, Record<TraitKey, number[]>> = {};
  
  for (const archetype of ALL_ARCHETYPES) {
    traitsByArchetype[archetype] = { A: [], C: [], E: [], O: [], X: [], P: [] };
  }
  
  for (const r of results) {
    for (const trait of ALL_TRAITS) {
      traitsByArchetype[r.trueArchetype][trait].push(r.traitScores[trait]);
    }
  }
  
  console.log("\n各原型实际特质分数范围（P10-P50-P90）：");
  console.log("─".repeat(65));
  
  const recommendations: string[] = [];
  
  for (const archetype of ALL_ARCHETYPES) {
    console.log(`\n${archetype}:`);
    const prototype = archetypePrototypes[archetype];
    
    for (const trait of ALL_TRAITS) {
      const scores = traitsByArchetype[archetype][trait].sort((a, b) => a - b);
      const p10 = scores[Math.floor(scores.length * 0.1)];
      const p50 = scores[Math.floor(scores.length * 0.5)];
      const p90 = scores[Math.floor(scores.length * 0.9)];
      const expected = prototype?.traitProfile[trait] || 50;
      const gap = Math.abs(p50 - expected);
      
      const indicator = gap > 15 ? '⚠️' : gap > 10 ? '△' : '✓';
      console.log(`  ${trait}: ${p10.toFixed(0)}-${p50.toFixed(0)}-${p90.toFixed(0)} (原型定义:${expected}) ${indicator}`);
      
      if (gap > 15) {
        recommendations.push(`${archetype}的${trait}特质：实际${p50.toFixed(0)} vs 定义${expected}，差距${gap.toFixed(0)}`);
      }
    }
  }
  
  if (recommendations.length > 0) {
    console.log("\n" + "─".repeat(65));
    console.log("⚠️ 需要调整的阈值（实际分数与原型定义差距>15）：");
    recommendations.forEach(r => console.log(`  - ${r}`));
  }
  
  return traitsByArchetype;
}

// 主模拟函数
function runSimulation() {
  console.log("╔═══════════════════════════════════════════════════════════════╗");
  console.log("║     JoyJoin V4 性格测评系统 - 10000用户模拟测试报告            ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝\n");
  
  console.log(`正在模拟 ${NUM_SIMULATIONS} 位用户完成完整测评流程...\n`);
  
  const results: SimulationResult[] = [];
  const archetypeDistribution = new Map<string, number>();
  
  // 均匀分布12种原型
  for (let i = 0; i < NUM_SIMULATIONS; i++) {
    const trueArchetype = ALL_ARCHETYPES[i % ALL_ARCHETYPES.length];
    archetypeDistribution.set(trueArchetype, (archetypeDistribution.get(trueArchetype) || 0) + 1);
    
    const result = simulateUser(trueArchetype);
    results.push(result);
    
    // 进度显示
    if ((i + 1) % 1000 === 0) {
      console.log(`  已完成: ${i + 1}/${NUM_SIMULATIONS} (${((i + 1) / NUM_SIMULATIONS * 100).toFixed(0)}%)`);
    }
  }
  
  // ═══════════════════════════════════════════════════════════════
  // 1. 准确度分析
  // ═══════════════════════════════════════════════════════════════
  console.log("\n" + "═".repeat(65));
  console.log("【1. 准确度分析】");
  console.log("═".repeat(65));
  
  const exactMatches = results.filter(r => r.isExactMatch).length;
  const similarMatches = results.filter(r => r.isSimilarMatch).length;
  const exactMatchRate = (exactMatches / NUM_SIMULATIONS * 100).toFixed(1);
  const similarMatchRate = (similarMatches / NUM_SIMULATIONS * 100).toFixed(1);
  
  console.log(`\n精确匹配率: ${exactMatchRate}% (${exactMatches}/${NUM_SIMULATIONS})`);
  console.log(`相似匹配率: ${similarMatchRate}% (${similarMatches}/${NUM_SIMULATIONS})`);
  console.log(`\n目标: 精确≥70%, 相似≥85%`);
  console.log(`状态: ${parseFloat(exactMatchRate) >= 70 ? '✅' : '⚠️'} 精确匹配 | ${parseFloat(similarMatchRate) >= 85 ? '✅' : '⚠️'} 相似匹配`);
  
  // 各原型准确率
  console.log("\n各原型精确匹配率:");
  const archetypeAccuracy: Record<string, { total: number, correct: number }> = {};
  for (const archetype of ALL_ARCHETYPES) {
    archetypeAccuracy[archetype] = { total: 0, correct: 0 };
  }
  for (const r of results) {
    archetypeAccuracy[r.trueArchetype].total++;
    if (r.isExactMatch) archetypeAccuracy[r.trueArchetype].correct++;
  }
  
  const sortedAccuracy = Object.entries(archetypeAccuracy)
    .map(([name, data]) => ({ name, rate: data.total > 0 ? data.correct / data.total * 100 : 0, ...data }))
    .sort((a, b) => b.rate - a.rate);
  
  for (const item of sortedAccuracy) {
    const bar = "█".repeat(Math.round(item.rate / 5)) + "░".repeat(20 - Math.round(item.rate / 5));
    const status = item.rate >= 70 ? '✅' : item.rate >= 60 ? '⚠️' : '❌';
    console.log(`  ${item.name.padEnd(8)} ${bar} ${item.rate.toFixed(1).padStart(5)}% ${status}`);
  }
  
  // ═══════════════════════════════════════════════════════════════
  // 2. 混淆矩阵分析
  // ═══════════════════════════════════════════════════════════════
  console.log("\n" + "═".repeat(65));
  console.log("【2. 混淆矩阵分析 - Top 10 误判对】");
  console.log("═".repeat(65));
  
  const confusionPairs: Map<string, number> = new Map();
  for (const r of results) {
    if (!r.isExactMatch) {
      const pair = `${r.trueArchetype} → ${r.predictedArchetype}`;
      confusionPairs.set(pair, (confusionPairs.get(pair) || 0) + 1);
    }
  }
  
  const sortedPairs = [...confusionPairs.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  
  console.log("\n最常见的误判:");
  for (const [pair, count] of sortedPairs) {
    const rate = (count / NUM_SIMULATIONS * 100).toFixed(2);
    console.log(`  ${pair.padEnd(25)} ${count}次 (${rate}%)`);
  }
  
  // ═══════════════════════════════════════════════════════════════
  // 3. 满意度分析
  // ═══════════════════════════════════════════════════════════════
  console.log("\n" + "═".repeat(65));
  console.log("【3. 用户满意度分析】");
  console.log("═".repeat(65));
  
  const avgSatisfaction = results.reduce((sum, r) => sum + r.satisfactionScore, 0) / NUM_SIMULATIONS;
  const satisfactionDistribution = {
    excellent: results.filter(r => r.satisfactionScore >= 80).length,
    good: results.filter(r => r.satisfactionScore >= 60 && r.satisfactionScore < 80).length,
    fair: results.filter(r => r.satisfactionScore >= 40 && r.satisfactionScore < 60).length,
    poor: results.filter(r => r.satisfactionScore < 40).length
  };
  
  console.log(`\n平均满意度: ${avgSatisfaction.toFixed(1)}/100`);
  console.log(`\n满意度分布:`);
  console.log(`  优秀 (≥80): ${satisfactionDistribution.excellent} (${(satisfactionDistribution.excellent/NUM_SIMULATIONS*100).toFixed(1)}%)`);
  console.log(`  良好 (60-79): ${satisfactionDistribution.good} (${(satisfactionDistribution.good/NUM_SIMULATIONS*100).toFixed(1)}%)`);
  console.log(`  一般 (40-59): ${satisfactionDistribution.fair} (${(satisfactionDistribution.fair/NUM_SIMULATIONS*100).toFixed(1)}%)`);
  console.log(`  较差 (<40): ${satisfactionDistribution.poor} (${(satisfactionDistribution.poor/NUM_SIMULATIONS*100).toFixed(1)}%)`);
  
  // NPS计算 (简化版)
  const promoters = results.filter(r => r.satisfactionScore >= 80).length;
  const detractors = results.filter(r => r.satisfactionScore < 50).length;
  const nps = ((promoters - detractors) / NUM_SIMULATIONS * 100).toFixed(0);
  console.log(`\n净推荐值 (NPS): ${nps}`);
  
  // ═══════════════════════════════════════════════════════════════
  // 4. 问题数量分析
  // ═══════════════════════════════════════════════════════════════
  console.log("\n" + "═".repeat(65));
  console.log("【4. 测评效率分析】");
  console.log("═".repeat(65));
  
  const avgQuestions = results.reduce((sum, r) => sum + r.questionsAsked, 0) / NUM_SIMULATIONS;
  const questionDistribution = {
    optimal: results.filter(r => r.questionsAsked <= 10).length,
    good: results.filter(r => r.questionsAsked > 10 && r.questionsAsked <= 12).length,
    acceptable: results.filter(r => r.questionsAsked > 12 && r.questionsAsked <= 14).length,
    long: results.filter(r => r.questionsAsked > 14).length
  };
  
  console.log(`\n平均问题数: ${avgQuestions.toFixed(1)} 题/用户`);
  console.log(`\n问题数量分布:`);
  console.log(`  最佳 (≤10题): ${questionDistribution.optimal} (${(questionDistribution.optimal/NUM_SIMULATIONS*100).toFixed(1)}%)`);
  console.log(`  良好 (11-12题): ${questionDistribution.good} (${(questionDistribution.good/NUM_SIMULATIONS*100).toFixed(1)}%)`);
  console.log(`  可接受 (13-14题): ${questionDistribution.acceptable} (${(questionDistribution.acceptable/NUM_SIMULATIONS*100).toFixed(1)}%)`);
  console.log(`  偏长 (>14题): ${questionDistribution.long} (${(questionDistribution.long/NUM_SIMULATIONS*100).toFixed(1)}%)`);
  
  // ═══════════════════════════════════════════════════════════════
  // 5. 置信度分析
  // ═══════════════════════════════════════════════════════════════
  console.log("\n" + "═".repeat(65));
  console.log("【5. 匹配置信度分析】");
  console.log("═".repeat(65));
  
  const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / NUM_SIMULATIONS;
  const highConfidence = results.filter(r => r.confidence >= 0.8).length;
  const mediumConfidence = results.filter(r => r.confidence >= 0.6 && r.confidence < 0.8).length;
  const lowConfidence = results.filter(r => r.confidence < 0.6).length;
  
  console.log(`\n平均置信度: ${(avgConfidence * 100).toFixed(1)}%`);
  console.log(`\n置信度分布:`);
  console.log(`  高置信 (≥80%): ${highConfidence} (${(highConfidence/NUM_SIMULATIONS*100).toFixed(1)}%)`);
  console.log(`  中置信 (60-79%): ${mediumConfidence} (${(mediumConfidence/NUM_SIMULATIONS*100).toFixed(1)}%)`);
  console.log(`  低置信 (<60%): ${lowConfidence} (${(lowConfidence/NUM_SIMULATIONS*100).toFixed(1)}%)`);
  
  // 置信度与准确度的关系
  const highConfCorrect = results.filter(r => r.confidence >= 0.8 && r.isExactMatch).length;
  const lowConfCorrect = results.filter(r => r.confidence < 0.6 && r.isExactMatch).length;
  console.log(`\n置信度-准确度相关性:`);
  console.log(`  高置信正确率: ${highConfidence > 0 ? (highConfCorrect/highConfidence*100).toFixed(1) : 0}%`);
  console.log(`  低置信正确率: ${lowConfidence > 0 ? (lowConfCorrect/lowConfidence*100).toFixed(1) : 0}%`);
  
  // ═══════════════════════════════════════════════════════════════
  // 6. 综合评估
  // ═══════════════════════════════════════════════════════════════
  console.log("\n" + "═".repeat(65));
  console.log("【6. 综合评估报告】");
  console.log("═".repeat(65));
  
  const overallScore = (
    parseFloat(exactMatchRate) * 0.4 +
    parseFloat(similarMatchRate) * 0.2 +
    avgSatisfaction * 0.2 +
    (100 - Math.abs(avgQuestions - 10) * 5) * 0.1 +
    avgConfidence * 100 * 0.1
  );
  
  console.log(`\n系统综合评分: ${overallScore.toFixed(1)}/100`);
  console.log(`\n评分构成:`);
  console.log(`  精确匹配 (40%): ${exactMatchRate}%`);
  console.log(`  相似匹配 (20%): ${similarMatchRate}%`);
  console.log(`  用户满意度 (20%): ${avgSatisfaction.toFixed(1)}%`);
  console.log(`  测评效率 (10%): ${avgQuestions.toFixed(1)} 题`);
  console.log(`  匹配置信度 (10%): ${(avgConfidence * 100).toFixed(1)}%`);
  
  // 改进建议
  console.log("\n" + "─".repeat(65));
  console.log("改进建议:");
  if (parseFloat(exactMatchRate) < 70) {
    console.log("  ⚠️ 精确匹配率未达标，建议优化混淆原型的区分问题");
  }
  if (sortedPairs.length > 0) {
    const topPair = sortedPairs[0][0];
    console.log(`  💡 重点优化: ${topPair} 的区分问题`);
  }
  if (avgQuestions > 12) {
    console.log("  ⏱️ 平均问题数偏多，建议优化自适应算法效率");
  }
  if (avgConfidence < 0.7) {
    console.log("  📊 置信度偏低，建议增加高区分度问题");
  }
  
  // ═══════════════════════════════════════════════════════════════
  // 7. 特质分数分布分析（用于阈值校准）
  // ═══════════════════════════════════════════════════════════════
  analyzeTraitDistributions(results);
  
  console.log("\n" + "═".repeat(65));
  console.log("测试完成！");
  console.log("═".repeat(65));
}

// 运行模拟
runSimulation();
