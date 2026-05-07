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
  socialStyle: string;
}

interface ABFeedback {
  userId: number;
  profile: UserProfile;
  preferredVersion: 'A' | 'B' | '都可以';
  preferenceReason: string;
  versionA_trustScore: number;
  versionB_trustScore: number;
  versionA_impression: string;
  versionB_impression: string;
  concernsAboutA: string[];
  concernsAboutB: string[];
}

const VERSION_A_DESCRIPTION = `
【方案A：人类+狐狸元素】
- 风格：3D日式动漫风格渲染
- 外貌：年轻男性，暖棕橙色头发，微妙的狐狸耳朵从卫衣帽子里露出
- 服装：紫色卫衣，左胸口有悦聚logo
- 姿态：双手插在卫衣口袋里，放松自信的站姿
- 表情：嘴角带了然的微笑，有点"我知道些什么"的感觉
`;

const VERSION_B_DESCRIPTION = `
【方案B：拟人化狐狸】
- 风格：3D日式动漫风格渲染（类似《疯狂动物城》Nick Wilde）
- 外貌：拟人化狐狸角色，暖橙棕色毛发，立体狐狸耳朵，机灵的眼神
- 服装：紫色卫衣，左胸口有悦聚logo
- 姿态：双手插在卫衣口袋里，放松自信的站姿，尾巴自然下垂
- 表情：嘴角带狡黠的微笑，聪明又靠谱的氛围
- 特点：与悦聚平台的12原型动物系统保持统一
`;

const CONTEXT = `
悦聚是一个社交平台，主打4-6人小局社交活动。平台有一套"12原型动物社交气质系统"，用不同动物代表不同社交性格（如狮子型领袖、猫咪型独处者等）。

小悦是平台的AI社交助手，人设是"街头老狐狸"——混迹社交场合多年，见过太多人，什么场面都能接住。表面玩世不恭，实际上比谁都靠谱。

现在需要为小悦设计视觉形象，有两个方案：
`;

function generateUserProfiles(count: number): UserProfile[] {
  const ages = ['00后(18-24岁)', '95后(25-29岁)', '90后(30-34岁)', '85后(35-40岁)'];
  const genders = ['男', '女'];
  const occupations = ['互联网/科技', '金融/投资', '设计/创意', '学生', '自由职业'];
  const personalities = ['内向型', '外向型'];
  const socialStyles = ['喜欢小局深聊', '喜欢大局热闹', '随缘'];

  const profiles: UserProfile[] = [];
  
  for (let i = 0; i < count; i++) {
    profiles.push({
      id: i + 1,
      age: ages[i % ages.length],
      gender: genders[i % genders.length],
      occupation: occupations[i % occupations.length],
      personality: personalities[i % personalities.length],
      socialStyle: socialStyles[i % socialStyles.length],
    });
  }
  
  for (let i = profiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [profiles[i], profiles[j]] = [profiles[j], profiles[i]];
  }
  
  return profiles;
}

async function evaluateAB(profile: UserProfile): Promise<ABFeedback> {
  const prompt = `你是一个${profile.age}的${profile.gender}生，职业是${profile.occupation}，性格${profile.personality}，社交偏好是${profile.socialStyle}。

${CONTEXT}

${VERSION_A_DESCRIPTION}

${VERSION_B_DESCRIPTION}

请以这个用户的真实视角，比较这两个方案。用JSON格式回答：

{
  "preferredVersion": "A 或 B 或 都可以",
  "preferenceReason": "选择这个版本的核心原因（一句话）",
  "versionA_trustScore": 1-10的信任感评分,
  "versionB_trustScore": 1-10的信任感评分,
  "versionA_impression": "对方案A的第一印象（2-4个词）",
  "versionB_impression": "对方案B的第一印象（2-4个词）",
  "concernsAboutA": ["对方案A的顾虑，如果没有就留空数组"],
  "concernsAboutB": ["对方案B的顾虑，如果没有就留空数组"]
}

注意：
- 基于你的用户画像真实回答
- 考虑这是一个社交平台的AI助手，你会和它对话注册
- 考虑平台有12原型动物系统这个背景
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
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    return {
      userId: profile.id,
      profile,
      preferredVersion: parsed.preferredVersion === 'A' ? 'A' : (parsed.preferredVersion === 'B' ? 'B' : '都可以'),
      preferenceReason: parsed.preferenceReason || '',
      versionA_trustScore: parsed.versionA_trustScore || 5,
      versionB_trustScore: parsed.versionB_trustScore || 5,
      versionA_impression: parsed.versionA_impression || '',
      versionB_impression: parsed.versionB_impression || '',
      concernsAboutA: parsed.concernsAboutA || [],
      concernsAboutB: parsed.concernsAboutB || [],
    };
  } catch (error) {
    console.error(`Error evaluating for user ${profile.id}:`, error);
    return {
      userId: profile.id,
      profile,
      preferredVersion: '都可以',
      preferenceReason: '评估失败',
      versionA_trustScore: 0,
      versionB_trustScore: 0,
      versionA_impression: '',
      versionB_impression: '',
      concernsAboutA: [],
      concernsAboutB: [],
    };
  }
}

async function runBatchEvaluation(profiles: UserProfile[], batchSize: number = 10): Promise<ABFeedback[]> {
  const results: ABFeedback[] = [];
  
  for (let i = 0; i < profiles.length; i += batchSize) {
    const batch = profiles.slice(i, i + batchSize);
    console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(profiles.length / batchSize)}...`);
    
    const batchResults = await Promise.all(batch.map(evaluateAB));
    results.push(...batchResults);
    
    if (i + batchSize < profiles.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
}

function analyzeResults(feedbacks: ABFeedback[]): void {
  const validFeedbacks = feedbacks.filter(f => f.versionA_trustScore > 0);
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 小悦形象设计 A/B测试 - 100人模拟用户报告');
  console.log('='.repeat(60));
  console.log('\n方案A：人类男生 + 狐狸耳朵');
  console.log('方案B：拟人化狐狸（Nick Wilde风格）');
  
  // Overall preference
  const prefA = validFeedbacks.filter(f => f.preferredVersion === 'A').length;
  const prefB = validFeedbacks.filter(f => f.preferredVersion === 'B').length;
  const prefBoth = validFeedbacks.filter(f => f.preferredVersion === '都可以').length;
  
  console.log('\n' + '─'.repeat(60));
  console.log('🏆 总体偏好');
  console.log('─'.repeat(60));
  
  const total = validFeedbacks.length;
  const barA = '█'.repeat(Math.round(prefA / total * 30));
  const barB = '█'.repeat(Math.round(prefB / total * 30));
  
  console.log(`\n方案A（人类+狐狸耳）: ${barA} ${prefA}人 (${(prefA/total*100).toFixed(0)}%)`);
  console.log(`方案B（拟人化狐狸）: ${barB} ${prefB}人 (${(prefB/total*100).toFixed(0)}%)`);
  console.log(`都可以: ${prefBoth}人 (${(prefBoth/total*100).toFixed(0)}%)`);
  
  // Trust scores comparison
  const avgA = validFeedbacks.reduce((sum, f) => sum + f.versionA_trustScore, 0) / validFeedbacks.length;
  const avgB = validFeedbacks.reduce((sum, f) => sum + f.versionB_trustScore, 0) / validFeedbacks.length;
  
  console.log('\n' + '─'.repeat(60));
  console.log('📈 信任感评分对比');
  console.log('─'.repeat(60));
  console.log(`方案A 平均分: ${avgA.toFixed(1)}/10`);
  console.log(`方案B 平均分: ${avgB.toFixed(1)}/10`);
  console.log(`差距: ${avgB > avgA ? 'B领先' : 'A领先'} ${Math.abs(avgB - avgA).toFixed(1)}分`);
  
  // Gender breakdown
  console.log('\n' + '─'.repeat(60));
  console.log('👫 性别差异');
  console.log('─'.repeat(60));
  
  const maleA = validFeedbacks.filter(f => f.profile.gender === '男' && f.preferredVersion === 'A').length;
  const maleB = validFeedbacks.filter(f => f.profile.gender === '男' && f.preferredVersion === 'B').length;
  const femaleA = validFeedbacks.filter(f => f.profile.gender === '女' && f.preferredVersion === 'A').length;
  const femaleB = validFeedbacks.filter(f => f.profile.gender === '女' && f.preferredVersion === 'B').length;
  
  console.log(`男生: 方案A ${maleA}人 vs 方案B ${maleB}人`);
  console.log(`女生: 方案A ${femaleA}人 vs 方案B ${femaleB}人`);
  
  // Age breakdown
  console.log('\n' + '─'.repeat(60));
  console.log('📅 年龄差异');
  console.log('─'.repeat(60));
  
  const ageGroups = ['00后(18-24岁)', '95后(25-29岁)', '90后(30-34岁)', '85后(35-40岁)'];
  ageGroups.forEach(age => {
    const ageA = validFeedbacks.filter(f => f.profile.age === age && f.preferredVersion === 'A').length;
    const ageB = validFeedbacks.filter(f => f.profile.age === age && f.preferredVersion === 'B').length;
    const winner = ageA > ageB ? 'A' : (ageB > ageA ? 'B' : '平');
    console.log(`${age}: A ${ageA}人 vs B ${ageB}人 → ${winner}胜`);
  });
  
  // Personality breakdown
  console.log('\n' + '─'.repeat(60));
  console.log('🧠 性格差异');
  console.log('─'.repeat(60));
  
  const introA = validFeedbacks.filter(f => f.profile.personality === '内向型' && f.preferredVersion === 'A').length;
  const introB = validFeedbacks.filter(f => f.profile.personality === '内向型' && f.preferredVersion === 'B').length;
  const extroA = validFeedbacks.filter(f => f.profile.personality === '外向型' && f.preferredVersion === 'A').length;
  const extroB = validFeedbacks.filter(f => f.profile.personality === '外向型' && f.preferredVersion === 'B').length;
  
  console.log(`内向型: A ${introA}人 vs B ${introB}人`);
  console.log(`外向型: A ${extroA}人 vs B ${extroB}人`);
  
  // First impressions
  console.log('\n' + '─'.repeat(60));
  console.log('🎭 第一印象词频');
  console.log('─'.repeat(60));
  
  const impressionsA: Record<string, number> = {};
  const impressionsB: Record<string, number> = {};
  
  validFeedbacks.forEach(f => {
    f.versionA_impression.split(/[，,、\s]+/).forEach(w => {
      if (w.length >= 2) impressionsA[w] = (impressionsA[w] || 0) + 1;
    });
    f.versionB_impression.split(/[，,、\s]+/).forEach(w => {
      if (w.length >= 2) impressionsB[w] = (impressionsB[w] || 0) + 1;
    });
  });
  
  console.log('\n方案A印象词:');
  Object.entries(impressionsA).sort((a, b) => b[1] - a[1]).slice(0, 5).forEach(([w, c]) => {
    console.log(`  ${w}: ${c}人`);
  });
  
  console.log('\n方案B印象词:');
  Object.entries(impressionsB).sort((a, b) => b[1] - a[1]).slice(0, 5).forEach(([w, c]) => {
    console.log(`  ${w}: ${c}人`);
  });
  
  // Concerns
  console.log('\n' + '─'.repeat(60));
  console.log('⚠️ 各方案顾虑');
  console.log('─'.repeat(60));
  
  const concernsA: Record<string, number> = {};
  const concernsB: Record<string, number> = {};
  
  validFeedbacks.forEach(f => {
    f.concernsAboutA.forEach(c => {
      concernsA[c] = (concernsA[c] || 0) + 1;
    });
    f.concernsAboutB.forEach(c => {
      concernsB[c] = (concernsB[c] || 0) + 1;
    });
  });
  
  console.log('\n对方案A的顾虑:');
  const topConcernsA = Object.entries(concernsA).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (topConcernsA.length === 0) {
    console.log('  (无明显顾虑)');
  } else {
    topConcernsA.forEach(([c, n]) => console.log(`  - ${c} (${n}人)`));
  }
  
  console.log('\n对方案B的顾虑:');
  const topConcernsB = Object.entries(concernsB).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (topConcernsB.length === 0) {
    console.log('  (无明显顾虑)');
  } else {
    topConcernsB.forEach(([c, n]) => console.log(`  - ${c} (${n}人)`));
  }
  
  // Sample reasons
  console.log('\n' + '─'.repeat(60));
  console.log('💬 选择理由示例');
  console.log('─'.repeat(60));
  
  console.log('\n选A的理由:');
  validFeedbacks.filter(f => f.preferredVersion === 'A').slice(0, 3).forEach(f => {
    console.log(`  [${f.profile.age} ${f.profile.gender}生] ${f.preferenceReason}`);
  });
  
  console.log('\n选B的理由:');
  validFeedbacks.filter(f => f.preferredVersion === 'B').slice(0, 3).forEach(f => {
    console.log(`  [${f.profile.age} ${f.profile.gender}生] ${f.preferenceReason}`);
  });
  
  // Conclusion
  console.log('\n' + '='.repeat(60));
  console.log('📋 结论');
  console.log('='.repeat(60));
  
  if (prefB > prefA * 1.2) {
    console.log(`\n✅ 方案B（拟人化狐狸）更受欢迎，领先${prefB - prefA}票`);
    console.log('建议采用拟人化狐狸设计，与12原型动物系统保持统一');
  } else if (prefA > prefB * 1.2) {
    console.log(`\n✅ 方案A（人类+狐狸耳）更受欢迎，领先${prefA - prefB}票`);
    console.log('建议保持人类形象，狐狸元素作为点缀');
  } else {
    console.log('\n⚖️ 两个方案接受度接近，可根据品牌定位选择');
    if (avgB > avgA) {
      console.log(`但方案B信任感评分更高（${avgB.toFixed(1)} vs ${avgA.toFixed(1)}），建议倾向B`);
    } else {
      console.log(`但方案A信任感评分更高（${avgA.toFixed(1)} vs ${avgB.toFixed(1)}），建议倾向A`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
}

async function main() {
  console.log('🎨 开始小悦形象A/B测试...\n');
  console.log('方案A：人类男生 + 狐狸耳朵');
  console.log('方案B：拟人化狐狸（Nick Wilde风格）\n');
  
  const userCount = 100;
  console.log(`📋 生成 ${userCount} 个模拟用户画像...`);
  const profiles = generateUserProfiles(userCount);
  
  console.log('🔄 开始收集反馈...\n');
  const feedbacks = await runBatchEvaluation(profiles, 10);
  
  analyzeResults(feedbacks);
}

main().catch(console.error);
