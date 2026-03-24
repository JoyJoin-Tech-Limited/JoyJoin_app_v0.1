/**
 * Shared TypeScript contracts for group analysis.
 * Used by both the server (matchExplanationService) and the client (PostMatchEventCard, PoolGroupDetailPage).
 */

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
  /** 'fire' | 'warm' | 'mild' | 'cold' */
  overallChemistry: string;
  groupDynamics: string;
  pairExplanations: MatchExplanationContract[];
  iceBreakers: string[];
}
