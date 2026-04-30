/**
 * 对话签名生成器 (Conversation Signature Generator)
 * 从AI对话中提取用户特征向量，用于增强匹配算法
 * 包含深度特征提取：认知风格、沟通偏好、社交人格、情感特质等
 */

import type { InferredAttribute } from './types';
import { CANTONESE_PATTERN, detectCantoneseUsage } from './cantoneseVocabulary';
import { analyzeDialectsFromMessages } from './dialectVocabulary';
import type { DialectProfile, Level3HiddenInsights } from './informationTiers';

// ============ 深度特征分类体系 ============

/**
 * 认知风格 - 用户思考和决策的方式
 */
export interface CognitiveStyle {
  // 决策速度: quick(快速决策) | deliberate(深思熟虑) | balanced(平衡型)
  decisionSpeed: 'quick' | 'deliberate' | 'balanced';
  
  // 风险偏好: adventurous(冒险型) | cautious(谨慎型) | moderate(适中型)
  riskTolerance: 'adventurous' | 'cautious' | 'moderate';
  
  // 思维方式: logical(逻辑型) | intuitive(直觉型) | mixed(混合型)
  thinkingMode: 'logical' | 'intuitive' | 'mixed';
  
  // 信息处理: detail(细节导向) | big-picture(宏观导向) | flexible(灵活切换)
  infoProcessing: 'detail' | 'big-picture' | 'flexible';
}

/**
 * 沟通偏好 - 用户的表达和交流习惯
 */
export interface CommunicationPreference {
  // 幽默风格: witty(机智型) | silly(搞笑型) | dry(冷幽默) | none(不使用)
  humorStyle: 'witty' | 'silly' | 'dry' | 'none';
  
  // 表达深度: surface(表面) | moderate(适中) | deep(深度)
  expressionDepth: 'surface' | 'moderate' | 'deep';
  
  // Emoji使用: frequent(频繁) | occasional(偶尔) | rare(很少)
  emojiUsage: 'frequent' | 'occasional' | 'rare';
  
  // 回复长度偏好: concise(简洁) | moderate(适中) | elaborate(详尽)
  responseLengthPreference: 'concise' | 'moderate' | 'elaborate';
  
  // 正式度: formal(正式) | casual(随意) | adaptive(适应性)
  formalityLevel: 'formal' | 'casual' | 'adaptive';
}

/**
 * 社交人格 - 用户在社交场合的行为模式
 */
export interface SocialPersonality {
  // 社交主动性: proactive(主动) | reactive(被动) | balanced(平衡)
  socialInitiative: 'proactive' | 'reactive' | 'balanced';
  
  // 领导倾向: leader(领导) | follower(跟随) | collaborator(协作)
  leadershipTendency: 'leader' | 'follower' | 'collaborator';
  
  // 倾听vs表达: listener(倾听型) | expressor(表达型) | balanced(平衡)
  listenExpressBalance: 'listener' | 'expressor' | 'balanced';
  
  // 群体偏好: small(小群体) | large(大群体) | flexible(灵活)
  groupSizePreference: 'small' | 'large' | 'flexible';
  
  // 能量来源: introvert(内向) | extrovert(外向) | ambivert(两向)
  energySource: 'introvert' | 'extrovert' | 'ambivert';
}

/**
 * 情感特质 - 用户的情感表达和情绪特征
 * 赵心怡教授建议：使用描述性区间代替0-100数值，避免标签化风险
 */
export interface EmotionalTraits {
  // 情绪稳定度: stable(稳定型) | sensitive(敏感型) | balanced(平衡型)
  emotionalStability: 'stable' | 'sensitive' | 'balanced';
  
  // 共情能力: high(高共情) | moderate(中等) | developing(发展中)
  empathyLevel: 'high' | 'moderate' | 'developing';
  
  // 开放程度: open(开放型) | selective(选择性) | traditional(传统型)
  opennessLevel: 'open' | 'selective' | 'traditional';
  
  // 情感表达: expressive(外显) | reserved(内敛) | selective(选择性)
  emotionalExpression: 'expressive' | 'reserved' | 'selective';
  
  // 积极性: optimistic(乐观型) | neutral(中性) | cautious(谨慎型)
  positivityLevel: 'optimistic' | 'neutral' | 'cautious';
}

/**
 * 互动节奏 - 用户的对话节奏特征
 */
export interface InteractionRhythm {
  // 回复节奏: fast(快) | moderate(中) | slow(慢)
  responseSpeed: 'fast' | 'moderate' | 'slow';
  
  // 话题切换: frequent(频繁) | steady(稳定) | rare(很少)
  topicSwitching: 'frequent' | 'steady' | 'rare';
  
  // 对话深入度: surface(浅尝辄止) | moderate(适中) | deep(深入探讨)
  conversationDepth: 'surface' | 'moderate' | 'deep';
  
  // 问答比例: questioner(多问) | answerer(多答) | balanced(平衡)
  qaBalance: 'questioner' | 'answerer' | 'balanced';
}

/**
 * 完整的深度特征结构
 */
export interface DeepTraits {
  cognitive: Partial<CognitiveStyle>;
  communication: Partial<CommunicationPreference>;
  social: Partial<SocialPersonality>;
  emotional: Partial<EmotionalTraits>;
  rhythm: Partial<InteractionRhythm>;
  
  // 提取时间戳
  extractedAt: string;
  
  // 总体置信度 (0-1)
  overallConfidence: number;
}

// ============ 原有类型定义 ============

// 语言风格类型
export type LinguisticStyle = 'direct' | 'implicit' | 'negative' | 'dialect' | 'mixed' | 
                              'doubleNegative' | 'hypothetical' | 'thirdPerson' | 'contradiction';

// 对话模式类型
export type ConversationMode = 'express' | 'standard' | 'deep' | 'allinone';

// 对话签名接口
export interface ConversationSignature {
  // 对话模式
  conversationMode: ConversationMode;
  
  // 主要语言风格
  primaryLinguisticStyle: LinguisticStyle;
  
  // 社交能量值 (0-100)
  // 基于回复速度、主动性、情绪积极度等
  conversationEnergy: number;
  
  // 否定表达可信度 (0-1)
  // 用户使用否定表达时的准确程度
  negationReliability: number;
  
  // AI推断的属性
  inferredTraits: Record<string, string | number | boolean>;
  
  // 深度特征 (可选，需要足够对话数据)
  deepTraits?: DeepTraits;
  
  // 方言画像 (Level 3 隐藏推断)
  dialectProfile?: DialectProfile;
  
  // 总体推断置信度 (0-1)
  inferenceConfidence: number;
}

// 对话统计信息
interface ConversationStats {
  totalTurns: number;
  userTurns: number;
  avgResponseLength: number;
  questionCount: number;
  exclamationCount: number;
  emojiCount: number;
  dialectUsage: number;
  negationUsage: number;
  proactiveQuestions: number;
}

/**
 * 分析对话统计信息
 */
function analyzeConversation(messages: Array<{ role: string; content: string }>): ConversationStats {
  const userMessages = messages.filter(m => m.role === 'user');
  
  let totalLength = 0;
  let questionCount = 0;
  let exclamationCount = 0;
  let emojiCount = 0;
  let dialectUsage = 0;
  let negationUsage = 0;
  let proactiveQuestions = 0;
  
  // 使用扩展的粤语词库（200+ 词汇）
  const dialectPatterns = CANTONESE_PATTERN;
  const negationPatterns = /不是|没有|不在|不想|没|不|唔系|唔係|冇|唔/g;
  const emojiPattern = /[\uD83C-\uDBFF\uDC00-\uDFFF]+/g;
  
  for (const msg of userMessages) {
    const content = msg.content;
    totalLength += content.length;
    
    // 统计问号
    questionCount += (content.match(/\?|？/g) || []).length;
    
    // 统计感叹号
    exclamationCount += (content.match(/!|！/g) || []).length;
    
    // 统计表情
    emojiCount += (content.match(emojiPattern) || []).length;
    
    // 统计方言使用
    dialectUsage += (content.match(dialectPatterns) || []).length;
    
    // 统计否定表达
    negationUsage += (content.match(negationPatterns) || []).length;
    
    // 统计主动提问（用户主动问悦仔问题）
    if (content.includes('你') && (content.includes('?') || content.includes('？'))) {
      proactiveQuestions++;
    }
  }
  
  return {
    totalTurns: messages.length,
    userTurns: userMessages.length,
    avgResponseLength: userMessages.length > 0 ? totalLength / userMessages.length : 0,
    questionCount,
    exclamationCount,
    emojiCount,
    dialectUsage,
    negationUsage,
    proactiveQuestions,
  };
}

/**
 * 计算社交能量值 (0-100)
 * 基于对话活跃度、积极性、主动性等
 */
function calculateConversationEnergy(stats: ConversationStats): number {
  let energy = 50; // 基础值
  
  // 回复长度加分 (平均长度越长，能量越高)
  if (stats.avgResponseLength > 50) energy += 10;
  else if (stats.avgResponseLength > 30) energy += 5;
  else if (stats.avgResponseLength < 10) energy -= 10;
  
  // 感叹号使用加分 (表示热情)
  energy += Math.min(stats.exclamationCount * 2, 10);
  
  // 表情使用加分 (表示友好)
  energy += Math.min(stats.emojiCount * 2, 10);
  
  // 主动提问加分 (表示好奇心)
  energy += Math.min(stats.proactiveQuestions * 5, 15);
  
  // 对话轮数加分 (表示参与度)
  if (stats.userTurns > 10) energy += 10;
  else if (stats.userTurns > 5) energy += 5;
  
  // 确保在0-100范围内
  return Math.max(0, Math.min(100, Math.round(energy)));
}

/**
 * 检测主要语言风格
 */
function detectPrimaryLinguisticStyle(
  messages: Array<{ role: string; content: string }>,
  stats: ConversationStats
): LinguisticStyle {
  const userMessages = messages.filter(m => m.role === 'user');
  const allContent = userMessages.map(m => m.content).join(' ');
  
  // 方言检测
  if (stats.dialectUsage > 5) {
    return 'dialect';
  }
  
  // 中英混杂检测
  const englishPattern = /[a-zA-Z]{3,}/g;
  const englishMatches = allContent.match(englishPattern) || [];
  if (englishMatches.length > 3) {
    return 'mixed';
  }
  
  // 否定转折检测
  const contrastPatterns = /不是.*是|没有.*有|不在.*在/g;
  if ((allContent.match(contrastPatterns) || []).length > 2) {
    return 'negative';
  }
  
  // 隐含表达检测
  const implicitPatterns = /可能|大概|应该|好像|感觉/g;
  if ((allContent.match(implicitPatterns) || []).length > 3) {
    return 'implicit';
  }
  
  // 默认直接表达
  return 'direct';
}

/**
 * 计算否定表达可信度 (0-1)
 * 用户使用否定表达时的准确程度
 */
function calculateNegationReliability(stats: ConversationStats): number {
  // 如果很少使用否定表达，默认高可信度
  if (stats.negationUsage < 2) {
    return 0.9;
  }
  
  // 否定使用越多，可能越模糊，可信度略降
  // 但也可能是表达习惯，不应过度惩罚
  const reliability = Math.max(0.6, 1 - (stats.negationUsage * 0.03));
  
  return Math.round(reliability * 100) / 100;
}

/**
 * 计算总体推断置信度 (0-1)
 */
function calculateInferenceConfidence(
  inferences: InferredAttribute[],
  stats: ConversationStats
): number {
  if (inferences.length === 0) {
    return 0;
  }
  
  // 基于推断结果的平均置信度
  const avgConfidence = inferences.reduce((sum, inf) => sum + inf.confidence, 0) / inferences.length;
  
  // 对话轮数越多，置信度越高
  let turnBonus = 0;
  if (stats.userTurns > 10) turnBonus = 0.1;
  else if (stats.userTurns > 5) turnBonus = 0.05;
  
  const confidence = Math.min(1, avgConfidence + turnBonus);
  
  return Math.round(confidence * 100) / 100;
}

/**
 * 生成对话签名
 * @param messages 对话消息列表
 * @param inferences AI推断的属性列表
 * @param mode 对话模式
 */
export function generateConversationSignature(
  messages: Array<{ role: string; content: string }>,
  inferences: InferredAttribute[],
  mode: ConversationMode = 'standard'
): ConversationSignature {
  // 分析对话统计
  const stats = analyzeConversation(messages);
  
  // 计算各项指标
  const conversationEnergy = calculateConversationEnergy(stats);
  const primaryLinguisticStyle = detectPrimaryLinguisticStyle(messages, stats);
  const negationReliability = calculateNegationReliability(stats);
  const inferenceConfidence = calculateInferenceConfidence(inferences, stats);
  
  // 分析方言画像 (Level 3 隐藏推断)
  const dialectProfile = analyzeDialectsFromMessages(messages);
  
  // 构建推断属性对象
  const inferredTraits: Record<string, string | number | boolean> = {};
  for (const inf of inferences) {
    inferredTraits[inf.field] = inf.value;
  }
  
  return {
    conversationMode: mode,
    primaryLinguisticStyle,
    conversationEnergy,
    negationReliability,
    inferredTraits,
    dialectProfile,
    inferenceConfidence,
  };
}

/**
 * 计算两个用户的对话签名相似度 (0-100)
 * 用于匹配算法的第6维度
 */
export function calculateSignatureSimilarity(
  sig1: ConversationSignature | null,
  sig2: ConversationSignature | null
): number {
  // 如果任一用户没有对话签名，返回中等分数
  if (!sig1 || !sig2) {
    return 50;
  }
  
  let score = 50; // 基础分
  
  // 语言风格相似度 (+20分)
  if (sig1.primaryLinguisticStyle === sig2.primaryLinguisticStyle) {
    score += 20;
  } else {
    // 相近风格也加分
    const similarStyles: Record<LinguisticStyle, LinguisticStyle[]> = {
      'direct': ['mixed'],
      'implicit': ['negative', 'hypothetical'],
      'negative': ['implicit', 'doubleNegative', 'contradiction'],
      'dialect': ['mixed'],
      'mixed': ['direct', 'dialect'],
      'doubleNegative': ['negative'],
      'hypothetical': ['implicit'],
      'thirdPerson': [],
      'contradiction': ['negative'],
    };
    if (similarStyles[sig1.primaryLinguisticStyle]?.includes(sig2.primaryLinguisticStyle)) {
      score += 10;
    }
  }
  
  // 社交能量匹配 (+20分)
  // 能量差越小越好
  const energyDiff = Math.abs(sig1.conversationEnergy - sig2.conversationEnergy);
  if (energyDiff < 10) {
    score += 20;
  } else if (energyDiff < 20) {
    score += 15;
  } else if (energyDiff < 30) {
    score += 10;
  } else if (energyDiff < 50) {
    score += 5;
  }
  
  // 对话模式相似 (+10分)
  if (sig1.conversationMode === sig2.conversationMode) {
    score += 10;
  } else {
    // 相近模式也加分
    const deepModes = ['deep', 'allinone'];
    const quickModes = ['express', 'standard'];
    if (
      (deepModes.includes(sig1.conversationMode) && deepModes.includes(sig2.conversationMode)) ||
      (quickModes.includes(sig1.conversationMode) && quickModes.includes(sig2.conversationMode))
    ) {
      score += 5;
    }
  }
  
  // 方言画像匹配 (+15分) - Level 3 隐藏推断的化学反应加成
  if (sig1.dialectProfile && sig2.dialectProfile) {
    const dp1 = sig1.dialectProfile;
    const dp2 = sig2.dialectProfile;
    
    // 同方言老乡加成
    if (dp1.primaryDialect && dp1.primaryDialect === dp2.primaryDialect) {
      // 同方言背景，超级加分！
      score += 15;
    } else if (dp1.primaryDialect && dp2.primaryDialect) {
      // 都有明确方言背景但不同，小加分（都是移民/外地人，有共鸣）
      score += 5;
    }
  }
  
  // 确保在0-100范围内
  return Math.max(0, Math.min(100, score));
}

// ============ 深度特征提取器 ============

/**
 * 从对话中提取深度特征
 * 分析用户的认知风格、沟通偏好、社交人格等微观信号
 */
export function extractDeepTraits(
  messages: Array<{ role: string; content: string }>
): DeepTraits {
  const userMessages = messages.filter(m => m.role === 'user');
  const allUserContent = userMessages.map(m => m.content).join(' ');
  
  // 基础统计
  const stats = analyzeConversation(messages);
  
  // ====== 沟通偏好分析 ======
  const communication: Partial<CommunicationPreference> = {};
  
  // Emoji使用频率
  if (stats.emojiCount > 5) {
    communication.emojiUsage = 'frequent';
  } else if (stats.emojiCount > 1) {
    communication.emojiUsage = 'occasional';
  } else {
    communication.emojiUsage = 'rare';
  }
  
  // 回复长度偏好
  if (stats.avgResponseLength > 50) {
    communication.responseLengthPreference = 'elaborate';
  } else if (stats.avgResponseLength > 20) {
    communication.responseLengthPreference = 'moderate';
  } else {
    communication.responseLengthPreference = 'concise';
  }
  
  // 正式度检测
  const formalPatterns = /您|请问|麻烦|贵/g;
  const casualPatterns = /哈哈|嘿|哇|啊|呀|嘛|呢|吧/g;
  const formalCount = (allUserContent.match(formalPatterns) || []).length;
  const casualCount = (allUserContent.match(casualPatterns) || []).length;
  
  if (formalCount > casualCount * 2) {
    communication.formalityLevel = 'formal';
  } else if (casualCount > formalCount * 2) {
    communication.formalityLevel = 'casual';
  } else {
    communication.formalityLevel = 'adaptive';
  }
  
  // 幽默风格检测
  const wittyPatterns = /笑|哈哈|haha|lol|😂|🤣/gi;
  const sillyPatterns = /傻|疯|神经|搞笑/g;
  const wittyCount = (allUserContent.match(wittyPatterns) || []).length;
  const sillyCount = (allUserContent.match(sillyPatterns) || []).length;
  
  if (wittyCount > 3) {
    communication.humorStyle = 'witty';
  } else if (sillyCount > 2) {
    communication.humorStyle = 'silly';
  } else if (wittyCount > 0 || sillyCount > 0) {
    communication.humorStyle = 'dry';
  } else {
    communication.humorStyle = 'none';
  }
  
  // ====== 社交人格分析 ======
  const social: Partial<SocialPersonality> = {};
  
  // 社交主动性
  if (stats.proactiveQuestions > 3) {
    social.socialInitiative = 'proactive';
  } else if (stats.proactiveQuestions > 0) {
    social.socialInitiative = 'balanced';
  } else {
    social.socialInitiative = 'reactive';
  }
  
  // 问答比例
  if (stats.questionCount > stats.userTurns * 0.5) {
    social.listenExpressBalance = 'listener'; // 多问说明想了解他人
  } else if (stats.avgResponseLength > 40) {
    social.listenExpressBalance = 'expressor'; // 长回复说明喜欢表达
  } else {
    social.listenExpressBalance = 'balanced';
  }
  
  // 能量来源推断（基于表达热情度）
  const energyScore = calculateConversationEnergy(stats);
  if (energyScore >= 70) {
    social.energySource = 'extrovert';
  } else if (energyScore <= 40) {
    social.energySource = 'introvert';
  } else {
    social.energySource = 'ambivert';
  }
  
  // ====== 情感特质分析 ======
  const emotional: Partial<EmotionalTraits> = {};
  
  // 积极性分析（使用描述性区间代替0-100数值）
  const positivePatterns = /喜欢|开心|快乐|期待|兴奋|棒|好|赞|爱|感谢|谢谢|不错|可以|挺好|蛮好|还行/g;
  const negativePatterns = /讨厌|烦|累|难过|无聊|不想|不喜欢|不行|糟糕|差劲/g;
  const positiveCount = (allUserContent.match(positivePatterns) || []).length;
  const negativeCount = (allUserContent.match(negativePatterns) || []).length;
  
  // 使用描述性区间判断积极性
  const totalAffect = positiveCount + negativeCount;
  if (totalAffect > 0) {
    const positivityRatio = positiveCount / totalAffect;
    if (positivityRatio >= 0.65) {
      emotional.positivityLevel = 'optimistic';
    } else if (positivityRatio <= 0.35) {
      emotional.positivityLevel = 'cautious';
    } else {
      emotional.positivityLevel = 'neutral';
    }
  } else {
    emotional.positivityLevel = 'neutral'; // 默认中性
  }
  
  // 情感表达风格
  if (stats.exclamationCount > stats.userTurns * 0.3) {
    emotional.emotionalExpression = 'expressive';
  } else if (stats.exclamationCount === 0 && communication.emojiUsage === 'rare') {
    emotional.emotionalExpression = 'reserved';
  } else {
    emotional.emotionalExpression = 'selective';
  }
  
  // 开放程度（基于愿意分享的信息量，使用描述性区间）
  const infoKeywords = /我是|我在|我的|家人|工作|喜欢|爱好|经历|之前/g;
  const infoCount = (allUserContent.match(infoKeywords) || []).length;
  if (infoCount >= 5) {
    emotional.opennessLevel = 'open';
  } else if (infoCount >= 2) {
    emotional.opennessLevel = 'selective';
  } else {
    emotional.opennessLevel = 'traditional';
  }
  
  // 情绪稳定度（基于表达一致性，使用描述性区间）
  // 对话轮次越多、表达越稳定则更可能是稳定型
  if (stats.userTurns >= 8 && stats.exclamationCount < stats.userTurns * 0.4) {
    emotional.emotionalStability = 'stable';
  } else if (stats.exclamationCount > stats.userTurns * 0.5 || negativeCount > positiveCount) {
    emotional.emotionalStability = 'sensitive';
  } else {
    emotional.emotionalStability = 'balanced';
  }
  
  // 共情能力（基于提问和关心词汇，使用描述性区间）
  const empathyPatterns = /你|您|怎么样|还好吗|辛苦|理解/g;
  const empathyCount = (allUserContent.match(empathyPatterns) || []).length;
  if (empathyCount >= 5) {
    emotional.empathyLevel = 'high';
  } else if (empathyCount >= 2) {
    emotional.empathyLevel = 'moderate';
  } else {
    emotional.empathyLevel = 'developing';
  }
  
  // ====== 互动节奏分析 ======
  const rhythm: Partial<InteractionRhythm> = {};
  
  // 对话深入度
  if (stats.avgResponseLength > 60 || stats.userTurns > 12) {
    rhythm.conversationDepth = 'deep';
  } else if (stats.avgResponseLength > 25 || stats.userTurns > 6) {
    rhythm.conversationDepth = 'moderate';
  } else {
    rhythm.conversationDepth = 'surface';
  }
  
  // 问答比例
  const qaRatio = stats.questionCount / Math.max(1, stats.userTurns);
  if (qaRatio > 0.5) {
    rhythm.qaBalance = 'questioner';
  } else if (qaRatio < 0.1) {
    rhythm.qaBalance = 'answerer';
  } else {
    rhythm.qaBalance = 'balanced';
  }
  
  // ====== 认知风格分析 ======
  const cognitive: Partial<CognitiveStyle> = {};
  
  // 思维方式（基于表达特征）
  const logicalPatterns = /因为|所以|如果|那么|但是|然而|首先|其次|总之/g;
  const intuitivePatterns = /感觉|好像|可能|应该|大概|似乎/g;
  const logicalCount = (allUserContent.match(logicalPatterns) || []).length;
  const intuitiveCount = (allUserContent.match(intuitivePatterns) || []).length;
  
  if (logicalCount > intuitiveCount * 2) {
    cognitive.thinkingMode = 'logical';
  } else if (intuitiveCount > logicalCount * 2) {
    cognitive.thinkingMode = 'intuitive';
  } else {
    cognitive.thinkingMode = 'mixed';
  }
  
  // 决策速度（基于回复简洁度）
  if (communication.responseLengthPreference === 'concise') {
    cognitive.decisionSpeed = 'quick';
  } else if (communication.responseLengthPreference === 'elaborate') {
    cognitive.decisionSpeed = 'deliberate';
  } else {
    cognitive.decisionSpeed = 'balanced';
  }
  
  // 计算总体置信度
  const totalFactors = Object.keys(communication).length + 
                       Object.keys(social).length + 
                       Object.keys(emotional).length + 
                       Object.keys(rhythm).length + 
                       Object.keys(cognitive).length;
  const overallConfidence = Math.min(0.95, 0.3 + (totalFactors * 0.05) + (stats.userTurns * 0.02));
  
  return {
    cognitive,
    communication,
    social,
    emotional,
    rhythm,
    extractedAt: new Date().toISOString(),
    overallConfidence: Math.round(overallConfidence * 100) / 100,
  };
}

/**
 * 计算两个用户深度特征的相似度 (0-100)
 * 使用置信度加权，确保即使部分特征缺失也能合理计算
 */
export function calculateDeepTraitsSimilarity(
  traits1: DeepTraits | undefined,
  traits2: DeepTraits | undefined
): number {
  if (!traits1 || !traits2) {
    return 50; // 无数据时返回中等分数
  }
  
  let score = 0;
  let totalWeight = 0;
  
  // 辅助函数：安全比较并加权
  const compareAndScore = (
    val1: string | number | undefined, 
    val2: string | number | undefined, 
    weight: number,
    numericThreshold?: number
  ): void => {
    if (val1 === undefined || val2 === undefined) return;
    
    totalWeight += weight;
    
    if (typeof val1 === 'number' && typeof val2 === 'number' && numericThreshold) {
      // 数值比较
      const diff = Math.abs(val1 - val2);
      if (diff <= numericThreshold) {
        score += weight;
      } else if (diff <= numericThreshold * 2) {
        score += weight * 0.5;
      }
    } else if (val1 === val2) {
      // 类别比较
      score += weight;
    }
  };
  
  // 沟通偏好匹配
  compareAndScore(traits1.communication.emojiUsage, traits2.communication.emojiUsage, 10);
  compareAndScore(traits1.communication.formalityLevel, traits2.communication.formalityLevel, 10);
  compareAndScore(traits1.communication.responseLengthPreference, traits2.communication.responseLengthPreference, 8);
  compareAndScore(traits1.communication.humorStyle, traits2.communication.humorStyle, 8);
  
  // 社交人格匹配
  compareAndScore(traits1.social.energySource, traits2.social.energySource, 15);
  compareAndScore(traits1.social.socialInitiative, traits2.social.socialInitiative, 10);
  compareAndScore(traits1.social.listenExpressBalance, traits2.social.listenExpressBalance, 8);
  
  // 互动节奏匹配
  compareAndScore(traits1.rhythm.conversationDepth, traits2.rhythm.conversationDepth, 12);
  compareAndScore(traits1.rhythm.qaBalance, traits2.rhythm.qaBalance, 8);
  
  // 认知风格匹配
  compareAndScore(traits1.cognitive.thinkingMode, traits2.cognitive.thinkingMode, 12);
  compareAndScore(traits1.cognitive.decisionSpeed, traits2.cognitive.decisionSpeed, 8);
  
  // 情感特质匹配 - 现已改为类别型（赵心怡教授建议）
  compareAndScore(traits1.emotional.positivityLevel, traits2.emotional.positivityLevel, 15);
  compareAndScore(traits1.emotional.opennessLevel, traits2.emotional.opennessLevel, 10);
  compareAndScore(traits1.emotional.empathyLevel, traits2.emotional.empathyLevel, 10);
  compareAndScore(traits1.emotional.emotionalStability, traits2.emotional.emotionalStability, 12);
  
  // 如果没有可比较的特征，返回中等分数
  if (totalWeight === 0) {
    return 50;
  }
  
  // 基于置信度加权的最终分数
  // 使用两者置信度的几何平均
  const confidenceWeight = Math.sqrt(traits1.overallConfidence * traits2.overallConfidence);
  
  // 归一化到0-100范围
  const normalizedScore = (score / totalWeight) * 100;
  
  // 置信度调整：低置信度时趋向50分
  const adjustedScore = 50 + (normalizedScore - 50) * confidenceWeight;
  
  return Math.min(100, Math.max(0, Math.round(adjustedScore)));
}

export default {
  generateConversationSignature,
  calculateSignatureSimilarity,
  extractDeepTraits,
  calculateDeepTraitsSimilarity,
};
