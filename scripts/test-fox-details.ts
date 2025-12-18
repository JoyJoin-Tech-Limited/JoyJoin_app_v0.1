import OpenAI from 'openai';

const deepseekClient = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
});

interface UserProfile {
  id: number;
  age: string;
  gender: string;
  occupation: string;
  personality: string;
}

interface DetailFeedback {
  userId: number;
  profile: UserProfile;
  
  // 表情偏好
  expressionPreference: '狡黠微笑' | '温和淡然' | '慵懒放松';
  expressionReason: string;
  
  // 眼神偏好
  eyePreference: '机灵有神' | '沉稳柔和' | '慵懒半眯';
  
  // 服装风格
  clothingPreference: '全新整洁' | '轻微做旧' | '明显街头感';
  clothingReason: string;
  
  // 配饰选择
  accessoryChoices: string[];
  
  // 尾巴状态
  tailPreference: '自然下垂' | '微微摇动' | '放松卷曲';
  
  // 整体氛围
  overallVibe: string;
  
  // 最重要的设计元素
  topPriority: string;
}

const FOX_BASE_DESCRIPTION = `
【确定采用的方案：拟人化狐狸形象】
- 风格：3D日式动漫风格渲染（类似《疯狂动物城》Nick Wilde的质感）
- 基础：拟人化狐狸角色，暖橙棕色毛发
- 服装：紫色卫衣，左胸口有悦聚logo
- 姿态：双手插在卫衣口袋里，放松自信的站姿
- 人设："街头老狐狸"——混迹社交场合多年，什么人都见过，表面玩世不恭实际靠谱
`;

function generateUserProfiles(count: number): UserProfile[] {
  const ages = ['00后(18-24岁)', '95后(25-29岁)', '90后(30-34岁)', '85后(35-40岁)'];
  const genders = ['男', '女'];
  const occupations = ['互联网/科技', '金融/投资', '设计/创意', '学生', '自由职业', '教育/医疗'];
  const personalities = ['内向型', '外向型', '社恐但想社交'];

  const profiles: UserProfile[] = [];
  
  for (let i = 0; i < count; i++) {
    profiles.push({
      id: i + 1,
      age: ages[i % ages.length],
      gender: genders[i % genders.length],
      occupation: occupations[i % occupations.length],
      personality: personalities[i % personalities.length],
    });
  }
  
  for (let i = profiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [profiles[i], profiles[j]] = [profiles[j], profiles[i]];
  }
  
  return profiles;
}

async function evaluateDetails(profile: UserProfile): Promise<DetailFeedback> {
  const prompt = `你是一个${profile.age}的${profile.gender}生，职业是${profile.occupation}，性格${profile.personality}。

悦聚是一个社交平台，主打4-6人小局社交活动。小悦是平台的AI助手，现在要设计它的视觉形象：

${FOX_BASE_DESCRIPTION}

现在需要你帮忙选择细节设计。请以这个用户的真实视角回答，用JSON格式：

{
  "expressionPreference": "狡黠微笑 或 温和淡然 或 慵懒放松",
  "expressionReason": "选择这个表情的原因（一句话）",
  
  "eyePreference": "机灵有神 或 沉稳柔和 或 慵懒半眯",
  
  "clothingPreference": "全新整洁 或 轻微做旧 或 明显街头感",
  "clothingReason": "选择这个服装风格的原因（一句话）",
  
  "accessoryChoices": ["从以下选2-3个你觉得最适合的配饰：无线耳机、演唱会手环、复古手表、简约项链、徽章、墨镜挂在领口"],
  
  "tailPreference": "自然下垂 或 微微摇动 或 放松卷曲",
  
  "overallVibe": "用2-3个词描述你期望的整体氛围",
  
  "topPriority": "你认为最重要的一个设计元素是什么"
}

注意：
- 基于你的用户画像真实回答
- 这是一个要和你对话帮你找社交活动的AI助手
- 人设是"老狐狸"：见多识广、松弛、靠谱
- 直接输出JSON，不要其他内容`;

  try {
    const response = await deepseekClient.chat.completions.create({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content || '{}';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON');
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    return {
      userId: profile.id,
      profile,
      expressionPreference: parsed.expressionPreference || '温和淡然',
      expressionReason: parsed.expressionReason || '',
      eyePreference: parsed.eyePreference || '沉稳柔和',
      clothingPreference: parsed.clothingPreference || '轻微做旧',
      clothingReason: parsed.clothingReason || '',
      accessoryChoices: parsed.accessoryChoices || [],
      tailPreference: parsed.tailPreference || '自然下垂',
      overallVibe: parsed.overallVibe || '',
      topPriority: parsed.topPriority || '',
    };
  } catch (error) {
    console.error(`Error for user ${profile.id}:`, error);
    return {
      userId: profile.id,
      profile,
      expressionPreference: '温和淡然',
      expressionReason: '',
      eyePreference: '沉稳柔和',
      clothingPreference: '轻微做旧',
      clothingReason: '',
      accessoryChoices: [],
      tailPreference: '自然下垂',
      overallVibe: '',
      topPriority: '',
    };
  }
}

async function runBatchEvaluation(profiles: UserProfile[], batchSize: number = 10): Promise<DetailFeedback[]> {
  const results: DetailFeedback[] = [];
  
  for (let i = 0; i < profiles.length; i += batchSize) {
    const batch = profiles.slice(i, i + batchSize);
    console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(profiles.length / batchSize)}...`);
    
    const batchResults = await Promise.all(batch.map(evaluateDetails));
    results.push(...batchResults);
    
    if (i + batchSize < profiles.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
}

function countItems<T extends string>(items: T[]): Record<T, number> {
  const counts: Record<string, number> = {};
  items.forEach(item => {
    counts[item] = (counts[item] || 0) + 1;
  });
  return counts as Record<T, number>;
}

function analyzeResults(feedbacks: DetailFeedback[]): void {
  const valid = feedbacks.filter(f => f.expressionReason);
  const total = valid.length;
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 拟人化狐狸形象细节设计 - 100人反馈报告');
  console.log('='.repeat(60));
  
  // 表情偏好
  console.log('\n' + '─'.repeat(60));
  console.log('😊 表情偏好');
  console.log('─'.repeat(60));
  
  const expressions = countItems(valid.map(f => f.expressionPreference));
  Object.entries(expressions).sort((a, b) => b[1] - a[1]).forEach(([exp, count]) => {
    const bar = '█'.repeat(Math.round(count / total * 30));
    console.log(`${exp}: ${bar} ${count}人 (${(count/total*100).toFixed(0)}%)`);
  });
  
  // 眼神偏好
  console.log('\n' + '─'.repeat(60));
  console.log('👁️ 眼神偏好');
  console.log('─'.repeat(60));
  
  const eyes = countItems(valid.map(f => f.eyePreference));
  Object.entries(eyes).sort((a, b) => b[1] - a[1]).forEach(([eye, count]) => {
    const bar = '█'.repeat(Math.round(count / total * 30));
    console.log(`${eye}: ${bar} ${count}人 (${(count/total*100).toFixed(0)}%)`);
  });
  
  // 服装风格
  console.log('\n' + '─'.repeat(60));
  console.log('👕 服装风格');
  console.log('─'.repeat(60));
  
  const clothing = countItems(valid.map(f => f.clothingPreference));
  Object.entries(clothing).sort((a, b) => b[1] - a[1]).forEach(([c, count]) => {
    const bar = '█'.repeat(Math.round(count / total * 30));
    console.log(`${c}: ${bar} ${count}人 (${(count/total*100).toFixed(0)}%)`);
  });
  
  // 配饰选择
  console.log('\n' + '─'.repeat(60));
  console.log('🎧 配饰偏好');
  console.log('─'.repeat(60));
  
  const accessories: Record<string, number> = {};
  valid.forEach(f => {
    f.accessoryChoices.forEach(a => {
      accessories[a] = (accessories[a] || 0) + 1;
    });
  });
  Object.entries(accessories).sort((a, b) => b[1] - a[1]).forEach(([acc, count]) => {
    const bar = '█'.repeat(Math.round(count / total * 20));
    console.log(`${acc}: ${bar} ${count}人`);
  });
  
  // 尾巴状态
  console.log('\n' + '─'.repeat(60));
  console.log('🦊 尾巴状态');
  console.log('─'.repeat(60));
  
  const tails = countItems(valid.map(f => f.tailPreference));
  Object.entries(tails).sort((a, b) => b[1] - a[1]).forEach(([t, count]) => {
    const bar = '█'.repeat(Math.round(count / total * 30));
    console.log(`${t}: ${bar} ${count}人 (${(count/total*100).toFixed(0)}%)`);
  });
  
  // 整体氛围词云
  console.log('\n' + '─'.repeat(60));
  console.log('✨ 期望的整体氛围（词频）');
  console.log('─'.repeat(60));
  
  const vibes: Record<string, number> = {};
  valid.forEach(f => {
    f.overallVibe.split(/[，,、\s]+/).forEach(w => {
      if (w.length >= 2) vibes[w] = (vibes[w] || 0) + 1;
    });
  });
  Object.entries(vibes).sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([v, count]) => {
    console.log(`  ${v}: ${count}人`);
  });
  
  // 最重要元素
  console.log('\n' + '─'.repeat(60));
  console.log('🎯 用户认为最重要的设计元素');
  console.log('─'.repeat(60));
  
  const priorities: Record<string, number> = {};
  valid.forEach(f => {
    if (f.topPriority) {
      priorities[f.topPriority] = (priorities[f.topPriority] || 0) + 1;
    }
  });
  Object.entries(priorities).sort((a, b) => b[1] - a[1]).slice(0, 8).forEach(([p, count]) => {
    console.log(`  - ${p} (${count}人)`);
  });
  
  // 性别差异分析
  console.log('\n' + '─'.repeat(60));
  console.log('👫 性别差异分析');
  console.log('─'.repeat(60));
  
  const maleExp = countItems(valid.filter(f => f.profile.gender === '男').map(f => f.expressionPreference));
  const femaleExp = countItems(valid.filter(f => f.profile.gender === '女').map(f => f.expressionPreference));
  
  console.log('\n表情偏好：');
  console.log(`  男生最爱: ${Object.entries(maleExp).sort((a, b) => b[1] - a[1])[0]?.[0] || '-'}`);
  console.log(`  女生最爱: ${Object.entries(femaleExp).sort((a, b) => b[1] - a[1])[0]?.[0] || '-'}`);
  
  const maleCloth = countItems(valid.filter(f => f.profile.gender === '男').map(f => f.clothingPreference));
  const femaleCloth = countItems(valid.filter(f => f.profile.gender === '女').map(f => f.clothingPreference));
  
  console.log('\n服装偏好：');
  console.log(`  男生最爱: ${Object.entries(maleCloth).sort((a, b) => b[1] - a[1])[0]?.[0] || '-'}`);
  console.log(`  女生最爱: ${Object.entries(femaleCloth).sort((a, b) => b[1] - a[1])[0]?.[0] || '-'}`);
  
  // 内向型用户特别关注
  console.log('\n' + '─'.repeat(60));
  console.log('🔒 内向型/社恐用户偏好');
  console.log('─'.repeat(60));
  
  const introvert = valid.filter(f => f.profile.personality.includes('内向') || f.profile.personality.includes('社恐'));
  const introExp = countItems(introvert.map(f => f.expressionPreference));
  const introEye = countItems(introvert.map(f => f.eyePreference));
  
  console.log(`内向型用户数: ${introvert.length}人`);
  console.log(`  表情偏好: ${Object.entries(introExp).sort((a, b) => b[1] - a[1])[0]?.[0] || '-'}`);
  console.log(`  眼神偏好: ${Object.entries(introEye).sort((a, b) => b[1] - a[1])[0]?.[0] || '-'}`);
  
  // 最终设计建议
  console.log('\n' + '='.repeat(60));
  console.log('📋 最终设计建议');
  console.log('='.repeat(60));
  
  const topExpression = Object.entries(expressions).sort((a, b) => b[1] - a[1])[0];
  const topEye = Object.entries(eyes).sort((a, b) => b[1] - a[1])[0];
  const topClothing = Object.entries(clothing).sort((a, b) => b[1] - a[1])[0];
  const topTail = Object.entries(tails).sort((a, b) => b[1] - a[1])[0];
  const topAccessories = Object.entries(accessories).sort((a, b) => b[1] - a[1]).slice(0, 2);
  
  console.log(`
🦊 小悦形象设计定稿建议：

【表情】${topExpression?.[0]} (${topExpression?.[1]}人选择)
【眼神】${topEye?.[0]} (${topEye?.[1]}人选择)  
【服装】${topClothing?.[0]} (${topClothing?.[1]}人选择)
【尾巴】${topTail?.[0]} (${topTail?.[1]}人选择)
【配饰】${topAccessories.map(([a]) => a).join(' + ')}

整体氛围关键词：${Object.entries(vibes).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([v]) => v).join('、')}
`);
  
  console.log('='.repeat(60));
}

async function main() {
  console.log('🦊 开始拟人化狐狸形象细节测试...\n');
  
  const userCount = 100;
  console.log(`📋 生成 ${userCount} 个模拟用户画像...`);
  const profiles = generateUserProfiles(userCount);
  
  console.log('🔄 开始收集反馈...\n');
  const feedbacks = await runBatchEvaluation(profiles, 10);
  
  analyzeResults(feedbacks);
}

main().catch(console.error);
