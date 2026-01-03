/**
 * 心理学家评测团模拟
 * 模拟10位"资深心理学家"测试性格测评系统的匹配精准度
 * 每位心理学家代表一种典型人格原型
 */

import {
  initializeEngineState,
  processAnswer,
  selectNextQuestion,
  shouldTerminate,
  EngineState,
} from '../packages/shared/src/personality/adaptiveEngine';
import { archetypePrototypes } from '../packages/shared/src/personality/prototypes';
import { TraitKey } from '../packages/shared/src/personality/types';

interface PsychologistProfile {
  id: number;
  name: string;
  specialty: string;
  targetArchetype: string;
  traitProfile: Record<TraitKey, number>;
}

interface TestResult {
  psychologist: PsychologistProfile;
  questionsAnswered: number;
  assignedArchetype: string | null;
  confidence: number;
  isExactMatch: boolean;
  isSimilarMatch: boolean;
  traitDeltas: Record<TraitKey, number>;
  questionSequence: string[];
  verdict: string;
}

// 10位心理学家，每人代表一种典型原型人格
const psychologistPanel: PsychologistProfile[] = [
  {
    id: 1,
    name: "Dr. 陈阳光",
    specialty: "正向心理学",
    targetArchetype: "开心柯基",
    traitProfile: { A: 72, C: 48, E: 62, O: 67, X: 96, P: 92 }
  },
  {
    id: 2,
    name: "Dr. 李稳健",
    specialty: "情绪调节研究",
    targetArchetype: "太阳鸡",
    traitProfile: { A: 68, C: 74, E: 90, O: 53, X: 76, P: 94 }
  },
  {
    id: 3,
    name: "Dr. 王温暖",
    specialty: "人际关系治疗",
    targetArchetype: "夸夸豚",
    traitProfile: { A: 92, C: 48, E: 67, O: 60, X: 84, P: 86 }
  },
  {
    id: 4,
    name: "Dr. 张灵活",
    specialty: "创新思维研究",
    targetArchetype: "机智狐",
    traitProfile: { A: 53, C: 52, E: 58, O: 92, X: 82, P: 63 }
  },
  {
    id: 5,
    name: "Dr. 刘从容",
    specialty: "压力管理",
    targetArchetype: "淡定海豚",
    traitProfile: { A: 72, C: 68, E: 87, O: 63, X: 58, P: 72 }
  },
  {
    id: 6,
    name: "Dr. 赵连接",
    specialty: "社会网络分析",
    targetArchetype: "织网蛛",
    traitProfile: { A: 82, C: 72, E: 63, O: 68, X: 58, P: 62 }
  },
  {
    id: 7,
    name: "Dr. 孙关怀",
    specialty: "共情与依恋",
    targetArchetype: "暖心熊",
    traitProfile: { A: 92, C: 63, E: 82, O: 58, X: 53, P: 72 }
  },
  {
    id: 8,
    name: "Dr. 周创意",
    specialty: "发散思维研究",
    targetArchetype: "灵感章鱼",
    traitProfile: { A: 48, C: 43, E: 57, O: 97, X: 58, P: 67 }
  },
  {
    id: 9,
    name: "Dr. 吴深思",
    specialty: "认知心理学",
    targetArchetype: "沉思猫头鹰",
    traitProfile: { A: 43, C: 82, E: 77, O: 87, X: 38, P: 48 }
  },
  {
    id: 10,
    name: "Dr. 郑沉稳",
    specialty: "人格稳定性研究",
    targetArchetype: "定心大象",
    traitProfile: { A: 72, C: 92, E: 88, O: 48, X: 38, P: 62 }
  }
];

function selectOptionForPsychologist(
  profile: PsychologistProfile,
  question: { id: string; options: Array<{ value: string; traitScores: Partial<Record<TraitKey, number>> }> }
): string {
  const optionScores = question.options.map((opt) => {
    let score = 0;
    for (const trait of Object.keys(opt.traitScores) as TraitKey[]) {
      const value = opt.traitScores[trait] || 0;
      const userTrait = profile.traitProfile[trait] || 50;
      const traitAlignment = (userTrait - 50) / 50;
      score += value * traitAlignment;
    }
    // 心理学家答题更一致，随机波动小
    score += (Math.random() - 0.5) * 0.5;
    return { value: opt.value, score };
  });

  optionScores.sort((a, b) => b.score - a.score);
  return optionScores[0].value;
}

function isSimilarArchetype(trueArchetype: string, assignedArchetype: string | null): boolean {
  if (!assignedArchetype) return false;
  if (trueArchetype === assignedArchetype) return true;
  
  const trueProto = archetypePrototypes[trueArchetype];
  const assignedProto = archetypePrototypes[assignedArchetype];
  
  if (!trueProto || !assignedProto) return false;
  
  if (trueProto.confusableWith?.includes(assignedArchetype)) return true;
  if (assignedProto.confusableWith?.includes(trueArchetype)) return true;
  
  return false;
}

function runPsychologistTest(profile: PsychologistProfile): TestResult {
  let state = initializeEngineState();
  let questionsAnswered = 0;
  let currentQuestion = selectNextQuestion(state);
  const questionSequence: string[] = [];

  while (currentQuestion && !shouldTerminate(state)) {
    questionsAnswered++;
    questionSequence.push(currentQuestion.id);

    const selectedOption = selectOptionForPsychologist(profile, currentQuestion);
    state = processAnswer(state, currentQuestion, selectedOption);
    currentQuestion = selectNextQuestion(state);
  }

  const assignedArchetype = state.currentMatches[0]?.archetype || null;
  const confidence = state.currentMatches[0]?.confidence || 0;
  const isExactMatch = assignedArchetype === profile.targetArchetype;
  const isSimilarMatch = isSimilarArchetype(profile.targetArchetype, assignedArchetype);

  // 计算特质偏差
  const traitDeltas: Record<TraitKey, number> = {} as Record<TraitKey, number>;
  const traits: TraitKey[] = ['A', 'C', 'E', 'O', 'X', 'P'];
  for (const trait of traits) {
    const measured = state.traitConfidences[trait]?.score || 50;
    const expected = profile.traitProfile[trait];
    traitDeltas[trait] = Math.round(measured - expected);
  }

  // 生成评价
  let verdict: string;
  if (isExactMatch) {
    verdict = `✅ 精确匹配！系统准确识别出${profile.targetArchetype}特征。`;
  } else if (isSimilarMatch) {
    verdict = `🟡 相似匹配。预期${profile.targetArchetype}，实际${assignedArchetype}，两者在维度上相近。`;
  } else {
    verdict = `❌ 匹配偏差。预期${profile.targetArchetype}，实际${assignedArchetype}，需检查区分度。`;
  }

  return {
    psychologist: profile,
    questionsAnswered,
    assignedArchetype,
    confidence,
    isExactMatch,
    isSimilarMatch,
    traitDeltas,
    questionSequence,
    verdict
  };
}

function runMultipleTimes(profile: PsychologistProfile, times: number = 5): TestResult[] {
  const results: TestResult[] = [];
  for (let i = 0; i < times; i++) {
    results.push(runPsychologistTest(profile));
  }
  return results;
}

function generatePanelReport(allResults: TestResult[][]): void {
  console.log('\n');
  console.log('═'.repeat(80));
  console.log('                    🧠 心理学家评测团 - 匹配精准度报告');
  console.log('═'.repeat(80));
  console.log(`\n测试时间: ${new Date().toLocaleString('zh-CN')}`);
  console.log(`评测方式: 每位心理学家重复测试5次，取一致性结果\n`);

  let totalExact = 0;
  let totalSimilar = 0;
  let totalTests = 0;

  for (let i = 0; i < allResults.length; i++) {
    const results = allResults[i];
    const profile = results[0].psychologist;
    
    console.log('─'.repeat(80));
    console.log(`\n👤 ${profile.name} | ${profile.specialty}`);
    console.log(`   目标原型: ${profile.targetArchetype}`);
    console.log(`   特质配置: A=${profile.traitProfile.A} C=${profile.traitProfile.C} E=${profile.traitProfile.E} O=${profile.traitProfile.O} X=${profile.traitProfile.X} P=${profile.traitProfile.P}`);
    console.log('');

    const archetypeCounts: Record<string, number> = {};
    let exactMatches = 0;
    let similarMatches = 0;
    let avgConfidence = 0;
    let avgQuestions = 0;

    for (const result of results) {
      totalTests++;
      if (result.isExactMatch) {
        exactMatches++;
        totalExact++;
      }
      if (result.isSimilarMatch) {
        similarMatches++;
        totalSimilar++;
      }
      avgConfidence += result.confidence;
      avgQuestions += result.questionsAnswered;
      const arch = result.assignedArchetype || '未知';
      archetypeCounts[arch] = (archetypeCounts[arch] || 0) + 1;
    }

    avgConfidence = avgConfidence / results.length;
    avgQuestions = avgQuestions / results.length;

    // 显示5次测试结果分布
    console.log('   5次测试结果:');
    for (const [arch, count] of Object.entries(archetypeCounts).sort((a, b) => b[1] - a[1])) {
      const isTarget = arch === profile.targetArchetype;
      const marker = isTarget ? ' ✓' : '';
      console.log(`      ${arch}: ${count}次${marker}`);
    }

    console.log('');
    console.log(`   📊 统计:`);
    console.log(`      精确匹配率: ${exactMatches}/5 (${Math.round(exactMatches / 5 * 100)}%)`);
    console.log(`      相似匹配率: ${similarMatches}/5 (${Math.round(similarMatches / 5 * 100)}%)`);
    console.log(`      平均置信度: ${(avgConfidence * 100).toFixed(1)}%`);
    console.log(`      平均答题数: ${avgQuestions.toFixed(1)}题`);

    // 最后一次测试的特质偏差
    const lastResult = results[results.length - 1];
    const traitLabels: Record<TraitKey, string> = {
      A: '亲和力', C: '责任心', E: '情绪稳', O: '开放性', X: '外向性', P: '正能量'
    };
    
    console.log('');
    console.log(`   📏 测量偏差 (测量值 - 真实值):`);
    const deltas = Object.entries(lastResult.traitDeltas).map(([trait, delta]) => {
      const sign = delta >= 0 ? '+' : '';
      const warning = Math.abs(delta) > 15 ? ' ⚠️' : '';
      return `${traitLabels[trait as TraitKey]}:${sign}${delta}${warning}`;
    });
    console.log(`      ${deltas.join(' | ')}`);

    // 综合评价
    console.log('');
    if (exactMatches >= 4) {
      console.log(`   ✅ 评价: 该原型识别非常稳定，5次中${exactMatches}次精确命中`);
    } else if (similarMatches >= 4) {
      console.log(`   🟡 评价: 匹配到相似原型，可能存在边界模糊`);
    } else {
      console.log(`   ❌ 评价: 匹配不稳定，需要检查该原型的区分度`);
    }
    console.log('');
  }

  // 汇总
  console.log('═'.repeat(80));
  console.log('                           📋 总体评估');
  console.log('═'.repeat(80));
  console.log('');
  console.log(`   总测试次数: ${totalTests} 次 (10位心理学家 × 5次)`);
  console.log(`   精确匹配: ${totalExact}/${totalTests} (${Math.round(totalExact / totalTests * 100)}%)`);
  console.log(`   相似匹配: ${totalSimilar}/${totalTests} (${Math.round(totalSimilar / totalTests * 100)}%)`);
  console.log('');

  // 精准度评级
  const exactRate = totalExact / totalTests;
  const similarRate = totalSimilar / totalTests;
  
  let grade: string;
  let recommendation: string;
  
  if (exactRate >= 0.7) {
    grade = '🏆 优秀 (A级)';
    recommendation = '匹配算法精准度高，可投入生产使用';
  } else if (exactRate >= 0.5) {
    grade = '✅ 良好 (B级)';
    recommendation = '精确匹配率达标，建议继续优化边界原型区分';
  } else if (similarRate >= 0.6) {
    grade = '🟡 及格 (C级)';
    recommendation = '相似匹配可接受，但精确匹配率需提升';
  } else {
    grade = '⚠️ 需改进 (D级)';
    recommendation = '匹配精准度不足，需审查原型定义和题目权重';
  }

  console.log(`   综合评级: ${grade}`);
  console.log(`   建议: ${recommendation}`);
  console.log('');

  // 问题原型分析
  const problemArchetypes: string[] = [];
  for (let i = 0; i < allResults.length; i++) {
    const results = allResults[i];
    const exactMatches = results.filter(r => r.isExactMatch).length;
    if (exactMatches < 3) {
      problemArchetypes.push(results[0].psychologist.targetArchetype);
    }
  }

  if (problemArchetypes.length > 0) {
    console.log('   ⚠️ 需要关注的原型:');
    for (const arch of problemArchetypes) {
      const proto = archetypePrototypes[arch];
      console.log(`      - ${arch}: 易混淆于 ${proto?.confusableWith?.join(', ') || '无'}`);
    }
    console.log('');
  }

  console.log('═'.repeat(80));
  console.log('');
}

async function main() {
  console.log('🚀 启动心理学家评测团模拟...\n');
  
  const allResults: TestResult[][] = [];
  
  for (const profile of psychologistPanel) {
    console.log(`正在测试: ${profile.name} (${profile.targetArchetype})...`);
    const results = runMultipleTimes(profile, 5);
    allResults.push(results);
  }

  generatePanelReport(allResults);
}

main().catch(console.error);
