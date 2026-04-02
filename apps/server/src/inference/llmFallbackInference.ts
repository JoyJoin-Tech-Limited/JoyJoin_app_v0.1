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
import type { UserAttributeMap } from './types';
import type { AIProvider } from '@shared/types/aiMeta';
import OpenAI from 'openai';
import { logger } from '../lib/logger';
import { logAITrace } from '../lib/aiTraceLogger';
import { recordLLMFallbackInferenceMetric } from '../middleware/metrics';

const SHADOW_ONLY_MODE = 'shadow';
const MAX_SHADOW_FALLBACK_DIMENSIONS = 2;
const DEEPSEEK_PROVIDER = 'deepseek';
const DEEPSEEK_MODEL = 'deepseek-chat';
const ESTIMATED_COST_PER_1K_TOKENS_USD = 0.0014;
const DEFAULT_SHADOW_TIMEOUT_MS = 1500;

const DIMENSION_TO_STATE_FIELDS: Record<InsightDimension, string[]> = {
  interest: ['topInterests', 'primaryInterests', 'interests', 'hobbies'],
  lifestyle: ['activityTimePreference', 'groupSizeComfort', 'lifestyle', 'lifeStage'],
  personality: ['socialStyle', 'personality', 'personalityTraits'],
  social: ['groupSizeComfort', 'socialStyle', 'socialPreference', 'icebreakerRole'],
  career: ['occupationHint', 'industryHint', 'seniority', 'educationLevel', 'occupation', 'industry', 'seniorityLevel', 'companyName', 'structuredOccupation'],
  expectation: ['intent', 'relationshipStatus', 'expectation', 'matchingGoal']
};

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
  liveCallAttempted?: boolean;
  provider?: AIProvider;
  model?: string;
  errorCode?: string;
}

export interface ShadowFallbackCandidate {
  dimension: InsightDimension;
  confidence: number;
  insightsCount: number;
  questionsAsked: number;
}

export interface ShadowFallbackLogEntry {
  timestamp: string;
  mode: 'shadow';
  sessionId?: string;
  dimension: InsightDimension;
  provider: AIProvider;
  model?: string;
  triggered: boolean;
  success: boolean;
  confidence: number;
  reasoning?: string;
  inferredAttributes: string[];
  latencyMs: number;
  estimatedCostUsd: number;
  questionsAsked: number;
  sourceConfidence: number;
  sourceInsightsCount: number;
  liveCallAttempted: boolean;
  errorCode?: string;
}

export interface ShadowFallbackSummary {
  mode: 'shadow' | 'disabled';
  triggered: boolean;
  calls: ShadowFallbackLogEntry[];
  totalLatencyMs: number;
  scheduledDimensions?: InsightDimension[];
}

const shadowFallbackLogs: ShadowFallbackLogEntry[] = [];

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
      return { success: false, insights: [], confidence: 0, errorCode: 'parse_error' };
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    return {
      success: true,
      insights: Array.isArray(parsed.insights) ? parsed.insights : [],
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
      reasoning: parsed.reasoning
    };
  } catch (error) {
    return { success: false, insights: [], confidence: 0, errorCode: 'parse_error' };
  }
}

const deepseekClient = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY || 'shadow-fallback-disabled',
  baseURL: 'https://api.deepseek.com',
});

export function getLLMFallbackInferenceMode(env: NodeJS.ProcessEnv = process.env): 'shadow' | 'disabled' {
  return env.LLM_FALLBACK_INFERENCE_MODE === SHADOW_ONLY_MODE ? SHADOW_ONLY_MODE : 'disabled';
}

export function getShadowFallbackLogs(): ShadowFallbackLogEntry[] {
  return [...shadowFallbackLogs];
}

export function clearShadowFallbackLogs(): void {
  shadowFallbackLogs.length = 0;
}

function rememberShadowFallbackLog(entry: ShadowFallbackLogEntry): void {
  shadowFallbackLogs.push(entry);
  if (shadowFallbackLogs.length > 1000) {
    shadowFallbackLogs.shift();
  }
}

function estimateTokenCount(text: string): number {
  return Math.max(1, Math.ceil(text.trim().length / 1.5));
}

function estimateCostUsd(prompt: string, result: LLMInferenceResult): number {
  const estimatedTokens = estimateTokenCount(prompt) +
    estimateTokenCount(result.insights.join(' ')) +
    estimateTokenCount(result.reasoning ?? '');
  return Number(((estimatedTokens / 1000) * ESTIMATED_COST_PER_1K_TOKENS_USD).toFixed(6));
}

async function withShadowTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error('shadow_timeout')), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

function buildShadowFallbackContext(
  conversationHistory: Array<{ role: string; content: string }>
): string | undefined {
  const context = conversationHistory
    .slice(-4)
    .map((message) => `${message.role}: ${message.content}`)
    .join('\n')
    .trim();

  return context || undefined;
}

function getDimensionSignalSnapshot(
  dimension: InsightDimension,
  currentState: UserAttributeMap
): { confidence: number; insightsCount: number; previousAttempts: string[] } {
  const fields = DIMENSION_TO_STATE_FIELDS[dimension];
  const values = fields
    .map((field) => currentState[field])
    .filter((value): value is NonNullable<UserAttributeMap[string]> => Boolean(value));

  const confidence = values.reduce((max, value) => Math.max(max, value.confidence), 0);
  const previousAttempts = values.map((value) => String(value.value)).filter(Boolean);

  return {
    confidence,
    insightsCount: previousAttempts.length,
    previousAttempts,
  };
}

export function buildShadowFallbackCandidates(params: {
  conversationHistory: Array<{ role: string; content: string }>;
  currentState: UserAttributeMap;
  matcherConfidence: number;
}): ShadowFallbackCandidate[] {
  const { conversationHistory, currentState, matcherConfidence } = params;

  if (matcherConfidence >= 0.6) {
    return [];
  }

  const questionsAsked =
    conversationHistory.filter((message) => message.role === 'user').length + 1;

  return (Object.keys(DIMENSION_TO_STATE_FIELDS) as InsightDimension[])
    .map((dimension) => {
      const snapshot = getDimensionSignalSnapshot(dimension, currentState);
      return {
        dimension,
        confidence: snapshot.confidence,
        insightsCount: snapshot.insightsCount,
        questionsAsked,
      };
    })
    .filter((candidate) => {
      if (!shouldTriggerLLM(
        candidate.dimension,
        candidate.confidence,
        candidate.insightsCount,
        candidate.questionsAsked,
      )) {
        return false;
      }

      return candidate.insightsCount > 0 || candidate.dimension === 'career' || candidate.dimension === 'expectation';
    })
    .sort((a, b) => {
      const aCritical = a.dimension === 'career' || a.dimension === 'expectation' ? 1 : 0;
      const bCritical = b.dimension === 'career' || b.dimension === 'expectation' ? 1 : 0;
      if (aCritical !== bCritical) {
        return bCritical - aCritical;
      }
      return a.confidence - b.confidence;
    })
    .slice(0, MAX_SHADOW_FALLBACK_DIMENSIONS);
}

export async function callLLMForInference(
  request: LLMInferenceRequest
): Promise<LLMInferenceResult> {
  if (!process.env.DEEPSEEK_API_KEY) {
    logger.warn('LLM fallback inference skipped because DEEPSEEK_API_KEY is missing', {
      provider: DEEPSEEK_PROVIDER,
    });
    return {
      success: false,
      insights: [],
      confidence: 0,
      liveCallAttempted: false,
      provider: null,
      errorCode: 'missing_credentials',
    };
  }

  const prompt = buildInferencePrompt(request);
  
  try {
    const response = await deepseekClient.chat.completions.create({
      model: DEEPSEEK_MODEL,
      messages: [
        { role: 'user', content: prompt }
      ],
      max_tokens: 500,
      temperature: 0.3
    });
    
    const content = response.choices?.[0]?.message?.content || '';
    const parsed = parseInferenceResponse(content);
    return {
      ...parsed,
      liveCallAttempted: true,
      provider: DEEPSEEK_PROVIDER,
      model: DEEPSEEK_MODEL,
      errorCode: parsed.success ? undefined : parsed.errorCode ?? 'parse_error',
    };
  } catch (error) {
    logger.error('LLM fallback inference request failed', {
      provider: DEEPSEEK_PROVIDER,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      insights: [],
      confidence: 0,
      liveCallAttempted: true,
      provider: DEEPSEEK_PROVIDER,
      model: DEEPSEEK_MODEL,
      errorCode: 'llm_error',
    };
  }
}

export async function runShadowLLMFallbackInference(params: {
  userMessage: string;
  conversationHistory: Array<{ role: string; content: string }>;
  currentState: UserAttributeMap;
  matcherConfidence: number;
  sessionId?: string;
  executeInference?: (request: LLMInferenceRequest) => Promise<LLMInferenceResult>;
  timeoutMs?: number;
}): Promise<ShadowFallbackSummary> {
  if (getLLMFallbackInferenceMode() !== SHADOW_ONLY_MODE) {
    return {
      mode: 'disabled',
      triggered: false,
      calls: [],
      totalLatencyMs: 0,
    };
  }

  const candidates = buildShadowFallbackCandidates({
    conversationHistory: params.conversationHistory,
    currentState: params.currentState,
    matcherConfidence: params.matcherConfidence,
  });

  if (candidates.length === 0) {
    return {
      mode: SHADOW_ONLY_MODE,
      triggered: false,
      calls: [],
      totalLatencyMs: 0,
    };
  }

  const context = buildShadowFallbackContext(params.conversationHistory);
  const executeInference = params.executeInference ?? callLLMForInference;
  const timeoutMs = params.timeoutMs ?? DEFAULT_SHADOW_TIMEOUT_MS;

  const calls = await Promise.all(
    candidates.map(async (candidate) => {
      const snapshot = getDimensionSignalSnapshot(candidate.dimension, params.currentState);
      const request: LLMInferenceRequest = {
        text: params.userMessage,
        dimension: candidate.dimension,
        context,
        previousAttempts: snapshot.previousAttempts,
      };
      const prompt = buildInferencePrompt(request);
      const startedAt = Date.now();
      let result: LLMInferenceResult;

      try {
        result = await withShadowTimeout(executeInference(request), timeoutMs);
      } catch (error) {
        result = {
          success: false,
          insights: [],
          confidence: 0,
          liveCallAttempted: true,
          provider: DEEPSEEK_PROVIDER,
          model: DEEPSEEK_MODEL,
          errorCode:
            error instanceof Error && error.message === 'shadow_timeout'
              ? 'shadow_timeout'
              : 'llm_error',
        };
      }

      const latencyMs = Date.now() - startedAt;
      const liveCallAttempted = result.liveCallAttempted ?? true;
      const provider = result.provider ?? (liveCallAttempted ? DEEPSEEK_PROVIDER : null);
      const model = result.model ?? (liveCallAttempted ? DEEPSEEK_MODEL : undefined);
      const errorCode = result.errorCode ?? (result.success ? undefined : 'inference_failed');
      const estimatedCostUsd = liveCallAttempted ? estimateCostUsd(prompt, result) : 0;
      const entry: ShadowFallbackLogEntry = {
        timestamp: new Date().toISOString(),
        mode: SHADOW_ONLY_MODE,
        sessionId: params.sessionId,
        dimension: candidate.dimension,
        provider,
        model,
        triggered: true,
        success: result.success,
        confidence: result.confidence,
        reasoning: result.reasoning,
        inferredAttributes: result.insights,
        latencyMs,
        estimatedCostUsd,
        questionsAsked: candidate.questionsAsked,
        sourceConfidence: candidate.confidence,
        sourceInsightsCount: candidate.insightsCount,
        liveCallAttempted,
        errorCode,
      };

      rememberShadowFallbackLog(entry);
      logger.info('Shadow LLM fallback inference completed', {
        session_id: params.sessionId,
        mode: SHADOW_ONLY_MODE,
        dimension: candidate.dimension,
        provider,
        model,
        live_call_attempted: liveCallAttempted,
        success: result.success,
        source_confidence: candidate.confidence,
        inferred_confidence: result.confidence,
        latency_ms: latencyMs,
        estimated_cost_usd: estimatedCostUsd,
        error_code: errorCode,
      });
      if (liveCallAttempted) {
        logAITrace({
          domain: 'attribute_inference',
          feature: 'shadowLLMFallbackInference',
          provider,
          model,
          latencyMs,
          success: result.success,
          fallbackUsed: true,
          fromCache: false,
          promptVersion: 'shadow-v1',
          errorCode,
        });
        recordLLMFallbackInferenceMetric({
          provider: provider ?? 'unknown',
          mode: SHADOW_ONLY_MODE,
          success: result.success,
          latencyMs,
          estimatedCostUsd,
        });
      }

      return entry;
    }),
  );

  return {
    mode: SHADOW_ONLY_MODE,
    triggered: true,
    totalLatencyMs: calls.reduce((sum, call) => sum + call.latencyMs, 0),
    calls,
    scheduledDimensions: candidates.map((candidate) => candidate.dimension),
  };
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
