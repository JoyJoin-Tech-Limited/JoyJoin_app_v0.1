/**
 * Shared TypeScript contracts for group analysis.
 * Used by both the server (matchExplanationService) and the client (PostMatchEventCard, PoolGroupDetailPage).
 */

import type { OverallChemistry } from './types/groupAnalysis';

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
}

export interface GroupAnalysisContract {
  groupId: string;
  overallChemistry: OverallChemistry;
  groupDynamics: string;
  pairExplanations: MatchExplanationContract[];
  iceBreakers: string[];
  /** 2–4 compact post-match theme tags (e.g. "高火花", "动静结合") */
  groupThemeTags?: string[];
  /** One short companion line contextualising the group theme */
  groupThemeCompanion?: string;
}
