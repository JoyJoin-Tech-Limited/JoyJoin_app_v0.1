import OpenAI from 'openai';

const deepseekClient = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
});

// 用户画像维度
const USER_PROFILES = {
  ageGroups: ['90后(25-34岁)', '95后(25-29岁)', '00后(20-24岁)', '85后(35-39岁)'],
  genders: ['女性', '男性'],
  occupations: ['大厂打工人', '金融从业者', '创业者', '学生', '自由职业', '传统行业', '公务员/国企'],
  socialStyles: ['外向活泼型', '内向慢热型', '社恐但渴望社交型', '选择性社交型'],
  patienceLevel: ['急性子(希望快速完成)', '中等耐心', '慢热型(喜欢深度交流)'],
  techFamiliarity: ['科技达人', '普通用户', '不太熟悉App'],
  cities: ['香港', '深圳', '广州', '北京', '上海']
};

// 当前注册流程设计（供模拟用户评价）
const REGISTRATION_FLOW_DESIGN = `
【JoyJoin 3分钟对话注册流程设计】

流程概述：通过AI小悦的自然对话，在约10轮交互中收集用户信息

第1轮：开场白 + 问昵称
第2轮：性别 + 年龄段（提供快捷按钮：90后/95后/00后）
第3轮：现居城市（快捷按钮）
第4轮：职业/身份（开放式或快捷按钮）
第5轮：兴趣爱好（多选快捷按钮：美食探店、户外运动、看展等）
第6轮：活动意图（快捷按钮：交朋友/拓展人脉/纯玩放松）
第7轮：人生阶段 + 年龄匹配偏好（捆绑问题）
第8轮：美食/场地偏好（可选快捷按钮）
第9轮：宠物/其他个性化问题（可选）
第10轮：总结 + 成就庆祝 + 完成

特色功能：
- 解锁成就系统（如"铲屎官认证"、"本地生存指南"等趣味徽章）
- 实时标签云（显示已收集的兴趣偏好）
- 小悦心情渐变（表情随对话深入变化：🌱→🌿→🌳→🌸→💮）
- 背景氛围渐变（冷色调→暖紫色）
- 快捷回复按钮 + 自由输入选项
- 优雅提前结束（核心数据收齐后可随时完成）
`;

interface SimulatedUserFeedback {
  profileId: number;
  profile: {
    ageGroup: string;
    gender: string;
    occupation: string;
    socialStyle: string;
    patienceLevel: string;
    techFamiliarity: string;
    city: string;
  };
  ratings: {
    overallSatisfaction: number; // 1-10
    flowLength: number; // 1-10 (是否合适)
    quickReplyDesign: number; // 1-10
    achievementSystem: number; // 1-10
    tagCloud: number; // 1-10
    moodProgression: number; // 1-10
    earlyExitOption: number; // 1-10
    privacyComfort: number; // 1-10
  };
  preferences: {
    preferQuickReply: boolean;
    wouldCompleteIn3Min: boolean;
    wouldRecommendToFriend: boolean;
  };
  feedback: {
    favoriteFeature: string;
    mostAnnoyingQuestion: string;
    dropOffRisk: string; // 什么情况会放弃
    suggestions: string[];
  };
}

function generateRandomProfile(id: number) {
  return {
    profileId: id,
    ageGroup: USER_PROFILES.ageGroups[Math.floor(Math.random() * USER_PROFILES.ageGroups.length)],
    gender: USER_PROFILES.genders[Math.floor(Math.random() * USER_PROFILES.genders.length)],
    occupation: USER_PROFILES.occupations[Math.floor(Math.random() * USER_PROFILES.occupations.length)],
    socialStyle: USER_PROFILES.socialStyles[Math.floor(Math.random() * USER_PROFILES.socialStyles.length)],
    patienceLevel: USER_PROFILES.patienceLevel[Math.floor(Math.random() * USER_PROFILES.patienceLevel.length)],
    techFamiliarity: USER_PROFILES.techFamiliarity[Math.floor(Math.random() * USER_PROFILES.techFamiliarity.length)],
    city: USER_PROFILES.cities[Math.floor(Math.random() * USER_PROFILES.cities.length)]
  };
}

async function simulateUserFeedback(profile: ReturnType<typeof generateRandomProfile>): Promise<SimulatedUserFeedback> {
  const prompt = `你是一个模拟用户研究的AI。请扮演以下用户画像，对JoyJoin的注册流程设计给出真实、具体的反馈。

【你的用户画像】
- 年龄段：${profile.ageGroup}
- 性别：${profile.gender}
- 职业：${profile.occupation}
- 社交风格：${profile.socialStyle}
- 耐心程度：${profile.patienceLevel}
- 科技熟悉度：${profile.techFamiliarity}
- 所在城市：${profile.city}

${REGISTRATION_FLOW_DESIGN}

请基于你的用户画像，给出以下结构化反馈（JSON格式）：

{
  "ratings": {
    "overallSatisfaction": <1-10分，整体满意度>,
    "flowLength": <1-10分，10轮对话长度是否合适>,
    "quickReplyDesign": <1-10分，快捷回复按钮设计>,
    "achievementSystem": <1-10分，成就解锁系统吸引力>,
    "tagCloud": <1-10分，标签云效果>,
    "moodProgression": <1-10分，小悦心情渐变>,
    "earlyExitOption": <1-10分，提前结束选项>,
    "privacyComfort": <1-10分，隐私舒适度>
  },
  "preferences": {
    "preferQuickReply": <true/false，是否更喜欢快捷回复而非打字>,
    "wouldCompleteIn3Min": <true/false，是否愿意花3分钟完成>,
    "wouldRecommendToFriend": <true/false，是否会推荐给朋友>
  },
  "feedback": {
    "favoriteFeature": "<最喜欢的功能，一句话>",
    "mostAnnoyingQuestion": "<最可能让你烦的问题类型，一句话>",
    "dropOffRisk": "<什么情况下你会放弃注册，一句话>",
    "suggestions": ["<具体改进建议1>", "<具体改进建议2>"]
  }
}

注意：
1. 请真实反映这个用户画像的真实反应，不要过于正面
2. 急性子用户应该给flowLength较低分
3. 社恐用户可能对某些问题敏感
4. 建议要具体、可执行
5. 只返回JSON，不要其他内容`;

  try {
    const response = await deepseekClient.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: '你是一个专业的用户研究模拟器，能够真实模拟不同画像用户的反馈。请严格按照JSON格式返回。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.8,
      max_tokens: 800,
    });

    const content = response.choices[0]?.message?.content || '{}';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        profileId: profile.profileId,
        profile: {
          ageGroup: profile.ageGroup,
          gender: profile.gender,
          occupation: profile.occupation,
          socialStyle: profile.socialStyle,
          patienceLevel: profile.patienceLevel,
          techFamiliarity: profile.techFamiliarity,
          city: profile.city
        },
        ratings: parsed.ratings || {},
        preferences: parsed.preferences || {},
        feedback: parsed.feedback || {}
      };
    }
    throw new Error('Invalid JSON response');
  } catch (error) {
    console.error(`Error for profile ${profile.profileId}:`, error);
    return {
      profileId: profile.profileId,
      profile: {
        ageGroup: profile.ageGroup,
        gender: profile.gender,
        occupation: profile.occupation,
        socialStyle: profile.socialStyle,
        patienceLevel: profile.patienceLevel,
        techFamiliarity: profile.techFamiliarity,
        city: profile.city
      },
      ratings: { overallSatisfaction: 0, flowLength: 0, quickReplyDesign: 0, achievementSystem: 0, tagCloud: 0, moodProgression: 0, earlyExitOption: 0, privacyComfort: 0 },
      preferences: { preferQuickReply: false, wouldCompleteIn3Min: false, wouldRecommendToFriend: false },
      feedback: { favoriteFeature: '', mostAnnoyingQuestion: '', dropOffRisk: '', suggestions: [] }
    };
  }
}

async function runBatchSimulation(totalUsers: number, batchSize: number = 10) {
  const allResults: SimulatedUserFeedback[] = [];
  const batches = Math.ceil(totalUsers / batchSize);
  
  console.log(`\n🚀 开始模拟 ${totalUsers} 个用户调研...`);
  console.log(`📦 分 ${batches} 批进行，每批 ${batchSize} 个用户\n`);
  
  for (let batch = 0; batch < batches; batch++) {
    const startIdx = batch * batchSize;
    const endIdx = Math.min(startIdx + batchSize, totalUsers);
    const profiles = [];
    
    for (let i = startIdx; i < endIdx; i++) {
      profiles.push(generateRandomProfile(i + 1));
    }
    
    console.log(`⏳ 批次 ${batch + 1}/${batches}: 处理用户 ${startIdx + 1}-${endIdx}...`);
    
    const batchResults = await Promise.all(profiles.map(p => simulateUserFeedback(p)));
    allResults.push(...batchResults);
    
    console.log(`✅ 批次 ${batch + 1} 完成`);
    
    // 避免API限流
    if (batch < batches - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return allResults;
}

function analyzeResults(results: SimulatedUserFeedback[]) {
  const validResults = results.filter(r => r.ratings.overallSatisfaction > 0);
  const n = validResults.length;
  
  if (n === 0) {
    return { error: 'No valid results' };
  }
  
  // 计算平均评分
  const avgRatings = {
    overallSatisfaction: validResults.reduce((sum, r) => sum + r.ratings.overallSatisfaction, 0) / n,
    flowLength: validResults.reduce((sum, r) => sum + r.ratings.flowLength, 0) / n,
    quickReplyDesign: validResults.reduce((sum, r) => sum + r.ratings.quickReplyDesign, 0) / n,
    achievementSystem: validResults.reduce((sum, r) => sum + r.ratings.achievementSystem, 0) / n,
    tagCloud: validResults.reduce((sum, r) => sum + r.ratings.tagCloud, 0) / n,
    moodProgression: validResults.reduce((sum, r) => sum + r.ratings.moodProgression, 0) / n,
    earlyExitOption: validResults.reduce((sum, r) => sum + r.ratings.earlyExitOption, 0) / n,
    privacyComfort: validResults.reduce((sum, r) => sum + r.ratings.privacyComfort, 0) / n,
  };
  
  // 计算偏好百分比
  const preferenceStats = {
    preferQuickReply: (validResults.filter(r => r.preferences.preferQuickReply).length / n * 100).toFixed(1) + '%',
    wouldCompleteIn3Min: (validResults.filter(r => r.preferences.wouldCompleteIn3Min).length / n * 100).toFixed(1) + '%',
    wouldRecommendToFriend: (validResults.filter(r => r.preferences.wouldRecommendToFriend).length / n * 100).toFixed(1) + '%',
  };
  
  // 收集所有建议并统计词频
  const allSuggestions: string[] = [];
  const allFavorites: string[] = [];
  const allAnnoyances: string[] = [];
  const allDropOffRisks: string[] = [];
  
  validResults.forEach(r => {
    if (r.feedback.suggestions) allSuggestions.push(...r.feedback.suggestions);
    if (r.feedback.favoriteFeature) allFavorites.push(r.feedback.favoriteFeature);
    if (r.feedback.mostAnnoyingQuestion) allAnnoyances.push(r.feedback.mostAnnoyingQuestion);
    if (r.feedback.dropOffRisk) allDropOffRisks.push(r.feedback.dropOffRisk);
  });
  
  // 按用户画像分组分析
  const byPatienceLevel: Record<string, number[]> = {};
  const bySocialStyle: Record<string, number[]> = {};
  
  validResults.forEach(r => {
    const patience = r.profile.patienceLevel;
    const social = r.profile.socialStyle;
    
    if (!byPatienceLevel[patience]) byPatienceLevel[patience] = [];
    byPatienceLevel[patience].push(r.ratings.overallSatisfaction);
    
    if (!bySocialStyle[social]) bySocialStyle[social] = [];
    bySocialStyle[social].push(r.ratings.overallSatisfaction);
  });
  
  const patienceLevelAnalysis = Object.entries(byPatienceLevel).map(([level, scores]) => ({
    level,
    avgSatisfaction: (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2),
    count: scores.length
  }));
  
  const socialStyleAnalysis = Object.entries(bySocialStyle).map(([style, scores]) => ({
    style,
    avgSatisfaction: (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2),
    count: scores.length
  }));
  
  return {
    sampleSize: n,
    averageRatings: Object.entries(avgRatings).map(([key, val]) => ({ metric: key, score: val.toFixed(2) })),
    preferenceStats,
    patienceLevelAnalysis,
    socialStyleAnalysis,
    topSuggestions: allSuggestions.slice(0, 50),
    topFavorites: allFavorites.slice(0, 30),
    topAnnoyances: allAnnoyances.slice(0, 30),
    topDropOffRisks: allDropOffRisks.slice(0, 30),
  };
}

async function main() {
  const TOTAL_USERS = 100; // 先测试100个，成功后可改为1000
  const BATCH_SIZE = 10;
  
  console.log('='.repeat(60));
  console.log('🔬 JoyJoin 注册流程模拟用户调研');
  console.log('='.repeat(60));
  
  const startTime = Date.now();
  const results = await runBatchSimulation(TOTAL_USERS, BATCH_SIZE);
  const endTime = Date.now();
  
  console.log(`\n⏱️ 调研完成，耗时 ${((endTime - startTime) / 1000).toFixed(1)} 秒\n`);
  
  const analysis = analyzeResults(results);
  
  console.log('='.repeat(60));
  console.log('📊 调研结果分析');
  console.log('='.repeat(60));
  
  console.log('\n📈 平均评分 (1-10分):');
  if (Array.isArray(analysis.averageRatings)) {
    analysis.averageRatings.forEach(r => {
      console.log(`  ${r.metric}: ${r.score}`);
    });
  }
  
  console.log('\n👥 用户偏好统计:');
  if (analysis.preferenceStats) {
    console.log(`  偏好快捷回复: ${analysis.preferenceStats.preferQuickReply}`);
    console.log(`  愿意花3分钟完成: ${analysis.preferenceStats.wouldCompleteIn3Min}`);
    console.log(`  愿意推荐给朋友: ${analysis.preferenceStats.wouldRecommendToFriend}`);
  }
  
  console.log('\n⏱️ 按耐心程度分组:');
  if (Array.isArray(analysis.patienceLevelAnalysis)) {
    analysis.patienceLevelAnalysis.forEach(p => {
      console.log(`  ${p.level}: 平均满意度 ${p.avgSatisfaction} (n=${p.count})`);
    });
  }
  
  console.log('\n💬 按社交风格分组:');
  if (Array.isArray(analysis.socialStyleAnalysis)) {
    analysis.socialStyleAnalysis.forEach(s => {
      console.log(`  ${s.style}: 平均满意度 ${s.avgSatisfaction} (n=${s.count})`);
    });
  }
  
  console.log('\n💡 精选建议 (前20条):');
  if (Array.isArray(analysis.topSuggestions)) {
    analysis.topSuggestions.slice(0, 20).forEach((s, i) => {
      console.log(`  ${i + 1}. ${s}`);
    });
  }
  
  console.log('\n❤️ 最受欢迎功能 (前10条):');
  if (Array.isArray(analysis.topFavorites)) {
    analysis.topFavorites.slice(0, 10).forEach((f, i) => {
      console.log(`  ${i + 1}. ${f}`);
    });
  }
  
  console.log('\n😤 最让人烦的问题类型 (前10条):');
  if (Array.isArray(analysis.topAnnoyances)) {
    analysis.topAnnoyances.slice(0, 10).forEach((a, i) => {
      console.log(`  ${i + 1}. ${a}`);
    });
  }
  
  console.log('\n🚪 放弃注册的风险点 (前10条):');
  if (Array.isArray(analysis.topDropOffRisks)) {
    analysis.topDropOffRisks.slice(0, 10).forEach((d, i) => {
      console.log(`  ${i + 1}. ${d}`);
    });
  }
  
  // 保存完整结果到文件
  const fs = await import('fs');
  const outputPath = 'scripts/user_research_results.json';
  fs.writeFileSync(outputPath, JSON.stringify({ results, analysis }, null, 2));
  console.log(`\n📁 完整结果已保存到: ${outputPath}`);
  
  return { results, analysis };
}

main().catch(console.error);
