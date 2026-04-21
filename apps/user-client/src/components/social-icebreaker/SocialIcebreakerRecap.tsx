import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import MobilePrimaryButton from '@/components/mobile/MobilePrimaryButton';
import type { AIResponseMeta } from '@shared/types/aiMeta';
import { IcebreakerRecapFeedbackBar } from '@/components/social-icebreaker/IcebreakerRecapFeedbackBar';

interface SocialIcebreakerRecapProps {
  socialSessionId: string;
  participants?: Array<{ userId: string; displayName: string; archetype?: string }>;
  durationMinutes?: number;
  commonGroundCount?: number;
  onLeave: () => void;
  eventId?: string;
}

interface RecapSummary {
  headline: string;
  moments: string[];
  closingLine: string;
}

interface Medal {
  emoji: string;
  title: string;
  recipientDisplayName: string;
  description: string;
}

export function SocialIcebreakerRecap({
  socialSessionId,
  participants,
  durationMinutes,
  commonGroundCount = 0,
  onLeave,
  eventId,
}: SocialIcebreakerRecapProps) {
  const [, setLocation] = useLocation();
  const { data: recapData, isLoading } = useQuery<{
    summary: RecapSummary;
    medals?: Medal[];
    state: any;
    meta?: AIResponseMeta;
  }>({
    queryKey: ['/api/social-icebreaker', socialSessionId, 'recap'],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/social-icebreaker/${socialSessionId}/recap`);
      return res.json();
    },
    enabled: !!socialSessionId,
    staleTime: Infinity,
  });

  const summary = recapData?.summary;
  const medals = recapData?.medals || [];

  const effectiveDuration =
    durationMinutes ??
    (recapData?.state?.sessionStartedAt
      ? Math.max(1, Math.round((Date.now() - recapData.state.sessionStartedAt) / 60000))
      : 30);

  const effectiveParticipants: Array<{ userId: string; displayName: string; archetype?: string }> =
    participants ??
    (recapData?.state?.lieDetectivePlayers?.length
      ? recapData.state.lieDetectivePlayers.map((p: { userId: string; displayName: string }) => ({
          userId: p.userId,
          displayName: p.displayName,
        }))
      : []);

  return (
    <div
      className="flex flex-col min-h-full bg-gradient-to-br from-violet-900 via-purple-900 to-fuchsia-900 text-white"
      data-testid="social-icebreaker-recap"
    >
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 24 }}
          className="text-center mb-8"
        >
          <div className="text-5xl mb-3">✨</div>
          <h2 className="text-3xl font-black">今晚的精彩回顾</h2>
          <p className="text-violet-300 mt-1 text-sm">{effectiveDuration} 分钟的破冰时光</p>
          <p className="text-violet-400 mt-1 text-xs">今晚一共发现了 {commonGroundCount} 个共同点</p>
        </motion.div>

        {isLoading ? (
          <div className="flex gap-1 mb-8">
            {[0, 1, 2].map(i => (
              <span
                key={i}
                className="w-2 h-2 bg-violet-300 rounded-full animate-bounce"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </div>
        ) : summary ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24, delay: 0.2 }}
            className="w-full max-w-sm space-y-4 mb-8"
          >
            {/* Headline */}
            <div className="bg-white/10 rounded-2xl p-4 text-center">
              <p className="text-xl font-black">{summary.headline}</p>
            </div>

            {/* Moments */}
            {summary.moments.map((moment, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.1 }}
                className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3"
              >
                <span className="text-xl">{['🎯', '🎭', '⚡'][i] || '✨'}</span>
                <p className="text-sm text-violet-100">{moment}</p>
              </motion.div>
            ))}

            {/* Closing line */}
            <div className="bg-white/10 rounded-2xl p-4 text-center">
              <p className="text-sm text-violet-200 leading-relaxed">{summary.closingLine}</p>
            </div>

            <IcebreakerRecapFeedbackBar socialSessionId={socialSessionId} meta={recapData?.meta} />
          </motion.div>
        ) : null}

        {/* Medals section */}
        {medals.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="w-full max-w-sm mb-6"
          >
            <p className="text-center text-sm font-bold text-violet-300 mb-3">🏅 今晚荣誉榜</p>
            <div className="space-y-2">
              {medals.map((medal, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.15 }}
                  className="bg-white/10 border border-white/20 rounded-xl p-3 flex items-center gap-3"
                >
                  <span className="text-3xl flex-shrink-0">{medal.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white text-sm">{medal.title}</p>
                    <p className="text-violet-200 text-xs">{medal.recipientDisplayName}</p>
                    <p className="text-violet-300 text-xs">{medal.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Participants */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {effectiveParticipants.slice(0, 6).map(p => (
            <div
              key={p.userId}
              className="bg-white/10 rounded-full px-3 py-1 text-xs text-violet-200"
            >
              {p.displayName}
            </div>
          ))}
        </div>
      </div>

      {/* Leave button */}
      <div className="px-6 pb-8 flex flex-col gap-3">
        {eventId && (
          <MobilePrimaryButton
            onClick={() => setLocation(`/events/${eventId}/feedback`)}
            className="w-full"
          >
            留下反馈 📝
          </MobilePrimaryButton>
        )}
        <MobilePrimaryButton
          onClick={onLeave}
          className="w-full bg-white/20 hover:bg-white/30 border-white/30 text-white"
        >
          结束今晚 👋
        </MobilePrimaryButton>
      </div>
    </div>
  );
}
