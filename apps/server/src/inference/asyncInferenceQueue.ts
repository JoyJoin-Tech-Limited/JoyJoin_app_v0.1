/**
 * 异步推断队列管理器 V3
 * 允许并行推断，不丢弃任何结果，按消息 ID 追踪
 */

import { llmReasoner, type LLMReasonerResult } from './llmReasoner';
import type { UserAttributeMap } from './types';

export interface AsyncInferenceStatus {
  isPending: boolean;
  messageId: string;
  startedAt?: Date;
  completedAt?: Date;
}

interface InferenceRecord {
  messageId: string;
  promise: Promise<LLMReasonerResult>;
  startedAt: Date;
}

interface CompletedInference {
  messageId: string;
  result: LLMReasonerResult;
  completedAt: Date;
}

export class AsyncInferenceQueue {
  private pendingInferences: Map<string, Map<string, InferenceRecord>> = new Map();
  private completedResults: Map<string, CompletedInference[]> = new Map();
  
  private maxPendingPerSession: number;
  private maxCompletedPerSession: number;
  private resultTTLMs: number;
  private cleanupTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(options?: { 
    maxPendingPerSession?: number;
    maxCompletedPerSession?: number; 
    resultTTLMs?: number 
  }) {
    this.maxPendingPerSession = options?.maxPendingPerSession ?? 3;
    this.maxCompletedPerSession = options?.maxCompletedPerSession ?? 5;
    this.resultTTLMs = options?.resultTTLMs ?? 120000;
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * 触发异步推断（不等待结果）
   * 允许并行多个推断，每个都会存储结果
   */
  triggerAsync(
    sessionId: string,
    userMessage: string,
    conversationHistory: Array<{ role: string; content: string }>,
    currentState: UserAttributeMap
  ): string {
    const messageId = this.generateMessageId();
    const startedAt = new Date();

    let sessionPending = this.pendingInferences.get(sessionId);
    if (!sessionPending) {
      sessionPending = new Map();
      this.pendingInferences.set(sessionId, sessionPending);
    }

    // 如果达到并行上限，跳过最旧的（让它继续运行但不追踪）
    if (sessionPending.size >= this.maxPendingPerSession) {
      const oldestKey = sessionPending.keys().next().value;
      if (oldestKey) {
        console.log(`[AsyncInferenceQueue] Session ${sessionId} reached max pending (${this.maxPendingPerSession}), oldest ${oldestKey} will be untracked`);
        sessionPending.delete(oldestKey);
      }
    }

    const promise = llmReasoner.infer(userMessage, conversationHistory, currentState);
    
    sessionPending.set(messageId, { messageId, promise, startedAt });

    promise
      .then(result => {
        const currentPending = this.pendingInferences.get(sessionId);
        if (currentPending) {
          currentPending.delete(messageId);
          if (currentPending.size === 0) {
            this.pendingInferences.delete(sessionId);
          }
        }

        // 存储结果
        let completedList = this.completedResults.get(sessionId);
        if (!completedList) {
          completedList = [];
          this.completedResults.set(sessionId, completedList);
        }
        
        completedList.push({
          messageId,
          result,
          completedAt: new Date(),
        });
        
        // 保持最多 N 个结果
        while (completedList.length > this.maxCompletedPerSession) {
          completedList.shift();
        }

        this.scheduleCleanup(sessionId);
        console.log(`[AsyncInferenceQueue] Session ${sessionId} inference ${messageId} completed in ${result.latencyMs}ms`);
      })
      .catch(error => {
        console.error(`[AsyncInferenceQueue] Session ${sessionId} inference ${messageId} failed:`, error);
        const currentPending = this.pendingInferences.get(sessionId);
        if (currentPending) {
          currentPending.delete(messageId);
          if (currentPending.size === 0) {
            this.pendingInferences.delete(sessionId);
          }
        }
      });

    return messageId;
  }

  /**
   * 获取最新的已完成结果（消费并移除）
   */
  getLatestCompletedResult(sessionId: string): LLMReasonerResult | null {
    const completedList = this.completedResults.get(sessionId);
    if (!completedList || completedList.length === 0) {
      return null;
    }

    const latest = completedList.pop();
    if (completedList.length === 0) {
      this.completedResults.delete(sessionId);
      this.cancelCleanup(sessionId);
    }
    
    return latest?.result || null;
  }

  /**
   * 获取指定消息 ID 的结果（消费并移除）
   */
  getResultByMessageId(sessionId: string, messageId: string): LLMReasonerResult | null {
    const completedList = this.completedResults.get(sessionId);
    if (!completedList) return null;

    const index = completedList.findIndex(c => c.messageId === messageId);
    if (index === -1) return null;

    const [found] = completedList.splice(index, 1);
    if (completedList.length === 0) {
      this.completedResults.delete(sessionId);
      this.cancelCleanup(sessionId);
    }
    
    return found.result;
  }

  /**
   * 查看最新结果（不移除）
   */
  peekLatestResult(sessionId: string): CompletedInference | null {
    const completedList = this.completedResults.get(sessionId);
    if (!completedList || completedList.length === 0) return null;
    return completedList[completedList.length - 1];
  }

  hasPendingInference(sessionId: string): boolean {
    const pending = this.pendingInferences.get(sessionId);
    return pending !== undefined && pending.size > 0;
  }

  getPendingMessageId(sessionId: string): string | null {
    const pending = this.pendingInferences.get(sessionId);
    if (!pending || pending.size === 0) return null;
    const entries = Array.from(pending.values());
    return entries[entries.length - 1]?.messageId || null;
  }

  getPendingCount(sessionId: string): number {
    return this.pendingInferences.get(sessionId)?.size || 0;
  }

  hasCompletedResult(sessionId: string): boolean {
    const list = this.completedResults.get(sessionId);
    return list !== undefined && list.length > 0;
  }

  getCompletedCount(sessionId: string): number {
    return this.completedResults.get(sessionId)?.length || 0;
  }

  async waitForAnyPending(sessionId: string): Promise<LLMReasonerResult | null> {
    const pending = this.pendingInferences.get(sessionId);
    if (!pending || pending.size === 0) {
      return this.getLatestCompletedResult(sessionId);
    }
    
    const promises = Array.from(pending.values()).map(r => r.promise);
    try {
      return await Promise.race(promises);
    } catch (error) {
      console.error(`[AsyncInferenceQueue] Wait failed for session ${sessionId}:`, error);
      return null;
    }
  }

  clearSession(sessionId: string): void {
    this.pendingInferences.delete(sessionId);
    this.completedResults.delete(sessionId);
    this.cancelCleanup(sessionId);
  }

  getStats(): {
    totalPendingSessions: number;
    totalPendingInferences: number;
    totalCompletedSessions: number;
    totalCompletedResults: number;
  } {
    let totalPending = 0;
    let totalCompleted = 0;
    
    for (const pending of this.pendingInferences.values()) {
      totalPending += pending.size;
    }
    for (const completed of this.completedResults.values()) {
      totalCompleted += completed.length;
    }
    
    return {
      totalPendingSessions: this.pendingInferences.size,
      totalPendingInferences: totalPending,
      totalCompletedSessions: this.completedResults.size,
      totalCompletedResults: totalCompleted,
    };
  }

  private scheduleCleanup(sessionId: string): void {
    this.cancelCleanup(sessionId);
    const timer = setTimeout(() => {
      this.completedResults.delete(sessionId);
      this.cleanupTimers.delete(sessionId);
    }, this.resultTTLMs);
    this.cleanupTimers.set(sessionId, timer);
  }

  private cancelCleanup(sessionId: string): void {
    const timer = this.cleanupTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.cleanupTimers.delete(sessionId);
    }
  }
}

export const asyncInferenceQueue = new AsyncInferenceQueue();
