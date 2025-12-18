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

interface DesignFeedback {
  userId: number;
  profile: UserProfile;
  firstImpression: string;
  trustScore: number;
  personaMatch: string;
  likedElements: string[];
  dislikedElements: string[];
  suggestions: string[];
}

const CHARACTER_DESCRIPTION = `
小悦是悦聚平台的AI社交助手，形象设计如下：
- 风格：3D日式动漫风格渲染
- 外貌：年轻男性，暖棕橙色头发，带有微妙的狐狸耳朵从卫衣帽子里露出
- 服装：紫色卫衣，左胸口有小而精致的悦聚logo
- 姿态：双手插在卫衣口袋里，放松自信的站姿
- 表情：嘴角带一丝了然的微笑，眉毛微挑，有种"我知道些什么"的感觉
- 整体氛围：松弛、自信、有点狡黠但靠谱

人设背景：小悦是个"街头老狐狸"（Nick Wilde原型）——混迹社交场合多年，见过太多人，什么场面都能接住。表面玩世不恭，实际上比谁都靠谱。
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
  
  // Shuffle for randomness
  for (let i = profiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [profiles[i], profiles[j]] = [profiles[j], profiles[i]];
  }
  
  return profiles;
}

async function evaluateDesign(profile: UserProfile): Promise<DesignFeedback> {
  const prompt = `你是一个${profile.age}的${profile.gender}生，职业是${profile.occupation}，性格${profile.personality}，社交偏好是${profile.socialStyle}。

你正在注册一个社交平台"悦聚"，这是他们AI助手"小悦"的形象设计：

${CHARACTER_DESCRIPTION}

请以这个用户的视角，真实地评价这个形象设计。用JSON格式回答：

{
  "firstImpression": "一句话描述第一印象（如：亲切、专业、可爱、酷、有距离感等）",
  "trustScore": 1-10的信任感评分,
  "personaMatch": "这个形象是否符合'老狐狸'人设？回答：很符合/比较符合/一般/不太符合/完全不符合，并简短说明原因",
  "likedElements": ["列出你最喜欢的1-3个设计元素"],
  "dislikedElements": ["列出你不喜欢或觉得可以改进的元素，如果没有就留空数组"],
  "suggestions": ["1-2个具体调整建议，如果觉得很好就留空数组"]
}

注意：
- 要基于你的用户画像真实回答，不同年龄/性别/性格的人会有不同看法
- 内向的人可能更关注是否有压迫感
- 女生可能更关注是否有亲切感
- 不同职业的人审美偏好不同
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
      firstImpression: parsed.firstImpression || '未知',
      trustScore: parsed.trustScore || 5,
      personaMatch: parsed.personaMatch || '未知',
      likedElements: parsed.likedElements || [],
      dislikedElements: parsed.dislikedElements || [],
      suggestions: parsed.suggestions || [],
    };
  } catch (error) {
    console.error(`Error evaluating for user ${profile.id}:`, error);
    return {
      userId: profile.id,
      profile,
      firstImpression: '评估失败',
      trustScore: 0,
      personaMatch: '未知',
      likedElements: [],
      dislikedElements: [],
      suggestions: [],
    };
  }
}

async function runBatchEvaluation(profiles: UserProfile[], batchSize: number = 10): Promise<DesignFeedback[]> {
  const results: DesignFeedback[] = [];
  
  for (let i = 0; i < profiles.length; i += batchSize) {
    const batch = profiles.slice(i, i + batchSize);
    console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(profiles.length / batchSize)}...`);
    
    const batchResults = await Promise.all(batch.map(evaluateDesign));
    results.push(...batchResults);
    
    // Rate limiting
    if (i + batchSize < profiles.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
}

function analyzeResults(feedbacks: DesignFeedback[]): void {
  const validFeedbacks = feedbacks.filter(f => f.trustScore > 0);
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 小悦形象设计 - 100人模拟用户反馈报告');
  console.log('='.repeat(60));
  
  // Trust Score Analysis
  const avgTrust = validFeedbacks.reduce((sum, f) => sum + f.trustScore, 0) / validFeedbacks.length;
  console.log(`\n📈 信任感评分：${avgTrust.toFixed(1)}/10`);
  
  const trustDistribution: Record<string, number> = {
    '高(8-10)': validFeedbacks.filter(f => f.trustScore >= 8).length,
    '中(5-7)': validFeedbacks.filter(f => f.trustScore >= 5 && f.trustScore < 8).length,
    '低(1-4)': validFeedbacks.filter(f => f.trustScore < 5).length,
  };
  console.log('  分布：', trustDistribution);
  
  // Gender breakdown
  const maleAvg = validFeedbacks.filter(f => f.profile.gender === '男').reduce((sum, f) => sum + f.trustScore, 0) / validFeedbacks.filter(f => f.profile.gender === '男').length;
  const femaleAvg = validFeedbacks.filter(f => f.profile.gender === '女').reduce((sum, f) => sum + f.trustScore, 0) / validFeedbacks.filter(f => f.profile.gender === '女').length;
  console.log(`  男生评分：${maleAvg.toFixed(1)} | 女生评分：${femaleAvg.toFixed(1)}`);
  
  // Age breakdown
  const ageGroups = ['00后(18-24岁)', '95后(25-29岁)', '90后(30-34岁)', '85后(35-40岁)'];
  console.log('  各年龄段：');
  ageGroups.forEach(age => {
    const ageAvg = validFeedbacks.filter(f => f.profile.age === age).reduce((sum, f) => sum + f.trustScore, 0) / validFeedbacks.filter(f => f.profile.age === age).length;
    console.log(`    ${age}: ${ageAvg.toFixed(1)}`);
  });
  
  // First Impression Analysis
  console.log('\n🎭 第一印象词云：');
  const impressionCounts: Record<string, number> = {};
  validFeedbacks.forEach(f => {
    const keywords = f.firstImpression.split(/[，,、\s]+/);
    keywords.forEach(k => {
      if (k.length >= 2) {
        impressionCounts[k] = (impressionCounts[k] || 0) + 1;
      }
    });
  });
  const topImpressions = Object.entries(impressionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  topImpressions.forEach(([word, count]) => {
    console.log(`  ${word}: ${'█'.repeat(Math.ceil(count / 2))} (${count}人)`);
  });
  
  // Persona Match Analysis
  console.log('\n🦊 人设匹配度：');
  const personaMatches: Record<string, number> = {
    '很符合': 0, '比较符合': 0, '一般': 0, '不太符合': 0, '完全不符合': 0
  };
  validFeedbacks.forEach(f => {
    for (const key of Object.keys(personaMatches)) {
      if (f.personaMatch.includes(key)) {
        personaMatches[key]++;
        break;
      }
    }
  });
  Object.entries(personaMatches).forEach(([match, count]) => {
    const pct = ((count / validFeedbacks.length) * 100).toFixed(0);
    console.log(`  ${match}: ${'█'.repeat(Math.ceil(count / 3))} ${pct}% (${count}人)`);
  });
  
  // Liked Elements
  console.log('\n💜 最受欢迎的设计元素：');
  const likedCounts: Record<string, number> = {};
  validFeedbacks.forEach(f => {
    f.likedElements.forEach(el => {
      likedCounts[el] = (likedCounts[el] || 0) + 1;
    });
  });
  const topLiked = Object.entries(likedCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  topLiked.forEach(([el, count]) => {
    console.log(`  ${el}: ${count}人`);
  });
  
  // Disliked Elements
  console.log('\n⚠️ 需要改进的元素：');
  const dislikedCounts: Record<string, number> = {};
  validFeedbacks.forEach(f => {
    f.dislikedElements.forEach(el => {
      dislikedCounts[el] = (dislikedCounts[el] || 0) + 1;
    });
  });
  const topDisliked = Object.entries(dislikedCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  if (topDisliked.length === 0) {
    console.log('  (无明显不满)');
  } else {
    topDisliked.forEach(([el, count]) => {
      console.log(`  ${el}: ${count}人`);
    });
  }
  
  // Suggestions
  console.log('\n💡 用户调整建议汇总：');
  const suggestionCounts: Record<string, number> = {};
  validFeedbacks.forEach(f => {
    f.suggestions.forEach(s => {
      // Normalize similar suggestions
      const normalized = s.toLowerCase().replace(/[。，！？]/g, '');
      suggestionCounts[s] = (suggestionCounts[s] || 0) + 1;
    });
  });
  const topSuggestions = Object.entries(suggestionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  if (topSuggestions.length === 0) {
    console.log('  (无调整建议)');
  } else {
    topSuggestions.forEach(([s, count], i) => {
      console.log(`  ${i + 1}. ${s} (${count}人)`);
    });
  }
  
  // Sample detailed feedback by segment
  console.log('\n📝 分群体典型反馈示例：');
  
  const segments = [
    { name: '00后女生', filter: (f: DesignFeedback) => f.profile.age.includes('00后') && f.profile.gender === '女' },
    { name: '95后男生', filter: (f: DesignFeedback) => f.profile.age.includes('95后') && f.profile.gender === '男' },
    { name: '内向型用户', filter: (f: DesignFeedback) => f.profile.personality === '内向型' },
    { name: '设计/创意行业', filter: (f: DesignFeedback) => f.profile.occupation.includes('设计') },
  ];
  
  segments.forEach(seg => {
    const sample = validFeedbacks.find(seg.filter);
    if (sample) {
      console.log(`\n  【${seg.name}】`);
      console.log(`  第一印象：${sample.firstImpression}`);
      console.log(`  信任感：${sample.trustScore}/10`);
      console.log(`  人设匹配：${sample.personaMatch}`);
      if (sample.suggestions.length > 0) {
        console.log(`  建议：${sample.suggestions[0]}`);
      }
    }
  });
  
  console.log('\n' + '='.repeat(60));
  console.log('报告结束');
  console.log('='.repeat(60));
}

async function main() {
  console.log('🎨 开始小悦形象设计模拟用户测试...\n');
  
  const userCount = 100;
  console.log(`📋 生成 ${userCount} 个模拟用户画像...`);
  const profiles = generateUserProfiles(userCount);
  
  console.log('🔄 开始收集反馈（这可能需要几分钟）...\n');
  const feedbacks = await runBatchEvaluation(profiles, 10);
  
  analyzeResults(feedbacks);
}

main().catch(console.error);
