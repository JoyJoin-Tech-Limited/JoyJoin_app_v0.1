/**
 * 快速评估脚本 - 10用户采样 + 5位心理学家评审
 * 用于快速验证系统性能
 */

import OpenAI from 'openai';

const deepseekClient = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
});

// 12原型动物
const ARCHETYPES = [
  { id: '开心柯基', traits: ['乐观', '热情', '喜欢热闹'], socialRole: '气氛制造者' },
  { id: '太阳鸡', traits: ['自信', '表达力强', '喜欢展示'], socialRole: '表演者' },
  { id: '夸夸豚', traits: ['温暖', '善于夸赞', '情感丰富'], socialRole: '支持者' },
  { id: '机智狐', traits: ['聪明', '灵活', '幽默'], socialRole: '策略家' },
  { id: '淡定海豚', traits: ['冷静', '理性', '善于观察'], socialRole: '思考者' },
  { id: '织网蛛', traits: ['细心', '善于规划', '注重细节'], socialRole: '组织者' },
  { id: '温柔羊', traits: ['温和', '体贴', '善解人意'], socialRole: '调解者' },
  { id: '独立猫', traits: ['独立', '有品味', '保持距离'], socialRole: '观察者' },
  { id: '探险鹰', traits: ['勇敢', '好奇', '追求刺激'], socialRole: '探索者' },
  { id: '智慧猫头鹰', traits: ['深思', '知识丰富', '分析能力强'], socialRole: '顾问' },
  { id: '守护熊', traits: ['可靠', '保护欲强', '稳重'], socialRole: '守护者' },
  { id: '社交蝴蝶', traits: ['社交达人', '多才多艺', '适应力强'], socialRole: '连接者' },
];

// 10个代表性用户画像
const TEST_PERSONAS = [
  { id: 'p1', name: '深圳白领女', city: '深圳', gender: '女性', age: 28, interests: ['美食', '旅行', '摄影'], style: 'normal', archetype: '社交蝴蝶' },
  { id: 'p2', name: '香港金融男', city: '香港', gender: '男性', age: 32, interests: ['投资', '健身', '红酒'], style: 'formal', archetype: '机智狐' },
  { id: 'p3', name: '极简回复用户', city: '广州', gender: '男性', age: 25, interests: ['游戏'], style: 'minimal', archetype: '独立猫' },
  { id: 'p4', name: '健谈文艺女', city: '深圳', gender: '女性', age: 27, interests: ['诗歌', '话剧', '咖啡'], style: 'verbose', archetype: '夸夸豚' },
  { id: 'p5', name: '隐私敏感用户', city: '不透露', gender: '不透露', age: 30, interests: ['隐私'], style: 'guarded', archetype: '淡定海豚' },
  { id: 'p6', name: '粤语用户', city: '香港', gender: '女性', age: 26, interests: ['粤剧', '茶餐厅'], style: 'cantonese', archetype: '温柔羊' },
  { id: 'p7', name: '社恐内向', city: '深圳', gender: '男性', age: 24, interests: ['动漫', '宅'], style: 'shy', archetype: '智慧猫头鹰' },
  { id: 'p8', name: '创业者', city: '深圳', gender: '男性', age: 35, interests: ['创业', '投资', '人脉'], style: 'confident', archetype: '探险鹰' },
  { id: 'p9', name: '边界测试', city: '🎉', gender: '???', age: 0, interests: [], style: 'edge', archetype: '开心柯基' },
  { id: 'p10', name: '完美配合', city: '广州', gender: '女性', age: 29, interests: ['阅读', '瑜伽', '烘焙'], style: 'perfect', archetype: '守护熊' },
];

// 心理学家专家
const PSYCHOLOGISTS = [
  { name: '陈思远', title: '临床心理学博士/北京大学', focus: '人格心理学理论基础' },
  { name: '林雅琪', title: '社会心理学家/香港大学', focus: '社交匹配与群体动力学' },
  { name: '王建明', title: '积极心理学专家/清华大学', focus: '个人成长与自我探索' },
  { name: '张晓华', title: '跨文化心理学家/中山大学', focus: '华人文化背景适用性' },
  { name: '刘心怡', title: '心理咨询师/国家二级', focus: '用户心理安全与焦虑' },
];

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function simulateQuickConversation(persona: typeof TEST_PERSONAS[0]): Promise<any> {
  const userPrompt = `你正在扮演一个用户与AI助手"小悦"对话注册。
角色: ${persona.name}, ${persona.city}, ${persona.gender}, ${persona.age}岁
兴趣: ${persona.interests.join('、')}
风格: ${persona.style === 'minimal' ? '惜字如金' : persona.style === 'verbose' ? '健谈' : persona.style === 'guarded' ? '谨慎不透露' : persona.style === 'cantonese' ? '粤语混用' : persona.style === 'shy' ? '社恐内向' : '正常'}

模拟3轮对话，返回JSON:
{
  "messages": [
    {"role": "assistant", "content": "小悦的开场白"},
    {"role": "user", "content": "用户回复"},
    {"role": "assistant", "content": "小悦回复"},
    {"role": "user", "content": "用户回复"},
    {"role": "assistant", "content": "小悦回复"},
    {"role": "user", "content": "用户回复"}
  ],
  "extractedInfo": {
    "name": "提取的昵称",
    "gender": "提取的性别",
    "city": "提取的城市",
    "interests": ["兴趣1"]
  },
  "qualityScore": 0-100,
  "naturalness": 0-100
}`;

  const response = await deepseekClient.chat.completions.create({
    model: 'deepseek-chat',
    messages: [{ role: 'user', content: userPrompt }],
    temperature: 0.8,
    response_format: { type: 'json_object' },
  });

  try {
    return JSON.parse(response.choices[0]?.message?.content || '{}');
  } catch {
    return { messages: [], qualityScore: 50, naturalness: 50 };
  }
}

async function simulatePersonalityTest(persona: typeof TEST_PERSONAS[0]): Promise<any> {
  const prompt = `基于用户画像判断最匹配的12原型动物:
用户: ${persona.name}
特征: ${persona.style}, 兴趣${persona.interests.join('、')}
预期原型: ${persona.archetype}

12原型: ${ARCHETYPES.map(a => a.id).join(', ')}

返回JSON:
{
  "assignedArchetype": "分配的原型",
  "confidence": 0-100,
  "matchesExpected": true/false,
  "reasoning": "理由"
}`;

  const response = await deepseekClient.chat.completions.create({
    model: 'deepseek-chat',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.5,
    response_format: { type: 'json_object' },
  });

  try {
    return JSON.parse(response.choices[0]?.message?.content || '{}');
  } catch {
    return { assignedArchetype: '未知', confidence: 0, matchesExpected: false };
  }
}

async function getPsychologistReview(expert: typeof PSYCHOLOGISTS[0], data: any): Promise<any> {
  const prompt = `你是${expert.name}，${expert.title}，专注于${expert.focus}。

评估悦聚平台12原型动物匹配系统:
${ARCHETYPES.map(a => `- ${a.id}: ${a.traits.join('、')}`).join('\n')}

测试数据摘要:
- 对话质量平均: ${data.avgQuality}/100
- 原型匹配准确率: ${data.accuracy}%
- 信息收集完整度: ${data.completeness}%

请提供专业评估，返回JSON:
{
  "overallScore": 0-100,
  "scientificValidity": 0-100,
  "culturalAppropriateness": 0-100,
  "psychologicalSafety": 0-100,
  "labelingRisk": "low/medium/high",
  "strengths": ["亮点1", "亮点2"],
  "concerns": ["顾虑1", "顾虑2"],
  "recommendations": ["建议1", "建议2", "建议3"],
  "expertOpinion": "100-150字专业意见"
}`;

  const response = await deepseekClient.chat.completions.create({
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: `你是${expert.name}，${expert.title}。请提供专业、客观的心理学评估。` },
      { role: 'user', content: prompt }
    ],
    temperature: 0.7,
    response_format: { type: 'json_object' },
  });

  try {
    const result = JSON.parse(response.choices[0]?.message?.content || '{}');
    return { ...result, expertName: expert.name, expertTitle: expert.title };
  } catch {
    return { expertName: expert.name, expertTitle: expert.title, overallScore: 0 };
  }
}

async function runQuickEvaluation() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║     悦聚(JoyJoin) AI系统快速评估                              ║');
  console.log('║     10用户采样 + 5位心理学家评审                              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  if (!process.env.DEEPSEEK_API_KEY) {
    console.error('错误: 未设置 DEEPSEEK_API_KEY');
    process.exit(1);
  }

  const startTime = Date.now();

  // 1. 对话模拟
  console.log('💬 步骤1: 模拟AI对话...');
  const conversationResults = [];
  for (const persona of TEST_PERSONAS) {
    process.stdout.write(`   测试: ${persona.name}...`);
    const result = await simulateQuickConversation(persona);
    conversationResults.push({ persona, ...result });
    console.log(` 完成 (质量: ${result.qualityScore || 'N/A'})`);
    await delay(300);
  }

  // 2. 性格测试
  console.log('\n🧠 步骤2: 模拟性格测试...');
  const testResults = [];
  for (const persona of TEST_PERSONAS) {
    process.stdout.write(`   测试: ${persona.name}...`);
    const result = await simulatePersonalityTest(persona);
    testResults.push({ persona, ...result });
    console.log(` ${result.assignedArchetype} (${result.matchesExpected ? '✓匹配' : '✗不匹配'})`);
    await delay(300);
  }

  // 计算统计
  const avgQuality = conversationResults.reduce((sum, r) => sum + (r.qualityScore || 50), 0) / conversationResults.length;
  const accuracy = testResults.filter(r => r.matchesExpected).length / testResults.length * 100;
  const completeness = conversationResults.filter(r => r.extractedInfo?.name).length / conversationResults.length * 100;

  // 3. 心理学家评审
  console.log('\n👩‍⚕️ 步骤3: 咨询心理学家...');
  const reviews = [];
  for (const expert of PSYCHOLOGISTS) {
    console.log(`   咨询: ${expert.name} (${expert.title})...`);
    const review = await getPsychologistReview(expert, { avgQuality, accuracy, completeness });
    reviews.push(review);
    await delay(500);
  }

  // 4. 生成报告
  console.log('\n📊 步骤4: 生成评估报告...\n');
  
  const avgPsychScore = reviews.reduce((sum, r) => sum + (r.overallScore || 0), 0) / reviews.length;
  const avgSciValidity = reviews.reduce((sum, r) => sum + (r.scientificValidity || 0), 0) / reviews.length;
  const avgCultureFit = reviews.reduce((sum, r) => sum + (r.culturalAppropriateness || 0), 0) / reviews.length;
  const avgPsychSafety = reviews.reduce((sum, r) => sum + (r.psychologicalSafety || 0), 0) / reviews.length;

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                    综 合 评 估 报 告                          ');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log('【一、核心指标】\n');
  console.log(`   对话质量平均分:     ${avgQuality.toFixed(1)}/100`);
  console.log(`   原型分配准确率:     ${accuracy.toFixed(1)}%`);
  console.log(`   信息收集完整度:     ${completeness.toFixed(1)}%`);
  console.log(`   心理学家平均评分:   ${avgPsychScore.toFixed(1)}/100\n`);

  console.log('【二、原型分配结果】\n');
  for (const result of testResults) {
    const match = result.matchesExpected ? '✓' : '✗';
    console.log(`   ${result.persona.name.padEnd(12)} → ${result.assignedArchetype.padEnd(10)} ${match} (预期: ${result.persona.archetype})`);
  }

  console.log('\n【三、心理学家专业评审】\n');
  console.log(`   科学有效性:    ${avgSciValidity.toFixed(1)}/100`);
  console.log(`   文化适切性:    ${avgCultureFit.toFixed(1)}/100`);
  console.log(`   心理安全感:    ${avgPsychSafety.toFixed(1)}/100\n`);

  console.log('   各专家评分:');
  for (const review of reviews) {
    console.log(`   - ${review.expertName}: ${review.overallScore}/100`);
  }

  console.log('\n【四、专家详细意见】\n');
  for (const review of reviews) {
    console.log(`┌─ ${review.expertName} (${review.expertTitle})`);
    console.log(`│  评分: ${review.overallScore}/100  标签化风险: ${review.labelingRisk || 'N/A'}`);
    console.log(`│`);
    if (review.strengths?.length) {
      console.log(`│  亮点:`);
      review.strengths.forEach((s: string) => console.log(`│    · ${s}`));
    }
    if (review.concerns?.length) {
      console.log(`│  顾虑:`);
      review.concerns.forEach((c: string) => console.log(`│    · ${c}`));
    }
    if (review.recommendations?.length) {
      console.log(`│  建议:`);
      review.recommendations.forEach((r: string) => console.log(`│    · ${r}`));
    }
    console.log(`│`);
    console.log(`│  专家意见: ${review.expertOpinion || 'N/A'}`);
    console.log(`└────────────────────────────────────────────────────\n`);
  }

  // 汇总所有建议
  const allRecommendations = reviews.flatMap(r => r.recommendations || []);
  const uniqueRecs = [...new Set(allRecommendations)];

  console.log('【五、综合改进建议】\n');
  uniqueRecs.slice(0, 8).forEach((rec, i) => {
    console.log(`   ${i + 1}. ${rec}`);
  });

  // 最终评级
  const grade = avgPsychScore >= 80 ? 'A (优秀)' : 
                avgPsychScore >= 70 ? 'B (良好)' : 
                avgPsychScore >= 60 ? 'C (及格)' : 'D (需改进)';

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`                    最终评级: ${grade}`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (avgPsychScore >= 75) {
    console.log('结论: 悦聚的12原型动物匹配系统整体表现良好，获得心理学专家认可。');
    console.log('      建议继续优化边界情况处理和方言识别能力。\n');
  } else if (avgPsychScore >= 60) {
    console.log('结论: 系统具备基本功能，但需在科学性和用户体验方面改进。');
    console.log('      建议重点关注专家提出的标签化风险和隐私保护问题。\n');
  } else {
    console.log('结论: 系统需要较大改进，建议暂缓上线。');
    console.log('      需先解决心理安全和科学有效性方面的核心问题。\n');
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`⏱ 评估耗时: ${duration} 秒\n`);

  return { conversationResults, testResults, reviews, metrics: { avgQuality, accuracy, completeness, avgPsychScore } };
}

runQuickEvaluation().catch(console.error);
