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
 *
 * Amendment A2 (AC-22): warm non-recruiting close (「第一局见」direction) —
 * the fallback is a farewell, not signup广告 copy. Keep it short; no
 * 匹配/社交/灵魂/AI vocabulary, no emoji.
 */
export const GENERIC_PROFILE_TAGLINE_FALLBACK =
  '悦仔已经记下了你的活动画像，第一局见。';

/**
 * Entry-card insight line roles (v2).
 * 入场卡「悦仔的观察」三行揭示的行角色：
 *   observation → 观察行（确定性模板，引用真实兴趣 label）
 *   inference   → 推断行（LLM 主路径，规则模板兜底）
 *   reveal      → 揭穿行（LLM 可选输出，规则模板兜底，可缺席）
 */
export type ProfileTaglineLineRole = 'observation' | 'inference' | 'reveal';

/**
 * One rendered line of the entry-card insight.
 * 入场卡洞察的单行。
 */
export interface ProfileTaglineLine {
  role: ProfileTaglineLineRole;
  text: string;
  /**
   * Per-line AIGC marker — fail-closed: true ONLY when this specific line was
   * produced by the LLM. Deterministic (template/curated) lines are always
   * false, so the AIGC label can never be attached to rule-based content.
   */
  aigc: boolean;
}

/**
 * Evidence pill backing the observation line.
 * 观察行的证据 pill —— 全部来自用户真实选择，确定性生成。
 */
export interface ProfileTaglineEvidence {
  /** Pill text: the user's real interest label. */
  text: string;
  /**
   * Provenance reference, e.g. `interest:<topicId>` or `priority:<topicId>`.
   * Lets clients/debuggers trace the pill back to its source record.
   */
  sourceRef: string;
}

/**
 * Profile Tagline Response
 * 档案标语响应
 *
 * Returned by GET /api/onboarding/profile-tagline.
 * v2 (sprint entry-card-insight-v2): structured three-line reveal + evidence
 * pills. `insightLine` is preserved (= inference line text) as the ONLY field
 * old clients read — do not remove it (REL-02).
 */
export interface ProfileTaglineResponse {
  /**
   * A warm, concise insight line about the user's social style.
   * v2 semantics: the final inference line text (LLM or rule fallback);
   * GENERIC_PROFILE_TAGLINE_FALLBACK when the whole pipeline retreats to v1.
   * Old clients consume only this field + `meta.aigc`.
   */
  insightLine: string;

  /**
   * Structured reveal lines in display order: observation, inference,
   * optional reveal. Empty array ONLY on the total v1 fallback retreat
   * (rule fallback unusable) — in that case `insightLine` carries
   * GENERIC_PROFILE_TAGLINE_FALLBACK.
   */
  lines: ProfileTaglineLine[];

  /**
   * Evidence pills citing the user's real selections/topPriorities.
   * Empty array when the user has no interest selections (AC-13).
   */
  evidence: ProfileTaglineEvidence[];

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
