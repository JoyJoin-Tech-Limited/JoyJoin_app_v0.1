import { useParams, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { SocialIcebreakerRecap } from '@/components/social-icebreaker/SocialIcebreakerRecap';
import { Loader2 } from 'lucide-react';

export default function SocialIcebreakerRecapPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [, setLocation] = useLocation();
  const socialSessionId = sessionId ? `social_${sessionId}` : '';

  const { data: user } = useQuery<{ id: string; displayName: string }>({
    queryKey: ['/api/auth/user'],
  });

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
      participants={user ? [{ userId: user.id, displayName: user.displayName }] : []}
      durationMinutes={30}
      onLeave={() => setLocation('/events')}
    />
  );
}
