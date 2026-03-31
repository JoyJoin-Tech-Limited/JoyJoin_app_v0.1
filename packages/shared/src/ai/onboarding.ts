/**
 * AI Onboarding Contracts
 * AI引导合约
 *
 * Shared types for AI-generated onboarding and pre-join moments.
 * Import via: import type { PreJoinVibeBrief } from '@shared/ai/onboarding';
 */

import type { AIResponseMeta } from '../types/aiMeta';

/**
 * Pre-Join Vibe Brief
 * 加入前的 Vibe 简报
 *
 * A compact AI-generated brief shown before the user enters the event/pool
 * join flow. Designed to convert by making the user feel that JoyJoin already
 * understands their profile and will match them to a well-fitting group.
 *
 * Guaranteed to have content even when the AI is unavailable — `meta.fallbackUsed`
 * indicates whether a deterministic fallback was used instead of a live response.
 */
export interface PreJoinVibeBrief {
  /**
   * One personalized insight about the user's social style or profile.
   * Should be concise (≤ 30 Chinese characters) and feel affirming, not clinical.
   * Example: "你更适合先轻松、后深入的群体节奏"
   */
  insight: string;

  /**
   * One short matching promise — what JoyJoin will do for them.
   * Should be concrete and action-oriented.
   * Example: "我们会以此为基础，为你匹配更对 vibe 的小组"
   */
  matchingPromise: string;

  /**
   * Standard AI observability metadata.
   * Check `meta.fallbackUsed` to distinguish live vs deterministic content.
   */
  meta: AIResponseMeta;
}
