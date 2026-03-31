/**
 * AI Onboarding Contracts
 * AI引导合约
 *
 * Shared types for AI-generated onboarding and pre-join moments.
 * Import via: import type { PreJoinVibeBrief } from '@shared/ai/onboarding';
 */

import type { AIResponseMeta } from '../types/aiMeta';

/**
 * Generic fallback tagline used when no archetype-specific line is available.
 * Warm and forward-looking without being too generic.
 */
export const GENERIC_PROFILE_TAGLINE_FALLBACK =
  '你的存在让每次聚会都多一份可能性。';

/**
 * Profile Tagline Response
 * 档案标语响应
 *
 * Returned by GET /api/onboarding/profile-tagline.
 * A single warm insight line for the profile review card, plus AI observability metadata.
 */
export interface ProfileTaglineResponse {
  /** One warm, personalised insight line (≤ 40 Chinese characters). */
  insightLine: string;
  /** Standard AI observability metadata. */
  meta: AIResponseMeta;
}

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
