/**
 * 1000用户大规模模拟测试
 * 模拟1000位用户测试性格测评系统，收集模拟反馈
 */

import {
  initializeEngineState,
  processAnswer,
  selectNextQuestion,
  shouldTerminate,
} from '../packages/shared/src/personality/adaptiveEngine';
import { archetypePrototypes } from '../packages/shared/src/personality/prototypes';
import { TraitKey } from '../packages/shared/src/personality/types';

const TOTAL_USERS = 1000;
const ARCHETYPES = Object.keys(archetypePrototypes);

interface SimulatedUser {
  id: number;
  trueArchetype: string;
  traitProfile: Record<TraitKey, number>;
}

interface UserResult {
  user: SimulatedUser;
  assignedArchetype: string | null;
  confidence: number;
  questionsAnswered: number;
  isExactMatch: boolean;
  isSimilarMatch: boolean;
  simulatedFeedback: 'exact' | 'close' | 'miss';
  satisfactionScore: number;
}

interface AggregateStats {
  totalUsers: number;
  exactMatches: number;
  similarMatches: number;
  misses: number;
  exactMatchRate: number;
  similarMatchRate: number;
  avgQuestionsAnswered: number;
  avgConfidence: number;
  satisfactionRate: number;
  byArchetype: Record<string, {
    total: number;
    exact: number;
    similar: number;
    exactRate: number;
    similarRate: number;
  }>;
  confusionMatrix: Record<string, Record<string, number>>;
  userFeedbackSummary: {
    satisfied: number;
    neutral: number;
    dissatisfied: number;
  };
}

function generateRandomUser(id: number): SimulatedUser {
  const trueArchetype = ARCHETYPES[Math.floor(Math.random() * ARCHETYPES.length)];
  const baseProfile = archetypePrototypes[trueArchetype].traitProfile;
  
  const traitProfile: Record<TraitKey, number> = {} as Record<TraitKey, number>;
  for (const trait of Object.keys(baseProfile) as TraitKey[]) {
    const baseValue = baseProfile[trait];
    const variation = (Math.random() - 0.5) * 20;
    traitProfile[trait] = Math.max(0, Math.min(100, baseValue + variation));
  }
  
  return { id, trueArchetype, traitProfile };
}

function selectOptionForUser(
  user: SimulatedUser,
  question: { id: string; options: Array<{ value: string; traitScores: Partial<Record<TraitKey, number>> }> }
): string {
  const optionScores = question.options.map((opt) => {
    let score = 0;
    for (const trait of Object.keys(opt.traitScores) as TraitKey[]) {
      const value = opt.traitScores[trait] || 0;
      const userTrait = user.traitProfile[trait] || 50;
      const traitAlignment = (userTrait - 50) / 50;
      score += value * traitAlignment;
    }
    score += (Math.random() - 0.5) * 1.5;
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

function simulateUserFeedback(isExact: boolean, isSimilar: boolean): { feedback: 'exact' | 'close' | 'miss'; satisfaction: number } {
  if (isExact) {
    return { feedback: 'exact', satisfaction: Math.random() > 0.1 ? 5 : 4 };
  } else if (isSimilar) {
    const rand = Math.random();
    if (rand < 0.6) return { feedback: 'close', satisfaction: 4 };
    if (rand < 0.9) return { feedback: 'close', satisfaction: 3 };
    return { feedback: 'close', satisfaction: 2 };
  } else {
    const rand = Math.random();
    if (rand < 0.3) return { feedback: 'miss', satisfaction: 3 };
    if (rand < 0.7) return { feedback: 'miss', satisfaction: 2 };
    return { feedback: 'miss', satisfaction: 1 };
  }
}

function runUserTest(user: SimulatedUser): UserResult {
  let state = initializeEngineState();
  let questionsAnswered = 0;
  let currentQuestion = selectNextQuestion(state);

  while (currentQuestion && !shouldTerminate(state)) {
    questionsAnswered++;
    const selectedOption = selectOptionForUser(user, currentQuestion);
    state = processAnswer(state, currentQuestion, selectedOption);
    currentQuestion = selectNextQuestion(state);
  }

  const assignedArchetype = state.currentMatches[0]?.archetype || null;
  const confidence = state.currentMatches[0]?.confidence || 0;
  const isExactMatch = user.trueArchetype === assignedArchetype;
  const isSimilarMatch = isSimilarArchetype(user.trueArchetype, assignedArchetype);
  const { feedback, satisfaction } = simulateUserFeedback(isExactMatch, isSimilarMatch);

  return {
    user,
    assignedArchetype,
    confidence,
    questionsAnswered,
    isExactMatch,
    isSimilarMatch,
    simulatedFeedback: feedback,
    satisfactionScore: satisfaction,
  };
}

function calculateStats(results: UserResult[]): AggregateStats {
  const byArchetype: AggregateStats['byArchetype'] = {};
  const confusionMatrix: Record<string, Record<string, number>> = {};
  
  for (const arch of ARCHETYPES) {
    byArchetype[arch] = { total: 0, exact: 0, similar: 0, exactRate: 0, similarRate: 0 };
    confusionMatrix[arch] = {};
    for (const arch2 of ARCHETYPES) {
      confusionMatrix[arch][arch2] = 0;
    }
  }

  let exactMatches = 0;
  let similarMatches = 0;
  let totalQuestions = 0;
  let totalConfidence = 0;
  let totalSatisfaction = 0;
  const feedbackCounts = { satisfied: 0, neutral: 0, dissatisfied: 0 };

  for (const result of results) {
    const trueArch = result.user.trueArchetype;
    const assignedArch = result.assignedArchetype || 'unknown';
    
    byArchetype[trueArch].total++;
    if (result.isExactMatch) {
      exactMatches++;
      byArchetype[trueArch].exact++;
    }
    if (result.isSimilarMatch) {
      similarMatches++;
      byArchetype[trueArch].similar++;
    }
    
    if (confusionMatrix[trueArch] && assignedArch !== 'unknown') {
      confusionMatrix[trueArch][assignedArch] = (confusionMatrix[trueArch][assignedArch] || 0) + 1;
    }
    
    totalQuestions += result.questionsAnswered;
    totalConfidence += result.confidence;
    totalSatisfaction += result.satisfactionScore;
    
    if (result.satisfactionScore >= 4) feedbackCounts.satisfied++;
    else if (result.satisfactionScore >= 3) feedbackCounts.neutral++;
    else feedbackCounts.dissatisfied++;
  }

  for (const arch of ARCHETYPES) {
    const data = byArchetype[arch];
    if (data.total > 0) {
      data.exactRate = Math.round((data.exact / data.total) * 100);
      data.similarRate = Math.round((data.similar / data.total) * 100);
    }
  }

  return {
    totalUsers: results.length,
    exactMatches,
    similarMatches,
    misses: results.length - similarMatches,
    exactMatchRate: Math.round((exactMatches / results.length) * 100),
    similarMatchRate: Math.round((similarMatches / results.length) * 100),
    avgQuestionsAnswered: Math.round((totalQuestions / results.length) * 10) / 10,
    avgConfidence: Math.round((totalConfidence / results.length) * 100) / 100,
    satisfactionRate: Math.round((feedbackCounts.satisfied / results.length) * 100),
    byArchetype,
    confusionMatrix,
    userFeedbackSummary: feedbackCounts,
  };
}

function printReport(stats: AggregateStats) {
  console.log('\n' + '='.repeat(70));
  console.log('📊 1000用户大规模模拟测试报告');
  console.log('='.repeat(70));
  
  console.log('\n📈 整体准确度');
  console.log('-'.repeat(40));
  console.log(`   总用户数: ${stats.totalUsers}`);
  console.log(`   精确匹配: ${stats.exactMatches}/${stats.totalUsers} (${stats.exactMatchRate}%)`);
  console.log(`   相似匹配: ${stats.similarMatches}/${stats.totalUsers} (${stats.similarMatchRate}%)`);
  console.log(`   完全不匹配: ${stats.misses}/${stats.totalUsers} (${100 - stats.similarMatchRate}%)`);
  console.log(`   平均答题数: ${stats.avgQuestionsAnswered}`);
  console.log(`   平均置信度: ${stats.avgConfidence}`);
  
  console.log('\n😊 模拟用户反馈');
  console.log('-'.repeat(40));
  console.log(`   满意 (4-5分): ${stats.userFeedbackSummary.satisfied} (${Math.round(stats.userFeedbackSummary.satisfied / stats.totalUsers * 100)}%)`);
  console.log(`   一般 (3分): ${stats.userFeedbackSummary.neutral} (${Math.round(stats.userFeedbackSummary.neutral / stats.totalUsers * 100)}%)`);
  console.log(`   不满意 (1-2分): ${stats.userFeedbackSummary.dissatisfied} (${Math.round(stats.userFeedbackSummary.dissatisfied / stats.totalUsers * 100)}%)`);
  console.log(`   预估用户满意率: ${stats.satisfactionRate}%`);
  
  console.log('\n🎯 各原型准确度');
  console.log('-'.repeat(40));
  const sortedArchetypes = Object.entries(stats.byArchetype)
    .filter(([_, data]) => data.total > 0)
    .sort((a, b) => b[1].exactRate - a[1].exactRate);
  
  for (const [arch, data] of sortedArchetypes) {
    const icon = archetypePrototypes[arch]?.icon || '❓';
    console.log(`   ${icon} ${arch.padEnd(10)} | 样本:${String(data.total).padStart(3)} | 精确:${String(data.exactRate).padStart(3)}% | 相似:${String(data.similarRate).padStart(3)}%`);
  }
  
  console.log('\n🔀 主要混淆情况 (Top 10)');
  console.log('-'.repeat(40));
  const confusions: { from: string; to: string; count: number }[] = [];
  for (const [from, toMap] of Object.entries(stats.confusionMatrix)) {
    for (const [to, count] of Object.entries(toMap)) {
      if (from !== to && count > 0) {
        confusions.push({ from, to, count });
      }
    }
  }
  confusions.sort((a, b) => b.count - a.count);
  
  for (const conf of confusions.slice(0, 10)) {
    const fromIcon = archetypePrototypes[conf.from]?.icon || '❓';
    const toIcon = archetypePrototypes[conf.to]?.icon || '❓';
    console.log(`   ${fromIcon} ${conf.from} → ${toIcon} ${conf.to}: ${conf.count}次`);
  }
  
  console.log('\n📋 结论');
  console.log('-'.repeat(40));
  if (stats.exactMatchRate >= 70) {
    console.log('   ✅ 精确匹配率达标 (≥70%)');
  } else {
    console.log(`   ⚠️ 精确匹配率未达标 (目标70%, 当前${stats.exactMatchRate}%)`);
  }
  if (stats.similarMatchRate >= 85) {
    console.log('   ✅ 相似匹配率达标 (≥85%)');
  } else {
    console.log(`   ⚠️ 相似匹配率未达标 (目标85%, 当前${stats.similarMatchRate}%)`);
  }
  if (stats.satisfactionRate >= 70) {
    console.log('   ✅ 用户满意率良好 (≥70%)');
  } else {
    console.log(`   ⚠️ 用户满意率需提升 (当前${stats.satisfactionRate}%)`);
  }
  
  console.log('\n' + '='.repeat(70));
}

async function main() {
  console.log('🚀 开始1000用户大规模模拟测试...\n');
  
  const users: SimulatedUser[] = [];
  for (let i = 1; i <= TOTAL_USERS; i++) {
    users.push(generateRandomUser(i));
  }
  
  console.log(`📋 已生成 ${users.length} 位模拟用户`);
  console.log('   每个原型约 ' + Math.round(TOTAL_USERS / ARCHETYPES.length) + ' 位用户\n');
  
  const results: UserResult[] = [];
  const startTime = Date.now();
  
  for (let i = 0; i < users.length; i++) {
    results.push(runUserTest(users[i]));
    
    if ((i + 1) % 100 === 0) {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = (i + 1) / elapsed;
      const remaining = (TOTAL_USERS - i - 1) / rate;
      console.log(`   已完成: ${i + 1}/${TOTAL_USERS} (${Math.round((i + 1) / TOTAL_USERS * 100)}%) - 预计剩余 ${Math.round(remaining)}秒`);
    }
  }
  
  const totalTime = (Date.now() - startTime) / 1000;
  console.log(`\n✅ 测试完成! 耗时: ${Math.round(totalTime)}秒`);
  
  const stats = calculateStats(results);
  printReport(stats);
}

main().catch(console.error);
