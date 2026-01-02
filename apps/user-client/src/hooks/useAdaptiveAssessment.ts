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
  skipCount?: number;
  canSkip?: boolean;
  encouragement?: {
    message: string;
    progressPercentage: number;
    archetype?: string;
    confidence?: number;
  } | null;
}

interface SkipResponse {
  success: boolean;
  newQuestion?: AssessmentQuestion;
  skipCount: number;
  canSkip: boolean;
  remainingSkips: number;
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

const MAX_SKIP_COUNT = 3;

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
  const [skipCount, setSkipCount] = useState(0);
  const [canSkip, setCanSkip] = useState(true);
  const [baselineAnswered, setBaselineAnswered] = useState<number>(0);

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
      // Replace existing answer for same question (not append)
      const existingIndex = answers.findIndex(a => a.questionId === answer.questionId);
      if (existingIndex >= 0) {
        answers[existingIndex] = answer;
      } else {
        answers.push(answer);
      }
      localStorage.setItem(PRESIGNUP_ANSWERS_KEY, JSON.stringify(answers));
    } catch {
    }
  }, []);

  const getCachedAnswers = useCallback((): PreSignupAnswer[] => {
    try {
      const cached = localStorage.getItem(PRESIGNUP_ANSWERS_KEY);
      if (!cached) return [];
      const answers: PreSignupAnswer[] = JSON.parse(cached);
      // Deduplicate by questionId, keeping the latest answer (last occurrence)
      const deduped = new Map<string, PreSignupAnswer>();
      for (const answer of answers) {
        deduped.set(answer.questionId, answer);
      }
      return Array.from(deduped.values());
    } catch {
      return [];
    }
  }, []);

  const clearCache = useCallback(() => {
    localStorage.removeItem(PRESIGNUP_SESSION_KEY);
    localStorage.removeItem(PRESIGNUP_ANSWERS_KEY);
  }, []);

  const startMutation = useMutation({
    mutationFn: async (params?: { 
      sessionId?: string;
      preSignupAnswers?: PreSignupAnswer[]; 
      forceNew?: boolean 
    }) => {
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
      // Record baseline for relative question counting
      setBaselineAnswered(data.progress?.answered || 0);
      // Clear ALL pre-signup cache after successful session creation
      // This prevents stale answers and session from being reused
      localStorage.removeItem(PRESIGNUP_ANSWERS_KEY);
      localStorage.removeItem(PRESIGNUP_SESSION_KEY);
      // Cache new session
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

  const skipMutation = useMutation({
    mutationFn: async (questionId: string) => {
      if (!sessionId) throw new Error("No active session");
      
      const response = await apiRequest(
        "POST",
        `/api/assessment/v4/${sessionId}/skip`,
        { questionId }
      );
      return response.json() as Promise<SkipResponse>;
    },
    onSuccess: (data) => {
      setSkipCount(data.skipCount);
      setCanSkip(data.canSkip);
      if (data.newQuestion) {
        setCurrentQuestion(data.newQuestion);
      }
    },
  });

  const startAssessment = useCallback(async (resumeFromCache = true) => {
    const cachedAnswers = getCachedAnswers();
    const preSignupAnswers = cachedAnswers.length > 0 ? cachedAnswers : undefined;
    
    // Always force new session when we have preSignupAnswers (post-login flow)
    // This ensures we don't accumulate answers from previous incomplete sessions
    const forceNew = preSignupAnswers && preSignupAnswers.length > 0;

    if (resumeFromCache && !forceNew) {
      const cached = loadCachedSession();
      if (cached?.sessionId) {
        setSessionId(cached.sessionId);
        setPhase(cached.phase);
        // Send sessionId to backend to resume existing session
        await startMutation.mutateAsync({ 
          sessionId: cached.sessionId, 
          preSignupAnswers, 
          forceNew: false 
        });
        return;
      }
    }
    
    await startMutation.mutateAsync({ preSignupAnswers, forceNew });
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

  const skipQuestion = useCallback(async (questionId: string) => {
    if (!canSkip) return false;
    try {
      await skipMutation.mutateAsync(questionId);
      return true;
    } catch {
      return false;
    }
  }, [canSkip, skipMutation]);

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
    
    skipCount,
    canSkip,
    remainingSkips: MAX_SKIP_COUNT - skipCount,
    
    isLoading: startMutation.isPending || answerMutation.isPending,
    isSubmitting: answerMutation.isPending,
    isSkipping: skipMutation.isPending,
    isLinkingUser: linkUserMutation.isPending,
    error: startMutation.error || answerMutation.error || linkUserMutation.error || skipMutation.error,
    
    startAssessment,
    startFreshAssessment,
    submitAnswer,
    skipQuestion,
    continueAfterSignup,
    fetchResult,
    clearCache,
    getCachedAnswers,
    
    topArchetype: currentMatches[0]?.archetype || null,
    topConfidence: currentMatches[0]?.confidence || 0,
    answeredCount: progress?.answered || 0,
    estimatedRemaining: progress?.estimatedRemaining || 0,
    baselineAnswered,
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
