import { useQuery } from '@tanstack/react-query';
import type { TopicCard } from '@shared/topicCards';

export interface ParticipantProfile {
  displayName: string;
  archetype: string;
  interests?: string[];
  topicsHappy?: string[];
  topicsAvoid?: string[];
}

export interface RecommendedTopicWithReason {
  topic: TopicCard;
  reason: string;
  score: number;
}

interface TopicsResponse {
  recommendedTopics: RecommendedTopicWithReason[];
  allTopics: TopicCard[];
}

export function useAITopics(
  participants: ParticipantProfile[],
  atmosphereType: string = 'balanced',
  count: number = 5,
  enabled: boolean = true
) {
  return useQuery<TopicsResponse>({
    queryKey: ['/api/icebreaker/ai-topics', participants, atmosphereType, count],
    queryFn: async () => {
      const response = await fetch('/api/icebreaker/ai-topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ participants, atmosphereType, count }),
      });
      if (!response.ok) {
        throw new Error('Failed to fetch AI topics');
      }
      return response.json();
    },
    enabled: enabled && participants.length > 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });
}

export function useQuickTopics(
  archetypes: string[],
  atmosphereType: string = 'balanced',
  count: number = 5,
  enabled: boolean = true
) {
  return useQuery<TopicsResponse>({
    queryKey: ['/api/icebreaker/quick-topics', archetypes, atmosphereType, count],
    queryFn: async () => {
      const response = await fetch('/api/icebreaker/quick-topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ archetypes, atmosphereType, count }),
      });
      if (!response.ok) {
        throw new Error('Failed to fetch quick topics');
      }
      return response.json();
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useIcebreakerTopics(
  participants: ParticipantProfile[],
  atmosphereType: string = 'balanced',
  useAI: boolean = true
) {
  const archetypes = participants.map(p => p.archetype).filter(Boolean);
  
  const aiQuery = useAITopics(participants, atmosphereType, 5, useAI && participants.length > 0);
  
  const shouldFallbackToQuick = useAI && (aiQuery.isError || (aiQuery.isSuccess && !aiQuery.data?.recommendedTopics?.length));
  
  const quickQuery = useQuickTopics(
    archetypes, 
    atmosphereType, 
    5, 
    !useAI || shouldFallbackToQuick
  );
  
  if (useAI && !aiQuery.isError && aiQuery.data?.recommendedTopics?.length) {
    return {
      recommendedTopics: aiQuery.data.recommendedTopics,
      allTopics: aiQuery.data.allTopics || [],
      isLoading: aiQuery.isLoading,
      isError: false,
      error: null,
      isAIPowered: true,
      isFallback: false,
    };
  }
  
  if (shouldFallbackToQuick && quickQuery.data) {
    return {
      recommendedTopics: quickQuery.data.recommendedTopics || [],
      allTopics: quickQuery.data.allTopics || [],
      isLoading: false,
      isError: false,
      error: null,
      isAIPowered: false,
      isFallback: true,
    };
  }
  
  if (!useAI) {
    return {
      recommendedTopics: quickQuery.data?.recommendedTopics || [],
      allTopics: quickQuery.data?.allTopics || [],
      isLoading: quickQuery.isLoading,
      isError: quickQuery.isError,
      error: quickQuery.error,
      isAIPowered: false,
      isFallback: false,
    };
  }
  
  return {
    recommendedTopics: [],
    allTopics: [],
    isLoading: aiQuery.isLoading || (shouldFallbackToQuick && quickQuery.isLoading),
    isError: aiQuery.isError && quickQuery.isError,
    error: aiQuery.error || quickQuery.error,
    isAIPowered: false,
    isFallback: shouldFallbackToQuick,
  };
}
