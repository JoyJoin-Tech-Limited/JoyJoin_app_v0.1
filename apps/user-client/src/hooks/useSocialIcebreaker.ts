import { useState, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type {
  SocialSessionState,
  SocialIcebreakerPhase,
  AtmosphereMood,
  SocialTopic,
  PersonalityDiceChallenge,
} from '@shared/socialIcebreaker';

interface UseSocialIcebreakerOptions {
  sessionId: string;
  userId: string;
  displayName: string;
  eventType?: string;
}

export type IcebreakerErrorKind =
  | 'session_missing'   // 404 — session not found or expired
  | 'permission_denied' // 403 — not the host, or wrong user
  | 'wrong_phase'       // 400 — action not valid for the current phase
  | 'network_error'     // network/fetch failure
  | 'unknown';          // any other error

export interface IcebreakerError {
  kind: IcebreakerErrorKind;
  message: string;
}

interface UseSocialIcebreakerReturn {
  state: SocialSessionState | null;
  isLoading: boolean;
  isHost: boolean;
  socialSessionId: string | null;
  error: IcebreakerError | null;
  clearError: () => void;
  startSession: () => Promise<void>;
  fetchTopics: (mood: AtmosphereMood) => Promise<SocialTopic[]>;
  advancePhase: () => Promise<void>;
  submitPulseCheck: (vibe: 1 | 2 | 3) => Promise<{ averageVibe: number; voteCount: number; allVoted: boolean } | null>;
  generateMyStatements: () => Promise<Array<{ index: number; text: string }>>;
  castVote: (targetUserId: string, statementIndex: number) => Promise<void>;
  completeChallenge: () => Promise<void>;
  generateDiceChallenges: (participants: Array<{ userId: string; displayName: string; archetype?: string; traitScores?: Record<string, number> }>) => Promise<PersonalityDiceChallenge[]>;
  completeDiceChallenge: () => Promise<void>;
  isStarting: boolean;
  isAdvancing: boolean;
}

/**
 * Classify a fetch error into a user-actionable kind.
 */
async function classifyError(error: unknown): Promise<IcebreakerError> {
  if (error instanceof TypeError) {
    return { kind: 'network_error', message: '网络连接失败，请检查网络后重试' };
  }
  if (error instanceof Response) {
    if (error.status === 404) return { kind: 'session_missing', message: '破冰会话已过期，请重新加入' };
    if (error.status === 403) return { kind: 'permission_denied', message: '当前操作需要主持人权限' };
    if (error.status === 400) return { kind: 'wrong_phase', message: '当前阶段不支持此操作' };
  }
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as any).status;
    if (status === 404) return { kind: 'session_missing', message: '破冰会话已过期，请重新加入' };
    if (status === 403) return { kind: 'permission_denied', message: '当前操作需要主持人权限' };
    if (status === 400) return { kind: 'wrong_phase', message: '当前阶段不支持此操作' };
  }
  if (error instanceof Error) {
    if (error.message.startsWith('404:') || error.message.toLowerCase().includes('not found')) {
      return { kind: 'session_missing', message: '破冰会话已过期，请重新加入' };
    }
    if (error.message.startsWith('403:')) {
      return { kind: 'permission_denied', message: '当前操作需要主持人权限' };
    }
    if (error.message.startsWith('400:')) {
      return { kind: 'wrong_phase', message: '当前阶段不支持此操作' };
    }
  }
  return { kind: 'unknown', message: '操作失败，请稍后重试' };
}

export function useSocialIcebreaker({
  sessionId,
  userId,
  displayName,
  eventType,
}: UseSocialIcebreakerOptions): UseSocialIcebreakerReturn {
  const qc = useQueryClient();
  const [socialSessionId, setSocialSessionId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [error, setError] = useState<IcebreakerError | null>(null);
  const startedRef = useRef(false);

  const clearError = useCallback(() => setError(null), []);

  // Poll for state every 3 seconds once we have a session
  const { data: state, isLoading } = useQuery<SocialSessionState | null>({
    queryKey: ['/api/social-icebreaker', socialSessionId],
    queryFn: async () => {
      if (!socialSessionId) return null;
      try {
        const res = await apiRequest('GET', `/api/social-icebreaker/${socialSessionId}`);
        return res.json();
      } catch (e) {
        setError(await classifyError(e));
        return null;
      }
    },
    enabled: !!socialSessionId,
    refetchInterval: 3000,
    staleTime: 1000,
  });

  const isHost = state?.hostUserId === userId;

  const startSession = useCallback(async () => {
    if (startedRef.current) return;
    startedRef.current = true;
    setIsStarting(true);
    setError(null);
    try {
      const res = await apiRequest('POST', '/api/social-icebreaker/start', {
        sessionId,
        displayName,
        eventType,
      });
      const data = await res.json();
      setSocialSessionId(data.socialSessionId);
    } catch (e) {
      const err = await classifyError(e);
      setError(err);
      startedRef.current = false;
    } finally {
      setIsStarting(false);
    }
  }, [sessionId, displayName, eventType]);

  const fetchTopics = useCallback(
    async (mood: AtmosphereMood): Promise<SocialTopic[]> => {
      if (!socialSessionId) return [];
      try {
        const res = await apiRequest('POST', `/api/social-icebreaker/${socialSessionId}/topics`, {
          mood,
          eventType,
          participantCount: state?.playerCount || 4,
        });
        const data = await res.json();
        qc.invalidateQueries({ queryKey: ['/api/social-icebreaker', socialSessionId] });
        return data.topics || [];
      } catch (e) {
        setError(await classifyError(e));
        return [];
      }
    },
    [socialSessionId, state?.playerCount, eventType, qc]
  );

  const advancePhase = useCallback(async () => {
    if (!socialSessionId || !state) return;
    setIsAdvancing(true);
    try {
      await apiRequest('POST', `/api/social-icebreaker/${socialSessionId}/advance`, {
        currentPhase: state.currentPhase,
      });
      qc.invalidateQueries({ queryKey: ['/api/social-icebreaker', socialSessionId] });
    } catch (e) {
      setError(await classifyError(e));
    } finally {
      setIsAdvancing(false);
    }
  }, [socialSessionId, state, qc]);

  const submitPulseCheck = useCallback(
    async (vibe: 1 | 2 | 3): Promise<{ averageVibe: number; voteCount: number; allVoted: boolean } | null> => {
      if (!socialSessionId) return null;
      try {
        const res = await apiRequest('POST', `/api/social-icebreaker/${socialSessionId}/pulse-check`, {
          vibe,
        });
        return res.json();
      } catch {
        return null;
      }
    },
    [socialSessionId]
  );

  const completeChallenge = useCallback(async () => {
    if (!socialSessionId) return;
    try {
      await apiRequest('POST', `/api/social-icebreaker/${socialSessionId}/micro-challenge/complete`, {});
      qc.invalidateQueries({ queryKey: ['/api/social-icebreaker', socialSessionId] });
    } catch (e) {
      setError(await classifyError(e));
    }
  }, [socialSessionId, qc]);

  const generateMyStatements = useCallback(async (): Promise<Array<{ index: number; text: string }>> => {
    if (!socialSessionId) return [];
    try {
      const res = await apiRequest(
        'POST',
        `/api/social-icebreaker/${socialSessionId}/lie-detective/generate`,
        { displayName }
      );
      const data = await res.json();
      qc.invalidateQueries({ queryKey: ['/api/social-icebreaker', socialSessionId] });
      return data.statements || [];
    } catch (e) {
      setError(await classifyError(e));
      return [];
    }
  }, [socialSessionId, displayName, qc]);

  const castVote = useCallback(
    async (targetUserId: string, statementIndex: number) => {
      if (!socialSessionId) return;
      try {
        await apiRequest('POST', `/api/social-icebreaker/${socialSessionId}/lie-detective/vote`, {
          targetUserId,
          guessedStatementIndex: statementIndex,
        });
        qc.invalidateQueries({ queryKey: ['/api/social-icebreaker', socialSessionId] });
      } catch (e) {
        setError(await classifyError(e));
      }
    },
    [socialSessionId, qc]
  );

  const generateDiceChallenges = useCallback(
    async (participants: Array<{ userId: string; displayName: string; archetype?: string; traitScores?: Record<string, number> }>): Promise<PersonalityDiceChallenge[]> => {
      if (!socialSessionId) return [];
      try {
        const res = await apiRequest('POST', `/api/social-icebreaker/${socialSessionId}/personality-dice/generate`, { participants });
        const data = await res.json();
        qc.invalidateQueries({ queryKey: ['/api/social-icebreaker', socialSessionId] });
        return data.challenges || [];
      } catch (e) {
        setError(await classifyError(e));
        return [];
      }
    },
    [socialSessionId, qc]
  );

  const completeDiceChallenge = useCallback(
    async () => {
      if (!socialSessionId) return;
      try {
        // The server now derives the userId from the session; no body userId needed
        await apiRequest('POST', `/api/social-icebreaker/${socialSessionId}/personality-dice/complete`, {});
        qc.invalidateQueries({ queryKey: ['/api/social-icebreaker', socialSessionId] });
      } catch (e) {
        setError(await classifyError(e));
      }
    },
    [socialSessionId, qc]
  );

  return {
    state: state ?? null,
    isLoading,
    isHost,
    socialSessionId,
    error,
    clearError,
    startSession,
    fetchTopics,
    advancePhase,
    submitPulseCheck,
    generateMyStatements,
    castVote,
    completeChallenge,
    generateDiceChallenges,
    completeDiceChallenge,
    isStarting,
    isAdvancing,
  };
}
