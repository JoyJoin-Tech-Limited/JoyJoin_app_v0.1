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

interface TrustDetailFeedback {
  userId: number;
  profile: UserProfile;
  
  // 各细节的信任感提升评分 (1-10)
  whiteEarFur: number;        // 耳朵白毛（阅历感）
  eyeWrinkles: number;        // 眼角细微纹路
  listeningPose: number;      // 倾听姿态（头微倾）
  handGesture: number;        // 手部"放心"手势
  eyeDirectionDown: number;   // 眼神微微向下
  messyFur: number;           // 毛发略蓬松
  pocketDetails: number;      // 口袋露出生活物品
  cafeBackground: number;     // 背景咖啡店暗示
  
  // 最重要的3个细节
  top3Details: string[];
  
  // 应该避免的细节
  avoidDetails: string[];
  
  // 整体建议
  suggestion: string;
}

const BASE_DESIGN = `
【小悦当前设计】
- 拟人化狐狸，Nick Wilde风格，3D日式动漫渲染
- 暖橙棕色毛发
- 慵懒放松的表情，沉稳柔和的眼神（瞳孔有微弱紫色光芒暗示AI身份）
- 紫色卫衣，轻微做旧质感
- 双手插兜放松站姿，尾巴放松卷曲
- 配饰：复古手表 + 简约项链
- 人设："街头老狐狸"——混迹社交场合多年，表面玩世不恭实际靠谱
`;

const TRUST_DETAILS = `
【考虑添加的信任感增强细节】

A. 阅历感细节：
   1. 耳朵边缘有一小撮白毛（暗示经验丰富）
   2. 眼角有细微纹路（暗示阅历）

B. 姿态调整：
   3. 身体略微侧身、头微微倾斜（倾听姿态）
   4. 一只手轻轻露出做"放心交给我"的手势

C. 眼神调整：
   5. 眼神微微向下看（减少压迫感，更亲和）

D. 质感细节：
   6. 毛发略微蓬松不完美、有几缕乱毛（更真实）

E. 生活化细节：
   7. 卫衣口袋露出半截手机或钥匙扣（生活感）

F. 背景暗示：
   8. 身后隐约有咖啡店/书架轮廓（暗示常混社交场合）
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

async function evaluateTrustDetails(profile: UserProfile): Promise<TrustDetailFeedback> {
  const prompt = `你是一个${profile.age}的${profile.gender}生，职业是${profile.occupation}，性格${profile.personality}。

悦聚是一个社交平台，小悦是平台的AI社交助手，帮用户注册、填资料、匹配活动。

${BASE_DESIGN}

${TRUST_DETAILS}

请以这个用户的真实视角评估这些细节，用JSON格式回答：

{
  "whiteEarFur": 1-10这个细节对你的信任感提升多少,
  "eyeWrinkles": 1-10,
  "listeningPose": 1-10,
  "handGesture": 1-10,
  "eyeDirectionDown": 1-10,
  "messyFur": 1-10,
  "pocketDetails": 1-10,
  "cafeBackground": 1-10,
  "top3Details": ["你认为最能提升信任感的3个细节名称"],
  "avoidDetails": ["你觉得可能反效果的细节，如果没有就空数组"],
  "suggestion": "一句话整体建议"
}

细节名称对照：
1=耳朵白毛, 2=眼角纹路, 3=倾听姿态, 4=手部手势, 5=眼神向下, 6=蓬松毛发, 7=口袋物品, 8=咖啡店背景

注意：
- 基于你的用户画像真实回答
- 考虑这是帮你社交匹配的AI助手
- 有些细节可能对你反而减分，请诚实评价
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
      whiteEarFur: parsed.whiteEarFur || 5,
      eyeWrinkles: parsed.eyeWrinkles || 5,
      listeningPose: parsed.listeningPose || 5,
      handGesture: parsed.handGesture || 5,
      eyeDirectionDown: parsed.eyeDirectionDown || 5,
      messyFur: parsed.messyFur || 5,
      pocketDetails: parsed.pocketDetails || 5,
      cafeBackground: parsed.cafeBackground || 5,
      top3Details: parsed.top3Details || [],
      avoidDetails: parsed.avoidDetails || [],
      suggestion: parsed.suggestion || '',
    };
  } catch (error) {
    console.error(`Error for user ${profile.id}:`, error);
    return {
      userId: profile.id,
      profile,
      whiteEarFur: 0,
      eyeWrinkles: 0,
      listeningPose: 0,
      handGesture: 0,
      eyeDirectionDown: 0,
      messyFur: 0,
      pocketDetails: 0,
      cafeBackground: 0,
      top3Details: [],
      avoidDetails: [],
      suggestion: '',
    };
  }
}

async function runBatchEvaluation(profiles: UserProfile[], batchSize: number = 10): Promise<TrustDetailFeedback[]> {
  const results: TrustDetailFeedback[] = [];
  
  for (let i = 0; i < profiles.length; i += batchSize) {
    const batch = profiles.slice(i, i + batchSize);
    console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(profiles.length / batchSize)}...`);
    
    const batchResults = await Promise.all(batch.map(evaluateTrustDetails));
    results.push(...batchResults);
    
    if (i + batchSize < profiles.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
}

function analyzeResults(feedbacks: TrustDetailFeedback[]): void {
  const valid = feedbacks.filter(f => f.whiteEarFur > 0);
  const total = valid.length;
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 信任感增强细节测试 - 100人模拟用户报告');
  console.log('='.repeat(60));
  
  // 各细节平均分排名
  console.log('\n' + '─'.repeat(60));
  console.log('🏆 各细节信任感提升效果排名');
  console.log('─'.repeat(60));
  
  const details = [
    { name: '倾听姿态（头微倾）', key: 'listeningPose', avg: 0 },
    { name: '眼神微微向下', key: 'eyeDirectionDown', avg: 0 },
    { name: '耳朵白毛（阅历感）', key: 'whiteEarFur', avg: 0 },
    { name: '手部"放心"手势', key: 'handGesture', avg: 0 },
    { name: '眼角细微纹路', key: 'eyeWrinkles', avg: 0 },
    { name: '蓬松毛发', key: 'messyFur', avg: 0 },
    { name: '口袋生活物品', key: 'pocketDetails', avg: 0 },
    { name: '咖啡店背景', key: 'cafeBackground', avg: 0 },
  ];
  
  details.forEach(d => {
    d.avg = valid.reduce((sum, f) => sum + (f as any)[d.key], 0) / total;
  });
  
  details.sort((a, b) => b.avg - a.avg);
  
  details.forEach((d, i) => {
    const bar = '█'.repeat(Math.round(d.avg * 2));
    const medal = i === 0 ? '🥇' : (i === 1 ? '🥈' : (i === 2 ? '🥉' : '  '));
    console.log(`${medal} ${d.name}: ${bar} ${d.avg.toFixed(1)}/10`);
  });
  
  // Top 3 统计
  console.log('\n' + '─'.repeat(60));
  console.log('📋 用户心目中最重要的细节（被选入Top3的次数）');
  console.log('─'.repeat(60));
  
  const top3Counts: Record<string, number> = {};
  valid.forEach(f => {
    f.top3Details.forEach(d => {
      top3Counts[d] = (top3Counts[d] || 0) + 1;
    });
  });
  
  Object.entries(top3Counts).sort((a, b) => b[1] - a[1]).slice(0, 8).forEach(([d, count]) => {
    const bar = '█'.repeat(Math.round(count / total * 30));
    console.log(`${d}: ${bar} ${count}人`);
  });
  
  // 应避免的细节
  console.log('\n' + '─'.repeat(60));
  console.log('⚠️ 用户认为可能有反效果的细节');
  console.log('─'.repeat(60));
  
  const avoidCounts: Record<string, number> = {};
  valid.forEach(f => {
    f.avoidDetails.forEach(d => {
      if (d && d.length > 0) {
        avoidCounts[d] = (avoidCounts[d] || 0) + 1;
      }
    });
  });
  
  const avoidEntries = Object.entries(avoidCounts).sort((a, b) => b[1] - a[1]);
  if (avoidEntries.length === 0) {
    console.log('  (没有明显的反效果细节)');
  } else {
    avoidEntries.slice(0, 5).forEach(([d, count]) => {
      console.log(`  - ${d} (${count}人认为可能反效果)`);
    });
  }
  
  // 性别差异
  console.log('\n' + '─'.repeat(60));
  console.log('👫 性别差异（各细节评分）');
  console.log('─'.repeat(60));
  
  const males = valid.filter(f => f.profile.gender === '男');
  const females = valid.filter(f => f.profile.gender === '女');
  
  const maleTop = details.map(d => ({
    name: d.name,
    avg: males.reduce((sum, f) => sum + (f as any)[d.key], 0) / males.length
  })).sort((a, b) => b.avg - a.avg)[0];
  
  const femaleTop = details.map(d => ({
    name: d.name,
    avg: females.reduce((sum, f) => sum + (f as any)[d.key], 0) / females.length
  })).sort((a, b) => b.avg - a.avg)[0];
  
  console.log(`\n男生最看重: ${maleTop.name} (${maleTop.avg.toFixed(1)}分)`);
  console.log(`女生最看重: ${femaleTop.name} (${femaleTop.avg.toFixed(1)}分)`);
  
  // 内向型用户
  console.log('\n' + '─'.repeat(60));
  console.log('🔒 内向型/社恐用户特别看重的细节');
  console.log('─'.repeat(60));
  
  const introverts = valid.filter(f => 
    f.profile.personality.includes('内向') || f.profile.personality.includes('社恐')
  );
  
  const introvertTop = details.map(d => ({
    name: d.name,
    avg: introverts.reduce((sum, f) => sum + (f as any)[d.key], 0) / introverts.length
  })).sort((a, b) => b.avg - a.avg);
  
  console.log(`内向型用户 (${introverts.length}人) Top 3:`);
  introvertTop.slice(0, 3).forEach((d, i) => {
    console.log(`  ${i + 1}. ${d.name} (${d.avg.toFixed(1)}分)`);
  });
  
  // 用户建议示例
  console.log('\n' + '─'.repeat(60));
  console.log('💬 用户建议示例');
  console.log('─'.repeat(60));
  
  valid.filter(f => f.suggestion).slice(0, 5).forEach(f => {
    console.log(`  [${f.profile.age} ${f.profile.gender}生] ${f.suggestion}`);
  });
  
  // 最终建议
  console.log('\n' + '='.repeat(60));
  console.log('📋 最终建议');
  console.log('='.repeat(60));
  
  const topDetails = details.slice(0, 3);
  const bottomDetails = details.slice(-2);
  
  console.log(`
🎯 推荐添加的细节（按效果排序）：

  ✅ 必加：${topDetails[0].name} (${topDetails[0].avg.toFixed(1)}分)
  ✅ 强烈推荐：${topDetails[1].name} (${topDetails[1].avg.toFixed(1)}分)
  ✅ 推荐：${topDetails[2].name} (${topDetails[2].avg.toFixed(1)}分)

⚠️ 效果较弱，可选：
  - ${bottomDetails[0].name} (${bottomDetails[0].avg.toFixed(1)}分)
  - ${bottomDetails[1].name} (${bottomDetails[1].avg.toFixed(1)}分)
`);
  
  console.log('='.repeat(60));
}

async function main() {
  console.log('🦊 开始信任感增强细节测试...\n');
  
  const userCount = 100;
  console.log(`📋 生成 ${userCount} 个模拟用户画像...`);
  const profiles = generateUserProfiles(userCount);
  
  console.log('🔄 开始收集反馈...\n');
  const feedbacks = await runBatchEvaluation(profiles, 10);
  
  analyzeResults(feedbacks);
}

main().catch(console.error);
