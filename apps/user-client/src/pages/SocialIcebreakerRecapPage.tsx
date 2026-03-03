import { useParams, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { SocialIcebreakerRecap } from '@/components/social-icebreaker/SocialIcebreakerRecap';
import type { SocialSessionState } from '@shared/socialIcebreaker';

export default function SocialIcebreakerRecapPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [, setLocation] = useLocation();
  const socialSessionId = sessionId ? `social_${sessionId}` : '';

  const { data: user } = useQuery<{ id: string; displayName: string }>({
    queryKey: ['/api/auth/user'],
  });

  const { data: recapData } = useQuery<{ state: SocialSessionState }>({
    queryKey: ['/api/social-icebreaker', socialSessionId, 'recap'],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/social-icebreaker/${socialSessionId}/recap`);
      return res.json();
    },
    enabled: !!socialSessionId,
    staleTime: Infinity,
  });

  const eventId = new URLSearchParams(window.location.search).get('eventId') || undefined;

  const state = recapData?.state;

  const durationMinutes = state?.sessionStartedAt
    ? Math.max(1, Math.round((Date.now() - state.sessionStartedAt) / 60000))
    : 30;

  const participants =
    state?.lieDetectivePlayers && state.lieDetectivePlayers.length > 0
      ? state.lieDetectivePlayers.map(p => ({ userId: p.userId, displayName: p.displayName }))
      : user
      ? [{ userId: user.id, displayName: user.displayName }]
      : [];

  if (!sessionId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">无效的会话ID</p>
      </div>
    );
  }

  return (
    <SocialIcebreakerRecap
      socialSessionId={socialSessionId}
      participants={participants}
      durationMinutes={durationMinutes}
      onLeave={() => setLocation('/events')}
      eventId={eventId}
    />
  );
}
