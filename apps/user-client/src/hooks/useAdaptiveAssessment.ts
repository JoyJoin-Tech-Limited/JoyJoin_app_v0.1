import { useState, useCallback, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface TraitScores {
  A?: number;
  C?: number;
  E?: number;
  O?: number;
  X?: number;
  P?: number;
}

interface QuestionOption {
  value: string;
  text: string;
  traitScores: TraitScores;
}

interface AssessmentQuestion {
  id: string;
  level: number;
  category: string;
  scenarioText: string;
  questionText: string;
  options: QuestionOption[];
}

interface ArchetypeMatch {
  archetype: string;
  score: number;
  confidence: number;
}

interface AssessmentProgress {
  answered: number;
  minQuestions: number;
  softMaxQuestions: number;
  hardMaxQuestions: number;
  estimatedRemaining: number;
}

interface AssessmentResult {
  primaryArchetype: string;
  secondaryArchetype?: string;
  archetypeConfidence: number;
  traitScores: TraitScores;
  traitConfidences: Record<string, number>;
  topMatches: ArchetypeMatch[];
  totalQuestionsAnswered: number;
  wasExtended: boolean;
  validityScore: number;
}

interface StartResponse {
  sessionId: string;
  phase: string;
  currentQuestionIndex: number;
  nextQuestion: AssessmentQuestion;
  progress: AssessmentProgress;
  currentMatches: ArchetypeMatch[];
  isComplete: boolean;
}

interface AnswerResponse {
  isComplete: boolean;
  nextQuestion?: AssessmentQuestion;
  result?: AssessmentResult;
  progress?: AssessmentProgress;
  currentMatches?: ArchetypeMatch[];
  encouragement?: {
    message: string;
    progressPercentage: number;
    archetype?: string;
    confidence?: number;
  } | null;
}

interface PreSignupAnswer {
  questionId: string;
  selectedOption: string;
  traitScores: TraitScores;
  answeredAt: string;
}

const PRESIGNUP_SESSION_KEY = "joyjoin_v4_assessment_session";
const PRESIGNUP_ANSWERS_KEY = "joyjoin_v4_presignup_answers";
const CACHE_EXPIRY_HOURS = 24;

export function useAdaptiveAssessment() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [phase, setPhase] = useState<string>("pre_signup");
  const [currentQuestion, setCurrentQuestion] = useState<AssessmentQuestion | null>(null);
  const [progress, setProgress] = useState<AssessmentProgress | null>(null);
  const [currentMatches, setCurrentMatches] = useState<ArchetypeMatch[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [encouragement, setEncouragement] = useState<AnswerResponse['encouragement']>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const loadCachedSession = useCallback(() => {
    try {
      const cached = localStorage.getItem(PRESIGNUP_SESSION_KEY);
      if (cached) {
        const data = JSON.parse(cached);
        const expiryTime = data.timestamp + (CACHE_EXPIRY_HOURS * 60 * 60 * 1000);
        if (Date.now() < expiryTime) {
          return data;
        }
        localStorage.removeItem(PRESIGNUP_SESSION_KEY);
        localStorage.removeItem(PRESIGNUP_ANSWERS_KEY);
      }
    } catch {
    }
    return null;
  }, []);

  const cacheSession = useCallback((sessionData: { sessionId: string; phase: string }) => {
    try {
      localStorage.setItem(PRESIGNUP_SESSION_KEY, JSON.stringify({
        ...sessionData,
        timestamp: Date.now(),
      }));
    } catch {
    }
  }, []);

  const cacheAnswer = useCallback((answer: PreSignupAnswer) => {
    try {
      const cached = localStorage.getItem(PRESIGNUP_ANSWERS_KEY);
      const answers: PreSignupAnswer[] = cached ? JSON.parse(cached) : [];
      answers.push(answer);
      localStorage.setItem(PRESIGNUP_ANSWERS_KEY, JSON.stringify(answers));
    } catch {
    }
  }, []);

  const getCachedAnswers = useCallback((): PreSignupAnswer[] => {
    try {
      const cached = localStorage.getItem(PRESIGNUP_ANSWERS_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  }, []);

  const clearCache = useCallback(() => {
    localStorage.removeItem(PRESIGNUP_SESSION_KEY);
    localStorage.removeItem(PRESIGNUP_ANSWERS_KEY);
  }, []);

  const startMutation = useMutation({
    mutationFn: async (params?: { preSignupData?: PreSignupAnswer[] }) => {
      const response = await apiRequest("POST", "/api/assessment/v4/start", params || {});
      return response.json() as Promise<StartResponse>;
    },
    onSuccess: (data) => {
      setSessionId(data.sessionId);
      setPhase(data.phase);
      setCurrentQuestion(data.nextQuestion);
      setProgress(data.progress);
      setCurrentMatches(data.currentMatches);
      setIsComplete(data.isComplete);
      setIsInitialized(true);
      cacheSession({ sessionId: data.sessionId, phase: data.phase });
    },
  });

  const answerMutation = useMutation({
    mutationFn: async ({ questionId, selectedOption, traitScores }: { 
      questionId: string; 
      selectedOption: string; 
      traitScores: TraitScores;
    }) => {
      if (!sessionId) throw new Error("No active session");
      
      const response = await apiRequest(
        "POST", 
        `/api/assessment/v4/${sessionId}/answer`,
        { questionId, selectedOption }
      );
      return { 
        data: await response.json() as AnswerResponse,
        questionId,
        selectedOption,
        traitScores,
      };
    },
    onSuccess: ({ data, questionId, selectedOption, traitScores }) => {
      if (phase === "pre_signup") {
        cacheAnswer({
          questionId,
          selectedOption,
          traitScores,
          answeredAt: new Date().toISOString(),
        });
      }

      setIsComplete(data.isComplete);
      setEncouragement(data.encouragement);
      
      if (data.isComplete && data.result) {
        setResult(data.result);
        setCurrentQuestion(null);
      } else if (data.nextQuestion) {
        setCurrentQuestion(data.nextQuestion);
      }
      
      if (data.progress) {
        setProgress(data.progress);
      }
      if (data.currentMatches) {
        setCurrentMatches(data.currentMatches);
      }
    },
  });

  const linkUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      if (!sessionId) throw new Error("No active session");
      
      const response = await apiRequest(
        "POST",
        `/api/assessment/v4/${sessionId}/link-user`,
        { userId }
      );
      return response.json();
    },
    onSuccess: (data) => {
      setPhase("post_signup");
      cacheSession({ sessionId: sessionId!, phase: "post_signup" });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    },
  });

  const getResultMutation = useMutation({
    mutationFn: async () => {
      if (!sessionId) throw new Error("No active session");
      
      const response = await apiRequest(
        "GET",
        `/api/assessment/v4/${sessionId}/result`
      );
      return response.json() as Promise<AssessmentResult>;
    },
    onSuccess: (data) => {
      setResult(data);
    },
  });

  const startAssessment = useCallback(async (resumeFromCache = true) => {
    if (resumeFromCache) {
      const cached = loadCachedSession();
      if (cached?.sessionId) {
        setSessionId(cached.sessionId);
        setPhase(cached.phase);
        
        const cachedAnswers = getCachedAnswers();
        await startMutation.mutateAsync({ preSignupData: cachedAnswers.length > 0 ? cachedAnswers : undefined });
        return;
      }
    }
    
    await startMutation.mutateAsync({});
  }, [loadCachedSession, getCachedAnswers, startMutation]);

  const startFreshAssessment = useCallback(async () => {
    clearCache();
    await startMutation.mutateAsync({});
  }, [clearCache, startMutation]);

  const submitAnswer = useCallback(async (
    questionId: string, 
    selectedOption: string,
    traitScores: TraitScores
  ) => {
    await answerMutation.mutateAsync({ questionId, selectedOption, traitScores });
  }, [answerMutation]);

  const continueAfterSignup = useCallback(async (userId: string) => {
    await linkUserMutation.mutateAsync(userId);
  }, [linkUserMutation]);

  const fetchResult = useCallback(async () => {
    await getResultMutation.mutateAsync();
  }, [getResultMutation]);

  return {
    sessionId,
    phase,
    currentQuestion,
    progress,
    currentMatches,
    isComplete,
    result,
    encouragement,
    isInitialized,
    
    isLoading: startMutation.isPending || answerMutation.isPending,
    isSubmitting: answerMutation.isPending,
    isLinkingUser: linkUserMutation.isPending,
    error: startMutation.error || answerMutation.error || linkUserMutation.error,
    
    startAssessment,
    startFreshAssessment,
    submitAnswer,
    continueAfterSignup,
    fetchResult,
    clearCache,
    getCachedAnswers,
    
    topArchetype: currentMatches[0]?.archetype || null,
    topConfidence: currentMatches[0]?.confidence || 0,
    answeredCount: progress?.answered || 0,
    estimatedRemaining: progress?.estimatedRemaining || 0,
  };
}

export type { 
  AssessmentQuestion, 
  QuestionOption, 
  ArchetypeMatch, 
  AssessmentProgress,
  AssessmentResult,
  PreSignupAnswer,
};
