/**
 * AI Chat Flow 模拟测试
 * 
 * 模拟1000个资深产品经理和AI工程师的对话
 * 统计智能信息收集的效果
 */

import { applySmartInference, SMART_INFERENCE_RULES } from '../inference/smartInference';
import { matchIndustryFromText, generateRAGContext } from '../inference/industryOntology';
import { 
  mergeInsights, 
  filterByConfidence, 
  extractAndValidateInsights,
  getInsightDistribution 
} from '../inference/smartInsightsService';
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
  };
  dialogues: string[];  // 模拟对话内容
  expectedInsights: string[];  // 预期应该提取的洞察
}

// 产品经理背景模板
const PM_BACKGROUNDS = [
  { industry: '科技/互联网', segment: '产品', company: '字节跳动', city: '深圳' },
  { industry: '科技/互联网', segment: '产品', company: '腾讯', city: '深圳' },
  { industry: '金融', segment: '资管', company: '华夏基金', city: '北京' },
  { industry: '科技/互联网', segment: '产品', company: '阿里巴巴', city: '杭州' },
  { industry: '快消/零售', segment: '电商', company: '拼多多', city: '上海' },
  { industry: '医疗/生物', segment: '医药研发', company: '药明康德', city: '上海' },
  { industry: '金融', segment: '投行', company: '中金', city: '北京' },
  { industry: '咨询', segment: '战略咨询', company: '麦肯锡', city: '上海' },
  { industry: '教育', segment: '培训机构', company: '新东方', city: '北京' },
  { industry: '传媒/广告', segment: '广告公司', company: '奥美', city: '上海' },
];

// AI工程师背景模板
const AI_ENGINEER_BACKGROUNDS = [
  { industry: '科技/互联网', segment: 'AI/算法', company: 'OpenAI', city: '深圳' },
  { industry: '科技/互联网', segment: 'AI/算法', company: '百度', city: '北京' },
  { industry: '科技/互联网', segment: 'AI/算法', company: '商汤', city: '深圳' },
  { industry: '金融', segment: '量化', company: '幻方', city: '杭州' },
  { industry: '科技/互联网', segment: 'AI/算法', company: '华为', city: '深圳' },
  { industry: '制造业', segment: '半导体/芯片', company: '寒武纪', city: '北京' },
  { industry: '科技/互联网', segment: '数据', company: '美团', city: '北京' },
  { industry: '医疗/生物', segment: '生物科技', company: '晶泰科技', city: '深圳' },
  { industry: '科技/互联网', segment: 'AI/算法', company: 'DeepMind', city: '香港' },
  { industry: '金融', segment: '二级市场', company: '九坤', city: '上海' },
];

// 资历级别
const SENIORITY_LEVELS = ['初级', '中级', '高级', '资深', '专家', '总监'];
const LIFE_STAGES = ['职场新人', '职场打工人', '创业中', '自由职业'];

// 对话模板 - 产品经理
const PM_DIALOGUE_TEMPLATES = [
  '我是做产品经理的，在{company}工作，主要负责用户增长',
  '做PM有{years}年了，之前在{prevCompany}，现在在{company}做B端产品',
  '我在{city}{company}做产品，平时会关注用户体验和数据分析',
  '目前在{company}做产品总监，带一个小团队，专注金融科技方向',
  '我是{company}的产品经理，主要做社交电商相关的业务',
  '之前在一级市场做投资，后来转型做产品经理了，现在{company}',
  '做了5年PM了，从C端做到B端，现在{company}负责企业服务产品线',
  '我在{company}做AI产品，跟算法团队配合比较多',
  '刚从{prevCompany}跳槽到{company}，继续做产品经理',
  '我是资深PM，在{city}工作，主要关注增长和商业化',
];

// 对话模板 - AI工程师
const AI_ENGINEER_DIALOGUE_TEMPLATES = [
  '我是做AI的，在{company}做算法工程师，主要方向是NLP',
  '做机器学习{years}年了，现在{company}做大模型相关的工作',
  '我在{company}做深度学习，主要是CV方向的',
  '目前在{company}做量化策略研究，用AI做因子挖掘',
  '我是{company}的AI工程师，做推荐系统的',
  '之前在学术界做研究，现在在{company}做LLM工程化落地',
  '做了4年算法了，从传统ML到现在的大模型，现在{company}',
  '我在{company}做数据科学家，主要负责用户画像和预测',
  '刚从{prevCompany}跳槽到{company}，继续做算法研发',
  '我是资深算法工程师，在{city}工作，专注自然语言处理',
];

// 补充对话内容 - 用于增加信息丰富度
const SUPPLEMENTARY_DIALOGUES = [
  '平时喜欢打篮球和看电影',
  '周末经常跟朋友去爬山或者喝咖啡',
  '我比较内向，但是跟熟悉的人聊天会很话痨',
  '对新技术比较感兴趣，会经常关注行业动态',
  '喜欢读书，最近在看一些心理学的书',
  '下班后喜欢健身，保持身材很重要',
  '我是深圳本地人，对这边比较熟悉',
  '我是从广州来深圳发展的，来了3年了',
  '周末喜欢探店，发现好吃的餐厅',
  '对红酒和咖啡比较有研究',
  '平时会参加一些行业交流活动',
  '我单身，希望能认识志同道合的朋友',
  '跟朋友相处我比较随和，不太计较',
  '工作压力比较大，需要放松的渠道',
  '对艺术和设计比较感兴趣',
];

// 生成随机数
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 随机选择数组元素
function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// 生成模拟用户
function generateSimulatedUsers(count: number): SimulatedUser[] {
  const users: SimulatedUser[] = [];
  const pmCount = Math.floor(count / 2);
  
  // 生成产品经理
  for (let i = 0; i < pmCount; i++) {
    const bg = randomChoice(PM_BACKGROUNDS);
    const template = randomChoice(PM_DIALOGUE_TEMPLATES);
    const years = randomInt(2, 10);
    const prevCompany = randomChoice(PM_BACKGROUNDS.filter(b => b.company !== bg.company)).company;
    
    const mainDialogue = template
      .replace('{company}', bg.company || '大厂')
      .replace('{city}', bg.city)
      .replace('{years}', years.toString())
      .replace('{prevCompany}', prevCompany || '其他公司');
    
    const dialogues = [mainDialogue];
    // 添加1-3条补充对话
    const supplementCount = randomInt(1, 3);
    for (let j = 0; j < supplementCount; j++) {
      dialogues.push(randomChoice(SUPPLEMENTARY_DIALOGUES));
    }
    
    users.push({
      id: i + 1,
      type: 'PM',
      background: {
        industry: bg.industry,
        industrySegment: bg.segment,
        occupation: '产品经理',
        seniority: randomChoice(SENIORITY_LEVELS),
        company: bg.company,
        city: bg.city,
        lifeStage: randomChoice(LIFE_STAGES),
      },
      dialogues,
      expectedInsights: [
        `从事${bg.industry}行业`,
        `${bg.segment}方向`,
        `在${bg.company}工作`,
      ],
    });
  }
  
  // 生成AI工程师
  for (let i = pmCount; i < count; i++) {
    const bg = randomChoice(AI_ENGINEER_BACKGROUNDS);
    const template = randomChoice(AI_ENGINEER_DIALOGUE_TEMPLATES);
    const years = randomInt(2, 8);
    const prevCompany = randomChoice(AI_ENGINEER_BACKGROUNDS.filter(b => b.company !== bg.company)).company;
    
    const mainDialogue = template
      .replace('{company}', bg.company || '大厂')
      .replace('{city}', bg.city)
      .replace('{years}', years.toString())
      .replace('{prevCompany}', prevCompany || '其他公司');
    
    const dialogues = [mainDialogue];
    const supplementCount = randomInt(1, 3);
    for (let j = 0; j < supplementCount; j++) {
      dialogues.push(randomChoice(SUPPLEMENTARY_DIALOGUES));
    }
    
    users.push({
      id: i + 1,
      type: 'AI_Engineer',
      background: {
        industry: bg.industry,
        industrySegment: bg.segment,
        occupation: 'AI工程师',
        seniority: randomChoice(SENIORITY_LEVELS),
        company: bg.company,
        city: bg.city,
        lifeStage: randomChoice(LIFE_STAGES),
      },
      dialogues,
      expectedInsights: [
        `从事${bg.industry}行业`,
        `${bg.segment}方向`,
        `在${bg.company}工作`,
      ],
    });
  }
  
  return users;
}

// ============ 信息提取测试 ============

interface ExtractionResult {
  userId: number;
  userType: 'PM' | 'AI_Engineer';
  dialogues: string[];
  
  // SmartInference结果
  inferences: Array<{ field: string; value: string | boolean; confidence: number }>;
  skipQuestions: string[];
  
  // 行业匹配结果
  industryMatch: {
    industry?: string;
    industrySegment?: string;
    occupation?: string;
    confidence: number;
  } | null;
  
  // RAG上下文
  ragContext: string;
  
  // 模拟的SmartInsights（基于规则生成）
  simulatedInsights: SmartInsight[];
  
  // 评估指标
  metrics: {
    fieldsExtracted: number;
    expectedFieldsCovered: number;
    accuracyRate: number;
    insightCount: number;
    avgConfidence: number;
  };
}

// 基于对话内容模拟生成SmartInsights
function simulateSmartInsights(dialogues: string[], background: SimulatedUser['background']): SmartInsight[] {
  const insights: SmartInsight[] = [];
  const allText = dialogues.join(' ');
  
  // 职业类洞察
  if (allText.includes('产品经理') || allText.includes('PM') || allText.includes('做产品')) {
    insights.push({
      category: 'career',
      insight: '具有产品管理经验，关注用户体验和数据驱动决策',
      evidence: '用户提到从事产品经理工作',
      confidence: 0.9,
      timestamp: new Date().toISOString(),
    });
  }
  
  if (allText.includes('AI') || allText.includes('算法') || allText.includes('机器学习') || allText.includes('深度学习')) {
    insights.push({
      category: 'career',
      insight: '技术背景扎实，专注AI/算法领域',
      evidence: '用户提到从事AI或算法工作',
      confidence: 0.92,
      timestamp: new Date().toISOString(),
    });
  }
  
  // 性格类洞察
  if (allText.includes('内向') || allText.includes('话痨') || allText.includes('随和')) {
    insights.push({
      category: 'personality',
      insight: '性格温和，社交偏好深度交流而非广泛社交',
      evidence: '用户描述自己的性格特点',
      confidence: 0.85,
      timestamp: new Date().toISOString(),
    });
  }
  
  // 生活方式洞察
  if (allText.includes('健身') || allText.includes('篮球') || allText.includes('爬山') || allText.includes('运动')) {
    insights.push({
      category: 'lifestyle',
      insight: '注重健康和运动，生活方式积极向上',
      evidence: '用户提到运动爱好',
      confidence: 0.88,
      timestamp: new Date().toISOString(),
    });
  }
  
  if (allText.includes('咖啡') || allText.includes('红酒') || allText.includes('探店')) {
    insights.push({
      category: 'preference',
      insight: '对生活品质有追求，喜欢探索美食',
      evidence: '用户提到饮食偏好',
      confidence: 0.82,
      timestamp: new Date().toISOString(),
    });
  }
  
  // 社交类洞察
  if (allText.includes('单身') || allText.includes('认识') || allText.includes('朋友')) {
    insights.push({
      category: 'social',
      insight: '开放交友，期待建立有意义的社交关系',
      evidence: '用户表达交友意向',
      confidence: 0.8,
      timestamp: new Date().toISOString(),
    });
  }
  
  // 背景类洞察
  if (allText.includes('本地') || allText.includes('来自') || allText.includes('深圳') || allText.includes('香港')) {
    insights.push({
      category: 'background',
      insight: `在${background.city}工作生活，熟悉本地环境`,
      evidence: '用户提到所在城市',
      confidence: 0.9,
      timestamp: new Date().toISOString(),
    });
  }
  
  return insights;
}

// 运行单个用户的提取测试
function runExtractionForUser(user: SimulatedUser): ExtractionResult {
  const allText = user.dialogues.join(' ');
  
  // 1. SmartInference
  const inferenceResult = applySmartInference(allText);
  
  // 2. 行业匹配
  const industryMatch = matchIndustryFromText(allText);
  
  // 3. RAG上下文
  const ragContext = generateRAGContext(user.dialogues);
  
  // 4. 模拟SmartInsights
  const simulatedInsights = simulateSmartInsights(user.dialogues, user.background);
  const validInsights = filterByConfidence(simulatedInsights);
  
  // 5. 计算评估指标
  const expectedFields = ['industry', 'industrySegment', 'occupation', 'city'];
  let coveredFields = 0;
  
  if (inferenceResult.inferences.some(i => i.field === 'industry')) coveredFields++;
  if (inferenceResult.inferences.some(i => i.field === 'industrySegment')) coveredFields++;
  if (inferenceResult.inferences.some(i => i.field === 'occupation')) coveredFields++;
  if (inferenceResult.inferences.some(i => i.field === 'city')) coveredFields++;
  
  // 行业匹配也计入
  if (industryMatch?.industry) coveredFields = Math.max(coveredFields, 1);
  if (industryMatch?.industrySegment) coveredFields = Math.max(coveredFields, 2);
  
  const avgConfidence = validInsights.length > 0
    ? validInsights.reduce((sum, i) => sum + i.confidence, 0) / validInsights.length
    : 0;
  
  return {
    userId: user.id,
    userType: user.type,
    dialogues: user.dialogues,
    inferences: inferenceResult.inferences,
    skipQuestions: inferenceResult.skipQuestions,
    industryMatch: industryMatch ? {
      industry: industryMatch.industry,
      industrySegment: industryMatch.industrySegment,
      occupation: industryMatch.occupation,
      confidence: industryMatch.confidence,
    } : null,
    ragContext,
    simulatedInsights: validInsights,
    metrics: {
      fieldsExtracted: inferenceResult.inferences.length,
      expectedFieldsCovered: coveredFields,
      accuracyRate: coveredFields / expectedFields.length,
      insightCount: validInsights.length,
      avgConfidence,
    },
  };
}

// ============ 统计报告生成 ============

interface SimulationReport {
  totalUsers: number;
  pmCount: number;
  aiEngineerCount: number;
  
  // 总体统计
  overall: {
    avgFieldsExtracted: number;
    avgAccuracyRate: number;
    avgInsightCount: number;
    avgConfidence: number;
    industryMatchRate: number;
    skipQuestionsAvg: number;
  };
  
  // 按用户类型统计
  byUserType: {
    PM: {
      avgFieldsExtracted: number;
      avgAccuracyRate: number;
      avgInsightCount: number;
      topInferredFields: string[];
    };
    AI_Engineer: {
      avgFieldsExtracted: number;
      avgAccuracyRate: number;
      avgInsightCount: number;
      topInferredFields: string[];
    };
  };
  
  // 洞察类别分布
  insightDistribution: Record<string, number>;
  
  // 信息丢失分析
  dataLossAnalysis: {
    totalExpectedFields: number;
    totalExtractedFields: number;
    lossRate: number;
    missedFieldsBreakdown: Record<string, number>;
  };
  
  // 智能化程度评估
  intelligenceScore: {
    inferenceEfficiency: number;    // 推断效率 (0-100)
    coverageCompleteness: number;   // 覆盖完整度 (0-100)
    confidenceQuality: number;      // 置信度质量 (0-100)
    overallScore: number;           // 综合评分 (0-100)
    improvement: string;            // 相比传统表单的提升描述
  };
}

function generateReport(results: ExtractionResult[]): SimulationReport {
  const pmResults = results.filter(r => r.userType === 'PM');
  const aiResults = results.filter(r => r.userType === 'AI_Engineer');
  
  // 总体统计
  const avgFieldsExtracted = results.reduce((sum, r) => sum + r.metrics.fieldsExtracted, 0) / results.length;
  const avgAccuracyRate = results.reduce((sum, r) => sum + r.metrics.accuracyRate, 0) / results.length;
  const avgInsightCount = results.reduce((sum, r) => sum + r.metrics.insightCount, 0) / results.length;
  const avgConfidence = results.reduce((sum, r) => sum + r.metrics.avgConfidence, 0) / results.length;
  const industryMatchRate = results.filter(r => r.industryMatch !== null).length / results.length;
  const skipQuestionsAvg = results.reduce((sum, r) => sum + r.skipQuestions.length, 0) / results.length;
  
  // 洞察类别分布
  const allInsights = results.flatMap(r => r.simulatedInsights);
  const insightDistribution = getInsightDistribution(allInsights);
  
  // 统计推断字段
  const pmInferredFields = new Map<string, number>();
  const aiInferredFields = new Map<string, number>();
  
  pmResults.forEach(r => {
    r.inferences.forEach(inf => {
      pmInferredFields.set(inf.field, (pmInferredFields.get(inf.field) || 0) + 1);
    });
  });
  
  aiResults.forEach(r => {
    r.inferences.forEach(inf => {
      aiInferredFields.set(inf.field, (aiInferredFields.get(inf.field) || 0) + 1);
    });
  });
  
  const pmTopFields = Array.from(pmInferredFields.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([field]) => field);
  
  const aiTopFields = Array.from(aiInferredFields.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([field]) => field);
  
  // 信息丢失分析
  const expectedFieldsPerUser = 4; // industry, segment, occupation, city
  const totalExpectedFields = results.length * expectedFieldsPerUser;
  const totalExtractedFields = results.reduce((sum, r) => sum + r.metrics.expectedFieldsCovered, 0);
  const lossRate = 1 - (totalExtractedFields / totalExpectedFields);
  
  // 智能化评分
  const inferenceEfficiency = Math.round(avgFieldsExtracted / 4 * 100);  // 假设最优是4个字段
  const coverageCompleteness = Math.round(avgAccuracyRate * 100);
  const confidenceQuality = Math.round(avgConfidence * 100);
  const overallScore = Math.round((inferenceEfficiency * 0.3 + coverageCompleteness * 0.4 + confidenceQuality * 0.3));
  
  // 相比传统表单的提升
  const traditionalFormFields = 8; // 传统表单需要填8个字段
  const savedQuestions = Math.round(skipQuestionsAvg);
  const improvementPercent = Math.round((savedQuestions / traditionalFormFields) * 100);
  
  return {
    totalUsers: results.length,
    pmCount: pmResults.length,
    aiEngineerCount: aiResults.length,
    
    overall: {
      avgFieldsExtracted,
      avgAccuracyRate,
      avgInsightCount,
      avgConfidence,
      industryMatchRate,
      skipQuestionsAvg,
    },
    
    byUserType: {
      PM: {
        avgFieldsExtracted: pmResults.reduce((sum, r) => sum + r.metrics.fieldsExtracted, 0) / pmResults.length,
        avgAccuracyRate: pmResults.reduce((sum, r) => sum + r.metrics.accuracyRate, 0) / pmResults.length,
        avgInsightCount: pmResults.reduce((sum, r) => sum + r.metrics.insightCount, 0) / pmResults.length,
        topInferredFields: pmTopFields,
      },
      AI_Engineer: {
        avgFieldsExtracted: aiResults.reduce((sum, r) => sum + r.metrics.fieldsExtracted, 0) / aiResults.length,
        avgAccuracyRate: aiResults.reduce((sum, r) => sum + r.metrics.accuracyRate, 0) / aiResults.length,
        avgInsightCount: aiResults.reduce((sum, r) => sum + r.metrics.insightCount, 0) / aiResults.length,
        topInferredFields: aiTopFields,
      },
    },
    
    insightDistribution,
    
    dataLossAnalysis: {
      totalExpectedFields,
      totalExtractedFields,
      lossRate,
      missedFieldsBreakdown: {
        industry: results.filter(r => !r.inferences.some(i => i.field === 'industry') && !r.industryMatch?.industry).length,
        industrySegment: results.filter(r => !r.inferences.some(i => i.field === 'industrySegment') && !r.industryMatch?.industrySegment).length,
        occupation: results.filter(r => !r.inferences.some(i => i.field === 'occupation')).length,
        city: results.filter(r => !r.inferences.some(i => i.field === 'city')).length,
      },
    },
    
    intelligenceScore: {
      inferenceEfficiency,
      coverageCompleteness,
      confidenceQuality,
      overallScore,
      improvement: `相比传统表单注册，AI对话平均可减少 ${savedQuestions} 个问题 (节省 ${improvementPercent}% 的填写负担)，同时额外收集 ${avgInsightCount.toFixed(1)} 条隐藏洞察`,
    },
  };
}

// ============ 主测试函数 ============

export async function runSimulation(userCount: number = 1000): Promise<SimulationReport> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🧪 AI Chat Flow 模拟测试`);
  console.log(`📊 模拟用户数: ${userCount} (${userCount/2} PM + ${userCount/2} AI工程师)`);
  console.log(`${'='.repeat(60)}\n`);
  
  // 1. 生成模拟用户
  console.log('📝 生成模拟用户数据...');
  const users = generateSimulatedUsers(userCount);
  console.log(`   ✅ 生成完成: ${users.length} 个用户\n`);
  
  // 2. 运行提取测试
  console.log('🔍 运行信息提取测试...');
  const results: ExtractionResult[] = [];
  let processed = 0;
  
  for (const user of users) {
    const result = runExtractionForUser(user);
    results.push(result);
    processed++;
    
    if (processed % 100 === 0) {
      console.log(`   进度: ${processed}/${userCount} (${Math.round(processed/userCount*100)}%)`);
    }
  }
  console.log(`   ✅ 测试完成\n`);
  
  // 3. 生成报告
  console.log('📊 生成统计报告...');
  const report = generateReport(results);
  
  // 4. 打印报告
  printReport(report);
  
  return report;
}

function printReport(report: SimulationReport): void {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 模拟测试报告`);
  console.log(`${'='.repeat(60)}\n`);
  
  console.log(`【总体统计】`);
  console.log(`  - 测试用户总数: ${report.totalUsers}`);
  console.log(`  - 产品经理: ${report.pmCount}`);
  console.log(`  - AI工程师: ${report.aiEngineerCount}`);
  console.log();
  
  console.log(`【信息提取效果】`);
  console.log(`  - 平均提取字段数: ${report.overall.avgFieldsExtracted.toFixed(2)}`);
  console.log(`  - 平均准确率: ${(report.overall.avgAccuracyRate * 100).toFixed(1)}%`);
  console.log(`  - 行业识别率: ${(report.overall.industryMatchRate * 100).toFixed(1)}%`);
  console.log(`  - 平均可跳过问题数: ${report.overall.skipQuestionsAvg.toFixed(1)}`);
  console.log();
  
  console.log(`【SmartInsights洞察】`);
  console.log(`  - 平均洞察数: ${report.overall.avgInsightCount.toFixed(2)}`);
  console.log(`  - 平均置信度: ${(report.overall.avgConfidence * 100).toFixed(1)}%`);
  console.log(`  - 洞察类别分布:`);
  Object.entries(report.insightDistribution).forEach(([cat, count]) => {
    console.log(`    · ${cat}: ${count} (${(count / report.totalUsers * 100).toFixed(1)}%)`);
  });
  console.log();
  
  console.log(`【按用户类型】`);
  console.log(`  产品经理:`);
  console.log(`    - 平均字段: ${report.byUserType.PM.avgFieldsExtracted.toFixed(2)}`);
  console.log(`    - 准确率: ${(report.byUserType.PM.avgAccuracyRate * 100).toFixed(1)}%`);
  console.log(`    - 常见推断: ${report.byUserType.PM.topInferredFields.join(', ')}`);
  console.log(`  AI工程师:`);
  console.log(`    - 平均字段: ${report.byUserType.AI_Engineer.avgFieldsExtracted.toFixed(2)}`);
  console.log(`    - 准确率: ${(report.byUserType.AI_Engineer.avgAccuracyRate * 100).toFixed(1)}%`);
  console.log(`    - 常见推断: ${report.byUserType.AI_Engineer.topInferredFields.join(', ')}`);
  console.log();
  
  console.log(`【信息丢失分析】`);
  console.log(`  - 期望提取字段: ${report.dataLossAnalysis.totalExpectedFields}`);
  console.log(`  - 实际提取字段: ${report.dataLossAnalysis.totalExtractedFields}`);
  console.log(`  - 丢失率: ${(report.dataLossAnalysis.lossRate * 100).toFixed(1)}%`);
  console.log(`  - 未识别字段分布:`);
  Object.entries(report.dataLossAnalysis.missedFieldsBreakdown).forEach(([field, count]) => {
    console.log(`    · ${field}: ${count} 用户未识别 (${(count / report.totalUsers * 100).toFixed(1)}%)`);
  });
  console.log();
  
  console.log(`【智能化程度评估】`);
  console.log(`  - 推断效率: ${report.intelligenceScore.inferenceEfficiency}/100`);
  console.log(`  - 覆盖完整度: ${report.intelligenceScore.coverageCompleteness}/100`);
  console.log(`  - 置信度质量: ${report.intelligenceScore.confidenceQuality}/100`);
  console.log(`  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  🏆 综合评分: ${report.intelligenceScore.overallScore}/100`);
  console.log();
  console.log(`  📈 ${report.intelligenceScore.improvement}`);
  console.log(`\n${'='.repeat(60)}\n`);
}

// 导出运行命令
export default runSimulation;
