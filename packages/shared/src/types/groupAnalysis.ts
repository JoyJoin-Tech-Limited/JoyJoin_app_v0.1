/**
 * Group Analysis Type Definitions
 * 桌友分析 API 响应类型定义
 *
 * Shared contract between the server's `generateGroupAnalysis()` service
 * and the client `useGroupAnalysis` hook (PR 3 of 3).
 *
 * Served by: GET /api/pool-groups/:groupId/analysis
 */

/**
 * Four-tier overall chemistry rating produced by the group analysis service.
 * Maps to avgChemistry thresholds: fire ≥ 85, warm ≥ 70, mild ≥ 55, cold < 55.
 */
export type OverallChemistry = 'fire' | 'warm' | 'mild' | 'cold';

/**
 * AI-generated compatibility explanation for a single member pair.
 */
export interface PairExplanation {
  /** Canonical pair identifier — sorted user-ID pair joined by "-" (e.g. "uid1-uid2") */
  pairKey: string;
  /** 2–3 sentence warm narrative explaining why this pair is a good match */
  explanation: string;
  /** Archetype chemistry matrix score, 0–100 */
  chemistryScore: number;
  /** Topic IDs or labels of interests shared by both members */
  sharedInterests: string[];
  /** Human-readable connection signals, e.g. "同乡", "同行业", "相似教育背景" */
  connectionPoints: string[];
}

/**
 * Full response shape for GET /api/pool-groups/:groupId/analysis.
 */
export interface GroupAnalysisResponse {
  /** The pool-group ID this analysis belongs to */
  groupId: string;
  /** Overall chemistry rating for the group */
  overallChemistry: OverallChemistry;
  /** Narrative description of the group's expected dynamic */
  groupDynamics: string;
  /** 3–5 AI-generated personalised ice-breaker topic suggestions */
  iceBreakers: string[];
  /** Per-pair AI explanations; one entry per unique member combination */
  pairExplanations: PairExplanation[];
  /** true when the result was served from the 7-day DB cache without calling the LLM */
  fromCache: boolean;
  /**
   * ISO-8601 timestamp reflecting when the analysis data was actually generated.
   * On cache hits this is the original generation time, not the request time,
   * so clients can show how fresh the data is.
   */
  generatedAt: string;
}
