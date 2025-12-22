/**
 * 推断引擎 - 主控制器
 * 协调语义匹配器、LLM推理器和状态管理器
 */

import type { 
  InferenceResult, 
  UserAttributeMap, 
  InferenceEngineConfig,
  DEFAULT_CONFIG 
} from './types';
import { semanticMatcher } from './semanticMatcher';
import { llmReasoner, type LLMReasonerResult, getTelemetryLogs } from './llmReasoner';
import { stateManager } from './stateManager';
import { matchIndustryFromText } from './industryOntology';

export interface InferenceEngineResult {
  extracted: Record<string, string>;
  inferred: InferenceResult['inferred'];
  conflicts: InferenceResult['conflicts'];
  skipQuestions: string[];
  confirmQuestions: InferenceResult['confirmQuestions'];
  newState: UserAttributeMap;
  debug: {
    matcherHit: boolean;
    matcherConfidence: number;
    llmCalled: boolean;
    llmLatencyMs?: number;
    totalLatencyMs: number;
  };
}

export interface InferenceLog {
  timestamp: Date;
  sessionId: string;
  userMessage: string;
  result: InferenceEngineResult;
}

// 推断日志存储（内存中）
const inferenceLogs: InferenceLog[] = [];

/**
 * 推断引擎类
 */
export class InferenceEngine {
  private config: InferenceEngineConfig;
  
  constructor(config?: Partial<InferenceEngineConfig>) {
    this.config = {
      skipThreshold: 0.85,
      confirmThreshold: 0.6,
      enableLLMFallback: true,
      maxLLMLatencyMs: 3000,
      enableLogging: true,
      logLevel: 'info',
      ...config
    };
  }
  
  /**
   * 主处理函数：对用户消息进行推断
   */
  async process(
    userMessage: string,
    conversationHistory: Array<{ role: string; content: string }>,
    currentState: UserAttributeMap,
    sessionId?: string
  ): Promise<InferenceEngineResult> {
    const startTime = Date.now();
    
    // 1. 快速匹配层
    const matcherResult = semanticMatcher.match(userMessage, currentState);
    const matcherHit = matcherResult.matched && matcherResult.confidence >= 0.7;
    
    // 2. 如果快速匹配置信度不够高，调用LLM
    let llmResult: LLMReasonerResult | null = null;
    let llmCalled = false;
    
    if (this.config.enableLLMFallback && !matcherHit) {
      llmCalled = true;
      llmResult = await llmReasoner.infer(
        userMessage,
        conversationHistory,
        currentState
      );
    }
    
    // 3. 合并结果
    const reconciledResult = stateManager.reconcile(
      matcherResult,
      llmResult ? {
        extracted: llmResult.extracted,
        inferred: llmResult.inferred,
        conflicts: llmResult.conflicts,
        skipQuestions: llmResult.skipQuestions,
        confirmQuestions: llmResult.confirmQuestions
      } : null,
      currentState
    );
    
    const totalLatencyMs = Date.now() - startTime;
    
    const result: InferenceEngineResult = {
      ...reconciledResult,
      debug: {
        matcherHit,
        matcherConfidence: matcherResult.confidence,
        llmCalled,
        llmLatencyMs: llmResult?.latencyMs,
        totalLatencyMs
      }
    };
    
    // 4. 记录日志
    if (this.config.enableLogging && sessionId) {
      this.log(sessionId, userMessage, result);
    }
    
    return result;
  }
  
  /**
   * 只运行快速匹配（不调用LLM）
   */
  quickMatch(
    userMessage: string,
    currentState: UserAttributeMap
  ): {
    inferences: Array<{ field: string; value: string; confidence: number }>;
    skipQuestions: string[];
    confirmQuestions: Array<{ field: string; template: string; inferredValue: string }>;
  } {
    const result = semanticMatcher.match(userMessage, currentState);
    return {
      inferences: result.inferences.map(i => ({
        field: i.field,
        value: i.value,
        confidence: i.confidence
      })),
      skipQuestions: result.skipQuestions,
      confirmQuestions: result.confirmQuestions
    };
  }
  
  /**
   * 生成注入到小悦提示词的上下文摘要
   */
  generatePromptContext(state: UserAttributeMap): {
    contextDigest: string;
    skipList: string[];
    confirmList: Array<{ field: string; template: string }>;
  } {
    return {
      contextDigest: stateManager.generateContextDigest(state),
      skipList: stateManager.generateSkipList(state, this.config.skipThreshold),
      confirmList: stateManager.generateConfirmList(
        state, 
        this.config.confirmThreshold, 
        this.config.skipThreshold
      )
    };
  }
  
  /**
   * 记录推断日志
   */
  private log(sessionId: string, userMessage: string, result: InferenceEngineResult): void {
    const log: InferenceLog = {
      timestamp: new Date(),
      sessionId,
      userMessage,
      result
    };
    
    inferenceLogs.push(log);
    
    // 保持最近1000条日志
    if (inferenceLogs.length > 1000) {
      inferenceLogs.shift();
    }
    
    if (this.config.logLevel === 'debug') {
      console.log('[InferenceEngine]', JSON.stringify(log, null, 2));
    } else if (this.config.logLevel === 'info' && result.inferred.length > 0) {
      console.log(`[InferenceEngine] 推断 ${result.inferred.length} 个属性, 跳过 ${result.skipQuestions.length} 个问题`);
    }
  }
  
  /**
   * 获取推断日志
   */
  getLogs(sessionId?: string): InferenceLog[] {
    if (sessionId) {
      return inferenceLogs.filter(l => l.sessionId === sessionId);
    }
    return [...inferenceLogs];
  }
  
  /**
   * 清除日志
   */
  clearLogs(): void {
    inferenceLogs.length = 0;
  }
}

// 默认实例
export const inferenceEngine = new InferenceEngine();

// ============ 便捷导出函数 ============

/**
 * 快速推断（不调用LLM）
 */
export function quickInfer(
  userMessage: string,
  currentState: UserAttributeMap = {}
): {
  inferences: Array<{ field: string; value: string; confidence: number }>;
  skipQuestions: string[];
} {
  const result = inferenceEngine.quickMatch(userMessage, currentState);
  return {
    inferences: result.inferences,
    skipQuestions: result.skipQuestions
  };
}

/**
 * 完整推断（可能调用LLM）
 */
export async function fullInfer(
  userMessage: string,
  conversationHistory: Array<{ role: string; content: string }>,
  currentState: UserAttributeMap = {},
  sessionId?: string
): Promise<InferenceEngineResult> {
  return inferenceEngine.process(userMessage, conversationHistory, currentState, sessionId);
}

/**
 * 生成小悦提示词上下文
 */
export function generateXiaoyueContext(state: UserAttributeMap): string {
  const { contextDigest, skipList, confirmList } = inferenceEngine.generatePromptContext(state);
  
  let prompt = contextDigest;
  
  if (skipList.length > 0) {
    prompt += `\n\n## 不要问的问题\n以下信息已经知道，请不要再问：\n`;
    prompt += skipList.map(f => `- ${f}`).join('\n');
  }
  
  if (confirmList.length > 0) {
    prompt += `\n\n## 可以确认的信息\n以下信息可以简单确认一下：\n`;
    prompt += confirmList.map(c => `- ${c.field}: "${c.template}"`).join('\n');
  }
  
  return prompt;
}

/**
 * 获取推断遥测数据
 */
export function getInferenceTelemetry() {
  return {
    llmTelemetry: getTelemetryLogs(),
    inferenceLogs: inferenceEngine.getLogs()
  };
}

/**
 * 快速行业匹配（基于本体知识库）
 */
export function quickIndustryMatch(text: string) {
  return matchIndustryFromText(text);
}
