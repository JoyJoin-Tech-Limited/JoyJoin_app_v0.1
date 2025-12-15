import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export interface ParticipantInfo {
  displayName: string;
  archetype: string | null;
  interests?: string[];
}

export interface GameRecommendation {
  gameId: string;
  gameName: string;
  reason: string;
}

interface RecommendGameParams {
  participants: ParticipantInfo[];
  scene?: 'dinner' | 'bar' | 'both';
}

export function useGameRecommendation() {
  const mutation = useMutation({
    mutationFn: async (params: RecommendGameParams): Promise<GameRecommendation> => {
      const response = await apiRequest('POST', '/api/icebreaker/recommend-game', params);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to recommend game' }));
        throw new Error(errorData.message || 'Failed to recommend game');
      }
      const data = await response.json();
      if (!data.gameId || !data.gameName) {
        throw new Error('Invalid recommendation response');
      }
      return data as GameRecommendation;
    },
  });

  return {
    recommend: mutation.mutate,
    recommendAsync: mutation.mutateAsync,
    isLoading: mutation.isPending,
    data: mutation.data,
    error: mutation.error as Error | null,
    reset: mutation.reset,
  };
}
