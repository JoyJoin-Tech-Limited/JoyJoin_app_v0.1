/**
 * 心理学专家圆桌会议 - 评分系统改革方案讨论
 * 
 * 议程：
 * 1. 现有系统问题回顾
 * 2. 累加评分方案设计
 * 3. 特质映射修正优先级
 * 4. P(积极性)维度处理
 * 5. 最终共识方案
 */

import OpenAI from 'openai';

const deepseekClient = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
});

const EXPERTS = [
  { 
    name: "陈思远", 
    title: "临床心理学博士 / 北京大学心理系副教授",
    specialty: "人格心理学、心理测量学",
    style: "严谨、数据驱动、注重测量效度"
  },
  { 
    name: "林雅琪", 
    title: "社会心理学家 / 香港大学心理学系教授",
    specialty: "社会认知、态度测量",
    style: "注重社会效度、实用性导向"
  },
  { 
    name: "王建明", 
    title: "发展心理学家 / 清华大学积极心理学中心",
    specialty: "积极心理学、人格发展",
    style: "成长导向、强调可塑性"
  },
  { 
    name: "张晓华", 
    title: "跨文化心理学家 / 中山大学心理学系",
    specialty: "文化心理学、本土化心理学",
    style: "注重文化适切性、华人特色"
  },
  { 
    name: "刘心怡", 
    title: "心理咨询师 / 国家二级心理咨询师",
    specialty: "人际关系咨询、心理评估",
    style: "用户友好、关注心理安全"
  },
];

const CURRENT_SYSTEM = {
  questions: 12,
  dimensions: ['A(亲和力)', 'O(开放性)', 'C(责任心)', 'E(情绪稳定)', 'X(外向性)', 'P(积极性)'],
  archetypes: ['corgi', 'rooster', 'hamster_praise', 'fox', 'dolphin_calm', 'spider', 'koala', 'octopus', 'owl', 'elephant', 'turtle', 'cat'],
  currentFlow: "用户答题 → 每个答案映射到原型 → 累计最高分原型 → 使用该原型的固定6维分数显示雷达图",
  problems: [
    "所有同原型用户雷达图完全相同，无个体差异",
    "问题选项有6维特质分数，但未用于雷达图计算",
    "70/30主副原型混合只能产生有限变化",
    "评分逻辑50/100分(不及格)"
  ],
  traitMappingIssues: [
    { q: "Q10-B 探索达人", current: "A:3, E:1, X:1", issue: "描述核心是开放性(O)，但未给O分" },
    { q: "Q10-C 创意无限", current: "C:3, E:1", issue: "创意应是开放性(O)，而非责任心(C)" },
    { q: "Q5-D 沉默等待", current: "C:1, E:2, X:1", issue: "沉默是低外向性，给X正分方向错误" },
    { q: "Q9-D 彻底耗尽", current: "A:2, P:1", issue: "社交耗尽更关联情绪稳定性，非亲和力" },
    { q: "Q1-D 隐身观察", current: "C:1, E:1, P:1", issue: "观察行为更体现谨慎，非积极性" },
  ]
};

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getExpertOpinion(expert: typeof EXPERTS[0], topic: string, context: string): Promise<string> {
  const prompt = `你是${expert.name}，${expert.title}，专长于${expert.specialty}。
你的风格是：${expert.style}

当前讨论议题：${topic}

背景信息：
${context}

请以第一人称发表你的专业意见（100-150字），要有具体建议。`;

  try {
    const response = await deepseekClient.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: `你是${expert.name}，参与心理测试评分系统改革的专家讨论。请简洁、专业、有建设性。` },
        { role: 'user', content: prompt }
      ],
      temperature: 0.8,
      max_tokens: 300,
    });
    return response.choices[0]?.message?.content || '';
  } catch (error) {
    return `[${expert.name}发言获取失败]`;
  }
}

async function getConsensusProposal(): Promise<any> {
  const prompt = `作为5位心理学专家的会议主持人，请综合以下讨论结果，形成最终共识方案：

## 现有系统问题
${CURRENT_SYSTEM.problems.map((p, i) => `${i+1}. ${p}`).join('\n')}

## 专家一致意见
- 废除固定原型分数方法
- 改用累加评分计算6维雷达图
- 修正特质映射错误
- 重新审视P(积极性)维度

## 约束条件
- 测试时间不超过3分钟(12道题)
- 保留12原型动物系统作为结果呈现
- 雷达图需反映个体真实差异
- 系统需要对用户友好、正向激励

请输出JSON格式的完整改革方案：
{
  "scoringSystemReform": {
    "approach": "推荐的评分方法名称",
    "formula": "具体计算公式说明",
    "normalization": "归一化方法(如何转换为0-100分)",
    "archetypeIntegration": "如何保留原型系统同时实现个性化",
    "implementation": ["实施步骤1", "实施步骤2", "..."]
  },
  "traitMappingFixes": [
    {
      "questionId": "Q10-B",
      "optionText": "探索达人",
      "currentTraits": {"A": 3, "E": 1, "X": 1},
      "revisedTraits": {"O": 4, "X": 2},
      "rationale": "修改理由"
    }
  ],
  "positivityDimensionDecision": {
    "decision": "保留/修改/整合",
    "rationale": "理由",
    "implementation": "具体做法"
  },
  "qualityAssurance": {
    "validationMethod": "如何验证新系统效度",
    "userExperience": "如何确保用户体验",
    "psychologicalSafety": "如何保护用户心理安全"
  },
  "expectedImprovements": {
    "individualDifferentiation": "个体差异改善预期",
    "measurementValidity": "测量效度改善预期",
    "userSatisfaction": "用户满意度改善预期"
  },
  "riskMitigation": ["风险1及应对", "风险2及应对"],
  "implementationPriority": ["高优先级任务", "中优先级任务", "低优先级任务"]
}`;

  try {
    const response = await deepseekClient.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: '你是心理测量学专家组的主持人，负责综合多位专家意见形成可执行的改革方案。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.5,
      response_format: { type: 'json_object' },
    });
    return JSON.parse(response.choices[0]?.message?.content || '{}');
  } catch (error) {
    console.error('获取共识方案失败:', error);
    return {};
  }
}

async function runExpertPanel() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║        心理学专家圆桌会议 - 评分系统改革方案讨论                  ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  if (!process.env.DEEPSEEK_API_KEY) {
    console.error('错误: 未设置 DEEPSEEK_API_KEY');
    process.exit(1);
  }

  console.log('📋 会议背景：');
  console.log(`   现有系统: ${CURRENT_SYSTEM.questions}道题 → ${CURRENT_SYSTEM.archetypes.length}个原型 → 6维雷达图`);
  console.log(`   核心问题: ${CURRENT_SYSTEM.problems[0]}`);
  console.log(`   评分逻辑得分: 50/100 (不及格)\n`);

  console.log('👥 与会专家：');
  EXPERTS.forEach(e => console.log(`   - ${e.name} (${e.specialty})`));
  console.log('\n');

  // ========== 议题1: 累加评分方案 ==========
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('【议题一】累加评分方案设计');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const topic1Context = `
现有系统问题：用户答题后，根据答案映射到12个原型，取最高分原型，然后直接使用该原型的预设分数作为雷达图。
这导致所有"corgi"用户的雷达图都是：亲和90、开放80、责任65、情绪80、外向95、积极95。

每道题的选项其实已经有6维特质分数（如 A:2, X:4, P:1），但这些分数没有被用于最终雷达图计算。

请讨论：如何利用这些选项特质分数，设计一个累加评分系统，使雷达图真正反映个体差异？`;

  for (const expert of EXPERTS) {
    const opinion = await getExpertOpinion(expert, "累加评分方案设计", topic1Context);
    console.log(`【${expert.name}】(${expert.specialty})`);
    console.log(`   ${opinion.replace(/\n/g, '\n   ')}\n`);
    await delay(800);
  }

  // ========== 议题2: 特质映射修正 ==========
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('【议题二】特质映射修正优先级');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const topic2Context = `
专家评审发现以下特质映射问题：
${CURRENT_SYSTEM.traitMappingIssues.map(i => `- ${i.q}: 当前${i.current}，问题: ${i.issue}`).join('\n')}

请讨论：这些映射问题的严重程度排序，以及具体修正建议。`;

  for (const expert of EXPERTS) {
    const opinion = await getExpertOpinion(expert, "特质映射修正优先级", topic2Context);
    console.log(`【${expert.name}】`);
    console.log(`   ${opinion.replace(/\n/g, '\n   ')}\n`);
    await delay(800);
  }

  // ========== 议题3: P维度处理 ==========
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('【议题三】P(积极性)维度的处理');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const topic3Context = `
当前6维特质中，5维对应大五人格：
- A(亲和力) ↔ 宜人性
- O(开放性) ↔ 开放性  
- C(责任心) ↔ 尽责性
- E(情绪稳定) ↔ 情绪稳定性(反向神经质)
- X(外向性) ↔ 外向性

而P(积极性)是独创维度，被多位专家质疑：
- 可能与外向性(X)重叠
- 可能与情绪稳定(E)重叠
- 缺乏独立的理论支撑

请讨论：P维度应该保留、修改定义、还是整合到其他维度？`;

  for (const expert of EXPERTS) {
    const opinion = await getExpertOpinion(expert, "P(积极性)维度的处理", topic3Context);
    console.log(`【${expert.name}】`);
    console.log(`   ${opinion.replace(/\n/g, '\n   ')}\n`);
    await delay(800);
  }

  // ========== 议题4: 原型系统整合 ==========
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('【议题四】原型系统与个性化分数的整合');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const topic4Context = `
12原型动物系统是产品核心特色（corgi、rooster等），用户喜欢这种有趣的呈现方式。

但如果改用累加评分，每个用户的6维分数都不同，如何与原型系统结合？

可能的方案：
A) 先算6维分数，再用欧氏距离匹配最接近的原型
B) 保留原型判定逻辑，但雷达图用累加分数
C) 原型作为"主调"，累加分数作为"变奏"

请讨论：哪种整合方案最优？`;

  for (const expert of EXPERTS) {
    const opinion = await getExpertOpinion(expert, "原型系统与个性化分数的整合", topic4Context);
    console.log(`【${expert.name}】`);
    console.log(`   ${opinion.replace(/\n/g, '\n   ')}\n`);
    await delay(800);
  }

  // ========== 形成共识方案 ==========
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('【会议总结】形成专家共识方案');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log('正在综合各位专家意见，形成最终方案...\n');
  
  const consensus = await getConsensusProposal();

  console.log('┌────────────────────────────────────────────────────────────┐');
  console.log('│                    专家共识方案                              │');
  console.log('└────────────────────────────────────────────────────────────┘\n');

  // 评分系统改革
  if (consensus.scoringSystemReform) {
    const reform = consensus.scoringSystemReform;
    console.log('【一、评分系统改革】\n');
    console.log(`   方法: ${reform.approach}`);
    console.log(`   公式: ${reform.formula}`);
    console.log(`   归一化: ${reform.normalization}`);
    console.log(`   原型整合: ${reform.archetypeIntegration}`);
    console.log('\n   实施步骤:');
    reform.implementation?.forEach((step: string, i: number) => {
      console.log(`     ${i+1}. ${step}`);
    });
  }

  // 特质映射修正
  if (consensus.traitMappingFixes?.length > 0) {
    console.log('\n【二、特质映射修正】\n');
    consensus.traitMappingFixes.forEach((fix: any) => {
      console.log(`   ${fix.questionId} "${fix.optionText}"`);
      console.log(`     当前: ${JSON.stringify(fix.currentTraits)}`);
      console.log(`     修正: ${JSON.stringify(fix.revisedTraits)}`);
      console.log(`     理由: ${fix.rationale}\n`);
    });
  }

  // P维度决策
  if (consensus.positivityDimensionDecision) {
    const pDecision = consensus.positivityDimensionDecision;
    console.log('【三、P(积极性)维度决策】\n');
    console.log(`   决策: ${pDecision.decision}`);
    console.log(`   理由: ${pDecision.rationale}`);
    console.log(`   实施: ${pDecision.implementation}`);
  }

  // 质量保证
  if (consensus.qualityAssurance) {
    const qa = consensus.qualityAssurance;
    console.log('\n【四、质量保证措施】\n');
    console.log(`   效度验证: ${qa.validationMethod}`);
    console.log(`   用户体验: ${qa.userExperience}`);
    console.log(`   心理安全: ${qa.psychologicalSafety}`);
  }

  // 预期改善
  if (consensus.expectedImprovements) {
    const exp = consensus.expectedImprovements;
    console.log('\n【五、预期改善效果】\n');
    console.log(`   个体差异: ${exp.individualDifferentiation}`);
    console.log(`   测量效度: ${exp.measurementValidity}`);
    console.log(`   用户满意: ${exp.userSatisfaction}`);
  }

  // 实施优先级
  if (consensus.implementationPriority) {
    console.log('\n【六、实施优先级】\n');
    consensus.implementationPriority.forEach((task: string, i: number) => {
      const priority = i === 0 ? '🔴 高' : i === 1 ? '🟡 中' : '🟢 低';
      console.log(`   ${priority}: ${task}`);
    });
  }

  // 风险应对
  if (consensus.riskMitigation) {
    console.log('\n【七、风险与应对】\n');
    consensus.riskMitigation.forEach((risk: string, i: number) => {
      console.log(`   ${i+1}. ${risk}`);
    });
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('                    会议结束 - 方案已形成                        ');
  console.log('═══════════════════════════════════════════════════════════════\n');

  return consensus;
}

runExpertPanel().catch(console.error);
