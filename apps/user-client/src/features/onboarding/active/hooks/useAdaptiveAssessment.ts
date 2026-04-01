import { useState, useCallback, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { prefetchXiaoyueAnalysis } from "@/hooks/useXiaoyueAnalysis";

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

interface SliderConfig {
  leftLabel: string;
  rightLabel: string;
  leftEmoji: string;
  rightEmoji: string;
  traitMappings: Array<{
    traitKey: string;
    scoreAtZero: number;
    scoreAt100: number;
  }>;
}

interface AssessmentQuestion {
  id: string;
  level: number;
  category: string;
  scenarioText: string;
  questionText: string;
  options: QuestionOption[];
  questionType?: 'choice' | 'slider' | 'emoji_tap';
  sliderConfig?: SliderConfig;
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
  const prefetchTriggeredRef = useRef(false);

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
      const data = await response.json() as StartResponse;
      // Pass through the params so onSuccess knows if this was a resume
      return { ...data, _wasResume: !!params?.sessionId && !params?.forceNew };
    },
    onSuccess: (data) => {
      const { _wasResume, ...responseData } = data as StartResponse & { _wasResume?: boolean };
      console.log('[AdaptiveAssessment] startMutation onSuccess:', {
        sessionId: responseData.sessionId,
        phase: responseData.phase,
        hasNextQuestion: !!responseData.nextQuestion,
        nextQuestionId: responseData.nextQuestion?.id,
        answered: responseData.progress?.answered,
        isComplete: responseData.isComplete,
        _wasResume,
      });
      
      setSessionId(responseData.sessionId);
      setPhase(responseData.phase);
      setCurrentQuestion(responseData.nextQuestion);
      setProgress(responseData.progress);
      setCurrentMatches(responseData.currentMatches);
      setIsComplete(responseData.isComplete);
      setIsInitialized(true);
      // Record baseline for relative question counting
      setBaselineAnswered(responseData.progress?.answered || 0);
      // Only clear pre-signup cache when NOT resuming an existing session
      // When resuming, answers are already in the backend - don't clear local state
      if (!_wasResume) {
        localStorage.removeItem(PRESIGNUP_ANSWERS_KEY);
        localStorage.removeItem(PRESIGNUP_SESSION_KEY);
      }
      // Cache current session
      cacheSession({ sessionId: responseData.sessionId, phase: responseData.phase });
    },
    onError: (error) => {
      console.error('[AdaptiveAssessment] startMutation onError:', error);
      // Set initialized to true so the page doesn't stay in loading state forever
      setIsInitialized(true);
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
        
        // NEW: Persist final result to localStorage for anonymous users
        if (phase === "pre_signup") {
          try {
            const resultData = {
              sessionId,
              result: data.result,
              completedAt: new Date().toISOString(),
              timestamp: Date.now(),
            };
            localStorage.setItem(PRESIGNUP_SESSION_KEY, JSON.stringify(resultData));
            console.log('[AdaptiveAssessment] Saved anonymous result to localStorage');
          } catch (e) {
            console.error('[AdaptiveAssessment] Failed to save result:', e);
          }
        }
      } else if (data.nextQuestion) {
        setCurrentQuestion(data.nextQuestion);
      }
      
      // Bug 13 Fix: Don't let server regress estimatedRemaining (prevents progress bar from going backwards)
      if (data.progress) {
        setProgress(prev => {
          if (!prev) return data.progress!;
          return {
            ...data.progress!,
            // Never let estimatedRemaining increase (prevents bar regression)
            estimatedRemaining: Math.min(prev.estimatedRemaining, data.progress!.estimatedRemaining),
          };
        });
      }
      if (data.currentMatches) {
        setCurrentMatches(data.currentMatches);
        
        // Prefetch xiaoyue analysis when we have a confident match
        const topMatch = data.currentMatches[0];
        if (topMatch && topMatch.confidence >= 0.7 && !prefetchTriggeredRef.current) {
          prefetchTriggeredRef.current = true;
          const currentTraits = data.progress ? {} : {};
          // Use trait scores from result if available, otherwise use empty object
          const traitScoresToPrefetch = data.result?.traitScores || {};
          prefetchXiaoyueAnalysis(topMatch.archetype, traitScoresToPrefetch, topMatch.confidence);
          console.log('[AdaptiveAssessment] Prefetching xiaoyue analysis for:', topMatch.archetype);
        }
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
      
      // NEW: If backend returns next question, update state immediately
      if (data.nextQuestion) {
        setCurrentQuestion(data.nextQuestion);
      }
      if (data.progress) {
        setProgress(data.progress);
      }
      if (data.currentMatches) {
        setCurrentMatches(data.currentMatches);
      }
      
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
    console.log('[AdaptiveAssessment] startAssessment called', { resumeFromCache });
    
    // Check if we have a synced session from onboarding (highest priority)
    const syncedSessionId = localStorage.getItem("joyjoin_synced_session_id");
    const syncedAnswerCount = parseInt(localStorage.getItem("joyjoin_synced_answer_count") || "0", 10);
    console.log('[AdaptiveAssessment] Checking for synced session:', { syncedSessionId, syncedAnswerCount });
    
    if (syncedSessionId) {
      // Bug 1 Fix: Validate that synced session has expected answer count (8 anchor questions)
      if (syncedAnswerCount < 8) {
        console.warn('[AdaptiveAssessment] Synced session has invalid answer count, clearing stale cache:', syncedAnswerCount);
        // Clear all stale assessment localStorage keys
        localStorage.removeItem("joyjoin_synced_session_id");
        localStorage.removeItem("joyjoin_synced_answer_count");
        localStorage.removeItem(PRESIGNUP_SESSION_KEY);
        localStorage.removeItem(PRESIGNUP_ANSWERS_KEY);
        // Start fresh assessment
        try {
          await startMutation.mutateAsync({ forceNew: true });
        } catch (error) {
          console.error('[AdaptiveAssessment] Failed to start fresh assessment after invalid sync count:', error);
        }
        return;
      }
      
      // Clear any stale cached answers since they've been synced
      clearCache();
      
      // Resume from the synced session - no need to re-submit answers
      setSessionId(syncedSessionId);
      setPhase("assessment");
      
      console.log('[AdaptiveAssessment] Found synced session, resuming:', syncedSessionId);
      
      // NEW: Check if we already have a current question (from link-user response)
      // If so, skip the API call
      if (currentQuestion) {
        console.log('[AdaptiveAssessment] Already have current question, skipping API call');
        localStorage.removeItem("joyjoin_synced_session_id");
        localStorage.removeItem("joyjoin_synced_answer_count");
        setIsInitialized(true);
        return;
      }
      
      try {
        console.log('[AdaptiveAssessment] Calling /start with synced sessionId:', syncedSessionId);
        await startMutation.mutateAsync({ 
          sessionId: syncedSessionId, 
          forceNew: false 
        });
        // Only clear synced session marker AFTER successful resume
        localStorage.removeItem("joyjoin_synced_session_id");
        localStorage.removeItem("joyjoin_synced_answer_count");
        console.log('[AdaptiveAssessment] Successfully resumed from synced session');
      } catch (error) {
        // If resume fails, clear the marker so we don't get stuck
        console.error('[AdaptiveAssessment] Failed to resume from synced session:', error);
        localStorage.removeItem("joyjoin_synced_session_id");
        localStorage.removeItem("joyjoin_synced_answer_count");
      }
      return;
    }
    
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
        try {
          await startMutation.mutateAsync({ 
            sessionId: cached.sessionId, 
            preSignupAnswers, 
            forceNew: false 
          });
        } catch (error) {
          console.error('[AdaptiveAssessment] Failed to resume cached session:', error);
        }
        return;
      }
    }
    
    try {
      await startMutation.mutateAsync({ preSignupAnswers, forceNew });
    } catch (error) {
      console.error('[AdaptiveAssessment] Failed to start assessment:', error);
    }
  }, [loadCachedSession, getCachedAnswers, startMutation, clearCache, currentQuestion]);

  const startFreshAssessment = useCallback(async () => {
    clearCache();
    // Explicitly send forceNew:true WITHOUT preSignupAnswers to signal an intentional restart
    await startMutation.mutateAsync({ forceNew: true });
  }, [clearCache, startMutation]);

  const submitAnswer = useCallback(async (
    questionId: string, 
    selectedOption: string,
    traitScores: TraitScores
  ) => {
    // Bug 13 Fix: Use functional updates to avoid stale closure over `progress`
    // Optimistic update: increment answered, decrement estimatedRemaining
    setProgress(prev => prev ? { 
      ...prev, 
      answered: prev.answered + 1,
      estimatedRemaining: Math.max(0, prev.estimatedRemaining - 1)
    } : null);
    
    try {
      await answerMutation.mutateAsync({ questionId, selectedOption, traitScores });
    } catch (error) {
      // Rollback using functional update (not stale reference)
      setProgress(prev => prev ? {
        ...prev,
        answered: prev.answered - 1,
        estimatedRemaining: prev.estimatedRemaining + 1
      } : null);
      if (process.env.NODE_ENV === 'development') {
        console.log('[AdaptiveAssessment] Rolled back optimistic update due to error');
      }
      throw error;
    }
  }, [answerMutation]); // Bug 13 Fix: Remove `progress` from deps

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
