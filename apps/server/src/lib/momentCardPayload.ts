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

/**
 * 话题留档 keepsake — the night's brave REACHED warmup topic, upgraded onto the
 * Moment Card as a designed editorial block. Additive optional field; payload
 * version stays 1 and old cached payloads still render.
 */
export interface MomentCardKeepsake {
  question: string;
  permissionLine?: string | null;
  depthLevel?: 1 | 2 | 3;
  mood?: string;
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
  keepsake?: MomentCardKeepsake;
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
  const base = process.env.APP_URL || 'https://joyjoinapp.com';
  return `${base}/discover?utm_source=moment_card&utm_medium=share&utm_campaign=viral&ref_session=${encodeURIComponent(sessionId)}`;
}

/**
 * Pick the night's keepsake topic — pure and deterministic from session state.
 *
 * Among REACHED topics only (index ≤ currentTopicIndex — a keepsake must be a
 * real memory, never an unreached card): prefer the LAST reached topic with
 * `safety === 'reflective'`; else the last reached topic; else undefined.
 */
export function pickKeepsakeTopic(state: SocialSessionState): MomentCardKeepsake | undefined {
  const topics = state.warmupTopics || [];
  if (topics.length === 0) return undefined;

  const reachedUpTo = Math.min(state.currentTopicIndex ?? 0, topics.length - 1);
  if (reachedUpTo < 0) return undefined;

  const reached = topics.slice(0, reachedUpTo + 1);
  let chosen = reached[reached.length - 1];
  for (let i = reached.length - 1; i >= 0; i--) {
    if (reached[i]?.safety === 'reflective') {
      chosen = reached[i];
      break;
    }
  }

  if (!chosen?.question) return undefined;
  return {
    question: chosen.question,
    permissionLine: chosen.permissionLine ?? null,
    depthLevel: chosen.depthLevel,
    mood: chosen.mood,
  };
}

function pickQuote(
  state: SocialSessionState,
  recapSummary?: { headline?: string; closingLine?: string; moments?: string[] },
  options?: { suppressWarmupTopic?: boolean },
): { text: string; author: string } | undefined {
  // Priority 1: standout moment from AI recap
  const standoutMoment = recapSummary?.moments?.[0];
  if (standoutMoment) {
    return {
      text: standoutMoment,
      author: '今晚的精彩瞬间',
    };
  }

  // Priority 2: current warmup topic question — suppressed when the topic was
  // upgraded into the keepsake block (the keepsake IS the quote).
  if (!options?.suppressWarmupTopic) {
    const topics = state.warmupTopics || [];
    const currentTopic = topics[state.currentTopicIndex ?? 0];
    if (currentTopic?.question) {
      return {
        text: currentTopic.question,
        author: '今晚的话题',
      };
    }
  }

  // Priority 3: deterministic warm quote seeded by session id
  const warmQuotes = [
    { text: '从陌生到熟悉，只需要一场真诚的对话。', author: 'JoyJoin' },
    { text: '每个人都是一本书，今晚我们读到了新的章节。', author: 'JoyJoin' },
    { text: '最好的相遇，是不期而遇。', author: 'JoyJoin' },
  ];
  const seed = state.socialSessionId
    ? state.socialSessionId.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
    : 0;
  return warmQuotes[seed % warmQuotes.length];
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

  const keepsake = pickKeepsakeTopic(state);
  const quote = pickQuote(state, recapSummary, { suppressWarmupTopic: !!keepsake });

  // Build headline from recap or fallback
  let headline = recapSummary?.headline || '';
  if (!headline) {
    const playerCount = roster.length;
    if (playerCount === 0) {
      headline = '今晚的局，值得记录';
    } else if (durationMinutes <= 0) {
      headline = `${playerCount}个人，这局有点东西`;
    } else {
      headline = `${playerCount}个人，${durationMinutes}分钟，这局有点东西`;
    }
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
    keepsake,
    medals: (medals || []).map((m) => ({
      emoji: m.emoji,
      title: m.title,
      recipient: m.recipientDisplayName,
    })),
    deepLinkUrl: buildDeepLink(state.socialSessionId),
    generatedAt: new Date().toISOString(),
  };
}
