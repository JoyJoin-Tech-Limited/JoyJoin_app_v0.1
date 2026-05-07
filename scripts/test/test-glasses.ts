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

interface GlassesFeedback {
  userId: number;
  profile: UserProfile;
  preference: '不戴眼镜' | '细框眼镜' | '墨镜挂领口' | '都可以';
  reason: string;
  trustImpact: '增加信任' | '减少信任' | '没影响';
  smartnessImpact: '增加智慧感' | '减少智慧感' | '没影响';
  concern: string;
}

const CHARACTER_DESCRIPTION = `
【小悦当前设计】
- 拟人化狐狸，Nick Wilde风格，3D日式动漫渲染
- 暖橙棕色毛发
- 慵懒放松的表情，头微微侧倾（倾听姿态）
- 眼神柔和微微向下，瞳孔有微弱紫色光（暗示AI身份）
- 一只手做放心的手势，一只手插兜
- 紫色卫衣，轻微做旧质感
- 尾巴放松卷曲
- 配饰：复古手表 + 简约项链
- 人设："街头老狐狸"——混迹社交场合多年，表面玩世不恭实际靠谱
`;

function generateUserProfiles(count: number): UserProfile[] {
  const ages = ['00后(18-24岁)', '95后(25-29岁)', '90后(30-34岁)', '85后(35-40岁)'];
  const genders = ['男', '女'];
  const occupations = ['互联网/科技', '金融/投资', '设计/创意', '学生', '自由职业', '传统行业'];
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

async function evaluateGlasses(profile: UserProfile): Promise<GlassesFeedback> {
  const prompt = `你是一个${profile.age}的${profile.gender}生，职业是${profile.occupation}，性格${profile.personality}。

悦聚是一个社交平台，小悦是平台的AI社交助手。

${CHARACTER_DESCRIPTION}

现在考虑是否给小悦加上眼镜，有以下选项：
A. 不戴眼镜（保持现状）
B. 细框/无框眼镜（知性感）
C. 墨镜挂在领口（不戴脸上，增加型格）

请以这个用户的真实视角回答，用JSON格式：

{
  "preference": "不戴眼镜 或 细框眼镜 或 墨镜挂领口 或 都可以",
  "reason": "选择的核心原因（一句话）",
  "trustImpact": "戴眼镜对你的信任感是 增加信任 或 减少信任 或 没影响",
  "smartnessImpact": "戴眼镜对智慧感是 增加智慧感 或 减少智慧感 或 没影响",
  "concern": "对戴眼镜的顾虑（如果没有写'无'）"
}

注意：
- 基于你的用户画像真实回答
- 考虑小悦是"街头老狐狸"人设
- 直接输出JSON，不要其他内容`;

  try {
    const response = await deepseekClient.chat.completions.create({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 300,
    });

    const content = response.choices[0]?.message?.content || '{}';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON');
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    return {
      userId: profile.id,
      profile,
      preference: parsed.preference || '不戴眼镜',
      reason: parsed.reason || '',
      trustImpact: parsed.trustImpact || '没影响',
      smartnessImpact: parsed.smartnessImpact || '没影响',
      concern: parsed.concern || '',
    };
  } catch (error) {
    console.error(`Error for user ${profile.id}:`, error);
    return {
      userId: profile.id,
      profile,
      preference: '不戴眼镜',
      reason: '',
      trustImpact: '没影响',
      smartnessImpact: '没影响',
      concern: '',
    };
  }
}

async function runBatchEvaluation(profiles: UserProfile[], batchSize: number = 10): Promise<GlassesFeedback[]> {
  const results: GlassesFeedback[] = [];
  
  for (let i = 0; i < profiles.length; i += batchSize) {
    const batch = profiles.slice(i, i + batchSize);
    console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(profiles.length / batchSize)}...`);
    
    const batchResults = await Promise.all(batch.map(evaluateGlasses));
    results.push(...batchResults);
    
    if (i + batchSize < profiles.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
}

function analyzeResults(feedbacks: GlassesFeedback[]): void {
  const valid = feedbacks.filter(f => f.reason);
  const total = valid.length;
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 小悦是否戴眼镜 - 100人模拟用户测试');
  console.log('='.repeat(60));
  
  // 偏好统计
  console.log('\n' + '─'.repeat(60));
  console.log('🏆 用户偏好');
  console.log('─'.repeat(60));
  
  const prefs = {
    '不戴眼镜': valid.filter(f => f.preference === '不戴眼镜').length,
    '细框眼镜': valid.filter(f => f.preference === '细框眼镜').length,
    '墨镜挂领口': valid.filter(f => f.preference === '墨镜挂领口').length,
    '都可以': valid.filter(f => f.preference === '都可以').length,
  };
  
  Object.entries(prefs).sort((a, b) => b[1] - a[1]).forEach(([pref, count]) => {
    const bar = '█'.repeat(Math.round(count / total * 30));
    console.log(`${pref}: ${bar} ${count}人 (${(count/total*100).toFixed(0)}%)`);
  });
  
  // 信任感影响
  console.log('\n' + '─'.repeat(60));
  console.log('🤝 眼镜对信任感的影响');
  console.log('─'.repeat(60));
  
  const trustUp = valid.filter(f => f.trustImpact === '增加信任').length;
  const trustDown = valid.filter(f => f.trustImpact === '减少信任').length;
  const trustNone = valid.filter(f => f.trustImpact === '没影响').length;
  
  console.log(`增加信任: ${trustUp}人 (${(trustUp/total*100).toFixed(0)}%)`);
  console.log(`减少信任: ${trustDown}人 (${(trustDown/total*100).toFixed(0)}%)`);
  console.log(`没影响: ${trustNone}人 (${(trustNone/total*100).toFixed(0)}%)`);
  
  // 智慧感影响
  console.log('\n' + '─'.repeat(60));
  console.log('🧠 眼镜对智慧感的影响');
  console.log('─'.repeat(60));
  
  const smartUp = valid.filter(f => f.smartnessImpact === '增加智慧感').length;
  const smartDown = valid.filter(f => f.smartnessImpact === '减少智慧感').length;
  const smartNone = valid.filter(f => f.smartnessImpact === '没影响').length;
  
  console.log(`增加智慧感: ${smartUp}人 (${(smartUp/total*100).toFixed(0)}%)`);
  console.log(`减少智慧感: ${smartDown}人 (${(smartDown/total*100).toFixed(0)}%)`);
  console.log(`没影响: ${smartNone}人 (${(smartNone/total*100).toFixed(0)}%)`);
  
  // 性别差异
  console.log('\n' + '─'.repeat(60));
  console.log('👫 性别差异');
  console.log('─'.repeat(60));
  
  const males = valid.filter(f => f.profile.gender === '男');
  const females = valid.filter(f => f.profile.gender === '女');
  
  const maleNoGlasses = males.filter(f => f.preference === '不戴眼镜').length;
  const femaleNoGlasses = females.filter(f => f.preference === '不戴眼镜').length;
  const maleSunglasses = males.filter(f => f.preference === '墨镜挂领口').length;
  const femaleSunglasses = females.filter(f => f.preference === '墨镜挂领口').length;
  
  console.log(`男生: 不戴${maleNoGlasses}人 | 墨镜挂领口${maleSunglasses}人`);
  console.log(`女生: 不戴${femaleNoGlasses}人 | 墨镜挂领口${femaleSunglasses}人`);
  
  // 职业差异
  console.log('\n' + '─'.repeat(60));
  console.log('💼 职业差异');
  console.log('─'.repeat(60));
  
  const occupations = ['互联网/科技', '金融/投资', '设计/创意', '学生'];
  occupations.forEach(occ => {
    const group = valid.filter(f => f.profile.occupation === occ);
    const noGlasses = group.filter(f => f.preference === '不戴眼镜').length;
    const glasses = group.filter(f => f.preference === '细框眼镜').length;
    const sunglasses = group.filter(f => f.preference === '墨镜挂领口').length;
    console.log(`${occ}: 不戴${noGlasses} | 细框${glasses} | 墨镜${sunglasses}`);
  });
  
  // 顾虑
  console.log('\n' + '─'.repeat(60));
  console.log('⚠️ 主要顾虑');
  console.log('─'.repeat(60));
  
  const concerns: Record<string, number> = {};
  valid.forEach(f => {
    if (f.concern && f.concern !== '无') {
      concerns[f.concern] = (concerns[f.concern] || 0) + 1;
    }
  });
  
  Object.entries(concerns).sort((a, b) => b[1] - a[1]).slice(0, 5).forEach(([c, n]) => {
    console.log(`  - ${c} (${n}人)`);
  });
  
  // 理由示例
  console.log('\n' + '─'.repeat(60));
  console.log('💬 选择理由示例');
  console.log('─'.repeat(60));
  
  console.log('\n选"不戴眼镜"的理由:');
  valid.filter(f => f.preference === '不戴眼镜').slice(0, 2).forEach(f => {
    console.log(`  [${f.profile.occupation}] ${f.reason}`);
  });
  
  console.log('\n选"墨镜挂领口"的理由:');
  valid.filter(f => f.preference === '墨镜挂领口').slice(0, 2).forEach(f => {
    console.log(`  [${f.profile.occupation}] ${f.reason}`);
  });
  
  console.log('\n选"细框眼镜"的理由:');
  valid.filter(f => f.preference === '细框眼镜').slice(0, 2).forEach(f => {
    console.log(`  [${f.profile.occupation}] ${f.reason}`);
  });
  
  // 结论
  console.log('\n' + '='.repeat(60));
  console.log('📋 结论');
  console.log('='.repeat(60));
  
  const winner = Object.entries(prefs).sort((a, b) => b[1] - a[1])[0];
  
  if (winner[0] === '不戴眼镜' && winner[1] > total * 0.5) {
    console.log(`\n✅ 建议：不戴眼镜（${winner[1]}人偏好，${(winner[1]/total*100).toFixed(0)}%）`);
    console.log('   眼镜会削弱"街头老狐狸"的松弛人设');
  } else if (winner[0] === '墨镜挂领口') {
    console.log(`\n✅ 建议：墨镜挂领口（${winner[1]}人偏好）`);
    console.log('   增加型格但不遮挡重要的眼神设计');
  } else {
    console.log(`\n⚖️ 意见分散，最多人选：${winner[0]}（${winner[1]}人）`);
  }
  
  console.log('\n' + '='.repeat(60));
}

async function main() {
  console.log('🦊 开始眼镜测试...\n');
  
  const userCount = 100;
  console.log(`📋 生成 ${userCount} 个模拟用户画像...`);
  const profiles = generateUserProfiles(userCount);
  
  console.log('🔄 开始收集反馈...\n');
  const feedbacks = await runBatchEvaluation(profiles, 10);
  
  analyzeResults(feedbacks);
}

main().catch(console.error);
