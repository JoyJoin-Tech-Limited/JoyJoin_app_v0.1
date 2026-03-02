import { useState, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type {
  SocialSessionState,
  SocialIcebreakerPhase,
  AtmosphereMood,
  SocialTopic,
} from '@shared/socialIcebreaker';

interface UseSocialIcebreakerOptions {
  sessionId: string;
  userId: string;
  displayName: string;
}

interface UseSocialIcebreakerReturn {
  state: SocialSessionState | null;
  isLoading: boolean;
  isHost: boolean;
  socialSessionId: string | null;
  startSession: () => Promise<void>;
  fetchTopics: (mood: AtmosphereMood) => Promise<SocialTopic[]>;
  advancePhase: () => Promise<void>;
  submitPulseCheck: (vibe: 1 | 2 | 3) => Promise<void>;
  generateMyStatements: () => Promise<Array<{ index: number; text: string }>>;
  castVote: (targetUserId: string, statementIndex: number) => Promise<void>;
  isStarting: boolean;
  isAdvancing: boolean;
}

export function useSocialIcebreaker({
  sessionId,
  userId,
  displayName,
}: UseSocialIcebreakerOptions): UseSocialIcebreakerReturn {
  const qc = useQueryClient();
  const [socialSessionId, setSocialSessionId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const startedRef = useRef(false);

  // Poll for state every 3 seconds once we have a session
  const { data: state, isLoading } = useQuery<SocialSessionState | null>({
    queryKey: ['/api/social-icebreaker', socialSessionId],
    queryFn: async () => {
      if (!socialSessionId) return null;
      const res = await apiRequest('GET', `/api/social-icebreaker/${socialSessionId}?userId=${userId}`);
      return res.json();
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
    try {
      const res = await apiRequest('POST', '/api/social-icebreaker/start', {
        sessionId,
        userId,
        displayName,
      });
      const data = await res.json();
      setSocialSessionId(data.socialSessionId);
    } catch (error) {
      console.error('[useSocialIcebreaker] startSession error:', error);
      startedRef.current = false;
    } finally {
      setIsStarting(false);
    }
  }, [sessionId, userId, displayName]);

  const fetchTopics = useCallback(
    async (mood: AtmosphereMood): Promise<SocialTopic[]> => {
      if (!socialSessionId) return [];
      try {
        const res = await apiRequest('POST', `/api/social-icebreaker/${socialSessionId}/topics`, {
          mood,
          participantCount: state?.playerCount || 4,
        });
        const data = await res.json();
        qc.invalidateQueries({ queryKey: ['/api/social-icebreaker', socialSessionId] });
        return data.topics || [];
      } catch (error) {
        console.error('[useSocialIcebreaker] fetchTopics error:', error);
        return [];
      }
    },
    [socialSessionId, state?.playerCount, qc]
  );

  const advancePhase = useCallback(async () => {
    if (!socialSessionId || !state) return;
    setIsAdvancing(true);
    try {
      await apiRequest('POST', `/api/social-icebreaker/${socialSessionId}/advance`, {
        userId,
        currentPhase: state.currentPhase,
      });
      qc.invalidateQueries({ queryKey: ['/api/social-icebreaker', socialSessionId] });
    } catch (error) {
      console.error('[useSocialIcebreaker] advancePhase error:', error);
    } finally {
      setIsAdvancing(false);
    }
  }, [socialSessionId, state, userId, qc]);

  const submitPulseCheck = useCallback(
    async (vibe: 1 | 2 | 3) => {
      if (!socialSessionId) return;
      try {
        await apiRequest('POST', `/api/social-icebreaker/${socialSessionId}/pulse-check`, {
          userId,
          vibe,
        });
      } catch (error) {
        console.error('[useSocialIcebreaker] submitPulseCheck error:', error);
      }
    },
    [socialSessionId, userId]
  );

  const generateMyStatements = useCallback(async (): Promise<Array<{ index: number; text: string }>> => {
    if (!socialSessionId) return [];
    try {
      const res = await apiRequest(
        'POST',
        `/api/social-icebreaker/${socialSessionId}/lie-detective/generate`,
        { userId, displayName }
      );
      const data = await res.json();
      qc.invalidateQueries({ queryKey: ['/api/social-icebreaker', socialSessionId] });
      return data.statements || [];
    } catch (error) {
      console.error('[useSocialIcebreaker] generateMyStatements error:', error);
      return [];
    }
  }, [socialSessionId, userId, displayName, qc]);

  const castVote = useCallback(
    async (targetUserId: string, statementIndex: number) => {
      if (!socialSessionId) return;
      try {
        await apiRequest('POST', `/api/social-icebreaker/${socialSessionId}/lie-detective/vote`, {
          voterId: userId,
          targetUserId,
          guessedStatementIndex: statementIndex,
        });
        qc.invalidateQueries({ queryKey: ['/api/social-icebreaker', socialSessionId] });
      } catch (error) {
        console.error('[useSocialIcebreaker] castVote error:', error);
      }
    },
    [socialSessionId, userId, qc]
  );

  return {
    state: state ?? null,
    isLoading,
    isHost,
    socialSessionId,
    startSession,
    fetchTopics,
    advancePhase,
    submitPulseCheck,
    generateMyStatements,
    castVote,
    isStarting,
    isAdvancing,
  };
}
