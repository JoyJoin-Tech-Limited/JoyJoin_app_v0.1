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
  techComfort: string;
}

interface StyleFeedback {
  userId: number;
  profile: UserProfile;
  preferredVersion: 'A' | 'B' | '都可以';
  preferenceReason: string;
  versionA_trustScore: number;
  versionB_trustScore: number;
  versionA_aiFeeling: number;
  versionB_aiFeeling: number;
  concernsAboutA: string;
  concernsAboutB: string;
}

const VERSION_A_DESCRIPTION = `
【方案A：松弛自然版】
- 拟人化狐狸，Nick Wilde风格
- 暖橙棕色毛发，慵懒放松的表情
- 沉稳柔和的自然眼神
- 紫色卫衣，轻微做旧质感
- 双手插兜放松站姿，尾巴放松卷曲
- 配饰：复古手表 + 简约项链
- 整体氛围：松弛、有故事感、街头老狐狸
`;

const VERSION_B_DESCRIPTION = `
【方案B：AI增强版】
- 拟人化狐狸，Nick Wilde风格
- 暖橙棕色毛发，慵懒放松的表情
- 眼睛瞳孔有淡淡的紫青色数字光环（暗示AI智能）
- 紫色卫衣，袖口有若隐若现的流光线条
- 半透明科技感无线耳机
- 双手插兜放松站姿，尾巴放松卷曲
- 配饰：极简几何发光吊坠 + 智能手表
- 身边有轻微的全息光点漂浮
- 整体氛围：松弛街头感 + 科技智能感的融合
`;

const CONTEXT = `
悦聚是一个社交平台，小悦是平台的AI社交助手。用户会通过和小悦对话来完成注册、填写个人资料、获得活动匹配。

小悦的人设是"街头老狐狸"——混迹社交场合多年，什么人都见过，表面玩世不恭实际靠谱。

现在有两个视觉设计方案：
`;

function generateUserProfiles(count: number): UserProfile[] {
  const ages = ['00后(18-24岁)', '95后(25-29岁)', '90后(30-34岁)', '85后(35-40岁)'];
  const genders = ['男', '女'];
  const occupations = ['互联网/科技', '金融/投资', '设计/创意', '学生', '自由职业', '传统行业'];
  const personalities = ['内向型', '外向型', '社恐但想社交'];
  const techComforts = ['科技爱好者', '普通用户', '对科技不太感冒'];

  const profiles: UserProfile[] = [];
  
  for (let i = 0; i < count; i++) {
    profiles.push({
      id: i + 1,
      age: ages[i % ages.length],
      gender: genders[i % genders.length],
      occupation: occupations[i % occupations.length],
      personality: personalities[i % personalities.length],
      techComfort: techComforts[i % techComforts.length],
    });
  }
  
  for (let i = profiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [profiles[i], profiles[j]] = [profiles[j], profiles[i]];
  }
  
  return profiles;
}

async function evaluateStyle(profile: UserProfile): Promise<StyleFeedback> {
  const prompt = `你是一个${profile.age}的${profile.gender}生，职业是${profile.occupation}，性格${profile.personality}，对科技产品的态度是"${profile.techComfort}"。

${CONTEXT}

${VERSION_A_DESCRIPTION}

${VERSION_B_DESCRIPTION}

请以这个用户的真实视角比较两个方案，用JSON格式回答：

{
  "preferredVersion": "A 或 B 或 都可以",
  "preferenceReason": "选择这个版本的核心原因（一句话）",
  "versionA_trustScore": 1-10的信任感评分,
  "versionB_trustScore": 1-10的信任感评分,
  "versionA_aiFeeling": 1-10这个形象多像一个智能AI助手,
  "versionB_aiFeeling": 1-10这个形象多像一个智能AI助手,
  "concernsAboutA": "对A方案的一个顾虑（如果没有写'无'）",
  "concernsAboutB": "对B方案的一个顾虑（如果没有写'无'）"
}

注意：
- 基于你的用户画像真实回答
- 考虑你作为${profile.techComfort}的身份
- 考虑这是一个帮你社交匹配的AI助手
- 直接输出JSON，不要其他内容`;

  try {
    const response = await deepseekClient.chat.completions.create({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 400,
    });

    const content = response.choices[0]?.message?.content || '{}';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON');
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    return {
      userId: profile.id,
      profile,
      preferredVersion: parsed.preferredVersion === 'A' ? 'A' : (parsed.preferredVersion === 'B' ? 'B' : '都可以'),
      preferenceReason: parsed.preferenceReason || '',
      versionA_trustScore: parsed.versionA_trustScore || 5,
      versionB_trustScore: parsed.versionB_trustScore || 5,
      versionA_aiFeeling: parsed.versionA_aiFeeling || 5,
      versionB_aiFeeling: parsed.versionB_aiFeeling || 5,
      concernsAboutA: parsed.concernsAboutA || '',
      concernsAboutB: parsed.concernsAboutB || '',
    };
  } catch (error) {
    console.error(`Error for user ${profile.id}:`, error);
    return {
      userId: profile.id,
      profile,
      preferredVersion: '都可以',
      preferenceReason: '',
      versionA_trustScore: 0,
      versionB_trustScore: 0,
      versionA_aiFeeling: 0,
      versionB_aiFeeling: 0,
      concernsAboutA: '',
      concernsAboutB: '',
    };
  }
}

async function runBatchEvaluation(profiles: UserProfile[], batchSize: number = 10): Promise<StyleFeedback[]> {
  const results: StyleFeedback[] = [];
  
  for (let i = 0; i < profiles.length; i += batchSize) {
    const batch = profiles.slice(i, i + batchSize);
    console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(profiles.length / batchSize)}...`);
    
    const batchResults = await Promise.all(batch.map(evaluateStyle));
    results.push(...batchResults);
    
    if (i + batchSize < profiles.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
}

function analyzeResults(feedbacks: StyleFeedback[]): void {
  const valid = feedbacks.filter(f => f.versionA_trustScore > 0);
  const total = valid.length;
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 小悦形象风格 A/B测试 - 100人模拟用户报告');
  console.log('='.repeat(60));
  console.log('\n方案A：松弛自然版（无科技元素）');
  console.log('方案B：AI增强版（带科技光效）');
  
  // Overall preference
  const prefA = valid.filter(f => f.preferredVersion === 'A').length;
  const prefB = valid.filter(f => f.preferredVersion === 'B').length;
  const prefBoth = valid.filter(f => f.preferredVersion === '都可以').length;
  
  console.log('\n' + '─'.repeat(60));
  console.log('🏆 总体偏好');
  console.log('─'.repeat(60));
  
  const barA = '█'.repeat(Math.round(prefA / total * 30));
  const barB = '█'.repeat(Math.round(prefB / total * 30));
  
  console.log(`\n方案A（松弛自然）: ${barA} ${prefA}人 (${(prefA/total*100).toFixed(0)}%)`);
  console.log(`方案B（AI增强）  : ${barB} ${prefB}人 (${(prefB/total*100).toFixed(0)}%)`);
  console.log(`都可以: ${prefBoth}人 (${(prefBoth/total*100).toFixed(0)}%)`);
  
  // Score comparison
  const avgTrustA = valid.reduce((sum, f) => sum + f.versionA_trustScore, 0) / total;
  const avgTrustB = valid.reduce((sum, f) => sum + f.versionB_trustScore, 0) / total;
  const avgAiA = valid.reduce((sum, f) => sum + f.versionA_aiFeeling, 0) / total;
  const avgAiB = valid.reduce((sum, f) => sum + f.versionB_aiFeeling, 0) / total;
  
  console.log('\n' + '─'.repeat(60));
  console.log('📈 评分对比');
  console.log('─'.repeat(60));
  console.log(`\n信任感评分：`);
  console.log(`  方案A: ${avgTrustA.toFixed(1)}/10`);
  console.log(`  方案B: ${avgTrustB.toFixed(1)}/10`);
  console.log(`  差距: ${avgTrustA > avgTrustB ? 'A领先' : 'B领先'} ${Math.abs(avgTrustA - avgTrustB).toFixed(1)}分`);
  
  console.log(`\nAI智能感评分：`);
  console.log(`  方案A: ${avgAiA.toFixed(1)}/10`);
  console.log(`  方案B: ${avgAiB.toFixed(1)}/10`);
  console.log(`  差距: ${avgAiA > avgAiB ? 'A领先' : 'B领先'} ${Math.abs(avgAiA - avgAiB).toFixed(1)}分`);
  
  // Tech comfort breakdown
  console.log('\n' + '─'.repeat(60));
  console.log('🔧 按科技态度分组');
  console.log('─'.repeat(60));
  
  const techLover = valid.filter(f => f.profile.techComfort === '科技爱好者');
  const normalUser = valid.filter(f => f.profile.techComfort === '普通用户');
  const techAverse = valid.filter(f => f.profile.techComfort === '对科技不太感冒');
  
  const techLoverA = techLover.filter(f => f.preferredVersion === 'A').length;
  const techLoverB = techLover.filter(f => f.preferredVersion === 'B').length;
  console.log(`\n科技爱好者 (${techLover.length}人): A ${techLoverA}人 vs B ${techLoverB}人`);
  
  const normalA = normalUser.filter(f => f.preferredVersion === 'A').length;
  const normalB = normalUser.filter(f => f.preferredVersion === 'B').length;
  console.log(`普通用户 (${normalUser.length}人): A ${normalA}人 vs B ${normalB}人`);
  
  const averseA = techAverse.filter(f => f.preferredVersion === 'A').length;
  const averseB = techAverse.filter(f => f.preferredVersion === 'B').length;
  console.log(`对科技不太感冒 (${techAverse.length}人): A ${averseA}人 vs B ${averseB}人`);
  
  // Gender breakdown
  console.log('\n' + '─'.repeat(60));
  console.log('👫 性别差异');
  console.log('─'.repeat(60));
  
  const maleA = valid.filter(f => f.profile.gender === '男' && f.preferredVersion === 'A').length;
  const maleB = valid.filter(f => f.profile.gender === '男' && f.preferredVersion === 'B').length;
  const femaleA = valid.filter(f => f.profile.gender === '女' && f.preferredVersion === 'A').length;
  const femaleB = valid.filter(f => f.profile.gender === '女' && f.preferredVersion === 'B').length;
  
  console.log(`男生: A ${maleA}人 vs B ${maleB}人`);
  console.log(`女生: A ${femaleA}人 vs B ${femaleB}人`);
  
  // Age breakdown
  console.log('\n' + '─'.repeat(60));
  console.log('📅 年龄差异');
  console.log('─'.repeat(60));
  
  const ageGroups = ['00后(18-24岁)', '95后(25-29岁)', '90后(30-34岁)', '85后(35-40岁)'];
  ageGroups.forEach(age => {
    const ageA = valid.filter(f => f.profile.age === age && f.preferredVersion === 'A').length;
    const ageB = valid.filter(f => f.profile.age === age && f.preferredVersion === 'B').length;
    const winner = ageA > ageB ? 'A' : (ageB > ageA ? 'B' : '平');
    console.log(`${age}: A ${ageA}人 vs B ${ageB}人 → ${winner}胜`);
  });
  
  // Concerns
  console.log('\n' + '─'.repeat(60));
  console.log('⚠️ 主要顾虑');
  console.log('─'.repeat(60));
  
  const concernsA: Record<string, number> = {};
  const concernsB: Record<string, number> = {};
  
  valid.forEach(f => {
    if (f.concernsAboutA && f.concernsAboutA !== '无') {
      concernsA[f.concernsAboutA] = (concernsA[f.concernsAboutA] || 0) + 1;
    }
    if (f.concernsAboutB && f.concernsAboutB !== '无') {
      concernsB[f.concernsAboutB] = (concernsB[f.concernsAboutB] || 0) + 1;
    }
  });
  
  console.log('\n对方案A的顾虑:');
  Object.entries(concernsA).sort((a, b) => b[1] - a[1]).slice(0, 3).forEach(([c, n]) => {
    console.log(`  - ${c} (${n}人)`);
  });
  
  console.log('\n对方案B的顾虑:');
  Object.entries(concernsB).sort((a, b) => b[1] - a[1]).slice(0, 3).forEach(([c, n]) => {
    console.log(`  - ${c} (${n}人)`);
  });
  
  // Sample reasons
  console.log('\n' + '─'.repeat(60));
  console.log('💬 选择理由示例');
  console.log('─'.repeat(60));
  
  console.log('\n选A的理由:');
  valid.filter(f => f.preferredVersion === 'A').slice(0, 3).forEach(f => {
    console.log(`  [${f.profile.techComfort}] ${f.preferenceReason}`);
  });
  
  console.log('\n选B的理由:');
  valid.filter(f => f.preferredVersion === 'B').slice(0, 3).forEach(f => {
    console.log(`  [${f.profile.techComfort}] ${f.preferenceReason}`);
  });
  
  // Conclusion
  console.log('\n' + '='.repeat(60));
  console.log('📋 结论');
  console.log('='.repeat(60));
  
  const trustWinner = avgTrustA > avgTrustB ? 'A' : 'B';
  const aiWinner = avgAiA > avgAiB ? 'A' : 'B';
  
  if (prefB > prefA * 1.2) {
    console.log(`\n✅ 方案B（AI增强版）更受欢迎，领先${prefB - prefA}票`);
    console.log(`   信任感: ${avgTrustB.toFixed(1)}/10 | AI智能感: ${avgAiB.toFixed(1)}/10`);
  } else if (prefA > prefB * 1.2) {
    console.log(`\n✅ 方案A（松弛自然版）更受欢迎，领先${prefA - prefB}票`);
    console.log(`   信任感: ${avgTrustA.toFixed(1)}/10 | AI智能感: ${avgAiA.toFixed(1)}/10`);
  } else {
    console.log('\n⚖️ 两个方案接受度接近');
    console.log(`   方案A - 信任感${avgTrustA.toFixed(1)} | AI感${avgAiA.toFixed(1)}`);
    console.log(`   方案B - 信任感${avgTrustB.toFixed(1)} | AI感${avgAiB.toFixed(1)}`);
    
    if (trustWinner !== aiWinner) {
      console.log(`\n💡 建议：方案${trustWinner}更可信，方案${aiWinner}更有AI感`);
      console.log('   可考虑折中方案：保持A的松弛感，仅保留B的眼睛光效');
    }
  }
  
  console.log('\n' + '='.repeat(60));
}

async function main() {
  console.log('🦊 开始小悦形象风格A/B测试...\n');
  console.log('方案A：松弛自然版（无科技元素）');
  console.log('方案B：AI增强版（带科技光效）\n');
  
  const userCount = 100;
  console.log(`📋 生成 ${userCount} 个模拟用户画像...`);
  const profiles = generateUserProfiles(userCount);
  
  console.log('🔄 开始收集反馈...\n');
  const feedbacks = await runBatchEvaluation(profiles, 10);
  
  analyzeResults(feedbacks);
}

main().catch(console.error);
