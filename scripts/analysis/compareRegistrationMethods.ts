/**
 * 小悦对话注册 vs 传统问卷对比测试
 * 评估两种注册方式在不同用户画像下的表现
 */

import OpenAI from 'openai';

const deepseekClient = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
});

// ============ 用户画像定义 ============
interface UserPersona {
  id: string;
  name: string;
  category: string;
  truthData: {
    displayName: string;
    gender: string;
    birthYear: number;
    currentCity: string;
    interests: string[];
    occupation?: string;
  };
  behaviorStyle: {
    verbosity: 'minimal' | 'normal' | 'verbose';
    privacyLevel: 'open' | 'selective' | 'guarded';
    responseSpeed: 'quick' | 'thoughtful';
    language: 'formal' | 'casual' | 'mixed';
  };
  specialTraits: string[];
}

// 选择有代表性的10个用户画像进行对比测试
const TEST_PERSONAS: UserPersona[] = [
  // 标准用户
  { id: 'std-1', name: '深圳白领女', category: '标准', truthData: { displayName: '小雨', gender: '女性', birthYear: 1995, currentCity: '深圳', interests: ['美食', '旅行', '摄影'] }, behaviorStyle: { verbosity: 'normal', privacyLevel: 'open', responseSpeed: 'quick', language: 'casual' }, specialTraits: [] },
  { id: 'std-4', name: '深圳科技男', category: '标准', truthData: { displayName: '阿明', gender: '男性', birthYear: 1992, currentCity: '深圳', interests: ['编程', '游戏', '数码'] }, behaviorStyle: { verbosity: 'minimal', privacyLevel: 'selective', responseSpeed: 'quick', language: 'casual' }, specialTraits: [] },
  
  // 极简用户
  { id: 'min-1', name: '惜字如金男', category: '极简', truthData: { displayName: '阿杰', gender: '男性', birthYear: 1996, currentCity: '深圳', interests: ['篮球', '音乐'] }, behaviorStyle: { verbosity: 'minimal', privacyLevel: 'selective', responseSpeed: 'quick', language: 'casual' }, specialTraits: ['一两个字回答'] },
  { id: 'min-3', name: '社恐内向男', category: '极简', truthData: { displayName: '小陈', gender: '男性', birthYear: 1997, currentCity: '广州', interests: ['游戏', '动漫'] }, behaviorStyle: { verbosity: 'minimal', privacyLevel: 'guarded', responseSpeed: 'thoughtful', language: 'casual' }, specialTraits: ['不愿多说'] },
  
  // 健谈用户
  { id: 'ver-1', name: '社交达人女', category: '健谈', truthData: { displayName: '晴天', gender: '女性', birthYear: 1994, currentCity: '深圳', interests: ['社交', '派对', '美妆', '购物', '旅行'] }, behaviorStyle: { verbosity: 'verbose', privacyLevel: 'open', responseSpeed: 'quick', language: 'casual' }, specialTraits: ['主动分享故事'] },
  { id: 'ver-3', name: '文艺青年女', category: '健谈', truthData: { displayName: '诗诗', gender: '女性', birthYear: 1997, currentCity: '广州', interests: ['诗歌', '话剧', '咖啡馆', '独立音乐'] }, behaviorStyle: { verbosity: 'verbose', privacyLevel: 'open', responseSpeed: 'thoughtful', language: 'formal' }, specialTraits: ['文艺表达'] },
  
  // 特殊用户
  { id: 'sp-1', name: '隐私敏感用户', category: '特殊', truthData: { displayName: '匿名', gender: '不透露', birthYear: 1990, currentCity: '不方便说', interests: ['隐私'] }, behaviorStyle: { verbosity: 'normal', privacyLevel: 'guarded', responseSpeed: 'thoughtful', language: 'formal' }, specialTraits: ['拒绝透露信息', '质疑数据用途'] },
  { id: 'sp-8', name: '负面情绪用户', category: '特殊', truthData: { displayName: '算了', gender: '女性', birthYear: 1991, currentCity: '深圳', interests: ['没什么'] }, behaviorStyle: { verbosity: 'minimal', privacyLevel: 'guarded', responseSpeed: 'thoughtful', language: 'casual' }, specialTraits: ['消极回应'] },
  
  // 边界用户
  { id: 'edge-9', name: '无兴趣用户', category: '边界', truthData: { displayName: '佛系', gender: '男性', birthYear: 1995, currentCity: '广州', interests: [] }, behaviorStyle: { verbosity: 'minimal', privacyLevel: 'selective', responseSpeed: 'thoughtful', language: 'casual' }, specialTraits: ['声称无爱好'] },
  { id: 'edge-10', name: '完美配合用户', category: '边界', truthData: { displayName: '模范用户', gender: '女性', birthYear: 1994, currentCity: '深圳', interests: ['配合', '友好', '积极'] }, behaviorStyle: { verbosity: 'normal', privacyLevel: 'open', responseSpeed: 'quick', language: 'casual' }, specialTraits: ['完美回答所有问题'] },
];

// ============ 传统问卷模拟 ============
interface FormResult {
  completed: boolean;
  abandoned: boolean;
  abandonReason?: string;
  fieldsCompleted: number;
  totalFields: number;
  dataQuality: 'high' | 'medium' | 'low';
  collectedData: {
    displayName?: string;
    gender?: string;
    birthYear?: number;
    currentCity?: string;
    interests?: string[];
  };
  timeSpentSeconds: number;
}

function simulateFormFilling(persona: UserPersona): FormResult {
  const startTime = Date.now();
  const result: FormResult = {
    completed: false,
    abandoned: false,
    fieldsCompleted: 0,
    totalFields: 5, // displayName, gender, birthYear, currentCity, interests
    dataQuality: 'high',
    collectedData: {},
    timeSpentSeconds: 0,
  };
  
  const { behaviorStyle, specialTraits, truthData, category } = persona;
  
  // 基于用户画像决定填写行为
  let abandonProbability = 0;
  let dataPoorQualityProbability = 0;
  
  // 隐私敏感用户
  if (behaviorStyle.privacyLevel === 'guarded') {
    abandonProbability += 0.3;
    dataPoorQualityProbability += 0.2;
  }
  
  // 极简用户
  if (behaviorStyle.verbosity === 'minimal') {
    abandonProbability += 0.15;
    dataPoorQualityProbability += 0.3;
  }
  
  // 特殊特征
  if (specialTraits.includes('拒绝透露信息')) {
    abandonProbability += 0.4;
  }
  if (specialTraits.includes('消极回应')) {
    abandonProbability += 0.25;
  }
  if (specialTraits.includes('敷衍态度')) {
    dataPoorQualityProbability += 0.5;
  }
  if (specialTraits.includes('不愿多说')) {
    abandonProbability += 0.2;
  }
  
  // 健谈用户完成度高
  if (behaviorStyle.verbosity === 'verbose' && behaviorStyle.privacyLevel === 'open') {
    abandonProbability = Math.max(0, abandonProbability - 0.3);
    dataPoorQualityProbability = Math.max(0, dataPoorQualityProbability - 0.2);
  }
  
  // 随机决定是否放弃
  if (Math.random() < abandonProbability) {
    result.abandoned = true;
    result.abandonReason = getAbandonReason(persona);
    result.fieldsCompleted = Math.floor(Math.random() * 3);
    result.timeSpentSeconds = Math.floor(Math.random() * 60) + 10;
    return result;
  }
  
  // 模拟填写各字段
  // 昵称 - 几乎所有人都会填
  if (truthData.displayName && truthData.displayName.length > 0) {
    result.collectedData.displayName = truthData.displayName;
    result.fieldsCompleted++;
  } else {
    result.collectedData.displayName = '用户' + Math.floor(Math.random() * 10000);
    result.fieldsCompleted++;
  }
  
  // 性别 - 隐私敏感用户可能跳过
  if (behaviorStyle.privacyLevel !== 'guarded' || Math.random() > 0.3) {
    result.collectedData.gender = truthData.gender || '不透露';
    result.fieldsCompleted++;
  }
  
  // 年龄 - 传统问卷的痛点，隐私敏感用户经常跳过
  const ageSkipProbability = behaviorStyle.privacyLevel === 'guarded' ? 0.5 : 
                             behaviorStyle.privacyLevel === 'selective' ? 0.2 : 0.05;
  if (Math.random() > ageSkipProbability) {
    result.collectedData.birthYear = truthData.birthYear;
    result.fieldsCompleted++;
  }
  
  // 城市 - 大多数人会填
  if (truthData.currentCity && !truthData.currentCity.includes('不方便')) {
    result.collectedData.currentCity = truthData.currentCity;
    result.fieldsCompleted++;
  }
  
  // 兴趣 - 极简用户可能敷衍
  if (behaviorStyle.verbosity === 'minimal' && Math.random() < 0.4) {
    result.collectedData.interests = ['其他'];
    result.fieldsCompleted++;
    result.dataQuality = 'low';
  } else if (truthData.interests.length > 0) {
    result.collectedData.interests = truthData.interests.slice(0, 3);
    result.fieldsCompleted++;
  } else {
    // 无兴趣用户
    result.collectedData.interests = [];
  }
  
  // 判断数据质量
  if (Math.random() < dataPoorQualityProbability) {
    result.dataQuality = 'low';
  } else if (result.fieldsCompleted < 4) {
    result.dataQuality = 'medium';
  }
  
  // 判断是否完成 (需要至少4个字段)
  result.completed = result.fieldsCompleted >= 4;
  result.timeSpentSeconds = behaviorStyle.verbosity === 'verbose' ? 
    Math.floor(Math.random() * 60) + 90 : 
    Math.floor(Math.random() * 45) + 30;
  
  return result;
}

function getAbandonReason(persona: UserPersona): string {
  if (persona.specialTraits.includes('拒绝透露信息')) return '不愿透露隐私信息';
  if (persona.specialTraits.includes('消极回应')) return '失去兴趣';
  if (persona.behaviorStyle.verbosity === 'minimal') return '问题太多，嫌麻烦';
  if (persona.behaviorStyle.privacyLevel === 'guarded') return '担心信息安全';
  return '中途放弃';
}

// ============ 小悦对话模拟 ============
interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const XIAOYUE_SYSTEM_PROMPT = `你是"小悦"，JoyJoin平台的AI社交助手。你的任务是通过轻松愉快的对话，帮助新用户完成注册信息收集。

## 你的人设
- 性格：温暖、俏皮、略带调侃但不过分，像一个活泼开朗的闺蜜/好哥们
- 说话风格：口语化、接地气，偶尔用emoji但不过度

## 需要收集的信息
1. 昵称、2. 性别、3. 年龄/年龄段、4. 城市、5. 兴趣(2-3个)

## 极简用户引导
如果用户回复简短，主动提供选项：A/B/C/D选择

## 输出格式
回复后用标记包裹收集到的JSON：
\`\`\`collected_info
{"field": "value"}
\`\`\`

收集完5项必填信息后加入：
\`\`\`registration_complete
true
\`\`\``;

const XIAOYUE_OPENING = `嘿～欢迎来到JoyJoin！我是小悦，你的社交向导 ✨

在这里，我们会帮你找到志同道合的小伙伴！

我先来认识一下你吧～你希望大家怎么称呼你呀？`;

async function generateUserResponse(
  persona: UserPersona,
  xiaoyueMessage: string,
  turnNumber: number
): Promise<string> {
  const personaPrompt = `你正在扮演一个用户与"小悦"进行注册对话。

## 角色设定
- 昵称: ${persona.truthData.displayName}
- 性别: ${persona.truthData.gender}
- 出生年份: ${persona.truthData.birthYear}
- 城市: ${persona.truthData.currentCity}
- 兴趣: ${persona.truthData.interests.join('、')}

## 行为风格
- 话多程度: ${persona.behaviorStyle.verbosity === 'minimal' ? '惜字如金' : persona.behaviorStyle.verbosity === 'verbose' ? '健谈' : '正常'}
- 隐私态度: ${persona.behaviorStyle.privacyLevel === 'guarded' ? '谨慎' : persona.behaviorStyle.privacyLevel === 'open' ? '开放' : '有选择'}
- 特殊特点: ${persona.specialTraits.join('、') || '无'}

## 当前轮次: ${turnNumber}
第1-2轮回答昵称，第3-4轮回答性别年龄，第5轮以后分享兴趣城市。

## 小悦说:
${xiaoyueMessage}

请以这个用户身份回复，只输出回复内容。`;

  try {
    const response = await deepseekClient.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: '扮演指定用户进行对话。' },
        { role: 'user', content: personaPrompt }
      ],
      temperature: 0.9,
      max_tokens: 150,
    });
    return response.choices[0]?.message?.content || '嗯';
  } catch (error) {
    console.error('User response error:', error);
    return '好的';
  }
}

async function xiaoyueRespond(conversationHistory: ChatMessage[]): Promise<{
  message: string;
  isComplete: boolean;
  collectedInfo: any;
}> {
  try {
    const response = await deepseekClient.chat.completions.create({
      model: 'deepseek-chat',
      messages: conversationHistory.map(msg => ({
        role: msg.role as 'system' | 'user' | 'assistant',
        content: msg.content
      })),
      temperature: 0.8,
      max_tokens: 500,
    });

    const rawMessage = response.choices[0]?.message?.content || '抱歉，我走神了';
    const isComplete = rawMessage.includes('```registration_complete');
    
    const infoMatch = rawMessage.match(/```collected_info\s*([\s\S]*?)```/);
    let collectedInfo = {};
    if (infoMatch) {
      try {
        collectedInfo = JSON.parse(infoMatch[1].trim());
      } catch {}
    }

    const cleanMessage = rawMessage
      .replace(/```collected_info[\s\S]*?```/g, '')
      .replace(/```registration_complete[\s\S]*?```/g, '')
      .trim();

    return { message: cleanMessage, isComplete, collectedInfo };
  } catch (error) {
    console.error('Xiaoyue API error:', error);
    throw error;
  }
}

interface ChatResult {
  completed: boolean;
  abandoned: boolean;
  turnCount: number;
  fieldsCompleted: number;
  totalFields: number;
  dataQuality: 'high' | 'medium' | 'low';
  collectedData: any;
  timeSpentSeconds: number;
}

async function simulateChatRegistration(persona: UserPersona): Promise<ChatResult> {
  const conversationHistory: ChatMessage[] = [
    { role: 'system', content: XIAOYUE_SYSTEM_PROMPT },
    { role: 'assistant', content: XIAOYUE_OPENING }
  ];
  
  const result: ChatResult = {
    completed: false,
    abandoned: false,
    turnCount: 0,
    fieldsCompleted: 0,
    totalFields: 5,
    dataQuality: 'high',
    collectedData: {},
    timeSpentSeconds: 0,
  };
  
  const maxTurns = 12;
  
  for (let turn = 1; turn <= maxTurns; turn++) {
    result.turnCount = turn;
    
    // 生成用户回复
    const userResponse = await generateUserResponse(
      persona,
      conversationHistory[conversationHistory.length - 1].content,
      turn
    );
    conversationHistory.push({ role: 'user', content: userResponse });
    
    // 小悦回复
    const xiaoyueResponse = await xiaoyueRespond(conversationHistory);
    conversationHistory.push({ role: 'assistant', content: xiaoyueResponse.message });
    
    // 合并收集到的信息
    Object.assign(result.collectedData, xiaoyueResponse.collectedInfo);
    
    // 立即更新字段计数
    result.fieldsCompleted = Object.keys(result.collectedData).length;
    
    if (xiaoyueResponse.isComplete) {
      result.completed = true;
      break;
    }
  }
  
  // 如果循环结束但未完成，标记为放弃
  if (!result.completed) {
    result.abandoned = true;
  }
  
  // 计算时间（模拟）
  result.timeSpentSeconds = result.turnCount * 15; // 平均每轮15秒
  
  // 评估数据质量
  if (result.fieldsCompleted >= 4) {
    result.dataQuality = 'high';
  } else if (result.fieldsCompleted >= 2) {
    result.dataQuality = 'medium';
  } else {
    result.dataQuality = 'low';
  }
  
  return result;
}

// ============ 对比测试主函数 ============
interface ComparisonResult {
  personaId: string;
  personaName: string;
  category: string;
  form: FormResult;
  chat: ChatResult;
}

async function runComparison(persona: UserPersona): Promise<ComparisonResult> {
  console.log(`\n📋 测试用户: ${persona.name} (${persona.category})`);
  
  // 传统问卷
  console.log('  ├─ 传统问卷模拟...');
  const formResult = simulateFormFilling(persona);
  
  // 小悦对话
  console.log('  └─ 小悦对话模拟...');
  const chatResult = await simulateChatRegistration(persona);
  
  return {
    personaId: persona.id,
    personaName: persona.name,
    category: persona.category,
    form: formResult,
    chat: chatResult,
  };
}

function generateReport(results: ComparisonResult[]): string {
  let report = `# 小悦对话 vs 传统问卷 对比测试报告

测试时间: ${new Date().toLocaleString('zh-CN')}
测试用户数: ${results.length}

---

## 📊 总体对比

| 指标 | 传统问卷 | 小悦对话 | 差异 |
|------|---------|---------|------|
`;

  // 计算统计数据
  const formStats = {
    completionRate: results.filter(r => r.form.completed).length / results.length * 100,
    abandonRate: results.filter(r => r.form.abandoned).length / results.length * 100,
    avgFields: results.reduce((s, r) => s + r.form.fieldsCompleted, 0) / results.length,
    highQualityRate: results.filter(r => r.form.dataQuality === 'high').length / results.length * 100,
    avgTime: results.reduce((s, r) => s + r.form.timeSpentSeconds, 0) / results.length,
  };
  
  const chatStats = {
    completionRate: results.filter(r => r.chat.completed).length / results.length * 100,
    abandonRate: results.filter(r => r.chat.abandoned).length / results.length * 100,
    avgFields: results.reduce((s, r) => s + r.chat.fieldsCompleted, 0) / results.length,
    highQualityRate: results.filter(r => r.chat.dataQuality === 'high').length / results.length * 100,
    avgTime: results.reduce((s, r) => s + r.chat.timeSpentSeconds, 0) / results.length,
  };

  report += `| 完成率 | ${formStats.completionRate.toFixed(1)}% | ${chatStats.completionRate.toFixed(1)}% | ${(chatStats.completionRate - formStats.completionRate) > 0 ? '+' : ''}${(chatStats.completionRate - formStats.completionRate).toFixed(1)}% |
| 放弃率 | ${formStats.abandonRate.toFixed(1)}% | ${chatStats.abandonRate.toFixed(1)}% | ${(chatStats.abandonRate - formStats.abandonRate) > 0 ? '+' : ''}${(chatStats.abandonRate - formStats.abandonRate).toFixed(1)}% |
| 平均字段数 | ${formStats.avgFields.toFixed(1)} | ${chatStats.avgFields.toFixed(1)} | ${(chatStats.avgFields - formStats.avgFields) > 0 ? '+' : ''}${(chatStats.avgFields - formStats.avgFields).toFixed(1)} |
| 高质量率 | ${formStats.highQualityRate.toFixed(1)}% | ${chatStats.highQualityRate.toFixed(1)}% | ${(chatStats.highQualityRate - formStats.highQualityRate) > 0 ? '+' : ''}${(chatStats.highQualityRate - formStats.highQualityRate).toFixed(1)}% |
| 平均耗时 | ${formStats.avgTime.toFixed(0)}秒 | ${chatStats.avgTime.toFixed(0)}秒 | ${(chatStats.avgTime - formStats.avgTime) > 0 ? '+' : ''}${(chatStats.avgTime - formStats.avgTime).toFixed(0)}秒 |

---

## 📈 分类别对比

`;

  // 按类别统计
  const categories = [...new Set(results.map(r => r.category))];
  for (const cat of categories) {
    const catResults = results.filter(r => r.category === cat);
    const catFormComp = catResults.filter(r => r.form.completed).length / catResults.length * 100;
    const catChatComp = catResults.filter(r => r.chat.completed).length / catResults.length * 100;
    
    report += `### ${cat}用户 (${catResults.length}人)
- 传统问卷完成率: ${catFormComp.toFixed(0)}%
- 小悦对话完成率: ${catChatComp.toFixed(0)}%
- 提升: ${(catChatComp - catFormComp) > 0 ? '+' : ''}${(catChatComp - catFormComp).toFixed(0)}%

`;
  }

  report += `---

## 📝 详细结果

| 用户 | 类别 | 问卷完成 | 问卷字段 | 对话完成 | 对话字段 | 对话轮次 |
|------|------|---------|---------|---------|---------|---------|
`;

  for (const r of results) {
    report += `| ${r.personaName} | ${r.category} | ${r.form.completed ? '✅' : r.form.abandoned ? '❌放弃' : '❌'} | ${r.form.fieldsCompleted}/5 | ${r.chat.completed ? '✅' : '❌'} | ${r.chat.fieldsCompleted}/5 | ${r.chat.turnCount} |
`;
  }

  report += `
---

## 💡 关键发现

1. **完成率**: 小悦对话完成率 ${chatStats.completionRate.toFixed(0)}% vs 传统问卷 ${formStats.completionRate.toFixed(0)}%
2. **信息完整度**: 平均收集 ${chatStats.avgFields.toFixed(1)} vs ${formStats.avgFields.toFixed(1)} 个字段
3. **用户体验**: 对话式交互更有温度，减少用户抵触心理
4. **适应性**: 小悦能针对不同用户类型调整引导策略

## 🎯 建议

- 对于隐私敏感用户，小悦对话可通过解释降低顾虑
- 对于极简用户，小悦提供选项降低输入门槛
- 对于健谈用户，两种方式差异不大，但对话更有趣
`;

  return report;
}

// ============ 主程序 ============
async function main() {
  const testCount = parseInt(process.argv[2] || '10');
  console.log(`\n🚀 开始对比测试: ${testCount} 个用户画像\n`);
  console.log('='.repeat(50));
  
  const results: ComparisonResult[] = [];
  const personas = TEST_PERSONAS.slice(0, testCount);
  
  for (const persona of personas) {
    try {
      const result = await runComparison(persona);
      results.push(result);
      console.log(`    ✓ 完成 - 问卷:${result.form.completed ? '成功' : '失败'} | 对话:${result.chat.completed ? '成功' : '失败'}`);
    } catch (error) {
      console.error(`    ✗ 错误:`, error);
    }
    
    // 添加延迟避免API限制
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('\n📊 生成对比报告...\n');
  
  const report = generateReport(results);
  console.log(report);
  
  // 保存报告
  const fs = await import('fs');
  const reportPath = `reports/comparison_${Date.now()}.md`;
  await fs.promises.mkdir('reports', { recursive: true });
  await fs.promises.writeFile(reportPath, report);
  console.log(`\n📄 报告已保存: ${reportPath}`);
}

main().catch(console.error);
