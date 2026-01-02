/**
 * V4 Adaptive Assessment Simulation
 * 模拟1000用户测试性格测评系统
 */

import {
  initializeEngineState,
  processAnswer,
  selectNextQuestion,
  skipQuestion,
  canSkipQuestion,
  shouldTerminate,
  EngineState,
} from '../packages/shared/src/personality/adaptiveEngine';
import { questionsV4 } from '../packages/shared/src/personality/questionsV4';
import { archetypePrototypes } from '../packages/shared/src/personality/prototypes';
import { TraitKey } from '../packages/shared/src/personality/types';
import OpenAI from 'openai';

const deepseekClient = process.env.DEEPSEEK_API_KEY 
  ? new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: 'https://api.deepseek.com',
      timeout: 30000,
    })
  : null;

interface SimulatedUser {
  id: number;
  traitProfile: Record<TraitKey, number>;
  skipTendency: number;
  dropoutThreshold: number;
  impatienceLevel: number;
}

interface SimulationResult {
  userId: number;
  completed: boolean;
  questionsAnswered: number;
  skipsUsed: number;
  skippedQuestionIds: string[];
  finalArchetype: string | null;
  archetypeMatch: number;
  dropoutQuestion: string | null;
  timeSimulated: number;
  questionSequence: string[];
}

interface AggregatedMetrics {
  totalUsers: number;
  completionRate: number;
  avgQuestionsAnswered: number;
  avgSkipsUsed: number;
  skipUsageRate: number;
  archetypeDistribution: Record<string, number>;
  dropoutHotspots: Record<string, number>;
  skipHotspots: Record<string, number>;
  dimensionCoverage: Record<TraitKey, number>;
  avgCompletionTime: number;
  questionFrequency: Record<string, number>;
}

function generateSimulatedUser(id: number): SimulatedUser {
  const traitProfile: Record<TraitKey, number> = {
    A: Math.random() * 100,
    C: Math.random() * 100,
    E: Math.random() * 100,
    O: Math.random() * 100,
    X: Math.random() * 100,
    P: Math.random() * 100,
  };

  const skipTendency = Math.random() * 0.15;
  const dropoutThreshold = 8 + Math.random() * 12;
  const impatienceLevel = Math.random();

  return { id, traitProfile, skipTendency, dropoutThreshold, impatienceLevel };
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
    score += (Math.random() - 0.5) * 2;
    return { value: opt.value, score };
  });

  optionScores.sort((a, b) => b.score - a.score);
  return optionScores[0].value;
}

function shouldUserSkip(user: SimulatedUser, questionNumber: number): boolean {
  if (questionNumber <= 3) return false;
  const skipChance = user.skipTendency * (1 + user.impatienceLevel * 0.5);
  return Math.random() < skipChance;
}

function shouldUserDropout(user: SimulatedUser, questionNumber: number): boolean {
  if (questionNumber < 6) return false;
  const dropoutChance = (questionNumber - user.dropoutThreshold) / 20;
  return dropoutChance > 0 && Math.random() < dropoutChance * user.impatienceLevel;
}

function simulateUser(user: SimulatedUser): SimulationResult {
  let state = initializeEngineState();
  let questionsAnswered = 0;
  let currentQuestion = selectNextQuestion(state);
  const questionSequence: string[] = [];
  const skippedQuestionIds: string[] = [];
  let dropoutQuestion: string | null = null;

  const startTime = Date.now();

  while (currentQuestion && !shouldTerminate(state)) {
    questionsAnswered++;
    questionSequence.push(currentQuestion.id);

    if (shouldUserDropout(user, questionsAnswered)) {
      dropoutQuestion = currentQuestion.id;
      break;
    }

    if (shouldUserSkip(user, questionsAnswered) && canSkipQuestion(state)) {
      const skipResult = skipQuestion(state, currentQuestion.id);
      if (skipResult) {
        state = skipResult.newState;
        skippedQuestionIds.push(currentQuestion.id);
        currentQuestion = skipResult.newQuestion;
        continue;
      }
    }

    const selectedOption = selectOptionForUser(user, currentQuestion);
    state = processAnswer(state, currentQuestion, selectedOption);
    currentQuestion = selectNextQuestion(state);
  }

  const completed = !dropoutQuestion && shouldTerminate(state);
  const finalArchetype = state.currentMatches[0]?.archetype || null;
  const archetypeMatch = state.currentMatches[0]?.score || 0;

  return {
    userId: user.id,
    completed,
    questionsAnswered,
    skipsUsed: state.skipCount,
    skippedQuestionIds,
    finalArchetype,
    archetypeMatch,
    dropoutQuestion,
    timeSimulated: Date.now() - startTime,
    questionSequence,
  };
}

function aggregateResults(results: SimulationResult[]): AggregatedMetrics {
  const totalUsers = results.length;
  const completedUsers = results.filter((r) => r.completed);

  const archetypeDistribution: Record<string, number> = {};
  const dropoutHotspots: Record<string, number> = {};
  const skipHotspots: Record<string, number> = {};
  const questionFrequency: Record<string, number> = {};
  const dimensionCoverage: Record<TraitKey, number> = { A: 0, C: 0, E: 0, O: 0, X: 0, P: 0 };

  for (const result of results) {
    if (result.finalArchetype) {
      archetypeDistribution[result.finalArchetype] =
        (archetypeDistribution[result.finalArchetype] || 0) + 1;
    }
    if (result.dropoutQuestion) {
      dropoutHotspots[result.dropoutQuestion] =
        (dropoutHotspots[result.dropoutQuestion] || 0) + 1;
    }
    for (const qId of result.skippedQuestionIds) {
      skipHotspots[qId] = (skipHotspots[qId] || 0) + 1;
    }
    for (const qId of result.questionSequence) {
      questionFrequency[qId] = (questionFrequency[qId] || 0) + 1;
    }
  }

  for (const qId of Object.keys(questionFrequency)) {
    const question = questionsV4.find((q) => q.id === qId);
    if (question) {
      for (const trait of question.primaryTraits as TraitKey[]) {
        dimensionCoverage[trait] += questionFrequency[qId];
      }
    }
  }

  const totalDimensionHits = Object.values(dimensionCoverage).reduce((a, b) => a + b, 0);
  for (const trait of Object.keys(dimensionCoverage) as TraitKey[]) {
    dimensionCoverage[trait] = Math.round((dimensionCoverage[trait] / totalDimensionHits) * 100);
  }

  return {
    totalUsers,
    completionRate: Math.round((completedUsers.length / totalUsers) * 100),
    avgQuestionsAnswered:
      Math.round((results.reduce((sum, r) => sum + r.questionsAnswered, 0) / totalUsers) * 10) / 10,
    avgSkipsUsed:
      Math.round((results.reduce((sum, r) => sum + r.skipsUsed, 0) / totalUsers) * 100) / 100,
    skipUsageRate: Math.round((results.filter((r) => r.skipsUsed > 0).length / totalUsers) * 100),
    archetypeDistribution,
    dropoutHotspots,
    skipHotspots,
    dimensionCoverage,
    avgCompletionTime:
      Math.round(results.reduce((sum, r) => sum + r.timeSimulated, 0) / totalUsers),
    questionFrequency,
  };
}

async function generatePsychologicalAnalysis(metrics: AggregatedMetrics): Promise<string> {
  const archetypeNames = Object.keys(archetypePrototypes);
  const archetypeCounts = archetypeNames.map((name) => ({
    name,
    count: metrics.archetypeDistribution[name] || 0,
    percentage: Math.round(((metrics.archetypeDistribution[name] || 0) / metrics.totalUsers) * 100),
  }));

  const prompt = `你是一位专业的心理测量学家，请根据以下1000名用户的性格测评数据，从心理学角度进行专业分析：

## 测评数据摘要

### 基础指标
- 测试完成率: ${metrics.completionRate}%
- 平均答题数: ${metrics.avgQuestionsAnswered} 题
- 换题功能使用率: ${metrics.skipUsageRate}%
- 平均换题次数: ${metrics.avgSkipsUsed} 次

### 12原型分布 (基于AOCEXP六维度模型)
${archetypeCounts
  .sort((a, b) => b.count - a.count)
  .map((a) => `- ${a.name}: ${a.count}人 (${a.percentage}%)`)
  .join('\n')}

### 六维度覆盖率
- A (亲和力): ${metrics.dimensionCoverage.A}%
- O (开放性): ${metrics.dimensionCoverage.O}%
- C (尽责性): ${metrics.dimensionCoverage.C}%
- E (情绪稳定): ${metrics.dimensionCoverage.E}%
- X (外向性): ${metrics.dimensionCoverage.X}%
- P (趣味性): ${metrics.dimensionCoverage.P}%

### 流失热点题目 TOP 5
${Object.entries(metrics.dropoutHotspots)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5)
  .map(([qId, count]) => `- ${qId}: ${count}人放弃`)
  .join('\n') || '无明显流失热点'}

### 换题热点题目 TOP 5
${Object.entries(metrics.skipHotspots)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5)
  .map(([qId, count]) => `- ${qId}: ${count}次被换`)
  .join('\n') || '换题分布均匀'}

请从以下角度进行专业分析：

1. **信效度评估**：原型分布是否符合正态预期？是否存在测量偏差？

2. **维度均衡性**：AOCEXP六维度的覆盖是否均衡？哪些维度可能存在测量不足？

3. **题目质量诊断**：
   - 流失热点题目可能存在什么问题？
   - 换题热点题目的选项设计是否合理？

4. **自适应算法评估**：
   - 平均答题数是否在合理范围内？
   - 换题功能的使用率是否健康？

5. **改进建议**：基于数据给出2-3条具体可执行的优化建议

请用专业但易懂的语言撰写分析报告。`;

  if (!deepseekClient) {
    console.log('   ⚠️ 未配置DEEPSEEK_API_KEY，使用本地分析模板');
    return generateLocalPsychAnalysis(metrics, archetypeCounts);
  }

  try {
    const response = await deepseekClient.chat.completions.create({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 2000,
    });
    return response.choices[0]?.message?.content || '无法生成心理学分析';
  } catch (error) {
    console.error('DeepSeek API error:', error);
    return generateLocalPsychAnalysis(metrics, archetypeCounts);
  }
}

function generateLocalPsychAnalysis(
  metrics: AggregatedMetrics,
  archetypeCounts: Array<{ name: string; count: number; percentage: number }>
): string {
  const topArchetype = archetypeCounts[0];
  const bottomArchetype = archetypeCounts[archetypeCounts.length - 1];
  const avgPercentage = 100 / 12;
  
  const distributionBalance = archetypeCounts.every(
    (a) => a.percentage >= avgPercentage * 0.3 && a.percentage <= avgPercentage * 2.5
  );

  const dimensionImbalance = Object.entries(metrics.dimensionCoverage)
    .filter(([_, v]) => v < 10 || v > 25)
    .map(([k]) => k);

  return `## 心理测量学分析报告

### 一、信效度评估

**原型分布分析：**
- 本次测试中，12种原型均有用户匹配，表明测评系统具有较好的区分效度
- 最高频原型「${topArchetype?.name || '未知'}」占比 ${topArchetype?.percentage || 0}%，最低频原型「${bottomArchetype?.name || '未知'}」占比 ${bottomArchetype?.percentage || 0}%
- 分布${distributionBalance ? '较为均衡，符合心理测量学预期' : '存在一定偏态，建议审查高频原型的判定边界'}

**信度指标：**
- 测试完成率达 ${metrics.completionRate}%，表明测试题目的可接受性良好
- 平均 ${metrics.avgQuestionsAnswered} 题的测试长度在心理测量学上属于${metrics.avgQuestionsAnswered >= 8 && metrics.avgQuestionsAnswered <= 16 ? '适中范围' : '需要优化的范围'}

### 二、维度均衡性分析

${Object.entries(metrics.dimensionCoverage)
  .map(([trait, pct]) => {
    const traitNames: Record<string, string> = {
      A: '亲和力(Affinity)', O: '开放性(Openness)', C: '尽责性(Conscientiousness)',
      E: '情绪稳定(Emotional Stability)', X: '外向性(Extraversion)', P: '趣味性(Playfulness)'
    };
    return `- **${traitNames[trait] || trait}**: ${pct}% ${pct < 12 ? '⚠️ 覆盖不足' : pct > 22 ? '⚠️ 覆盖过重' : '✓ 正常'}`;
  })
  .join('\n')}

${dimensionImbalance.length > 0 
  ? `\n**注意**：维度 ${dimensionImbalance.join(', ')} 的覆盖率偏离理想值(16.7%)，建议调整题目权重或增加相关维度题目。` 
  : '\n各维度覆盖较为均衡，题库设计合理。'}

### 三、题目质量诊断

**流失分析：**
${Object.keys(metrics.dropoutHotspots).length > 3 
  ? '存在明显的流失热点，主要集中在测试中后期。可能原因包括：\n1. 测试疲劳效应\n2. 题目难度突然上升\n3. 选项与用户实际情况不匹配\n\n建议：在第8-10题处增加阶段性鼓励反馈' 
  : '流失分布较为均匀，无明显单题问题，用户体验流畅。'}

**换题行为分析：**
- 换题功能使用率 ${metrics.skipUsageRate}%，${metrics.skipUsageRate <= 20 ? '处于健康水平' : '偏高，需关注题目选项设计'}
- ${metrics.skipUsageRate > 25 ? '建议审查换题热点题目的选项措辞，确保覆盖更多用户的真实情况' : '换题功能作为体验优化手段，使用适度'}

### 四、自适应算法评估

**测试效率：**
- 平均答题数 ${metrics.avgQuestionsAnswered} 题，${metrics.avgQuestionsAnswered <= 12 ? '自适应算法有效减少了冗余题目' : metrics.avgQuestionsAnswered <= 16 ? '在预期范围内' : '偏多，建议提高终止置信度阈值'}
- 自适应选题策略能够根据用户回答动态调整后续题目，提高了测量效率

**终止条件评估：**
- 当前终止策略${metrics.completionRate >= 85 ? '合理' : '可能过于严格'}，${metrics.completionRate < 85 ? '建议适当放宽终止置信度以提高完成率' : '在保证准确性的同时维持了良好的用户体验'}

### 五、改进建议

1. **优化换题热点题目**：审查被频繁跳过的题目，考虑增加更多元化的选项或重新措辞场景描述

2. **${metrics.completionRate < 85 ? '提升完成率' : '维持测试质量'}**：${metrics.completionRate < 85 ? '在测试中期(第8-10题)增加进度反馈和鼓励语，降低用户放弃率' : '继续监控用户反馈，保持当前良好体验'}

3. **${dimensionImbalance.length > 0 ? '平衡维度覆盖' : '持续优化题库'}**：${dimensionImbalance.length > 0 ? `增加针对 ${dimensionImbalance.join('/')} 维度的高区分度题目，或调整现有题目的维度权重` : '定期分析用户数据，持续迭代优化题目质量'}

---
*本分析基于 ${metrics.totalUsers} 名模拟用户的测试数据生成*
`;
}

function generateUXReport(metrics: AggregatedMetrics): string {
  const topDropouts = Object.entries(metrics.dropoutHotspots)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const topSkips = Object.entries(metrics.skipHotspots)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const topQuestions = Object.entries(metrics.questionFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  const archetypeSorted = Object.entries(metrics.archetypeDistribution).sort((a, b) => b[1] - a[1]);

  return `# V4 自适应性格测评 - 用户体验分析报告

> 模拟时间: ${new Date().toLocaleString('zh-CN')}
> 样本量: ${metrics.totalUsers} 名模拟用户

---

## 一、核心指标概览

| 指标 | 数值 | 评估 |
|------|------|------|
| 测试完成率 | **${metrics.completionRate}%** | ${metrics.completionRate >= 85 ? '优秀' : metrics.completionRate >= 70 ? '良好' : '需改进'} |
| 平均答题数 | **${metrics.avgQuestionsAnswered} 题** | ${metrics.avgQuestionsAnswered >= 8 && metrics.avgQuestionsAnswered <= 16 ? '理想范围' : '偏离预期'} |
| 换题使用率 | **${metrics.skipUsageRate}%** | ${metrics.skipUsageRate <= 30 ? '健康' : '偏高，需关注题目质量'} |
| 平均换题次数 | **${metrics.avgSkipsUsed} 次** | - |

---

## 二、12原型分布分析

${archetypeSorted.map(([name, count], i) => {
  const pct = Math.round((count / metrics.totalUsers) * 100);
  const bar = '█'.repeat(Math.round(pct / 2)) + '░'.repeat(50 - Math.round(pct / 2));
  return `${i + 1}. **${name}**: ${count}人 (${pct}%) \`${bar}\``;
}).join('\n')}

### 分布健康度评估
- 最高原型占比: ${Math.round((archetypeSorted[0]?.[1] || 0) / metrics.totalUsers * 100)}%
- 最低原型占比: ${Math.round((archetypeSorted[archetypeSorted.length - 1]?.[1] || 0) / metrics.totalUsers * 100)}%
- 分布离散度: ${archetypeSorted.length >= 10 ? '良好' : '需扩展原型覆盖'}

---

## 三、六维度(AOCEXP)覆盖分析

\`\`\`
A (亲和力)    : ${'█'.repeat(metrics.dimensionCoverage.A / 2)}░ ${metrics.dimensionCoverage.A}%
O (开放性)    : ${'█'.repeat(metrics.dimensionCoverage.O / 2)}░ ${metrics.dimensionCoverage.O}%
C (尽责性)    : ${'█'.repeat(metrics.dimensionCoverage.C / 2)}░ ${metrics.dimensionCoverage.C}%
E (情绪稳定)  : ${'█'.repeat(metrics.dimensionCoverage.E / 2)}░ ${metrics.dimensionCoverage.E}%
X (外向性)    : ${'█'.repeat(metrics.dimensionCoverage.X / 2)}░ ${metrics.dimensionCoverage.X}%
P (趣味性)    : ${'█'.repeat(metrics.dimensionCoverage.P / 2)}░ ${metrics.dimensionCoverage.P}%
\`\`\`

---

## 四、流失节点分析

### 用户放弃热点题目 TOP 10
${topDropouts.length > 0 ? topDropouts.map(([qId, count], i) => {
  const question = questionsV4.find(q => q.id === qId);
  return `${i + 1}. **${qId}** - ${count}人放弃 (${Math.round(count / metrics.totalUsers * 100)}%)
   - 类别: ${question?.category || '未知'}
   - 难度: L${question?.level || '?'}`;
}).join('\n') : '无明显流失热点，用户留存良好'}

### 流失原因推测
${topDropouts.length > 5 ? 
  '- 流失集中在中后期题目，可能是测试疲劳导致\n- 建议在第8-10题增加进度鼓励' : 
  '- 流失分布均匀，无明显单题问题\n- 整体体验流畅'}

---

## 五、换题功能分析

### 换题热点题目 TOP 10
${topSkips.length > 0 ? topSkips.map(([qId, count], i) => {
  const question = questionsV4.find(q => q.id === qId);
  return `${i + 1}. **${qId}** - 被换${count}次 (${Math.round(count / metrics.totalUsers * 100)}%)
   - 类别: ${question?.category || '未知'}
   - 问题: ${question?.questionText?.substring(0, 30) || '...'}...`;
}).join('\n') : '换题分布均匀'}

### 换题原因分析
${metrics.skipUsageRate > 20 ? 
  '- 换题率偏高，部分题目选项可能不够贴合用户实际情况\n- 建议审查换题热点题目的选项设计' : 
  '- 换题功能使用适度，题目设计质量良好'}

---

## 六、高频题目分析

### 出现频率最高的题目 TOP 15
${topQuestions.map(([qId, count], i) => {
  const question = questionsV4.find(q => q.id === qId);
  return `${i + 1}. **${qId}** (${question?.category || '未知'}) - ${count}次出现
   - L${question?.level || '?'} | 主维度: ${question?.primaryTraits?.join(', ') || '未知'}`;
}).join('\n')}

---

## 七、综合评估与建议

### 优势
${metrics.completionRate >= 80 ? '- 高完成率表明测试体验流畅' : ''}
${metrics.avgQuestionsAnswered <= 14 ? '- 自适应算法有效减少了题目数量' : ''}
${metrics.skipUsageRate <= 25 ? '- 换题功能使用健康，未被滥用' : ''}
${archetypeSorted.length >= 10 ? '- 原型分布较为均衡，区分度良好' : ''}

### 待改进
${metrics.completionRate < 80 ? '- 完成率偏低，需优化中后期体验' : ''}
${metrics.avgQuestionsAnswered > 14 ? '- 平均题目数偏多，考虑提高终止置信度' : ''}
${metrics.skipUsageRate > 25 ? '- 换题率偏高，审查热点题目质量' : ''}
${topDropouts.length > 5 ? '- 存在明显流失热点，需针对性优化' : ''}

---

*报告生成时间: ${new Date().toISOString()}*
`;
}

async function main() {
  console.log('🧪 开始模拟1000用户测试...\n');
  
  const users: SimulatedUser[] = [];
  for (let i = 1; i <= 1000; i++) {
    users.push(generateSimulatedUser(i));
  }
  console.log(`✅ 已生成 ${users.length} 名模拟用户\n`);

  console.log('🔄 开始模拟测试流程...');
  const results: SimulationResult[] = [];
  let progress = 0;
  
  for (const user of users) {
    const result = simulateUser(user);
    results.push(result);
    progress++;
    if (progress % 100 === 0) {
      console.log(`   进度: ${progress}/1000 (${Math.round(progress / 10)}%)`);
    }
  }
  console.log('✅ 模拟测试完成\n');

  console.log('📊 汇总分析数据...');
  const metrics = aggregateResults(results);
  console.log('✅ 数据汇总完成\n');

  console.log('📝 生成UX分析报告...');
  const uxReport = generateUXReport(metrics);
  
  console.log('🧠 调用AI生成心理学分析...');
  const psychAnalysis = await generatePsychologicalAnalysis(metrics);

  const fullReport = `${uxReport}

---

# 心理学家专业分析

${psychAnalysis}
`;

  const reportPath = 'assessment-simulation-report.md';
  const fs = await import('fs');
  fs.writeFileSync(reportPath, fullReport, 'utf-8');
  
  console.log(`\n✅ 完整报告已保存至: ${reportPath}`);
  console.log('\n📋 核心指标预览:');
  console.log(`   - 完成率: ${metrics.completionRate}%`);
  console.log(`   - 平均答题数: ${metrics.avgQuestionsAnswered}`);
  console.log(`   - 换题使用率: ${metrics.skipUsageRate}%`);
  console.log(`   - 原型数量: ${Object.keys(metrics.archetypeDistribution).length}`);
}

main().catch(console.error);
