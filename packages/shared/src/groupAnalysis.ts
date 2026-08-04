/**
 * Shared TypeScript contracts for group analysis.
 * Used by both the server (matchExplanationService) and the client (PostMatchEventCard, PoolGroupDetailPage).
 */

import type { OverallChemistry } from './types/groupAnalysis';
import type { AIProvider } from './types/aiMeta';

// Re-export so consumers can import everything from this file
export type { OverallChemistry };

export interface MatchMemberBase {
  userId: string;
  displayName?: string | null;
  archetype?: string | null;
  topInterests?: string[];
  industry?: string | null;
}

export interface MatchExplanationContract {
  pairKey: string;
  explanation: string;
  chemistryScore: number;
  sharedInterests: string[];
  connectionPoints: string[];
  /** Connection points with rarity tiers (additive field for enriched rendering). */
  connectionPointsWithRarity?: import('./types/groupAnalysis').ConnectionPointWithRarity[];
  /**
   * Deterministic shared highlights (必聊项 / 共同意图 / 同乡 one-liners),
   * computed server-side without an LLM call. Optional for backward
   * compatibility with cached payloads generated before pair-explanation-v3.
   */
  sharedHighlights?: string[];
  /** Optional one-line conversation opener suggestion (match intelligence layer). */
  introAngle?: string;
}

export interface GroupAnalysisContract {
  groupId: string;
  overallChemistry: OverallChemistry;
  groupDynamics: string;
  pairExplanations: MatchExplanationContract[];
  iceBreakers: string[];
  /** Normalized metadata: aligned with AIResponseMeta.provider */
  provider?: AIProvider;
  /** Normalized metadata: aligned with AIResponseMeta.fallbackUsed */
  fallbackUsed?: boolean;
}
