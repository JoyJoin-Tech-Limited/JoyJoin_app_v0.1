/**
 * Moment Card Payload Builder
 *
 * Builds the JSON payload for the shareable Moment Card.
 * This is consumed by:
 *   - Mini-program Canvas renderer
 *   - Web Canvas/DOM renderer
 *   - Future server-side PNG renderer
 */

import type { SocialSessionState } from '@shared/socialIcebreaker';

export interface MomentCardCastMember {
  displayName: string;
  archetype?: string;
  archetypeEmoji?: string;
}

export interface MomentCardPayload {
  version: 1;
  headline: string;
  subheadline: string;
  cast: MomentCardCastMember[];
  stats: {
    durationMinutes: number;
    phasesCompleted: number;
    totalPhases: number;
    topicsCount: number;
    challengesCount: number;
  };
  quote?: string;
  quoteAuthor?: string;
  medals: Array<{
    emoji: string;
    title: string;
    recipient: string;
  }>;
  deepLinkUrl: string;
  generatedAt: string;
}

/** Archetype visual marker — empty string per brand guideline (no generic emojis). */
function getArchetypeEmoji(archetype?: string): string {
  return '';
}

function buildDeepLink(sessionId: string): string {
  const base = process.env.APP_URL || 'https://yuejuapp.com';
  return `${base}/discover?utm_source=moment_card&utm_medium=share&utm_campaign=viral&ref_session=${encodeURIComponent(sessionId)}`;
}

function pickQuote(state: SocialSessionState): { text: string; author: string } | undefined {
  // Try to find a memorable moment from the session
  const topics = state.warmupTopics || [];
  const currentTopic = topics[state.currentTopicIndex ?? 0];
  if (currentTopic?.question) {
    return {
      text: currentTopic.question,
      author: '今晚的话题',
    };
  }
  // Fallback to a generic warm quote
  const warmQuotes = [
    { text: '从陌生到熟悉，只需要一场真诚的对话。', author: 'JoyJoin' },
    { text: '每个人都是一本书，今晚我们读到了新的章节。', author: 'JoyJoin' },
    { text: '最好的相遇，是不期而遇。', author: 'JoyJoin' },
  ];
  return warmQuotes[Math.floor(Math.random() * warmQuotes.length)];
}

export function buildMomentCardPayload(
  state: SocialSessionState,
  roster: Array<{ displayName: string; archetype?: string }>,
  recapSummary?: { headline?: string; closingLine?: string; moments?: string[] },
  medals?: Array<{ emoji: string; title: string; recipientDisplayName: string; description: string }>,
): MomentCardPayload {
  const durationMinutes = Math.round(
    (Date.now() - (state.sessionStartedAt || state.phaseStartedAt || Date.now())) / 60000
  );

  const completedPhases = state.completedPhases || [];
  const totalPhases = state.enabledPhases?.length || 5;

  const cast: MomentCardCastMember[] = roster.map((p) => ({
    displayName: p.displayName,
    archetype: p.archetype,
    archetypeEmoji: getArchetypeEmoji(p.archetype),
  }));

  const quote = pickQuote(state);

  // Build headline from recap or fallback
  let headline = recapSummary?.headline || '';
  if (!headline) {
    const playerCount = roster.length;
    headline = `${playerCount}个人，${durationMinutes}分钟，这局有点东西`;
  }

  // Build subheadline
  let subheadline = recapSummary?.closingLine || '';
  if (!subheadline) {
    subheadline = '陌生人 → 朋友，只需要一场破冰';
  }

  return {
    version: 1,
    headline,
    subheadline,
    cast,
    stats: {
      durationMinutes,
      phasesCompleted: completedPhases.length,
      totalPhases,
      topicsCount: (state.warmupTopics || []).slice(0, (state.currentTopicIndex ?? 0) + 1).length,
      challengesCount: state.challengeCompletedBy?.length || 0,
    },
    quote: quote?.text,
    quoteAuthor: quote?.author,
    medals: (medals || []).map((m) => ({
      emoji: m.emoji,
      title: m.title,
      recipient: m.recipientDisplayName,
    })),
    deepLinkUrl: buildDeepLink(state.socialSessionId),
    generatedAt: new Date().toISOString(),
  };
}
