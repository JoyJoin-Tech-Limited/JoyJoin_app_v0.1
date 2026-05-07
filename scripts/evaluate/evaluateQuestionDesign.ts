/**
 * 性格测试问题设计 + 评分逻辑 心理学专家评审
 * 
 * 评审内容:
 * 1. 12道题目的设计质量
 * 2. 选项与6维特质的映射准确性
 * 3. 固定原型分数 vs 个人化分数的合理性
 * 4. 整体测量效度和信度评估
 */

import OpenAI from 'openai';

const deepseekClient = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
});

// ============ 完整题库数据 ============
const QUESTIONS = [
  {
    id: 1,
    category: "社交启动",
    scenario: "朋友生日聚会，你走进包厢，发现有5个人你都不认识...",
    question: "刚进门，你最自然的反应是？",
    options: [
      { text: "大声说「大家好！」用幽默开场让全场笑起来", traits: { A: 2, X: 4, P: 1 }, tag: "主动破冰" },
      { text: "找到寿星，让ta来帮你介绍认识大家", traits: { C: 1, E: 2 }, tag: "借力社交" },
      { text: "挨个问「你是怎么认识XX的」，建立人际连接", traits: { A: 3, X: 2 }, tag: "主动连接" },
      { text: "先找个角落坐下，用手机掩饰，默默观察", traits: { C: 1, E: 1, P: 1 }, tag: "隐身观察" },
    ],
  },
  {
    id: 2,
    category: "新鲜事物",
    scenario: "有人提到最近发现了一家超神秘的咖啡馆，藏在老洋房里...",
    question: "听到这个，你的第一反应是？",
    options: [
      { text: "「在哪里？我们现在就去！」立马拉人组队行动", traits: { O: 3, X: 2, P: 1 }, tag: "即刻行动" },
      { text: "「哇好棒！你发现的地方都好有品味！」热情夸赞", traits: { A: 1, O: 2 }, tag: "赞美肯定" },
      { text: "「我之前也去过类似的，那次的故事是...」分享经历", traits: { O: 1, X: 2 }, tag: "故事共鸣" },
      { text: "「这家店的定位是什么？为什么能火？」深挖原因", traits: { O: 2, C: 1 }, tag: "深度分析" },
    ],
  },
  {
    id: 3,
    category: "情绪支持",
    scenario: "聊着聊着，有人突然叹气说最近工作压力好大...",
    question: "你最自然的反应是？",
    options: [
      { text: "握住ta的手，说「我懂...」然后安静地深度倾听", traits: { A: 3, P: 1 }, tag: "深度共情" },
      { text: "「没事！一切都会好的！我们都支持你！」积极鼓励", traits: { A: 1, P: 4 }, tag: "阳光鼓励" },
      { text: "默默递纸巾，全程不说话，用眼神表达理解", traits: { A: 2, C: 1, E: 1, P: 1 }, tag: "无声陪伴" },
      { text: "等情绪稳定后，巧妙引入轻松话题转移注意力", traits: { A: 1, E: 2, X: 1 }, tag: "氛围调控" },
    ],
  },
  {
    id: 4,
    category: "想法表达",
    scenario: "大家在讨论：「如果能开一家梦想小店，你会开什么？」",
    question: "你的大脑会？",
    options: [
      { text: "「猫咖！书店！奶茶车！还有...」5秒内冒出10个点子", traits: { O: 3, P: 2 }, tag: "创意爆发" },
      { text: "「首先，目标客户是谁？核心竞争力是...」框架分析", traits: { C: 3, E: 1 }, tag: "逻辑拆解" },
      { text: "「嗯...让我想想」边想边组织语言，斟酌后才开口", traits: { C: 2, E: 1, P: 1 }, tag: "稳健思考" },
      { text: "「你们呢？我先听听大家的想法」", traits: { A: 1, O: 1, X: 1 }, tag: "倾听优先" },
    ],
  },
  {
    id: 5,
    category: "意见分歧",
    scenario: "点菜时，两个人为了吃火锅还是烧烤争起来了...",
    question: "你会？",
    options: [
      { text: "「哈哈哈！要不猜拳决定？输的请客！」搞笑化解", traits: { A: 2, E: 2, X: 1 }, tag: "幽默破冰" },
      { text: "分别私聊两人，协调出一个双方都能接受的方案", traits: { A: 2, E: 1, P: 1 }, tag: "私下调解" },
      { text: "「其实附近有家店两种都有！」找创意方案", traits: { A: 1, O: 2, P: 2 }, tag: "创意解法" },
      { text: "一言不发，低头玩手机，等他们自己聊完", traits: { C: 1, E: 2, X: 1 }, tag: "沉默等待" },
    ],
  },
  {
    id: 6,
    category: "贡献方式",
    scenario: "聚会需要有人负责订位、点菜、AA收钱...",
    question: "你通常会？",
    options: [
      { text: "「我来订位！交给我没问题！」主动承担组织者", traits: { C: 3, X: 2, P: 2 }, tag: "主动担当" },
      { text: "「需要帮忙喊一声～」愿意配合支持", traits: { A: 2, C: 1 }, tag: "配合支持" },
      { text: "默默把账单算好，等大家吃完发给大家", traits: { C: 2, E: 1, P: 1 }, tag: "细心执行" },
      { text: "「我负责活跃气氛就好啦！」贡献其他价值", traits: { X: 2, P: 3 }, tag: "气氛担当" },
    ],
  },
  {
    id: 7,
    category: "社交舒适区",
    scenario: "聚会进行到一半，你感觉最舒服的状态是...",
    question: "以下哪个最像你？",
    options: [
      { text: "站在C位带节奏，全场的笑点都是你制造的", traits: { X: 4, P: 3 }, tag: "全场焦点" },
      { text: "像太阳一样照顾每个人，确保没人被冷落", traits: { A: 2, O: 1 }, tag: "普照全场" },
      { text: "到处串场，和不同的人深聊，挖掘有趣信息", traits: { A: 1, E: 1, P: 1 }, tag: "探索挖掘" },
      { text: "找个舒服的角落，安静听大家聊，享受旁观", traits: { C: 1, E: 1, X: 1 }, tag: "边缘舒适" },
    ],
  },
  {
    id: 8,
    category: "深度话题",
    scenario: "有人聊到最近看的一部电影，说被某个情节感动哭了...",
    question: "你会怎么接话？",
    options: [
      { text: "「我也看了！那段真的太戳了...」热烈分享自己的感受", traits: { O: 3, X: 2 }, tag: "热情分享" },
      { text: "认真听ta讲完，追问细节和ta的感受", traits: { C: 2, E: 1, P: 1 }, tag: "专注倾听" },
      { text: "「是吗？我也想看！」记下来回头找", traits: { A: 1, O: 2 }, tag: "好奇记录" },
      { text: "默默听着，觉得电影这种东西看缘分", traits: { E: 1, X: 1, P: 2 }, tag: "随缘佛系" },
    ],
  },
  {
    id: 9,
    category: "聚会结束",
    scenario: "聚会结束回到家，你的状态是...",
    question: "以下哪个最像你？",
    options: [
      { text: "「累爆了但超爽！」躺床上还在回味今晚的高光时刻", traits: { X: 4, P: 3 }, tag: "累并快乐" },
      { text: "「好充实～」心满意足，感觉给了很多也收获了很多", traits: { E: 2, P: 2 }, tag: "温暖充实" },
      { text: "「还行吧」正常消耗，独处一会儿就能恢复", traits: { C: 1, E: 1, X: 1 }, tag: "平稳消耗" },
      { text: "「终于...」瘫在沙发上不想动，社交电量归零", traits: { A: 2, P: 1 }, tag: "彻底耗尽" },
    ],
  },
  {
    id: 10,
    category: "朋友评价",
    scenario: "有个新朋友问别人：「ta是什么样的人呀？」",
    question: "你猜朋友会怎么形容你？",
    options: [
      { text: "「人间小太阳，和ta在一起心情会变好！」", traits: { O: 1, X: 3, P: 3 }, tag: "温暖治愈" },
      { text: "「超会玩！总能带你发现新奇好玩的东西！」", traits: { A: 3, E: 1, X: 1 }, tag: "探索达人" },
      { text: "「脑洞王！创意源源不断，想法特别多！」", traits: { C: 3, E: 1 }, tag: "创意无限" },
      { text: "「超靠谱！关键时刻稳得一批！」", traits: { O: 3, C: 1 }, tag: "稳定可靠" },
    ],
  },
  {
    id: 11,
    category: "新尝试",
    scenario: "有人提议玩一个你完全没接触过的桌游/密室/剧本杀...",
    question: "你的第一反应是？",
    options: [
      { text: "「来来来！新游戏最好玩了！」眼睛放光", traits: { O: 3, X: 3, P: 1 }, tag: "即刻尝鲜" },
      { text: "「规则是什么？先讲清楚吧」想搞懂再开始", traits: { O: 1, C: 2 }, tag: "先懂再玩" },
      { text: "「你们玩过吗？带带我～」希望有人指导", traits: { A: 2, O: 1, P: 1 }, tag: "求带入门" },
      { text: "「我在旁边看你们玩也挺好的」保持距离", traits: { C: 2, X: 1 }, tag: "旁观为主" },
    ],
  },
  {
    id: 12,
    category: "变化应对",
    scenario: "计划好的餐厅临时订不到位，需要换地方...",
    question: "你的反应是？",
    options: [
      { text: "「太好了！说不定能发现更好吃的！」反而兴奋", traits: { O: 3, E: 1, P: 3 }, tag: "乐见变化" },
      { text: "「那我来查查附近有什么其他选择」立刻行动", traits: { A: 1, C: 2, X: 1 }, tag: "主动解决" },
      { text: "「随便啦，有吃的就行～」无所谓", traits: { A: 1, E: 2, P: 1 }, tag: "随遇而安" },
      { text: "「有点可惜...不过也没办法」接受现实", traits: { C: 1, E: 1, P: 1 }, tag: "接受调整" },
    ],
  },
];

// ============ 12原型预设分数 ============
const ARCHETYPE_SCORES = {
  "corgi": { affinity: 90, openness: 80, conscientiousness: 65, emotionalStability: 80, extraversion: 95, positivity: 95 },
  "rooster": { affinity: 90, openness: 70, conscientiousness: 80, emotionalStability: 95, extraversion: 85, positivity: 95 },
  "hamster_praise": { affinity: 95, openness: 75, conscientiousness: 70, emotionalStability: 85, extraversion: 85, positivity: 95 },
  "fox": { affinity: 70, openness: 95, conscientiousness: 65, emotionalStability: 75, extraversion: 85, positivity: 80 },
  "dolphin_calm": { affinity: 85, openness: 80, conscientiousness: 85, emotionalStability: 90, extraversion: 70, positivity: 85 },
  "spider": { affinity: 90, openness: 85, conscientiousness: 85, emotionalStability: 80, extraversion: 70, positivity: 75 },
  "koala": { affinity: 95, openness: 75, conscientiousness: 80, emotionalStability: 90, extraversion: 65, positivity: 85 },
  "octopus": { affinity: 65, openness: 95, conscientiousness: 60, emotionalStability: 65, extraversion: 70, positivity: 80 },
  "owl": { affinity: 60, openness: 90, conscientiousness: 90, emotionalStability: 85, extraversion: 50, positivity: 65 },
  "elephant": { affinity: 85, openness: 65, conscientiousness: 95, emotionalStability: 95, extraversion: 45, positivity: 75 },
  "turtle": { affinity: 55, openness: 80, conscientiousness: 90, emotionalStability: 90, extraversion: 35, positivity: 60 },
  "cat": { affinity: 60, openness: 55, conscientiousness: 70, emotionalStability: 85, extraversion: 30, positivity: 65 },
};

// ============ 6维特质定义 ============
const TRAIT_DEFINITIONS = {
  A: { name: "亲和力 (Affinity)", description: "善于与他人建立联系、友好、体贴、关心他人的程度", bigFive: "宜人性 (Agreeableness)" },
  O: { name: "开放性 (Openness)", description: "好奇心、愿意尝试新事物、富有想象力的程度", bigFive: "开放性 (Openness)" },
  C: { name: "责任心 (Conscientiousness)", description: "可靠性、组织性、责任感、谨慎性的程度", bigFive: "尽责性 (Conscientiousness)" },
  E: { name: "情绪稳定 (Emotional Stability)", description: "情绪波动小、冷静、抗压能力的程度", bigFive: "情绪稳定性 (反向神经质)" },
  X: { name: "外向性 (Extraversion)", description: "社交活跃、精力充沛、喜欢与人互动的程度", bigFive: "外向性 (Extraversion)" },
  P: { name: "积极性 (Positivity)", description: "乐观、热情、充满正能量的程度", bigFive: "无直接对应，独创维度" },
};

// ============ 心理学专家定义 ============
const PSYCHOLOGISTS = [
  { 
    name: "陈思远", 
    title: "临床心理学博士 / 北京大学心理系副教授",
    specialty: "人格心理学、心理测量学",
    focus: "评估问题设计的测量效度，特质评分的心理学准确性"
  },
  { 
    name: "林雅琪", 
    title: "社会心理学家 / 香港大学心理学系教授",
    specialty: "社会认知、态度测量",
    focus: "评估问题情境的社会效度，选项是否反映真实社交行为"
  },
  { 
    name: "王建明", 
    title: "发展心理学家 / 清华大学积极心理学中心",
    specialty: "积极心理学、人格发展",
    focus: "评估问题是否促进自我认知，固定分数是否限制个人成长"
  },
  { 
    name: "张晓华", 
    title: "跨文化心理学家 / 中山大学心理学系",
    specialty: "文化心理学、本土化心理学",
    focus: "评估问题在华人文化背景下的适切性，情境是否符合港深生活"
  },
  { 
    name: "刘心怡", 
    title: "心理咨询师 / 国家二级心理咨询师",
    specialty: "人际关系咨询、心理评估",
    focus: "评估问题是否会引发焦虑，评分结果是否对用户友好"
  },
];

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getExpertReview(expert: typeof PSYCHOLOGISTS[0]): Promise<any> {
  const questionsText = QUESTIONS.map((q, i) => {
    const optionsText = q.options.map((opt, j) => 
      `    ${String.fromCharCode(65 + j)}. "${opt.text}" [${opt.tag}]\n       → 特质分数: ${JSON.stringify(opt.traits)}`
    ).join('\n');
    return `
【问题${q.id}】类别: ${q.category}
情境: ${q.scenario}
问题: ${q.question}
选项:
${optionsText}`;
  }).join('\n');

  const archetypeText = Object.entries(ARCHETYPE_SCORES).map(([name, scores]) => 
    `  ${name}: 亲和${scores.affinity} 开放${scores.openness} 责任${scores.conscientiousness} 情绪${scores.emotionalStability} 外向${scores.extraversion} 积极${scores.positivity}`
  ).join('\n');

  const traitText = Object.entries(TRAIT_DEFINITIONS).map(([key, def]) =>
    `  ${key}: ${def.name} - ${def.description}\n     对应大五: ${def.bigFive}`
  ).join('\n');

  const prompt = `你是${expert.name}，${expert.title}，专长于${expert.specialty}。

请从专业心理学角度评审以下性格测试系统的问题设计和评分逻辑。

## 你的评审重点
${expert.focus}

## 六维特质定义
${traitText}

## 完整题库（12道题）
${questionsText}

## 12原型预设分数
评分机制: 用户答题 → 匹配原型 → 使用该原型的固定分数显示雷达图
${archetypeText}

## 关键问题
1. 问题设计是否能准确测量对应的特质？
2. 选项的特质评分（如 A:2, X:4）是否合理？
3. "固定原型分数"方法是否科学？（所有同原型用户雷达图相同）
4. 6维特质与大五人格的映射是否准确？

请返回JSON格式的专业评审：
{
  "overallScore": 0-100,
  "questionDesignScore": 0-100,
  "traitMappingScore": 0-100,
  "scoringLogicScore": 0-100,
  "bigFiveAlignmentScore": 0-100,
  "questionByQuestionReview": [
    {
      "questionId": 1,
      "score": 0-100,
      "issues": ["问题1", "问题2"],
      "suggestions": ["建议1"]
    }
  ],
  "scoringMechanismReview": {
    "fixedScoreApproach": "支持/反对/中立",
    "reasoning": "理由",
    "alternative": "替代方案建议"
  },
  "traitMappingIssues": [
    {
      "questionId": 1,
      "optionIndex": 0,
      "currentTraits": {"A": 2, "X": 4},
      "suggestedTraits": {"A": 3, "X": 3},
      "reason": "修改理由"
    }
  ],
  "topStrengths": ["亮点1", "亮点2", "亮点3"],
  "topConcerns": ["问题1", "问题2", "问题3"],
  "priorityRecommendations": ["建议1", "建议2", "建议3"],
  "expertOpinion": "200字专业总评"
}`;

  try {
    const response = await deepseekClient.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: `你是${expert.name}，${expert.title}。请提供专业、严谨、有建设性的心理学评估。` },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    const result = JSON.parse(response.choices[0]?.message?.content || '{}');
    return { expertName: expert.name, expertTitle: expert.title, ...result };
  } catch (error) {
    console.error(`Error getting review from ${expert.name}:`, error);
    return { expertName: expert.name, expertTitle: expert.title, error: 'Failed to get review' };
  }
}

async function runQuestionDesignEvaluation() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║     性格测试问题设计 + 评分逻辑 心理学专家评审                 ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  if (!process.env.DEEPSEEK_API_KEY) {
    console.error('错误: 未设置 DEEPSEEK_API_KEY');
    process.exit(1);
  }

  const startTime = Date.now();
  const reviews: any[] = [];

  console.log('📋 评审内容:');
  console.log(`   - ${QUESTIONS.length} 道性格测试题目`);
  console.log(`   - ${Object.keys(ARCHETYPE_SCORES).length} 个原型预设分数`);
  console.log(`   - ${Object.keys(TRAIT_DEFINITIONS).length} 个特质维度\n`);

  console.log('👩‍⚕️ 咨询心理学专家...\n');
  
  for (const expert of PSYCHOLOGISTS) {
    console.log(`   咨询: ${expert.name} (${expert.specialty})...`);
    const review = await getExpertReview(expert);
    reviews.push(review);
    await delay(1000);
  }

  // 计算平均分
  const avgOverall = reviews.reduce((sum, r) => sum + (r.overallScore || 0), 0) / reviews.length;
  const avgQuestionDesign = reviews.reduce((sum, r) => sum + (r.questionDesignScore || 0), 0) / reviews.length;
  const avgTraitMapping = reviews.reduce((sum, r) => sum + (r.traitMappingScore || 0), 0) / reviews.length;
  const avgScoringLogic = reviews.reduce((sum, r) => sum + (r.scoringLogicScore || 0), 0) / reviews.length;
  const avgBigFive = reviews.reduce((sum, r) => sum + (r.bigFiveAlignmentScore || 0), 0) / reviews.length;

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('                    问题设计评审报告                            ');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log('【一、综合评分】\n');
  console.log(`   总体评分:        ${avgOverall.toFixed(1)}/100`);
  console.log(`   问题设计质量:    ${avgQuestionDesign.toFixed(1)}/100`);
  console.log(`   特质映射准确性:  ${avgTraitMapping.toFixed(1)}/100`);
  console.log(`   评分逻辑合理性:  ${avgScoringLogic.toFixed(1)}/100`);
  console.log(`   大五人格对齐度:  ${avgBigFive.toFixed(1)}/100\n`);

  console.log('【二、各专家评分】\n');
  for (const review of reviews) {
    console.log(`   ${review.expertName}: 总分${review.overallScore}/100 | 问题${review.questionDesignScore} | 映射${review.traitMappingScore} | 逻辑${review.scoringLogicScore}`);
  }

  console.log('\n【三、固定原型分数机制评审】\n');
  for (const review of reviews) {
    const mechanism = review.scoringMechanismReview || {};
    console.log(`   ${review.expertName}: ${mechanism.fixedScoreApproach || 'N/A'}`);
    if (mechanism.reasoning) {
      console.log(`      理由: ${mechanism.reasoning.substring(0, 80)}...`);
    }
  }

  console.log('\n【四、问题级别分析】\n');
  
  // 汇总每道题的评分
  const questionScores: Record<number, number[]> = {};
  for (const review of reviews) {
    const qReviews = review.questionByQuestionReview || [];
    for (const qr of qReviews) {
      if (!questionScores[qr.questionId]) questionScores[qr.questionId] = [];
      questionScores[qr.questionId].push(qr.score || 0);
    }
  }

  for (const [qId, scores] of Object.entries(questionScores)) {
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const q = QUESTIONS.find(q => q.id === parseInt(qId));
    const status = avg >= 80 ? '✓' : avg >= 60 ? '⚠' : '✗';
    console.log(`   问题${qId} [${q?.category}]: ${avg.toFixed(0)}/100 ${status}`);
  }

  console.log('\n【五、特质映射问题汇总】\n');
  const allMappingIssues: any[] = [];
  for (const review of reviews) {
    const issues = review.traitMappingIssues || [];
    allMappingIssues.push(...issues);
  }
  
  if (allMappingIssues.length > 0) {
    const issuesByQuestion = allMappingIssues.reduce((acc, issue) => {
      const key = `Q${issue.questionId}-${String.fromCharCode(65 + issue.optionIndex)}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(issue);
      return acc;
    }, {} as Record<string, any[]>);

    for (const [key, issues] of Object.entries(issuesByQuestion).slice(0, 10)) {
      console.log(`   ${key}: ${issues.length}位专家建议修改`);
      if (issues[0].reason) {
        console.log(`      理由: ${issues[0].reason.substring(0, 60)}...`);
      }
    }
  } else {
    console.log('   未发现需要修改的特质映射');
  }

  console.log('\n【六、专家详细意见】\n');
  for (const review of reviews) {
    console.log(`┌─ ${review.expertName} (${review.expertTitle})`);
    console.log(`│  总分: ${review.overallScore}/100`);
    console.log(`│`);
    if (review.topStrengths?.length) {
      console.log(`│  亮点:`);
      review.topStrengths.slice(0, 3).forEach((s: string) => console.log(`│    + ${s}`));
    }
    if (review.topConcerns?.length) {
      console.log(`│  问题:`);
      review.topConcerns.slice(0, 3).forEach((c: string) => console.log(`│    - ${c}`));
    }
    if (review.priorityRecommendations?.length) {
      console.log(`│  建议:`);
      review.priorityRecommendations.slice(0, 3).forEach((r: string) => console.log(`│    → ${r}`));
    }
    console.log(`│`);
    console.log(`│  专家意见: ${(review.expertOpinion || 'N/A').substring(0, 150)}...`);
    console.log(`└────────────────────────────────────────────────────\n`);
  }

  // 汇总所有建议
  const allRecommendations = reviews.flatMap(r => r.priorityRecommendations || []);
  const uniqueRecs = [...new Set(allRecommendations)];

  console.log('【七、综合改进建议】\n');
  uniqueRecs.slice(0, 10).forEach((rec, i) => {
    console.log(`   ${i + 1}. ${rec}`);
  });

  // 最终评级
  const grade = avgOverall >= 80 ? 'A (优秀)' : 
                avgOverall >= 70 ? 'B (良好)' : 
                avgOverall >= 60 ? 'C (及格)' : 'D (需改进)';

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`                    评审等级: ${grade}`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`⏱ 评审耗时: ${duration} 秒\n`);

  return { reviews, metrics: { avgOverall, avgQuestionDesign, avgTraitMapping, avgScoringLogic, avgBigFive } };
}

runQuestionDesignEvaluation().catch(console.error);
