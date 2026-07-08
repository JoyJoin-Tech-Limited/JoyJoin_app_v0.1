/**
 * AI Onboarding Contracts
 * AI引导合约
 *
 * Shared types for AI-generated onboarding and pre-join moments.
 * Import via: import type { PreJoinVibeBrief } from '@shared/ai/onboarding';
 */

import type { AIResponseMeta } from '../types/aiMeta';

/**
 * Generic fallback text shown in the profile portrait card when the AI
 * tagline is not yet available or no context is present.
 * Used as a placeholder that reserves layout height to prevent card jump.
 */
export const GENERIC_PROFILE_TAGLINE_FALLBACK =
  '悦仔已经记下了你的社交画像，期待你的加入。';

/**
 * Profile Tagline Response
 * 档案标语响应
 *
 * Returned by GET /api/onboarding/profile-tagline.
 * Contains a single warm insight line for the profile review card.
 */
export interface ProfileTaglineResponse {
  /**
   * A warm, concise insight line about the user's social style.
   * 20–36 Chinese characters.
   */
  insightLine: string;

  /**
   * Standard AI observability metadata.
   */
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
   * 2–3 concise fit reasons explaining why this specific pool suits the user.
   * Each reason should be ≤ 25 Chinese characters, skimmable, and non-prescriptive.
   * Examples:
   *   - "与你的社交风格契合"
   *   - "符合你对轻松聚餐的偏好"
   *   - "参与者背景多元，利于破冰"
   * Empty array means no reasons could be generated (graceful degradation).
   */
  reasons: string[];

  /**
   * Standard AI observability metadata.
   * Check `meta.fallbackUsed` to distinguish live vs deterministic content.
   */
  meta: AIResponseMeta;
}
