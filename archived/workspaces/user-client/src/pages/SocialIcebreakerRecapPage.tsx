import { useParams, useLocation } from 'wouter';
import { SocialIcebreakerRecap } from '@/components/social-icebreaker/SocialIcebreakerRecap';

export default function SocialIcebreakerRecapPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [, setLocation] = useLocation();
  const socialSessionId = sessionId ? `social_${sessionId}` : '';

  const eventId = new URLSearchParams(window.location.search).get('eventId') || undefined;

  if (!sessionId) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh]">
        <p className="text-muted-foreground">无效的会话ID</p>
      </div>
    );
  }

  return (
    <SocialIcebreakerRecap
      socialSessionId={socialSessionId}
      onLeave={() => setLocation('/events')}
      eventId={eventId}
    />
  );
}
