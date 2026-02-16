import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface GameCard {
  id: string;
  sessionId: string;
  cardType: 'question' | 'vote' | 'mission';
  content: string;
  hint?: string;
  category?: string;
  difficulty: 'easy' | 'medium' | 'deep';
  aiRecommendReason?: string;
  
  // Vote card fields
  voteOptions?: Array<{ id: string; text: string; emoji?: string }>;
  voteResults?: Record<string, number>;
  
  // Mission card fields
  missionType?: 'group_challenge' | 'pair_challenge' | 'individual_share';
  unlockCondition?: string;
  isUnlocked?: boolean;
  
  // Metadata
  roundNumber: number;
  displayOrder: number;
  isRevealed: boolean;
  revealedAt?: string;
  interactionCount: number;
  skipCount: number;
  
  isAiGenerated: boolean;
  generationSource: string;
  personalizedFor?: {
    archetypes: string[];
    interests: string[];
    industries: string[];
  };
}

export interface GameProgress {
  id: string;
  sessionId: string;
  totalRounds: number;
  roundDurationMinutes: number;
  currentRound: number;
  roundStartedAt: string;
  gameStartedAt: string;
  gameEndedAt?: string;
  aiGenerationRatio: number;
  cardsPerRound: number;
  roundHistory?: Array<{
    round: number;
    startedAt: string;
    endedAt?: string;
    cardsRevealed: number;
  }>;
}

interface UseIcebreakerGameOptions {
  sessionId?: string;
  eventId?: string;
  groupId?: string;
  enabled?: boolean;
}

export function useIcebreakerGame({
  sessionId: initialSessionId,
  eventId,
  groupId,
  enabled = true,
}: UseIcebreakerGameOptions) {
  const queryClient = useQueryClient();
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);

  // Fetch game progress
  const { data: progress, isLoading: progressLoading } = useQuery<GameProgress>({
    queryKey: ['/api/icebreaker/game/progress', sessionId],
    enabled: enabled && !!sessionId,
  });

  // Fetch cards for current session
  const { data: cardsData, isLoading: cardsLoading } = useQuery<{ cards: GameCard[] }>({
    queryKey: ['/api/icebreaker/game/cards', sessionId, progress?.currentRound],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (progress?.currentRound) {
        params.append('roundNumber', String(progress.currentRound));
      }
      const res = await fetch(`/api/icebreaker/game/cards/${sessionId}?${params}`);
      if (!res.ok) throw new Error('Failed to fetch cards');
      return res.json();
    },
    enabled: enabled && !!sessionId,
  });

  const cards = cardsData?.cards || [];
  const currentCard = cards[currentCardIndex];

  // Generate cards mutation
  const generateCardsMutation = useMutation({
    mutationFn: async (params: {
      sessionId?: string;
      eventId?: string;
      groupId?: string;
      roundNumber?: number;
      cardsCount?: number;
      aiRatio?: number;
    }) => {
      const res = await fetch('/api/icebreaker/game/generate-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to generate cards');
      }
      return res.json();
    },
    onSuccess: (data) => {
      if (data.sessionId) {
        setSessionId(data.sessionId);
      }
      // Invalidate queries to refetch
      queryClient.invalidateQueries({ queryKey: ['/api/icebreaker/game/cards'] });
      queryClient.invalidateQueries({ queryKey: ['/api/icebreaker/game/progress'] });
    },
  });

  // Record interaction mutation
  const recordInteractionMutation = useMutation({
    mutationFn: async (params: {
      cardId: string;
      sessionId: string;
      interactionType: 'view' | 'vote' | 'skip' | 'reaction';
      voteOptionId?: string;
      reaction?: string;
    }) => {
      const res = await fetch('/api/icebreaker/game/interact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!res.ok) throw new Error('Failed to record interaction');
      return res.json();
    },
    onSuccess: () => {
      // Invalidate cards query to update vote results
      queryClient.invalidateQueries({ queryKey: ['/api/icebreaker/game/cards'] });
    },
  });

  // Initialize game
  const initializeGame = useCallback(async () => {
    if (!sessionId && !eventId && !groupId) {
      console.warn('[IcebreakerGame] No session, event, or group ID provided');
      return;
    }

    try {
      await generateCardsMutation.mutateAsync({
        sessionId,
        eventId,
        groupId,
        roundNumber: 1,
        cardsCount: 3,
        aiRatio: 70,
      });
    } catch (error) {
      console.error('[IcebreakerGame] Failed to initialize:', error);
    }
  }, [sessionId, eventId, groupId, generateCardsMutation]);

  // Start new round
  const startNewRound = useCallback(async (roundNumber: number) => {
    if (!sessionId) {
      console.warn('[IcebreakerGame] No session ID');
      return;
    }

    try {
      await generateCardsMutation.mutateAsync({
        sessionId,
        roundNumber,
        cardsCount: 3,
        aiRatio: 70,
      });
      setCurrentCardIndex(0);
    } catch (error) {
      console.error('[IcebreakerGame] Failed to start round:', error);
    }
  }, [sessionId, generateCardsMutation]);

  // Navigate cards
  const nextCard = useCallback(() => {
    if (currentCardIndex < cards.length - 1) {
      setCurrentCardIndex(prev => prev + 1);
    }
  }, [currentCardIndex, cards.length]);

  const previousCard = useCallback(() => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex(prev => prev - 1);
    }
  }, [currentCardIndex]);

  const goToCard = useCallback((index: number) => {
    if (index >= 0 && index < cards.length) {
      setCurrentCardIndex(index);
    }
  }, [cards.length]);

  // Record interactions
  const recordView = useCallback(async (cardId: string) => {
    if (!sessionId) return;
    await recordInteractionMutation.mutateAsync({
      cardId,
      sessionId,
      interactionType: 'view',
    });
  }, [sessionId, recordInteractionMutation]);

  const recordVote = useCallback(async (cardId: string, voteOptionId: string) => {
    if (!sessionId) return;
    await recordInteractionMutation.mutateAsync({
      cardId,
      sessionId,
      interactionType: 'vote',
      voteOptionId,
    });
  }, [sessionId, recordInteractionMutation]);

  const recordSkip = useCallback(async (cardId: string) => {
    if (!sessionId) return;
    await recordInteractionMutation.mutateAsync({
      cardId,
      sessionId,
      interactionType: 'skip',
    });
    nextCard(); // Auto-advance to next card
  }, [sessionId, recordInteractionMutation, nextCard]);

  const recordReaction = useCallback(async (cardId: string, reaction: string) => {
    if (!sessionId) return;
    await recordInteractionMutation.mutateAsync({
      cardId,
      sessionId,
      interactionType: 'reaction',
      reaction,
    });
  }, [sessionId, recordInteractionMutation]);

  // Calculate round time remaining
  const getRoundTimeRemaining = useCallback(() => {
    if (!progress?.roundStartedAt || !progress?.roundDurationMinutes) {
      return null;
    }

    const startTime = new Date(progress.roundStartedAt).getTime();
    const durationMs = progress.roundDurationMinutes * 60 * 1000;
    const endTime = startTime + durationMs;
    const now = Date.now();
    const remaining = Math.max(0, endTime - now);

    return {
      remainingMs: remaining,
      remainingMinutes: Math.floor(remaining / 60000),
      isExpired: remaining === 0,
      progress: Math.min(100, ((now - startTime) / durationMs) * 100),
    };
  }, [progress]);

  // Auto-record view when card changes
  useEffect(() => {
    if (currentCard && sessionId) {
      recordView(currentCard.id);
    }
  }, [currentCard?.id, sessionId, recordView]);

  return {
    // State
    sessionId,
    progress,
    cards,
    currentCard,
    currentCardIndex,
    
    // Loading states
    isLoading: progressLoading || cardsLoading,
    isGenerating: generateCardsMutation.isPending,
    
    // Actions
    initializeGame,
    startNewRound,
    nextCard,
    previousCard,
    goToCard,
    recordVote,
    recordSkip,
    recordReaction,
    
    // Utils
    getRoundTimeRemaining,
    hasNextCard: currentCardIndex < cards.length - 1,
    hasPreviousCard: currentCardIndex > 0,
    totalCards: cards.length,
    isFirstCard: currentCardIndex === 0,
    isLastCard: currentCardIndex === cards.length - 1,
  };
}
