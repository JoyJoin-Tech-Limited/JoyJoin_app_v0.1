import OpenAI from 'openai';

const deepseekClient = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
});

const USER_PROFILES = {
  ageGroups: ['90后(25-34岁)', '95后(25-29岁)', '00后(20-24岁)', '85后(35-39岁)'],
  genders: ['女性', '男性'],
  occupations: ['大厂打工人', '金融从业者', '创业者', '学生', '自由职业', '传统行业', '公务员/国企'],
  socialStyles: ['外向活泼型', '内向慢热型', '社恐但渴望社交型', '选择性社交型'],
  patienceLevel: ['急性子(希望快速完成)', '中等耐心', '慢热型(喜欢深度交流)'],
  techFamiliarity: ['科技达人', '普通用户', '不太熟悉App'],
  cities: ['香港', '深圳', '广州', '北京', '上海']
};

const SURVEY_CONTEXT = `
【JoyJoin 应用背景】
JoyJoin是一个本地微型活动社交平台，帮助用户通过5-10人的小型活动认识新朋友。
为了精准匹配活动伙伴，我们使用"12原型动物社交氛围系统"来了解用户的社交风格。

【12原型系统说明】
通过12道场景题，分析用户的6个社交维度（亲和力、开放性、责任心、情绪稳定、外向性、积极性），
匹配到12个社交原型之一（如"corgi"、"koala"、"fox"等）。
这个测试大约需要2-3分钟完成。

【当前问题】
我们正在设计新用户注册流程，有两个方案需要选择：

【方案A：性格测试融入对话注册】
根据用户选择的模式，性格测试融入程度不同：
- 闪电模式(90秒)：跳过性格测试，先注册，后续必须补测才能参加活动
- 标准模式(3分钟)：融入3-5道精简版性格题
- 深度模式(5分钟)：融入完整12道性格测试

特点：一次完成所有，但时间可能较长

【方案B：性格测试作为独立步骤】
- 对话注册只收集基础信息（昵称、性别、年龄、城市、兴趣等），约2分钟
- 注册完成后，跳转到独立的"性格测试"页面
- 性格测试可以选择：
  a) 传统问卷形式（12道选择题，2-3分钟）
  b) 继续和小悦对话完成（更自然，但时间略长）

特点：分步完成，每步更短，但需要两个步骤
`;

interface SurveyResponse {
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
  preferredOption: 'A' | 'B';
  ratings: {
    optionA_appeal: number;
    optionB_appeal: number;
    optionA_completionLikelihood: number;
    optionB_completionLikelihood: number;
  };
  reasoning: string;
  concerns: {
    optionA: string;
    optionB: string;
  };
  suggestions: string;
  ifChoosingB_preferredTestFormat: 'questionnaire' | 'chat';
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

async function simulateSurvey(profile: ReturnType<typeof generateRandomProfile>): Promise<SurveyResponse> {
  const prompt = `你是一个模拟用户研究的AI。请扮演以下用户画像，对JoyJoin的两个注册流程方案给出真实、具体的反馈。

【你的用户画像】
- 年龄段：${profile.ageGroup}
- 性别：${profile.gender}
- 职业：${profile.occupation}
- 社交风格：${profile.socialStyle}
- 耐心程度：${profile.patienceLevel}
- 科技熟悉度：${profile.techFamiliarity}
- 所在城市：${profile.city}

${SURVEY_CONTEXT}

请基于你的用户画像，给出以下结构化反馈（JSON格式）：

{
  "preferredOption": "<A或B，你更倾向哪个方案>",
  "ratings": {
    "optionA_appeal": <1-10分，方案A的吸引力>,
    "optionB_appeal": <1-10分，方案B的吸引力>,
    "optionA_completionLikelihood": <1-10分，选择方案A时你完成全程的可能性>,
    "optionB_completionLikelihood": <1-10分，选择方案B时你完成全程（包括性格测试）的可能性>
  },
  "reasoning": "<一句话解释你的选择原因>",
  "concerns": {
    "optionA": "<对方案A的主要担忧>",
    "optionB": "<对方案B的主要担忧>"
  },
  "suggestions": "<你对这两个方案的改进建议>",
  "ifChoosingB_preferredTestFormat": "<如果选B，你更喜欢questionnaire(问卷)还是chat(对话)形式做性格测试>"
}

注意：
1. 请完全代入你的用户画像来回答，而不是给出"理性"或"客观"的分析
2. 考虑你的耐心程度、社交风格等因素如何影响你的选择
3. JSON格式必须正确，不要包含注释`;

  const response = await deepseekClient.chat.completions.create({
    model: 'deepseek-chat',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.8,
    max_tokens: 1000,
  });

  const content = response.choices[0]?.message?.content || '';
  
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found');
    
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
        city: profile.city,
      },
      preferredOption: parsed.preferredOption || 'B',
      ratings: {
        optionA_appeal: parsed.ratings?.optionA_appeal || 5,
        optionB_appeal: parsed.ratings?.optionB_appeal || 5,
        optionA_completionLikelihood: parsed.ratings?.optionA_completionLikelihood || 5,
        optionB_completionLikelihood: parsed.ratings?.optionB_completionLikelihood || 5,
      },
      reasoning: parsed.reasoning || '',
      concerns: {
        optionA: parsed.concerns?.optionA || '',
        optionB: parsed.concerns?.optionB || '',
      },
      suggestions: parsed.suggestions || '',
      ifChoosingB_preferredTestFormat: parsed.ifChoosingB_preferredTestFormat || 'questionnaire',
    };
  } catch (error) {
    console.error(`Failed to parse response for profile ${profile.profileId}:`, error);
    return {
      profileId: profile.profileId,
      profile: {
        ageGroup: profile.ageGroup,
        gender: profile.gender,
        occupation: profile.occupation,
        socialStyle: profile.socialStyle,
        patienceLevel: profile.patienceLevel,
        techFamiliarity: profile.techFamiliarity,
        city: profile.city,
      },
      preferredOption: 'B',
      ratings: {
        optionA_appeal: 5,
        optionB_appeal: 5,
        optionA_completionLikelihood: 5,
        optionB_completionLikelihood: 5,
      },
      reasoning: 'Parse error',
      concerns: { optionA: '', optionB: '' },
      suggestions: '',
      ifChoosingB_preferredTestFormat: 'questionnaire',
    };
  }
}

async function runSurvey(sampleSize: number = 100) {
  console.log(`\n🔬 开始模拟用户调研：性格测试融入方式\n`);
  console.log(`样本量：${sampleSize}人\n`);
  console.log('='.repeat(60));

  const results: SurveyResponse[] = [];
  const batchSize = 10;
  
  for (let i = 0; i < sampleSize; i += batchSize) {
    const batch = [];
    for (let j = i; j < Math.min(i + batchSize, sampleSize); j++) {
      const profile = generateRandomProfile(j + 1);
      batch.push(simulateSurvey(profile));
    }
    
    const batchResults = await Promise.all(batch);
    results.push(...batchResults);
    
    console.log(`已完成 ${Math.min(i + batchSize, sampleSize)}/${sampleSize} 个用户...`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 调研结果汇总\n');

  const optionACount = results.filter(r => r.preferredOption === 'A').length;
  const optionBCount = results.filter(r => r.preferredOption === 'B').length;
  
  console.log('【投票结果】');
  console.log(`方案A (融入对话): ${optionACount}票 (${(optionACount/sampleSize*100).toFixed(1)}%)`);
  console.log(`方案B (独立步骤): ${optionBCount}票 (${(optionBCount/sampleSize*100).toFixed(1)}%)`);
  console.log('');

  const avgRatings = {
    optionA_appeal: results.reduce((sum, r) => sum + r.ratings.optionA_appeal, 0) / sampleSize,
    optionB_appeal: results.reduce((sum, r) => sum + r.ratings.optionB_appeal, 0) / sampleSize,
    optionA_completionLikelihood: results.reduce((sum, r) => sum + r.ratings.optionA_completionLikelihood, 0) / sampleSize,
    optionB_completionLikelihood: results.reduce((sum, r) => sum + r.ratings.optionB_completionLikelihood, 0) / sampleSize,
  };

  console.log('【平均评分】');
  console.log(`方案A 吸引力: ${avgRatings.optionA_appeal.toFixed(2)}/10`);
  console.log(`方案B 吸引力: ${avgRatings.optionB_appeal.toFixed(2)}/10`);
  console.log(`方案A 完成可能性: ${avgRatings.optionA_completionLikelihood.toFixed(2)}/10`);
  console.log(`方案B 完成可能性: ${avgRatings.optionB_completionLikelihood.toFixed(2)}/10`);
  console.log('');

  const questionnairePreference = results.filter(r => r.ifChoosingB_preferredTestFormat === 'questionnaire').length;
  const chatPreference = results.filter(r => r.ifChoosingB_preferredTestFormat === 'chat').length;
  
  console.log('【如果选方案B，性格测试形式偏好】');
  console.log(`问卷形式: ${questionnairePreference}票 (${(questionnairePreference/sampleSize*100).toFixed(1)}%)`);
  console.log(`对话形式: ${chatPreference}票 (${(chatPreference/sampleSize*100).toFixed(1)}%)`);
  console.log('');

  console.log('【按用户特征分析】');
  
  const byPatience: Record<string, { A: number; B: number }> = {};
  USER_PROFILES.patienceLevel.forEach(level => {
    const subset = results.filter(r => r.profile.patienceLevel === level);
    byPatience[level] = {
      A: subset.filter(r => r.preferredOption === 'A').length,
      B: subset.filter(r => r.preferredOption === 'B').length,
    };
  });
  
  console.log('\n耐心程度 vs 方案偏好:');
  Object.entries(byPatience).forEach(([level, counts]) => {
    const total = counts.A + counts.B;
    if (total > 0) {
      console.log(`  ${level}: A=${counts.A}(${(counts.A/total*100).toFixed(0)}%) B=${counts.B}(${(counts.B/total*100).toFixed(0)}%)`);
    }
  });

  const bySocialStyle: Record<string, { A: number; B: number }> = {};
  USER_PROFILES.socialStyles.forEach(style => {
    const subset = results.filter(r => r.profile.socialStyle === style);
    bySocialStyle[style] = {
      A: subset.filter(r => r.preferredOption === 'A').length,
      B: subset.filter(r => r.preferredOption === 'B').length,
    };
  });
  
  console.log('\n社交风格 vs 方案偏好:');
  Object.entries(bySocialStyle).forEach(([style, counts]) => {
    const total = counts.A + counts.B;
    if (total > 0) {
      console.log(`  ${style}: A=${counts.A}(${(counts.A/total*100).toFixed(0)}%) B=${counts.B}(${(counts.B/total*100).toFixed(0)}%)`);
    }
  });

  console.log('\n【常见担忧 - 方案A】');
  const concernsA: Record<string, number> = {};
  results.forEach(r => {
    if (r.concerns.optionA) {
      const key = r.concerns.optionA.slice(0, 50);
      concernsA[key] = (concernsA[key] || 0) + 1;
    }
  });
  Object.entries(concernsA)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([concern, count]) => console.log(`  (${count}次) ${concern}...`));

  console.log('\n【常见担忧 - 方案B】');
  const concernsB: Record<string, number> = {};
  results.forEach(r => {
    if (r.concerns.optionB) {
      const key = r.concerns.optionB.slice(0, 50);
      concernsB[key] = (concernsB[key] || 0) + 1;
    }
  });
  Object.entries(concernsB)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([concern, count]) => console.log(`  (${count}次) ${concern}...`));

  console.log('\n【选择原因示例】');
  const sampleReasons = results.slice(0, 10).map(r => 
    `[${r.profile.patienceLevel}/${r.profile.socialStyle}] 选${r.preferredOption}: ${r.reasoning}`
  );
  sampleReasons.forEach(r => console.log(`  ${r}`));

  console.log('\n' + '='.repeat(60));
  console.log('🎯 调研结论');
  
  if (optionACount > optionBCount * 1.2) {
    console.log('\n推荐：方案A（融入对话注册）更受欢迎');
  } else if (optionBCount > optionACount * 1.2) {
    console.log('\n推荐：方案B（独立步骤）更受欢迎');
  } else {
    console.log('\n结论：两个方案接受度相近，可考虑提供选择');
  }

  const completionDiff = avgRatings.optionB_completionLikelihood - avgRatings.optionA_completionLikelihood;
  if (Math.abs(completionDiff) > 0.5) {
    console.log(`\n完成率预测：方案${completionDiff > 0 ? 'B' : 'A'}的完成可能性更高 (差异${Math.abs(completionDiff).toFixed(2)}分)`);
  }

  if (chatPreference > questionnairePreference) {
    console.log('\n性格测试形式：用户更倾向对话形式');
  } else {
    console.log('\n性格测试形式：用户更倾向问卷形式（更快捷）');
  }

  console.log('\n' + '='.repeat(60));
}

runSurvey(100).catch(console.error);
