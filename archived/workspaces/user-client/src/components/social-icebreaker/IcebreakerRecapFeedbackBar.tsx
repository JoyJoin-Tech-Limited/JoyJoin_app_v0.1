import { useState } from 'react';
import type { AIResponseMeta } from '@shared/types/aiMeta';
import { apiRequest } from '@/lib/queryClient';

type Rating = 'helpful' | 'neutral' | 'awkward';

export function IcebreakerRecapFeedbackBar({
  socialSessionId,
  meta,
}: {
  socialSessionId: string;
  meta?: AIResponseMeta | null;
}) {
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!meta?.promptVersion || !meta.aiCorrelationId) {
    return null;
  }

  if (done) {
    return (
      <p className="text-center text-violet-300 text-xs mb-4" data-testid="icebreaker-recap-feedback-thanks">
        感谢你的反馈
      </p>
    );
  }

  const submit = async (rating: Rating) => {
    if (busy) return;
    setBusy(true);
    try {
      await apiRequest('POST', `/api/social-icebreaker/${socialSessionId}/ai-feedback`, {
        phase: 'recap',
        promptVersion: meta.promptVersion,
        aiCorrelationId: meta.aiCorrelationId,
        rating,
      });
      setDone(true);
    } catch {
      setBusy(false);
    }
  };

  return (
    <div className="w-full max-w-sm space-y-2 mb-6" data-testid="icebreaker-recap-feedback">
      <p className="text-center text-violet-200 text-sm">这场 AI 回顾对你有帮助吗？</p>
      <div className="flex flex-wrap gap-2 justify-center">
        <button
          type="button"
          disabled={busy}
          onClick={() => void submit('helpful')}
          className="rounded-full px-4 py-2 text-sm bg-emerald-500/30 border border-emerald-400/40 text-white disabled:opacity-50"
        >
          有帮助
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void submit('neutral')}
          className="rounded-full px-4 py-2 text-sm bg-white/10 border border-white/20 text-violet-100 disabled:opacity-50"
        >
          一般
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void submit('awkward')}
          className="rounded-full px-4 py-2 text-sm bg-rose-500/25 border border-rose-400/35 text-white disabled:opacity-50"
        >
          略尴尬
        </button>
      </div>
    </div>
  );
}
