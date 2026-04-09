import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type {
  SocialSessionState,
  AtmosphereMood,
  SocialTopic,
  PersonalityDiceChallenge,
} from '@shared/socialIcebreaker';

function getSocialSessionStorageKey(sessionId: string): string {
  return `joyjoin_social_session_id:${sessionId}`;
}

/** How often (ms) to send a heartbeat when the tab is active. */
const HEARTBEAT_INTERVAL_MS = 10_000;

interface UseSocialIcebreakerOptions {
  sessionId: string;
  userId: string;
  displayName: string;
  eventType?: string;
  participantProfile?: {
    archetype?: string;
    interests?: string[];
    topicsHappy?: string[];
    topicsAvoid?: string[];
  };
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
  /** True when the server returned SESSION_EXPIRED (410) for this session. */
  sessionExpired: boolean;
  startSession: () => Promise<void>;
  fetchTopics: (mood: AtmosphereMood, options?: { avoidTopics?: string[] }) => Promise<SocialTopic[]>;
  markWarmupReady: (ready?: boolean) => Promise<{ readyCount: number; allReady: boolean } | null>;
  nextWarmupTopic: () => Promise<void>;
  advancePhase: () => Promise<void>;
  submitPulseCheck: (vibe: 1 | 2 | 3) => Promise<{ averageVibe: number; voteCount: number; allVoted: boolean } | null>;
  generateMyStatements: () => Promise<Array<{ index: number; text: string }>>;
  castVote: (targetUserId: string, statementIndex: number) => Promise<void>;
  nextLieDetectivePlayer: () => Promise<void>;
  completeChallenge: () => Promise<void>;
  generateDiceChallenges: (participants: Array<{ userId: string; displayName: string; archetype?: string; traitScores?: Record<string, number> }>) => Promise<PersonalityDiceChallenge[]>;
  completeDiceChallenge: () => Promise<void>;
  isStarting: boolean;
  isAdvancing: boolean;
  /** The last action error, or null if no error. */
  error: IcebreakerError | null;
  /** Clear the current action error. */
  clearError: () => void;
}

/**
 * Classify a fetch error into a user-actionable kind.
 */
async function classifyError(error: unknown): Promise<IcebreakerError> {
  if (error instanceof TypeError) {
    return { kind: 'network_error', message: '网络连接失败，请检查网络后重试' };
  }
  if (error instanceof Error) {
    const message = error.message || '';
    const lowerMessage = message.toLowerCase();
    if (message.startsWith('404:') || lowerMessage.includes('not found')) {
      return { kind: 'session_missing', message: '破冰会话已过期，请重新加入' };
    }
    if (message.startsWith('403:')) {
      return { kind: 'permission_denied', message: '当前操作需要主持人权限' };
    }
    if (message.startsWith('400:')) {
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
  participantProfile,
}: UseSocialIcebreakerOptions): UseSocialIcebreakerReturn {
  const qc = useQueryClient();
  const storageKey = getSocialSessionStorageKey(sessionId);

  // Restore a cached socialSessionId from sessionStorage so that the GET
  // polling query can start immediately on reconnect/refresh, before
  // startSession() completes its POST.
  const [socialSessionId, setSocialSessionId] = useState<string | null>(() => {
    try {
      const stored = sessionStorage.getItem(storageKey);
      return stored || null;
    } catch {
      return null;
    }
  });

  const [isStarting, setIsStarting] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [error, setError] = useState<IcebreakerError | null>(null);
  const [isDocumentVisible, setIsDocumentVisible] =
    useState(typeof document === 'undefined' || document.visibilityState === 'visible');
  const startedRef = useRef(false);

  // Keep sessionStorage in sync with the current socialSessionId.
  const setAndCacheSocialSessionId = useCallback((id: string | null) => {
    setSocialSessionId(id);
    try {
      if (id) {
        sessionStorage.setItem(storageKey, id);
      } else {
        sessionStorage.removeItem(storageKey);
      }
    } catch {
      // sessionStorage may be unavailable in some environments; ignore.
    }
  }, [storageKey]);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handleVisibilityChange = () => {
      setIsDocumentVisible(document.visibilityState === 'visible');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Poll for state every 3 seconds once we have a session.
  // The query fn checks for the structured expiry error and updates state.
  const { data: state, isLoading } = useQuery<SocialSessionState | null>({
    queryKey: ['/api/social-icebreaker', socialSessionId],
    queryFn: async () => {
      if (!socialSessionId) return null;
      const res = await apiRequest('GET', `/api/social-icebreaker/${socialSessionId}`, undefined, {
        allowStatuses: [410],
      });
      if (res.status === 410) {
        setSessionExpired(true);
        setAndCacheSocialSessionId(null);
        return null;
      }
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!socialSessionId && !sessionExpired,
    refetchInterval: 3000,
    staleTime: 1000,
  });

  const isHost = state?.hostUserId === userId;

  // Periodically send a heartbeat to keep the user marked as active while
  // the tab remains visible.
  useEffect(() => {
    if (!socialSessionId || sessionExpired || !isDocumentVisible) return;

    let cancelled = false;
    let timeoutId: number | null = null;

    const sendHeartbeat = async () => {
      try {
        const res = await apiRequest('POST', `/api/social-icebreaker/${socialSessionId}/heartbeat`, {}, {
          allowStatuses: [410],
        });
        if (res.status === 410) {
          setSessionExpired(true);
          setAndCacheSocialSessionId(null);
        }
      } catch {
        // Network failure; will retry next interval.
      } finally {
        if (!cancelled) {
          timeoutId = window.setTimeout(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
        }
      }
    };

    void sendHeartbeat();

    return () => {
      cancelled = true;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, [socialSessionId, sessionExpired, isDocumentVisible, setAndCacheSocialSessionId]);

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
        }, {
          allowStatuses: [410],
      });
      if (res.status === 410) {
        setSessionExpired(true);
        setAndCacheSocialSessionId(null);
        return;
      }
      const data = await res.json();
      setAndCacheSocialSessionId(data.socialSessionId);
    } catch (error) {
      console.error('[useSocialIcebreaker] startSession error:', error);
      setError(await classifyError(error));
      startedRef.current = false;
    } finally {
      setIsStarting(false);
    }
  }, [sessionId, displayName, eventType, setAndCacheSocialSessionId]);

  const fetchTopics = useCallback(
    async (mood: AtmosphereMood, options?: { avoidTopics?: string[] }): Promise<SocialTopic[]> => {
      if (!socialSessionId) return [];
      try {
        const res = await apiRequest('POST', `/api/social-icebreaker/${socialSessionId}/topics`, {
          mood,
          eventType,
          participantCount: state?.playerCount || 4,
          avoidTopics: options?.avoidTopics,
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

  const markWarmupReady = useCallback(
    async (ready: boolean = true): Promise<{ readyCount: number; allReady: boolean } | null> => {
      if (!socialSessionId) return null;
      try {
        const res = await apiRequest('POST', `/api/social-icebreaker/${socialSessionId}/warmup/ready`, { ready });
        const data = await res.json();
        qc.invalidateQueries({ queryKey: ['/api/social-icebreaker', socialSessionId] });
        return { readyCount: data.readyCount, allReady: data.allReady };
      } catch (e) {
        setError(await classifyError(e));
        return null;
      }
    },
    [socialSessionId, qc]
  );

  const nextWarmupTopic = useCallback(async () => {
    if (!socialSessionId) return;
    try {
      await apiRequest('POST', `/api/social-icebreaker/${socialSessionId}/warmup/next-topic`, {});
      qc.invalidateQueries({ queryKey: ['/api/social-icebreaker', socialSessionId] });
    } catch (e) {
      setError(await classifyError(e));
    }
  }, [socialSessionId, qc]);

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
      } catch (e) {
        setError(await classifyError(e));
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
        {
          displayName,
          archetype: participantProfile?.archetype,
          interests: participantProfile?.interests,
        }
      );
      const data = await res.json();
      qc.invalidateQueries({ queryKey: ['/api/social-icebreaker', socialSessionId] });
      return data.statements || [];
    } catch (e) {
      setError(await classifyError(e));
      return [];
    }
  }, [socialSessionId, displayName, participantProfile?.archetype, participantProfile?.interests, qc]);

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

  const nextLieDetectivePlayer = useCallback(async () => {
    if (!socialSessionId) return;
    try {
      await apiRequest('POST', `/api/social-icebreaker/${socialSessionId}/lie-detective/next-player`, {});
      qc.invalidateQueries({ queryKey: ['/api/social-icebreaker', socialSessionId] });
    } catch (e) {
      setError(await classifyError(e));
    }
  }, [socialSessionId, qc]);

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
    sessionExpired,
    startSession,
    fetchTopics,
    markWarmupReady,
    nextWarmupTopic,
    advancePhase,
    submitPulseCheck,
    generateMyStatements,
    castVote,
    nextLieDetectivePlayer,
    completeChallenge,
    generateDiceChallenges,
    completeDiceChallenge,
    isStarting,
    isAdvancing,
    error,
    clearError: () => setError(null),
  };
}
