/**
 * AI Onboarding Contracts
 * AI引导合约
 *
 * Shared types for AI-generated onboarding and pre-join moments.
 * Import via: import type { PreJoinVibeBrief } from '@shared/ai/onboarding';
 */

import type { AIResponseMeta } from '../types/aiMeta';

/**
 * Profile Tagline Response
 * 档案标语响应
 *
 * Returned by GET /api/onboarding/profile-tagline.
 * Contains a single warm AI-generated insight line shown in ProfilePortraitCard
 * during the FinalProfileReviewPage.  Always present — `meta.fallbackUsed`
 * distinguishes live AI output from a deterministic fallback.
 */
export interface ProfileTaglineResponse {
  /** One warm insight line about the user's social style (20–36 Chinese characters). */
  insightLine: string;
  /** Standard AI observability metadata. */
  meta: AIResponseMeta;
}

/**
 * Generic fallback tagline shown when no archetype-specific fallback applies.
 * Used as the final safety net in profileTaglineService and ProfilePortraitCard.
 */
export const GENERIC_PROFILE_TAGLINE_FALLBACK =
  '你的独特气质，会让合适的人主动靠近。';

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
