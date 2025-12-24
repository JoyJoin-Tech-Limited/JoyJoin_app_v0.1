import { useQuery, useMutation } from '@tanstack/react-query';

export interface ParticipantInfo {
  displayName: string;
  archetype: string | null;
  interests?: string[];
}

interface MessageResponse {
  message: string;
}

export function useWelcomeMessage(
  participants: ParticipantInfo[],
  eventTitle?: string,
  enabled: boolean = true
) {
  const participantKey = participants.map(p => p.displayName).sort().join(',');
  
  return useQuery<MessageResponse>({
    queryKey: ['/api/icebreaker/welcome-message', participantKey, eventTitle],
    queryFn: async () => {
      const response = await fetch('/api/icebreaker/welcome-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ participants, eventTitle }),
      });
      if (!response.ok) {
        throw new Error('Failed to fetch welcome message');
      }
      return response.json();
    },
    enabled: enabled && participants.length > 0,
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: 1,
  });
}

export function useClosingMessage() {
  return useMutation({
    mutationFn: async ({
      participants,
      durationMinutes,
      topicsDiscussed,
      gamesPlayed,
    }: {
      participants: ParticipantInfo[];
      durationMinutes: number;
      topicsDiscussed?: string[];
      gamesPlayed?: string[];
    }): Promise<MessageResponse> => {
      const response = await fetch('/api/icebreaker/closing-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          participants,
          durationMinutes,
          topicsDiscussed,
          gamesPlayed,
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to fetch closing message');
      }
      return response.json();
    },
  });
}
