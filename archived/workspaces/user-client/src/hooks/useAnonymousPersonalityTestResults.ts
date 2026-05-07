import { useQuery } from "@tanstack/react-query";
import type { AssessmentResult } from "./useAdaptiveAssessment";

const PRESIGNUP_SESSION_KEY = "joyjoin_v4_assessment_session";

// Transform AssessmentResult to UnifiedAssessmentResult format
interface UnifiedAssessmentResult {
  algorithmVersion: string;
  primaryArchetype: string;
  secondaryArchetype?: string;
  topArchetypes?: Array<{ archetype: string; score: number; confidence?: number }> | null;
  affinityScore: number;
  opennessScore: number;
  conscientiousnessScore: number;
  emotionalStabilityScore: number;
  extraversionScore: number;
  positivityScore: number;
  totalQuestions: number;
  chemistryList: Array<{ role: string; percentage: number; reason?: string }>;
  archetypeTraitProfile: Record<string, number> | null;
  matchDetails: any;
  isDecisive: boolean;
  completedAt: string;
}

function transformToUnifiedResult(result: AssessmentResult, completedAt: string): UnifiedAssessmentResult {
  return {
    algorithmVersion: 'v2',
    primaryArchetype: result.primaryArchetype,
    secondaryArchetype: result.secondaryArchetype,
    topArchetypes: result.topMatches || null,
    // Trait scores are already 0-100 from adaptive engine
    affinityScore: result.traitScores.A || 0,
    opennessScore: result.traitScores.O || 0,
    conscientiousnessScore: result.traitScores.C || 0,
    emotionalStabilityScore: result.traitScores.E || 0,
    extraversionScore: result.traitScores.X || 0,
    positivityScore: result.traitScores.P || 0,
    totalQuestions: result.totalQuestionsAnswered,
    chemistryList: (result.topMatches || []).map(match => ({
      role: match.archetype,
      // match.score is already 0-100 from findBestMatchingArchetypes
      percentage: Math.round(match.score),
    })),
    archetypeTraitProfile: {
      A: result.traitScores.A || 0,
      C: result.traitScores.C || 0,
      E: result.traitScores.E || 0,
      O: result.traitScores.O || 0,
      X: result.traitScores.X || 0,
      P: result.traitScores.P || 0,
    },
    matchDetails: {
      confidence: result.archetypeConfidence,
      validityScore: result.validityScore,
      wasExtended: result.wasExtended,
    },
    isDecisive: result.archetypeConfidence >= 0.7,
    completedAt,
  };
}

export function useAnonymousPersonalityTestResults() {
  return useQuery({
    queryKey: ['/api/assessment/anonymous-result'],
    queryFn: async (): Promise<UnifiedAssessmentResult | null> => {
      // Try to get completed result from localStorage
      const sessionData = localStorage.getItem(PRESIGNUP_SESSION_KEY);
      if (sessionData) {
        try {
          const parsed = JSON.parse(sessionData);
          if (parsed.result && parsed.result.primaryArchetype) {
            return transformToUnifiedResult(parsed.result, parsed.completedAt);
          }
        } catch (e) {
          console.error('[useAnonymousPersonalityTestResults] Parse error:', e);
        }
      }
      
      return null;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: false,
  });
}
