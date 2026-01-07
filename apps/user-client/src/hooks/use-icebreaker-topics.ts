import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback, useMemo, useEffect } from "react";
import type { TopicCard } from "@shared/topicCards";

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

export function useIcebreakerTopics(
  participants: ParticipantProfile[],
  atmosphereType: string = 'balanced',
  preferAI: boolean = true
) {
  const queryClient = useQueryClient();
  const [refreshKey, setRefreshKey] = useState(0);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  
  const hasParticipants = participants.length > 0;
  
  const stableParticipantsKey = useMemo(() => {
    if (!hasParticipants) return 'empty';
    return participants.map(p => `${p.displayName}:${p.archetype}`).sort().join('|');
  }, [participants, hasParticipants]);
  
  const archetypes = useMemo(() => 
    participants.map(p => p.archetype).filter(Boolean),
    [participants]
  );
  const stableArchetypesKey = useMemo(() => 
    archetypes.sort().join('|') || 'empty',
    [archetypes]
  );
  
  const aiQueryKey = useMemo(() => 
    ['/api/icebreaker/ai-topics', stableParticipantsKey, atmosphereType, refreshKey],
    [stableParticipantsKey, atmosphereType, refreshKey]
  );
  
  const quickQueryKey = useMemo(() => 
    ['/api/icebreaker/quick-topics', stableArchetypesKey, atmosphereType, refreshKey],
    [stableArchetypesKey, atmosphereType, refreshKey]
  );
  
  const aiQuery = useQuery<TopicsResponse>({
    queryKey: aiQueryKey,
    queryFn: async () => {
      const response = await fetch('/api/icebreaker/ai-topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          participants, 
          atmosphereType, 
          count: 5, 
          refresh: refreshKey > 0 
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to fetch AI topics');
      }
      return response.json();
    },
    enabled: preferAI && hasParticipants,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });
  
  const aiHasData = Boolean(aiQuery.data?.recommendedTopics?.length);
  const aiFailed = aiQuery.isError || (aiQuery.isSuccess && !aiHasData);
  const shouldUseQuick = !preferAI || (preferAI && aiFailed) || !hasParticipants;
  
  const quickQuery = useQuery<TopicsResponse>({
    queryKey: quickQueryKey,
    queryFn: async () => {
      const response = await fetch('/api/icebreaker/quick-topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          archetypes, 
          atmosphereType, 
          count: 5, 
          refresh: refreshKey > 0 
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to fetch quick topics');
      }
      return response.json();
    },
    enabled: shouldUseQuick,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
  
  useEffect(() => {
    if (!isManualRefreshing) return;
    
    const isAnyFetching = aiQuery.isFetching || quickQuery.isFetching;
    
    if (!isAnyFetching) {
      const timer = setTimeout(() => {
        setIsManualRefreshing(false);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [aiQuery.isFetching, quickQuery.isFetching, isManualRefreshing]);

  const refreshTopics = useCallback(() => {
    setIsManualRefreshing(true);
    setRefreshKey(prev => prev + 1);
  }, []);

  const isRefreshing = isManualRefreshing;
  
  if (preferAI && hasParticipants && aiHasData) {
    return {
      recommendedTopics: aiQuery.data!.recommendedTopics,
      allTopics: aiQuery.data!.allTopics || [],
      isLoading: false,
      isError: false,
      error: null,
      isAIPowered: true,
      isFallback: false,
      refreshTopics,
      isRefreshing,
    };
  }
  
  if (shouldUseQuick && quickQuery.data) {
    return {
      recommendedTopics: quickQuery.data.recommendedTopics || [],
      allTopics: quickQuery.data.allTopics || [],
      isLoading: false,
      isError: false,
      error: null,
      isAIPowered: false,
      isFallback: preferAI && hasParticipants,
      refreshTopics,
      isRefreshing,
    };
  }
  
  const isLoading = (preferAI && hasParticipants && aiQuery.isLoading) || 
                    (shouldUseQuick && quickQuery.isLoading);
  const isError = (preferAI && hasParticipants && aiQuery.isError && !shouldUseQuick) ||
                  (shouldUseQuick && quickQuery.isError);
  
  return {
    recommendedTopics: [],
    allTopics: [],
    isLoading,
    isError,
    error: aiQuery.error || quickQuery.error,
    isAIPowered: false,
    isFallback: false,
    refreshTopics,
    isRefreshing,
  };
}
