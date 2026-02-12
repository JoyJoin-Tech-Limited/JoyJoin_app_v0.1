import { useQuery } from "@tanstack/react-query";
import type { AssessmentResult } from "./useAdaptiveAssessment";

const PRESIGNUP_SESSION_KEY = "joyjoin_v4_assessment_session";

export function useAnonymousPersonalityTestResults() {
  return useQuery({
    queryKey: ['/api/assessment/anonymous-result'],
    queryFn: async (): Promise<AssessmentResult | null> => {
      // Try to get completed result from localStorage
      const sessionData = localStorage.getItem(PRESIGNUP_SESSION_KEY);
      if (sessionData) {
        try {
          const parsed = JSON.parse(sessionData);
          if (parsed.result && parsed.result.primaryArchetype) {
            return parsed.result;
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
