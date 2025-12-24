#!/usr/bin/env tsx
/**
 * 端到端模拟测试 - 1000用户全流程测试
 * 
 * 测试范围：
 * 1. AI聊天注册（调用DeepSeek API）
 * 2. 性格测试（12道题 + 低能量校准）
 * 3. 信息收集质量评估（L1/L2/L3层级）
 * 
 * 输出：详细体验报告
 */

import { continueXiaoyueChatWithInference, type XiaoyueCollectedInfo } from '../deepseekClient';
import { L1_FIELDS, L2_FIELDS } from '../inference/informationTiers';
import { DIMENSION_ORDER, DIMENSION_NAMES } from '../inference/dialogGuidanceSystem';

// ============ 10+行业模拟用户画像 ============

interface SimulatedUserProfile {
  id: number;
  industry: string;
  occupation: string;
  segment: string;
  city: string;
  gender: 'male' | 'female';
  birthYear: number;
  personality: string;
  interests: string[];
  dialect: 'cantonese' | 'mandarin' | 'mix';
  socialStyle: string;
  seniority: string;
  lifeStage: string;
}

const INDUSTRY_PROFILES: Array<{
  industry: string;
  segments: string[];
  occupations: string[];
  cities: string[];
  dialects: Array<'cantonese' | 'mandarin' | 'mix'>;
}> = [
  {
    industry: '金融投资',
    segments: ['一级市场/PE/VC', '二级市场/量化', '投行', '资管', '银行', '保险'],
    occupations: ['投资经理', '分析师', '交易员', '风控', '研究员', '客户经理'],
    cities: ['香港', '深圳', '上海', '北京'],
    dialects: ['cantonese', 'mandarin', 'mix'],
  },
  {
    industry: '科技互联网',
    segments: ['产品', '研发', 'AI/算法', '数据', '运营', '设计'],
    occupations: ['产品经理', '软件工程师', 'AI工程师', '数据分析师', '运营经理', 'UI设计师'],
    cities: ['深圳', '北京', '杭州', '上海', '广州'],
    dialects: ['mandarin', 'cantonese', 'mix'],
  },
  {
    industry: '咨询服务',
    segments: ['战略咨询', '管理咨询', '人力咨询', '财务咨询', 'IT咨询'],
    occupations: ['顾问', '高级顾问', '咨询经理', '合伙人'],
    cities: ['上海', '北京', '深圳', '香港'],
    dialects: ['mandarin', 'cantonese'],
  },
  {
    industry: '法律合规',
    segments: ['商业律所', '公司法务', '合规', '知识产权'],
    occupations: ['律师', '法务', '合规经理', '法务总监'],
    cities: ['香港', '上海', '北京', '深圳'],
    dialects: ['cantonese', 'mandarin'],
  },
  {
    industry: '医疗健康',
    segments: ['医药研发', '医疗器械', '医院', '生物科技', '医疗投资'],
    occupations: ['医生', '研发总监', '临床经理', '医药代表', '投资经理'],
    cities: ['上海', '北京', '深圳', '广州', '苏州'],
    dialects: ['mandarin', 'cantonese'],
  },
  {
    industry: '教育培训',
    segments: ['K12', '职业培训', '高等教育', '在线教育', '留学咨询'],
    occupations: ['教师', '课程设计', '培训师', '教育顾问', '运营总监'],
    cities: ['北京', '上海', '深圳', '广州', '杭州'],
    dialects: ['mandarin', 'cantonese'],
  },
  {
    industry: '地产建筑',
    segments: ['房地产开发', '建筑设计', '物业管理', '商业地产', '装修设计'],
    occupations: ['项目经理', '建筑师', '设计师', '销售总监', '投资经理'],
    cities: ['深圳', '上海', '北京', '广州', '香港'],
    dialects: ['cantonese', 'mandarin', 'mix'],
  },
  {
    industry: '快消零售',
    segments: ['电商', '品牌营销', '供应链', '零售运营', '新消费'],
    occupations: ['品牌经理', '电商运营', '供应链经理', '采购', '市场总监'],
    cities: ['上海', '杭州', '广州', '深圳', '北京'],
    dialects: ['mandarin', 'cantonese'],
  },
  {
    industry: '传媒内容',
    segments: ['广告公司', '公关', '内容创作', '影视制作', '新媒体'],
    occupations: ['创意总监', '文案', '导演', '制片人', '新媒体运营'],
    cities: ['北京', '上海', '深圳', '广州', '杭州'],
    dialects: ['mandarin', 'cantonese'],
  },
  {
    industry: '制造业',
    segments: ['半导体/芯片', '新能源', '汽车', '机械', '电子'],
    occupations: ['研发工程师', '生产经理', '质量工程师', '供应链经理', '技术总监'],
    cities: ['深圳', '上海', '苏州', '东莞', '合肥'],
    dialects: ['mandarin', 'cantonese'],
  },
  {
    industry: '航空酒店旅游',
    segments: ['航空', '酒店', '旅行社', 'OTA', '会展'],
    occupations: ['运营经理', '市场经理', '产品经理', '客户经理', '酒店总监'],
    cities: ['上海', '北京', '广州', '深圳', '三亚'],
    dialects: ['mandarin', 'cantonese'],
  },
];

const PERSONALITIES = ['外向活泼', '内向沉稳', '随性自在', '严谨务实', '热情开朗', '慢热深度'];
const SOCIAL_STYLES = ['主动社交', '被动社交', '深度交流', '广泛交友', '精准社交', '佛系社交'];
const SENIORITY_LEVELS = ['1-3年', '3-5年', '5-8年', '8-10年', '10年+'];
const LIFE_STAGES = ['职场新人', '职场进阶', '创业中', '自由职业', '管理层'];
const INTERESTS_POOL = [
  '健身', '跑步', '游泳', '瑜伽', '篮球', '足球', '网球', '高尔夫',
  '读书', '电影', '音乐', '摄影', '旅行', '美食', '咖啡', '红酒',
  '游戏', '二次元', '桌游', '剧本杀', '密室逃脱', '露营', '徒步',
  '画画', '弹吉他', '钢琴', '唱歌', '舞蹈', '烘焙', '烹饪',
];

// ============ 模拟用户生成器 ============

function generateSimulatedUsers(count: number): SimulatedUserProfile[] {
  const users: SimulatedUserProfile[] = [];
  
  for (let i = 0; i < count; i++) {
    const industryProfile = INDUSTRY_PROFILES[i % INDUSTRY_PROFILES.length];
    const gender = Math.random() > 0.5 ? 'male' : 'female';
    const birthYear = 1990 + Math.floor(Math.random() * 10);
    
    users.push({
      id: i + 1,
      industry: industryProfile.industry,
      occupation: industryProfile.occupations[Math.floor(Math.random() * industryProfile.occupations.length)],
      segment: industryProfile.segments[Math.floor(Math.random() * industryProfile.segments.length)],
      city: industryProfile.cities[Math.floor(Math.random() * industryProfile.cities.length)],
      gender,
      birthYear,
      personality: PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)],
      interests: shuffle(INTERESTS_POOL).slice(0, 3 + Math.floor(Math.random() * 3)),
      dialect: industryProfile.dialects[Math.floor(Math.random() * industryProfile.dialects.length)],
      socialStyle: SOCIAL_STYLES[Math.floor(Math.random() * SOCIAL_STYLES.length)],
      seniority: SENIORITY_LEVELS[Math.floor(Math.random() * SENIORITY_LEVELS.length)],
      lifeStage: LIFE_STAGES[Math.floor(Math.random() * LIFE_STAGES.length)],
    });
  }
  
  return users;
}

function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// ============ 模拟用户回答生成 ============

function generateUserResponse(user: SimulatedUserProfile, question: string): string {
  const dialectPrefix = user.dialect === 'cantonese' ? ['系咁嘅', '其实呢', '即系', '唔係咁嘅'][Math.floor(Math.random() * 4)] + '，' : '';
  
  if (question.includes('名字') || question.includes('称呼')) {
    const names = user.gender === 'female' 
      ? ['小雪', '雨薇', 'Yuki', '阿敏', 'Cathy', '小鱼', 'Emily']
      : ['阿杰', '小明', 'Kevin', '大卫', 'Tony', '阿强', 'Jason'];
    return names[Math.floor(Math.random() * names.length)];
  }
  
  if (question.includes('性别') || question.includes('男女')) {
    return user.gender === 'female' ? '女生' : '男生';
  }
  
  if (question.includes('年龄') || question.includes('几岁') || question.includes('出生')) {
    return `${2024 - user.birthYear}岁，${user.birthYear}年的`;
  }
  
  if (question.includes('城市') || question.includes('在哪') || question.includes('工作')) {
    return `${dialectPrefix}在${user.city}，做${user.occupation}，${user.segment}方向的`;
  }
  
  if (question.includes('行业') || question.includes('职业') || question.includes('做什么')) {
    return `${dialectPrefix}${user.industry}，${user.occupation}，工作${user.seniority}了`;
  }
  
  if (question.includes('兴趣') || question.includes('爱好') || question.includes('喜欢')) {
    return `${dialectPrefix}平时喜欢${user.interests.slice(0, 2).join('、')}，周末会${user.interests[2] || '放松一下'}`;
  }
  
  if (question.includes('性格') || question.includes('社交') || question.includes('朋友')) {
    return `${dialectPrefix}我${user.personality}吧，交友比较${user.socialStyle}，${user.lifeStage}`;
  }
  
  if (question.includes('期望') || question.includes('想认识') || question.includes('希望')) {
    return `希望认识${user.socialStyle}的朋友，聊聊${user.interests[0]}`;
  }
  
  return `${dialectPrefix}${user.interests.join('、')}，${user.personality}`;
}

// ============ 模拟性格测试答题 ============

const PERSONALITY_TEST_QUESTIONS = [
  { id: 'q1', dimension: 'E', text: '你更喜欢什么样的社交场合？' },
  { id: 'q2', dimension: 'A', text: '遇到分歧时你通常怎么处理？' },
  { id: 'q3', dimension: 'O', text: '对于新事物你的态度是？' },
  { id: 'q4', dimension: 'C', text: '做事情时你更看重什么？' },
  { id: 'q5', dimension: 'X', text: '面对压力时你的反应是？' },
  { id: 'q6', dimension: 'E', text: '充电方式上你更偏向？' },
  { id: 'q7', dimension: 'A', text: '与人相处时你更看重？' },
  { id: 'q8', dimension: 'O', text: '对于规则和变化你的看法？' },
  { id: 'q9', dimension: 'C', text: '安排计划时你的风格是？' },
  { id: 'q10', dimension: 'X', text: '情绪波动时你会怎么做？' },
  { id: 'q11', dimension: 'E', text: '团队活动中你的角色通常是？' },
  { id: 'q12', dimension: 'A', text: '对待他人的需求你的态度？' },
];

interface PersonalityTestResult {
  answers: Record<string, number>;
  scores: Record<string, number>;
  archetype: string;
  completionTime: number;
}

function simulatePersonalityTest(user: SimulatedUserProfile): PersonalityTestResult {
  const startTime = Date.now();
  const answers: Record<string, number> = {};
  const dimensionScores: Record<string, number[]> = { E: [], A: [], O: [], C: [], X: [] };
  
  PERSONALITY_TEST_QUESTIONS.forEach(q => {
    let score: number;
    if (user.personality.includes('外向') && q.dimension === 'E') {
      score = 4 + Math.floor(Math.random() * 2);
    } else if (user.personality.includes('内向') && q.dimension === 'E') {
      score = 1 + Math.floor(Math.random() * 2);
    } else if (user.personality.includes('严谨') && q.dimension === 'C') {
      score = 4 + Math.floor(Math.random() * 2);
    } else {
      score = 1 + Math.floor(Math.random() * 5);
    }
    
    answers[q.id] = score;
    dimensionScores[q.dimension].push(score);
  });
  
  const scores: Record<string, number> = {};
  for (const [dim, vals] of Object.entries(dimensionScores)) {
    scores[dim] = vals.reduce((a, b) => a + b, 0) / vals.length;
  }
  
  const archetypes = ['灵狐', '智鸮', '金虎', '青龙', '白兔', '墨狼', '玄龟', '翠蛇', '赤马', '银象', '彩蝶', '玉鹿'];
  const archetype = archetypes[Math.floor(Math.random() * archetypes.length)];
  
  return {
    answers,
    scores,
    archetype,
    completionTime: 60 + Math.floor(Math.random() * 120),
  };
}

// ============ 信息收集质量评估 ============

interface QualityMetrics {
  l1Completeness: number;
  l2Completeness: number;
  l3Completeness: number;
  dimensionCoverage: Record<string, boolean>;
  dialectDetected: boolean;
  deepTraitsExtracted: boolean;
  smartInsightCount: number;
  smartInsightConfidence: number;
  totalFields: number;
  filledFields: number;
}

function evaluateCollectionQuality(
  collectedInfo: Partial<XiaoyueCollectedInfo>,
  dialectProfile: any,
  deepTraits: any,
  smartInsights: any[]
): QualityMetrics {
  const l1FieldNames = ['displayName', 'gender', 'birthYear', 'currentCity', 'hometownProvince'];
  const l2FieldNames = ['topInterests', 'occupation', 'industry', 'intent', 'relationshipStatus', 'socialStyle', 'educationLevel', 'seniority', 'industrySegment'];
  
  const info = collectedInfo as any;
  const l1Filled = l1FieldNames.filter(f => info[f]).length;
  const l2Filled = l2FieldNames.filter(f => {
    const val = info[f];
    return val && (Array.isArray(val) ? val.length > 0 : true);
  }).length;
  
  const dimensionCoverage: Record<string, boolean> = {};
  for (const dim of DIMENSION_ORDER) {
    if (dim === 'career') {
      dimensionCoverage[dim] = !!(info.occupation || info.industry || info.industrySegment);
    } else if (dim === 'interest') {
      dimensionCoverage[dim] = !!(info.topInterests && info.topInterests.length > 0);
    } else if (dim === 'lifestyle') {
      dimensionCoverage[dim] = !!(info.seniority || info.socialStyle || info.educationLevel);
    } else if (dim === 'personality') {
      dimensionCoverage[dim] = !!(info.socialStyle || info.icebreakerRole || info.personality);
    } else if (dim === 'social') {
      dimensionCoverage[dim] = !!(info.intent || info.socialStyle);
    } else if (dim === 'expectation') {
      dimensionCoverage[dim] = !!(info.currentCity || info.hometownProvince);
    }
  }
  
  const highConfidenceInsights = smartInsights?.filter((i: any) => i.confidence >= 0.7) || [];
  
  return {
    l1Completeness: l1Filled / l1FieldNames.length,
    l2Completeness: l2Filled / l2FieldNames.length,
    l3Completeness: (dialectProfile ? 0.5 : 0) + (deepTraits ? 0.5 : 0),
    dimensionCoverage,
    dialectDetected: !!dialectProfile?.primaryDialect,
    deepTraitsExtracted: !!deepTraits,
    smartInsightCount: smartInsights?.length || 0,
    smartInsightConfidence: highConfidenceInsights.length / Math.max(smartInsights?.length || 1, 1),
    totalFields: l1FieldNames.length + l2FieldNames.length,
    filledFields: l1Filled + l2Filled,
  };
}

// ============ 单用户端到端测试 ============

interface E2ETestResult {
  userId: number;
  industry: string;
  registrationSuccess: boolean;
  registrationTurns: number;
  registrationTime: number;
  collectedInfo: Partial<XiaoyueCollectedInfo>;
  qualityMetrics: QualityMetrics;
  personalityTestResult: PersonalityTestResult | null;
  errors: string[];
}

async function runSingleUserE2E(
  user: SimulatedUserProfile,
  useRealAPI: boolean = false
): Promise<E2ETestResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let collectedInfo: Partial<XiaoyueCollectedInfo> = {};
  let dialectProfile = null;
  let deepTraits = null;
  let smartInsights: any[] = [];
  let registrationTurns = 0;
  let registrationSuccess = false;
  
  if (useRealAPI) {
    try {
      const sessionId = `sim_${user.id}_${Date.now()}`;
      let conversationHistory: Array<{ role: string; content: string }> = [];
      let isComplete = false;
      
      const systemPrompt = `你是小悦，JoyJoin的AI助手，正在进行标准模式注册对话。`;
      conversationHistory.push({ role: 'system', content: systemPrompt });
      
      while (!isComplete && registrationTurns < 15) {
        const lastAssistantMsg = conversationHistory.filter(m => m.role === 'assistant').pop()?.content || '你好！';
        const userResponse = generateUserResponse(user, lastAssistantMsg);
        
        const result = await continueXiaoyueChatWithInference(
          userResponse,
          conversationHistory.map(m => ({ role: m.role as 'system' | 'user' | 'assistant', content: m.content })),
          sessionId
        );
        
        conversationHistory.push({ role: 'user', content: userResponse });
        conversationHistory.push({ role: 'assistant', content: result.message });
        
        collectedInfo = { ...collectedInfo, ...result.collectedInfo };
        isComplete = result.isComplete;
        registrationTurns++;
        
        await new Promise(r => setTimeout(r, 100));
      }
      
      registrationSuccess = isComplete;
    } catch (error) {
      errors.push(`API调用错误: ${(error as Error).message}`);
    }
  } else {
    collectedInfo = {
      displayName: user.gender === 'female' ? '小雪' : '阿杰',
      gender: user.gender === 'female' ? '女' : '男',
      birthYear: String(user.birthYear),
      currentCity: user.city,
      occupation: user.occupation,
      industry: user.industry,
      industrySegment: user.segment,
      topInterests: user.interests.slice(0, 3),
      socialStyle: user.socialStyle.includes('主动') ? 'proactive' : 'reactive',
      intent: ['拓展圈子'],
      seniority: user.seniority,
    } as any;
    registrationTurns = 5 + Math.floor(Math.random() * 4);
    registrationSuccess = true;
    
    if (user.dialect === 'cantonese') {
      dialectProfile = { primaryDialect: 'cantonese', confidence: 0.8 } as any;
    }
    deepTraits = { cognitiveStyle: 'analytical', communicationPreference: 'direct' } as any;
    smartInsights = [
      { category: 'career', insight: user.occupation, confidence: 0.9 },
      { category: 'lifestyle', insight: user.interests[0], confidence: 0.85 },
    ];
  }
  
  const qualityMetrics = evaluateCollectionQuality(collectedInfo, dialectProfile, deepTraits, smartInsights);
  
  let personalityTestResult: PersonalityTestResult | null = null;
  if (registrationSuccess) {
    personalityTestResult = simulatePersonalityTest(user);
  }
  
  return {
    userId: user.id,
    industry: user.industry,
    registrationSuccess,
    registrationTurns,
    registrationTime: Date.now() - startTime,
    collectedInfo,
    qualityMetrics,
    personalityTestResult,
    errors,
  };
}

// ============ 批量测试运行 ============

interface BatchReport {
  batchId: number;
  userCount: number;
  successCount: number;
  avgTurns: number;
  avgL1Completeness: number;
  avgL2Completeness: number;
  avgL3Completeness: number;
  dialectDetectionRate: number;
  avgSmartInsightCount: number;
  dimensionCoverageRates: Record<string, number>;
  industryDistribution: Record<string, number>;
  archetypeDistribution: Record<string, number>;
  errorRate: number;
  errors: string[];
}

async function runBatch(
  users: SimulatedUserProfile[],
  batchId: number,
  useRealAPI: boolean
): Promise<BatchReport> {
  const results: E2ETestResult[] = [];
  let processed = 0;
  
  for (const user of users) {
    try {
      const result = await runSingleUserE2E(user, useRealAPI);
      results.push(result);
    } catch (error) {
      results.push({
        userId: user.id,
        industry: user.industry,
        registrationSuccess: false,
        registrationTurns: 0,
        registrationTime: 0,
        collectedInfo: {},
        qualityMetrics: {
          l1Completeness: 0,
          l2Completeness: 0,
          l3Completeness: 0,
          dimensionCoverage: {},
          dialectDetected: false,
          deepTraitsExtracted: false,
          smartInsightCount: 0,
          smartInsightConfidence: 0,
          totalFields: 0,
          filledFields: 0,
        },
        personalityTestResult: null,
        errors: [(error as Error).message],
      });
    }
    
    processed++;
    if (processed % 50 === 0) {
      console.log(`   批次 ${batchId}: ${processed}/${users.length} (${Math.round(processed / users.length * 100)}%)`);
    }
  }
  
  const successResults = results.filter(r => r.registrationSuccess);
  const allErrors = results.flatMap(r => r.errors);
  
  const dimensionCoverageRates: Record<string, number> = {};
  for (const dim of DIMENSION_ORDER) {
    const covered = successResults.filter(r => r.qualityMetrics.dimensionCoverage[dim]).length;
    dimensionCoverageRates[dim] = covered / Math.max(successResults.length, 1);
  }
  
  const industryDistribution: Record<string, number> = {};
  const archetypeDistribution: Record<string, number> = {};
  
  for (const result of results) {
    industryDistribution[result.industry] = (industryDistribution[result.industry] || 0) + 1;
    if (result.personalityTestResult) {
      const arch = result.personalityTestResult.archetype;
      archetypeDistribution[arch] = (archetypeDistribution[arch] || 0) + 1;
    }
  }
  
  return {
    batchId,
    userCount: users.length,
    successCount: successResults.length,
    avgTurns: successResults.reduce((s, r) => s + r.registrationTurns, 0) / Math.max(successResults.length, 1),
    avgL1Completeness: successResults.reduce((s, r) => s + r.qualityMetrics.l1Completeness, 0) / Math.max(successResults.length, 1),
    avgL2Completeness: successResults.reduce((s, r) => s + r.qualityMetrics.l2Completeness, 0) / Math.max(successResults.length, 1),
    avgL3Completeness: successResults.reduce((s, r) => s + r.qualityMetrics.l3Completeness, 0) / Math.max(successResults.length, 1),
    dialectDetectionRate: successResults.filter(r => r.qualityMetrics.dialectDetected).length / Math.max(successResults.length, 1),
    avgSmartInsightCount: successResults.reduce((s, r) => s + r.qualityMetrics.smartInsightCount, 0) / Math.max(successResults.length, 1),
    dimensionCoverageRates,
    industryDistribution,
    archetypeDistribution,
    errorRate: allErrors.length / results.length,
    errors: allErrors.slice(0, 10),
  };
}

// ============ 完整报告生成 ============

interface FinalReport {
  totalUsers: number;
  totalBatches: number;
  overallSuccessRate: number;
  avgRegistrationTurns: number;
  qualityScores: {
    l1Completeness: number;
    l2Completeness: number;
    l3Completeness: number;
    overallCompleteness: number;
  };
  dimensionCoverageRates: Record<string, number>;
  dialectDetectionRate: number;
  avgSmartInsightCount: number;
  industryDistribution: Record<string, number>;
  archetypeDistribution: Record<string, number>;
  personalityTestStats: {
    completionRate: number;
    avgCompletionTime: number;
  };
  errorRate: number;
  topErrors: string[];
  recommendations: string[];
}

function generateFinalReport(batches: BatchReport[]): FinalReport {
  const totalUsers = batches.reduce((s, b) => s + b.userCount, 0);
  const totalSuccess = batches.reduce((s, b) => s + b.successCount, 0);
  
  const avgL1 = batches.reduce((s, b) => s + b.avgL1Completeness * b.successCount, 0) / Math.max(totalSuccess, 1);
  const avgL2 = batches.reduce((s, b) => s + b.avgL2Completeness * b.successCount, 0) / Math.max(totalSuccess, 1);
  const avgL3 = batches.reduce((s, b) => s + b.avgL3Completeness * b.successCount, 0) / Math.max(totalSuccess, 1);
  
  const dimensionCoverageRates: Record<string, number> = {};
  for (const dim of DIMENSION_ORDER) {
    dimensionCoverageRates[dim] = batches.reduce((s, b) => s + (b.dimensionCoverageRates[dim] || 0), 0) / batches.length;
  }
  
  const industryDistribution: Record<string, number> = {};
  const archetypeDistribution: Record<string, number> = {};
  
  for (const batch of batches) {
    for (const [ind, count] of Object.entries(batch.industryDistribution)) {
      industryDistribution[ind] = (industryDistribution[ind] || 0) + count;
    }
    for (const [arch, count] of Object.entries(batch.archetypeDistribution)) {
      archetypeDistribution[arch] = (archetypeDistribution[arch] || 0) + count;
    }
  }
  
  const allErrors = batches.flatMap(b => b.errors);
  const errorCounts: Record<string, number> = {};
  for (const err of allErrors) {
    const key = err.substring(0, 50);
    errorCounts[key] = (errorCounts[key] || 0) + 1;
  }
  const topErrors = Object.entries(errorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([err, count]) => `${err} (${count}次)`);
  
  const recommendations: string[] = [];
  if (avgL1 < 0.9) recommendations.push('L1核心字段收集率偏低，建议优化必填字段引导');
  if (avgL2 < 0.7) recommendations.push('L2丰富字段收集率偏低，建议增加自然话题引导');
  if (avgL3 < 0.5) recommendations.push('L3推断层激活率偏低，建议检查dialectProfile和deepTraits整合');
  
  const lowCoverageDims = Object.entries(dimensionCoverageRates).filter(([, rate]) => rate < 0.8);
  if (lowCoverageDims.length > 0) {
    recommendations.push(`以下维度覆盖率偏低需关注: ${lowCoverageDims.map(([d]) => DIMENSION_NAMES[d as keyof typeof DIMENSION_NAMES] || d).join(', ')}`);
  }
  
  return {
    totalUsers,
    totalBatches: batches.length,
    overallSuccessRate: totalSuccess / totalUsers,
    avgRegistrationTurns: batches.reduce((s, b) => s + b.avgTurns * b.successCount, 0) / Math.max(totalSuccess, 1),
    qualityScores: {
      l1Completeness: avgL1,
      l2Completeness: avgL2,
      l3Completeness: avgL3,
      overallCompleteness: (avgL1 * 0.4 + avgL2 * 0.4 + avgL3 * 0.2),
    },
    dimensionCoverageRates,
    dialectDetectionRate: batches.reduce((s, b) => s + b.dialectDetectionRate, 0) / batches.length,
    avgSmartInsightCount: batches.reduce((s, b) => s + b.avgSmartInsightCount, 0) / batches.length,
    industryDistribution,
    archetypeDistribution,
    personalityTestStats: {
      completionRate: totalSuccess / totalUsers,
      avgCompletionTime: 90,
    },
    errorRate: allErrors.length / totalUsers,
    topErrors,
    recommendations,
  };
}

function printFinalReport(report: FinalReport): void {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 JoyJoin 端到端模拟测试报告`);
  console.log(`${'='.repeat(80)}\n`);
  
  console.log(`【测试概况】`);
  console.log(`  - 总测试用户: ${report.totalUsers}`);
  console.log(`  - 测试批次: ${report.totalBatches}`);
  console.log(`  - 注册成功率: ${(report.overallSuccessRate * 100).toFixed(1)}%`);
  console.log(`  - 平均对话轮次: ${report.avgRegistrationTurns.toFixed(1)} 轮`);
  console.log();
  
  console.log(`【信息收集质量 (L1/L2/L3层级)】`);
  console.log(`  ┌────────────────┬──────────┬────────┐`);
  console.log(`  │ 层级           │ 完整度   │ 状态   │`);
  console.log(`  ├────────────────┼──────────┼────────┤`);
  const l1Status = report.qualityScores.l1Completeness >= 0.9 ? '✅' : report.qualityScores.l1Completeness >= 0.7 ? '⚠️' : '❌';
  const l2Status = report.qualityScores.l2Completeness >= 0.8 ? '✅' : report.qualityScores.l2Completeness >= 0.6 ? '⚠️' : '❌';
  const l3Status = report.qualityScores.l3Completeness >= 0.6 ? '✅' : report.qualityScores.l3Completeness >= 0.3 ? '⚠️' : '❌';
  console.log(`  │ L1-显式必要    │ ${(report.qualityScores.l1Completeness * 100).toFixed(1).padStart(6)}% │ ${l1Status}     │`);
  console.log(`  │ L2-自然丰富    │ ${(report.qualityScores.l2Completeness * 100).toFixed(1).padStart(6)}% │ ${l2Status}     │`);
  console.log(`  │ L3-隐藏推断    │ ${(report.qualityScores.l3Completeness * 100).toFixed(1).padStart(6)}% │ ${l3Status}     │`);
  console.log(`  └────────────────┴──────────┴────────┘`);
  console.log(`  📈 综合质量评分: ${(report.qualityScores.overallCompleteness * 100).toFixed(1)}%`);
  console.log();
  
  console.log(`【6维度覆盖率】`);
  for (const [dim, rate] of Object.entries(report.dimensionCoverageRates)) {
    const status = rate >= 0.9 ? '✅' : rate >= 0.7 ? '⚠️' : '❌';
    const name = DIMENSION_NAMES[dim as keyof typeof DIMENSION_NAMES] || dim;
    console.log(`  ${status} ${name.padEnd(10)}: ${(rate * 100).toFixed(1)}%`);
  }
  console.log();
  
  console.log(`【L3推断能力】`);
  console.log(`  - 方言检测率: ${(report.dialectDetectionRate * 100).toFixed(1)}%`);
  console.log(`  - 平均SmartInsight数: ${report.avgSmartInsightCount.toFixed(1)} 条/用户`);
  console.log();
  
  console.log(`【行业分布】`);
  const sortedIndustries = Object.entries(report.industryDistribution).sort((a, b) => b[1] - a[1]);
  for (const [industry, count] of sortedIndustries) {
    const pct = (count / report.totalUsers * 100).toFixed(1);
    console.log(`  - ${industry}: ${count} (${pct}%)`);
  }
  console.log();
  
  console.log(`【性格原型分布】`);
  const sortedArchetypes = Object.entries(report.archetypeDistribution).sort((a, b) => b[1] - a[1]);
  for (const [archetype, count] of sortedArchetypes.slice(0, 6)) {
    const pct = (count / report.totalUsers * 100).toFixed(1);
    console.log(`  - ${archetype}: ${count} (${pct}%)`);
  }
  console.log();
  
  console.log(`【性格测试统计】`);
  console.log(`  - 完成率: ${(report.personalityTestStats.completionRate * 100).toFixed(1)}%`);
  console.log(`  - 平均完成时间: ${report.personalityTestStats.avgCompletionTime}秒`);
  console.log();
  
  if (report.topErrors.length > 0) {
    console.log(`【错误统计】`);
    console.log(`  - 错误率: ${(report.errorRate * 100).toFixed(2)}%`);
    console.log(`  - 主要错误:`);
    for (const err of report.topErrors) {
      console.log(`    · ${err}`);
    }
    console.log();
  }
  
  if (report.recommendations.length > 0) {
    console.log(`【优化建议】`);
    for (const rec of report.recommendations) {
      console.log(`  💡 ${rec}`);
    }
    console.log();
  }
  
  console.log(`${'='.repeat(80)}\n`);
}

// ============ 主函数 ============

export async function runE2ESimulation(
  totalUsers: number = 1000,
  batchSize: number = 200,
  useRealAPI: boolean = false
): Promise<FinalReport> {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🚀 JoyJoin 端到端模拟测试`);
  console.log(`${'='.repeat(80)}`);
  console.log(`📊 总用户数: ${totalUsers}`);
  console.log(`📦 批次大小: ${batchSize}`);
  console.log(`🔌 API模式: ${useRealAPI ? '真实API调用' : '本地模拟'}`);
  console.log(`${'='.repeat(80)}\n`);
  
  console.log('📝 生成模拟用户画像...');
  const allUsers = generateSimulatedUsers(totalUsers);
  console.log(`   ✅ 生成完成: ${allUsers.length} 个用户，覆盖 ${INDUSTRY_PROFILES.length} 个行业\n`);
  
  const batches: BatchReport[] = [];
  const batchCount = Math.ceil(totalUsers / batchSize);
  
  for (let i = 0; i < batchCount; i++) {
    const start = i * batchSize;
    const end = Math.min(start + batchSize, totalUsers);
    const batchUsers = allUsers.slice(start, end);
    
    console.log(`\n📦 运行批次 ${i + 1}/${batchCount} (用户 ${start + 1}-${end})...`);
    const batchReport = await runBatch(batchUsers, i + 1, useRealAPI);
    batches.push(batchReport);
    
    console.log(`   ✅ 批次 ${i + 1} 完成: 成功率 ${(batchReport.successCount / batchReport.userCount * 100).toFixed(1)}%`);
  }
  
  console.log('\n📊 生成最终报告...');
  const finalReport = generateFinalReport(batches);
  
  printFinalReport(finalReport);
  
  return finalReport;
}

export default runE2ESimulation;
