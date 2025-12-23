/**
 * AI Chat Flow 模拟测试 v2.0
 * 
 * 使用6维度对话引导系统，模拟完整对话流程
 * 目标：各维度覆盖率达到90%+
 */

import { applySmartInference } from '../inference/smartInference';
import { matchIndustryFromText } from '../inference/industryOntology';
import { 
  mergeInsights, 
  filterByConfidence,
  getInsightDistribution 
} from '../inference/smartInsightsService';
import {
  DIMENSION_ORDER,
  DIMENSION_NAMES,
  GUIDANCE_QUESTIONS,
  createConversationTracker,
  getNextQuestion,
  getFollowUpQuestion,
  extractAndUpdateCoverage,
  getCoverageStats,
  toSmartInsights,
  type InsightDimension,
  type ConversationTracker,
  type GuidanceQuestion
} from '../inference/dialogGuidanceSystem';
import type { SmartInsight } from '../deepseekClient';

// ============ 模拟用户数据生成 ============

interface SimulatedUser {
  id: number;
  type: 'PM' | 'AI_Engineer';
  background: {
    industry: string;
    industrySegment: string;
    occupation: string;
    seniority: string;
    company?: string;
    city: string;
    lifeStage: string;
    personality: string;
    interests: string[];
    socialStyle: string;
  };
}

// 产品经理背景模板
const PM_PROFILES = [
  { industry: '科技/互联网', segment: '产品', company: '字节跳动', city: '深圳', personality: '外向', interests: ['游戏', '电影'], socialStyle: '活跃' },
  { industry: '科技/互联网', segment: '产品', company: '腾讯', city: '深圳', personality: '内向', interests: ['读书', '咖啡'], socialStyle: '小范围' },
  { industry: '金融', segment: '资管', company: '华夏基金', city: '北京', personality: '稳重', interests: ['健身', '红酒'], socialStyle: '深度' },
  { industry: '科技/互联网', segment: '产品', company: '阿里巴巴', city: '杭州', personality: '随性', interests: ['旅行', '摄影'], socialStyle: '随缘' },
  { industry: '快消/零售', segment: '电商', company: '拼多多', city: '上海', personality: '主动', interests: ['美食', '探店'], socialStyle: '热闹' },
  { industry: '医疗/生物', segment: '医药研发', company: '药明康德', city: '上海', personality: '严谨', interests: ['健身', '阅读'], socialStyle: '小圈子' },
  { industry: '金融', segment: '投行', company: '中金', city: '北京', personality: '内敛', interests: ['高尔夫', '品酒'], socialStyle: '精准' },
  { industry: '咨询', segment: '战略咨询', company: '麦肯锡', city: '上海', personality: '外向', interests: ['旅行', '健身'], socialStyle: '开放' },
  { industry: '教育', segment: '培训机构', company: '新东方', city: '北京', personality: '热情', interests: ['音乐', '演讲'], socialStyle: '广泛' },
  { industry: '传媒/广告', segment: '广告公司', company: '奥美', city: '上海', personality: '创意', interests: ['艺术', '设计'], socialStyle: '多元' },
];

// AI工程师背景模板
const AI_ENGINEER_PROFILES = [
  { industry: '科技/互联网', segment: 'AI/算法', company: 'OpenAI', city: '深圳', personality: '内向', interests: ['编程', '游戏'], socialStyle: '技术圈' },
  { industry: '科技/互联网', segment: 'AI/算法', company: '百度', city: '北京', personality: '宅', interests: ['二次元', '桌游'], socialStyle: '小众' },
  { industry: '科技/互联网', segment: 'AI/算法', company: '商汤', city: '深圳', personality: '理性', interests: ['健身', '电影'], socialStyle: '选择性' },
  { industry: '金融', segment: '量化', company: '幻方', city: '杭州', personality: '专注', interests: ['数学', '围棋'], socialStyle: '精英' },
  { industry: '科技/互联网', segment: 'AI/算法', company: '华为', city: '深圳', personality: '踏实', interests: ['跑步', '徒步'], socialStyle: '同事圈' },
  { industry: '制造业', segment: '半导体/芯片', company: '寒武纪', city: '北京', personality: '严谨', interests: ['硬件', '3D打印'], socialStyle: '专业' },
  { industry: '科技/互联网', segment: '数据', company: '美团', city: '北京', personality: '务实', interests: ['美食', '骑行'], socialStyle: '生活化' },
  { industry: '医疗/生物', segment: '生物科技', company: '晶泰科技', city: '深圳', personality: '学术', interests: ['论文', '实验'], socialStyle: '学术圈' },
  { industry: '科技/互联网', segment: 'AI/算法', company: 'DeepMind', city: '香港', personality: '国际化', interests: ['旅行', '语言'], socialStyle: '多元' },
  { industry: '金融', segment: '二级市场', company: '九坤', city: '上海', personality: '敏锐', interests: ['交易', '新闻'], socialStyle: '金融圈' },
];

const SENIORITY_LEVELS = ['初级', '中级', '高级', '资深', '专家', '总监'];
const LIFE_STAGES = ['职场新人', '职场打工人', '创业中', '自由职业'];

// ============ 模拟用户回答生成 ============

interface AnswerTemplate {
  dimension: InsightDimension;
  templates: string[];
}

const ANSWER_TEMPLATES: AnswerTemplate[] = [
  {
    dimension: 'interest',
    templates: [
      '最近在追{drama}，超好看！周末也喜欢{hobby}',
      '我比较喜欢{hobby}，还有就是{interest2}，感觉挺解压的',
      '周末一般{hobby}，有时候也会{interest2}',
      '最近在玩{game}，太上头了哈哈。平时也喜欢{hobby}',
      '我爱好挺广的，{hobby}、{interest2}都喜欢',
    ]
  },
  {
    dimension: 'lifestyle',
    templates: [
      '下班后一般会{activity}放松一下，周末喜欢{weekend}',
      '我是{sleep_type}，平时喜欢{food_style}',
      '{activity}是我的解压方式，吃的话比较喜欢{cuisine}',
      '周末一般{weekend}，有时候也会自己{activity}',
      '我比较{lifestyle_type}，{food_style}，作息{sleep_pattern}',
    ]
  },
  {
    dimension: 'personality',
    templates: [
      '我算是{personality_type}的吧，{social_behavior}',
      '朋友说我{friend_eval}，我觉得还挺准的',
      '刚认识的时候会{first_meet}，熟了之后{after_familiar}',
      '我做事比较{decision_style}，压力大的时候{stress_handle}',
      '应该算{energy_type}吧，{social_preference}',
    ]
  },
  {
    dimension: 'social',
    templates: [
      '我喜欢{gathering_style}，{friend_count}就够了',
      '交朋友比较看重{friend_value}，{relationship_style}',
      '我是{social_role}的类型，喜欢{topic_style}',
      '{gathering_pref}的聚会我比较喜欢，{friend_criteria}',
      '社交上我比较{social_tendency}，{friend_expectation}',
    ]
  },
  {
    dimension: 'career',
    templates: [
      '我在{company}做{occupation}，在{city}工作{years}年了',
      '现在{city}这边做{occupation}，{company}，工作{years}年了',
      '做{occupation}的，在{city}，公司是{company}',
      '{city}{company}，做{occupation}，{years}年经验了',
      '我是做{occupation}的，现在在{city}的{company}',
    ]
  },
  {
    dimension: 'expectation',
    templates: [
      '希望认识{friend_type}的朋友，{relationship_status}，想找人{activity_wish}',
      '想认识{friend_type}的人，最好能{activity_wish}',
      '我{origin}，{relationship_status}，希望找到{friend_type}的朋友',
      '期待认识{friend_type}的朋友，一起{activity_wish}',
      '{relationship_status}，想找{friend_type}的朋友{activity_wish}',
    ]
  },
];

// 填充模板的词库
const FILL_WORDS = {
  drama: ['鱿鱼游戏', '狂飙', '繁花', '漫长的季节', '三体'],
  hobby: ['打游戏', '看电影', '健身', '看书', '弹吉他', '画画', '摄影'],
  interest2: ['听音乐', '刷B站', '逛展', '喝咖啡', '爬山'],
  game: ['原神', '王者', 'Steam上的独立游戏', 'Switch健身环'],
  activity: ['健身', '跑步', '打球', '看书', '打游戏', '追剧'],
  weekend: ['宅家', '出门探店', '跟朋友聚餐', '去咖啡厅', '户外徒步'],
  sleep_type: ['夜猫子', '早睡早起型', '作息不太规律'],
  food_style: ['喜欢探店', '自己做饭', '外卖党', '重口味', '清淡饮食'],
  cuisine: ['粤菜', '川菜', '日料', '火锅', '西餐'],
  lifestyle_type: ['宅', '喜欢出门', '看心情', '规律作息'],
  sleep_pattern: ['比较规律', '经常熬夜', '佛系'],
  personality_type: ['比较内向', '偏外向', '慢热', '随性'],
  social_behavior: ['跟新朋友聊天会先观察', '熟了之后话很多', '比较主动找话题'],
  friend_eval: ['比较靠谱', '话痨', '随和', '有点闷骚', '很好相处'],
  first_meet: ['先观察一会儿', '主动搭话', '看对方先开口'],
  after_familiar: ['话很多', '很能聊', '还是比较安静'],
  decision_style: ['想清楚再做', '边做边调整', '听直觉'],
  stress_handle: ['找朋友聊', '自己消化', '运动发泄'],
  energy_type: ['需要独处充电', '跟人在一起有能量', '都还好'],
  social_preference: ['但也喜欢跟合得来的人聊天', '不太喜欢应酬', '看心情'],
  gathering_style: ['小范围深聊', '热闹的聚会', '3-5个人刚好'],
  friend_count: ['有几个铁哥们/闺蜜', '认识多点人也好', '质量比数量重要'],
  friend_value: ['三观合', '聊得来', '有共同爱好', '真诚'],
  relationship_style: ['比较看重深度交流', '轻松相处就好', '喜欢互相支持'],
  social_role: ['照顾别人多一点', '被照顾', '比较平等'],
  topic_style: ['深度话题', '轻松吐槽', '什么都能聊'],
  gathering_pref: ['小范围', '有主题', '自由随意'],
  friend_criteria: ['志同道合最重要', '氛围好就行', '能互相学习'],
  social_tendency: ['选择性社交', '比较开放', '随缘'],
  friend_expectation: ['希望找到几个知心朋友', '扩大社交圈', '认识有趣的人'],
  friend_type: ['聊得来', '同频', '有共同爱好', '三观合', '有趣'],
  relationship_status: ['目前单身', '有对象了', '单身很久了'],
  origin: ['本地人', '外地来这边发展的', '来这边几年了'],
  activity_wish: ['一起吃饭探店', '周末一起玩', '聊聊天', '一起运动', '交流行业经验'],
};

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function fillTemplate(template: string, profile: SimulatedUser['background']): string {
  let result = template;
  
  // 替换profile中的字段
  result = result.replace('{company}', profile.company || '大厂');
  result = result.replace('{city}', profile.city);
  result = result.replace('{occupation}', profile.occupation);
  result = result.replace('{years}', randomInt(2, 10).toString());
  
  // 替换词库中的占位符
  for (const [key, values] of Object.entries(FILL_WORDS)) {
    const placeholder = `{${key}}`;
    while (result.includes(placeholder)) {
      result = result.replace(placeholder, randomChoice(values));
    }
  }
  
  return result;
}

// 噪声回答 - 模拟真实用户的模糊/简短/拒绝回答
const NOISY_RESPONSES: Record<InsightDimension, string[]> = {
  interest: [
    '还好吧，没什么特别的',
    '就那样呗',
    '🎮🎬',  // 纯emoji
    '看心情',
    'emmm',
    '哈哈，什么都玩一点',
  ],
  lifestyle: [
    '随便啦',
    '看情况',
    '就正常生活吧',
    '😴',
    '没什么特别',
  ],
  personality: [
    '不太好说',
    '我也不知道诶',
    '应该还行？',
    '🤔',
    '说不上来',
  ],
  social: [
    '都可以',
    '看情况吧',
    '随缘',
    '🤷',
    '没想过这个问题',
  ],
  career: [
    '上班族',
    '打工人',
    '社畜一枚',
    '就普通工作',
    '😅工作嘛',
  ],
  expectation: [
    '没想好',
    '看看再说',
    '都行吧',
    '随缘~',
    '先看看',
  ],
};

function generateUserAnswer(dimension: InsightDimension, profile: SimulatedUser['background']): string {
  // 30%概率给出噪声回答（模拟真实用户变化）
  if (Math.random() < 0.3) {
    const noisy = NOISY_RESPONSES[dimension];
    if (noisy && noisy.length > 0) {
      return randomChoice(noisy);
    }
  }
  
  const templates = ANSWER_TEMPLATES.find(t => t.dimension === dimension)?.templates || [];
  if (templates.length === 0) return '还好吧，没什么特别的';
  
  const template = randomChoice(templates);
  return fillTemplate(template, profile);
}

// ============ 生成模拟用户 ============

function generateSimulatedUsers(count: number): SimulatedUser[] {
  const users: SimulatedUser[] = [];
  const pmCount = Math.floor(count / 2);
  
  for (let i = 0; i < pmCount; i++) {
    const profile = randomChoice(PM_PROFILES);
    users.push({
      id: i + 1,
      type: 'PM',
      background: {
        industry: profile.industry,
        industrySegment: profile.segment,
        occupation: '产品经理',
        seniority: randomChoice(SENIORITY_LEVELS),
        company: profile.company,
        city: profile.city,
        lifeStage: randomChoice(LIFE_STAGES),
        personality: profile.personality,
        interests: profile.interests,
        socialStyle: profile.socialStyle,
      }
    });
  }
  
  for (let i = pmCount; i < count; i++) {
    const profile = randomChoice(AI_ENGINEER_PROFILES);
    users.push({
      id: i + 1,
      type: 'AI_Engineer',
      background: {
        industry: profile.industry,
        industrySegment: profile.segment,
        occupation: 'AI工程师',
        seniority: randomChoice(SENIORITY_LEVELS),
        company: profile.company,
        city: profile.city,
        lifeStage: randomChoice(LIFE_STAGES),
        personality: profile.personality,
        interests: profile.interests,
        socialStyle: profile.socialStyle,
      }
    });
  }
  
  return users;
}

// ============ 模拟对话流程 ============

interface DialogueSimulationResult {
  userId: number;
  userType: 'PM' | 'AI_Engineer';
  conversationTurns: number;
  coverageStats: ReturnType<typeof getCoverageStats>;
  smartInsights: SmartInsight[];
  dimensionCoverage: Record<InsightDimension, boolean>;
  dialogueLog: Array<{
    turn: number;
    question: string;
    answer: string;
    dimension: InsightDimension;
  }>;
}

function simulateDialogue(user: SimulatedUser): DialogueSimulationResult {
  const tracker = createConversationTracker();
  tracker.userId = user.id;
  
  const dialogueLog: DialogueSimulationResult['dialogueLog'] = [];
  let turn = 0;
  const maxTurns = 10; // 最多10轮对话
  
  while (turn < maxTurns) {
    const question = getNextQuestion(tracker);
    if (!question) break; // 所有维度已覆盖
    
    turn++;
    tracker.questionsAsked.push(question);
    tracker.totalTurns = turn;
    
    // 生成用户回答
    const answer = generateUserAnswer(question.dimension, user.background);
    
    // 提取洞察并更新覆盖
    const extractions = extractAndUpdateCoverage(answer, tracker, question);
    
    dialogueLog.push({
      turn,
      question: question.question,
      answer,
      dimension: question.dimension
    });
    
    // 检查是否需要追问（置信度不够）
    const coverage = tracker.dimensions.get(question.dimension)!;
    if (!coverage.covered && coverage.confidence < 0.7) {
      // 尝试追问
      const followUp = getFollowUpQuestion(tracker, question.dimension);
      if (followUp) {
        turn++;
        tracker.questionsAsked.push(followUp);
        tracker.totalTurns = turn;
        
        const followUpAnswer = generateUserAnswer(question.dimension, user.background);
        extractAndUpdateCoverage(followUpAnswer, tracker, followUp);
        
        dialogueLog.push({
          turn,
          question: followUp.followUp || followUp.question,
          answer: followUpAnswer,
          dimension: question.dimension
        });
      }
    }
  }
  
  // 收集结果
  const stats = getCoverageStats(tracker);
  const insights = toSmartInsights(tracker);
  
  const dimensionCoverage: Record<InsightDimension, boolean> = {} as any;
  for (const dim of DIMENSION_ORDER) {
    dimensionCoverage[dim] = tracker.dimensions.get(dim)!.covered;
  }
  
  return {
    userId: user.id,
    userType: user.type,
    conversationTurns: turn,
    coverageStats: stats,
    smartInsights: insights,
    dimensionCoverage,
    dialogueLog
  };
}

// ============ 生成报告 ============

interface SimulationReport {
  totalUsers: number;
  pmCount: number;
  aiEngineerCount: number;
  
  avgConversationTurns: number;
  
  dimensionCoverageRates: Record<InsightDimension, number>;
  overallCoverageRate: number;
  
  avgInsightCount: number;
  avgConfidence: number;
  
  insightDistribution: Record<string, number>;
  
  intelligenceScore: {
    coverageCompleteness: number;
    efficiencyScore: number;
    qualityScore: number;
    overallScore: number;
  };
  
  comparison: {
    beforeOptimization: Record<string, number>;
    afterOptimization: Record<string, number>;
    improvement: Record<string, string>;
  };
}

function generateReport(results: DialogueSimulationResult[]): SimulationReport {
  const pmResults = results.filter(r => r.userType === 'PM');
  const aiResults = results.filter(r => r.userType === 'AI_Engineer');
  
  // 计算各维度覆盖率
  const dimensionCoverageRates: Record<InsightDimension, number> = {} as any;
  for (const dim of DIMENSION_ORDER) {
    const coveredCount = results.filter(r => r.dimensionCoverage[dim]).length;
    dimensionCoverageRates[dim] = coveredCount / results.length;
  }
  
  // 总体覆盖率
  const totalDimensions = results.length * DIMENSION_ORDER.length;
  const coveredDimensions = results.reduce((sum, r) => 
    sum + DIMENSION_ORDER.filter(d => r.dimensionCoverage[d]).length, 0
  );
  const overallCoverageRate = coveredDimensions / totalDimensions;
  
  // 平均对话轮次
  const avgTurns = results.reduce((sum, r) => sum + r.conversationTurns, 0) / results.length;
  
  // 洞察统计
  const allInsights = results.flatMap(r => r.smartInsights);
  const avgInsightCount = allInsights.length / results.length;
  const avgConfidence = results.reduce((sum, r) => sum + r.coverageStats.overallConfidence, 0) / results.length;
  
  const insightDistribution = getInsightDistribution(allInsights);
  
  // 智能化评分
  const coverageScore = Math.round(overallCoverageRate * 100);
  const efficiencyScore = Math.round(Math.max(0, 100 - (avgTurns - 6) * 10)); // 6轮为基准
  const qualityScore = Math.round(avgConfidence * 100);
  const overallScore = Math.round(coverageScore * 0.5 + efficiencyScore * 0.2 + qualityScore * 0.3);
  
  // 优化前后对比
  const beforeOptimization: Record<string, number> = {
    'career': 90.8,
    'social': 35.6,
    'lifestyle': 33.3,
    'preference': 33.3,
    'background': 27.8,
    'personality': 26.1,
    'overall': 76,
  };
  
  const afterOptimization: Record<string, number> = {
    'career': dimensionCoverageRates.career * 100,
    'social': dimensionCoverageRates.social * 100,
    'lifestyle': dimensionCoverageRates.lifestyle * 100,
    'preference': dimensionCoverageRates.interest * 100,
    'background': dimensionCoverageRates.expectation * 100,
    'personality': dimensionCoverageRates.personality * 100,
    'overall': overallScore,
  };
  
  const improvement: Record<string, string> = {};
  for (const key of Object.keys(beforeOptimization)) {
    const before = beforeOptimization[key];
    const after = afterOptimization[key];
    const diff = after - before;
    improvement[key] = diff >= 0 ? `+${diff.toFixed(1)}%` : `${diff.toFixed(1)}%`;
  }
  
  return {
    totalUsers: results.length,
    pmCount: pmResults.length,
    aiEngineerCount: aiResults.length,
    avgConversationTurns: avgTurns,
    dimensionCoverageRates,
    overallCoverageRate,
    avgInsightCount,
    avgConfidence,
    insightDistribution,
    intelligenceScore: {
      coverageCompleteness: coverageScore,
      efficiencyScore,
      qualityScore,
      overallScore
    },
    comparison: {
      beforeOptimization,
      afterOptimization,
      improvement
    }
  };
}

function printReport(report: SimulationReport): void {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`📊 AI Chat Flow 模拟测试报告 v2.0 (6维度对话引导系统)`);
  console.log(`${'='.repeat(70)}\n`);
  
  console.log(`【基本信息】`);
  console.log(`  - 测试用户: ${report.totalUsers} (PM: ${report.pmCount}, AI工程师: ${report.aiEngineerCount})`);
  console.log(`  - 平均对话轮次: ${report.avgConversationTurns.toFixed(1)} 轮`);
  console.log();
  
  console.log(`【各维度覆盖率】`);
  for (const dim of DIMENSION_ORDER) {
    const rate = report.dimensionCoverageRates[dim] * 100;
    const status = rate >= 90 ? '✅' : rate >= 70 ? '⚠️' : '❌';
    console.log(`  ${status} ${DIMENSION_NAMES[dim]}: ${rate.toFixed(1)}%`);
  }
  console.log(`  ━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  📈 总体覆盖率: ${(report.overallCoverageRate * 100).toFixed(1)}%`);
  console.log();
  
  console.log(`【洞察质量】`);
  console.log(`  - 平均洞察数: ${report.avgInsightCount.toFixed(1)} 条/用户`);
  console.log(`  - 平均置信度: ${(report.avgConfidence * 100).toFixed(1)}%`);
  console.log();
  
  console.log(`【智能化评分】`);
  console.log(`  - 覆盖完整度: ${report.intelligenceScore.coverageCompleteness}/100`);
  console.log(`  - 效率评分: ${report.intelligenceScore.efficiencyScore}/100`);
  console.log(`  - 质量评分: ${report.intelligenceScore.qualityScore}/100`);
  console.log(`  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  🏆 综合评分: ${report.intelligenceScore.overallScore}/100`);
  console.log();
  
  console.log(`【优化前后对比】`);
  console.log(`  ${'维度'.padEnd(12)}${'优化前'.padEnd(10)}${'优化后'.padEnd(10)}${'提升'}`);
  console.log(`  ${'─'.repeat(42)}`);
  
  const dimMapping: Record<string, string> = {
    'career': '职业画像',
    'social': '社交偏好',
    'lifestyle': '生活方式',
    'preference': '兴趣爱好',
    'background': '背景期待',
    'personality': '性格特质',
    'overall': '综合评分',
  };
  
  for (const key of Object.keys(report.comparison.beforeOptimization)) {
    const before = report.comparison.beforeOptimization[key];
    const after = report.comparison.afterOptimization[key];
    const imp = report.comparison.improvement[key];
    const name = dimMapping[key] || key;
    const impColor = imp.startsWith('+') ? '📈' : '📉';
    console.log(`  ${name.padEnd(10)} ${before.toFixed(1).padStart(6)}%   ${after.toFixed(1).padStart(6)}%   ${impColor} ${imp}`);
  }
  
  console.log(`\n${'='.repeat(70)}\n`);
}

// ============ 主测试函数 ============

export async function runSimulation(userCount: number = 1000): Promise<SimulationReport> {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🧪 AI Chat Flow 模拟测试 v2.0`);
  console.log(`📊 模拟用户数: ${userCount} (${userCount/2} PM + ${userCount/2} AI工程师)`);
  console.log(`🎯 目标: 各维度覆盖率达到 90%+`);
  console.log(`${'='.repeat(70)}\n`);
  
  console.log('📝 生成模拟用户...');
  const users = generateSimulatedUsers(userCount);
  console.log(`   ✅ 生成完成: ${users.length} 个用户\n`);
  
  console.log('💬 模拟对话流程...');
  const results: DialogueSimulationResult[] = [];
  let processed = 0;
  
  for (const user of users) {
    const result = simulateDialogue(user);
    results.push(result);
    processed++;
    
    if (processed % 100 === 0) {
      console.log(`   进度: ${processed}/${userCount} (${Math.round(processed/userCount*100)}%)`);
    }
  }
  console.log(`   ✅ 对话模拟完成\n`);
  
  console.log('📊 生成报告...');
  const report = generateReport(results);
  
  printReport(report);
  
  return report;
}

export default runSimulation;
