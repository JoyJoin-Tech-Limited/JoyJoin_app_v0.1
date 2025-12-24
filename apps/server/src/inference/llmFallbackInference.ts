/**
 * LLM兜底推断模块
 * 
 * 当静态规则匹配失败或置信度<0.5时，调用DeepSeek处理复杂语义
 * 
 * 触发条件：
 * 1. 规则匹配失败 - 没有任何正则命中
 * 2. 置信度<0.5 - 命中了但信号太弱
 * 3. 关键维度缺失 - 问了2轮还没提取到核心信息
 * 4. 语义冲突 - 提取结果自相矛盾
 * 
 * 使用共享的deepseekClient以保持一致性和安全性
 */

import type { SmartInsight } from '../deepseekClient';
import type { InsightDimension } from './dialogGuidanceSystem';
import OpenAI from 'openai';

export interface LLMInferenceRequest {
  text: string;
  dimension: InsightDimension;
  context?: string;
  previousAttempts?: string[];
}

export interface LLMInferenceResult {
  success: boolean;
  insights: string[];
  confidence: number;
  reasoning?: string;
}

const DIMENSION_PROMPTS: Record<InsightDimension, string> = {
  interest: `分析用户的兴趣爱好。提取具体的兴趣点（如游戏类型、影视偏好、运动项目等）。`,
  lifestyle: `分析用户的生活方式。提取作息习惯、饮食偏好、休闲方式等。`,
  personality: `分析用户的性格特质。提取内向/外向倾向、社交风格、决策方式等。`,
  social: `分析用户的社交偏好。提取交友标准、聚会偏好、社交风格等。`,
  career: `分析用户的职业信息。提取职位、行业、公司、城市等。支持口语表达如"做XX的"、"XX一枚"等。`,
  expectation: `分析用户的交友期待。提取期望认识什么样的人、关系状态、来源背景等。`
};

export function buildInferencePrompt(request: LLMInferenceRequest): string {
  const dimensionGuide = DIMENSION_PROMPTS[request.dimension];
  
  return `你是一个用户画像分析专家，擅长从对话中提取用户洞察。

任务：${dimensionGuide}

用户原文：
"${request.text}"

${request.context ? `对话上下文：\n${request.context}\n` : ''}

请以JSON格式返回分析结果：
{
  "insights": ["洞察1", "洞察2"],  // 提取到的具体洞察，每条不超过10个字
  "confidence": 0.8,                // 0-1之间，表示提取的置信度
  "reasoning": "简要说明推理过程"   // 可选
}

注意：
1. 只提取有明确依据的洞察，不要猜测
2. 如果文本太模糊无法提取，返回空insights数组和低置信度
3. 使用口语化的洞察描述，如"游戏爱好者"而非"对游戏有兴趣"
4. 每条洞察要具体，避免空泛描述`;
}

export function shouldTriggerLLM(
  dimension: InsightDimension,
  confidence: number,
  insightsCount: number,
  questionsAsked: number
): boolean {
  if (confidence >= 0.7 && insightsCount > 0) {
    return false;
  }
  
  if (confidence < 0.5 && questionsAsked >= 2) {
    return true;
  }
  
  if (dimension === 'career' && confidence < 0.6) {
    return true;
  }
  
  if (dimension === 'expectation' && confidence < 0.6) {
    return true;
  }
  
  return false;
}

export function parseInferenceResponse(responseText: string): LLMInferenceResult {
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { success: false, insights: [], confidence: 0 };
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    return {
      success: true,
      insights: Array.isArray(parsed.insights) ? parsed.insights : [],
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
      reasoning: parsed.reasoning
    };
  } catch (error) {
    return { success: false, insights: [], confidence: 0 };
  }
}

const deepseekClient = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
});

export async function callLLMForInference(
  request: LLMInferenceRequest
): Promise<LLMInferenceResult> {
  const prompt = buildInferencePrompt(request);
  
  try {
    const response = await deepseekClient.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'user', content: prompt }
      ],
      max_tokens: 500,
      temperature: 0.3
    });
    
    const content = response.choices?.[0]?.message?.content || '';
    return parseInferenceResponse(content);
  } catch (error) {
    console.error('[LLM Fallback] Request failed:', error);
    return { success: false, insights: [], confidence: 0 };
  }
}

export function convertToSmartInsights(
  result: LLMInferenceResult,
  dimension: InsightDimension
): SmartInsight[] {
  const categoryMap: Record<InsightDimension, SmartInsight['category']> = {
    interest: 'preference',
    lifestyle: 'lifestyle',
    personality: 'personality',
    social: 'social',
    career: 'career',
    expectation: 'background'
  };
  
  return result.insights.map(insight => ({
    category: categoryMap[dimension],
    insight,
    evidence: 'LLM推断',
    confidence: result.confidence,
    timestamp: new Date().toISOString()
  }));
}
