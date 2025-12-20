/**
 * 对话签名生成器 (Conversation Signature Generator)
 * 从AI对话中提取用户特征向量，用于增强匹配算法
 */

import type { InferredAttribute } from './types';

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
  
  const dialectPatterns = /[嘅喺咗啦嘛咩呀噉]/g;
  const negationPatterns = /不是|没有|不在|不想|没|不/g;
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
    
    // 统计主动提问（用户主动问小悦问题）
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
  
  // 确保在0-100范围内
  return Math.max(0, Math.min(100, score));
}

export default {
  generateConversationSignature,
  calculateSignatureSimilarity,
};
