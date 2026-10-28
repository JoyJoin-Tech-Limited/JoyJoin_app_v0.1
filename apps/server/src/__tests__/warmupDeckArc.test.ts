import { describe, expect, it } from 'vitest';
import type {
  AtmosphereMood,
  SocialSessionState,
  SocialTopic,
} from '@shared/socialIcebreaker';
import type { AIResponseMeta } from '@shared/types/aiMeta';
import {
  FALLBACK_WARMUP_TOPICS,
  getCuratedWarmupTopics,
} from '../socialIcebreakerAIService';
import { commitWholeTopicSet } from '../lib/warmupTopicSetRevision';

const NOW = 1_800_000_000_000;
const MOODS: AtmosphereMood[] = ['relaxed', 'funny', 'life', 'emotional'];
const VIBES = ['chat', 'balanced', 'game'] as const;
type Vibe = (typeof VIBES)[number];
const EXPECTED_COUNT: Record<Vibe, number> = { chat: 6, balanced: 5, game: 4 };

const meta: AIResponseMeta = {
  generatedAt: new Date(NOW).toISOString(),
  fromCache: false,
  provider: 'deepseek',
  fallbackUsed: false,
};

function makeState(vibe: Vibe, mood: AtmosphereMood): SocialSessionState {
  return {
    socialSessionId: `social_arc_${vibe}_${mood}`,
    icebreakerSessionId: `arc_${vibe}_${mood}`,
    currentPhase: 'warmup',
    hostUserId: 'host',
    hostDisplayName: 'Host',
    playerCount: 6,
    phaseStartedAt: NOW,
    sessionStartedAt: NOW,
    completedPhases: [],
    vibe,
    warmupTopics: [{ id: 'legacy', question: 'Legacy', mood: mood, emoji: '' }],
    warmupTopicSetRevision: 1,
  };
}

function liveShapedDeck(vibe: Vibe, mood: AtmosphereMood): SocialTopic[] {
  const depths: Record<Vibe, Array<1 | 2 | 3>> = {
    chat: [1, 2, 2, 2, 3, 3],
    balanced: [1, 1, 2, 2, 3],
    game: [1, 1, 2, 2],
  };
  return depths[vibe].map((depthLevel, index) => ({
    id: `${vibe}-${mood}-${index}`,
    question: `${vibe} ${mood} live question ${index}`,
    mood,
    emoji: '',
    depthLevel,
    promptStyle: depthLevel === 3 ? 'reflective' : depthLevel === 2 ? 'experiential' : 'binary',
    safety: index === depths[vibe].length - 1
      ? 'reflective'
      : index === 0
        ? 'gentle'
        : 'open',
    ...(vibe === 'chat'
      ? { promptTiers: { opener: 'O', followUp: 'F', reflection: 'R' } }
      : {}),
  }));
}

function commitDeck(state: SocialSessionState, topics: SocialTopic[]): void {
  commitWholeTopicSet(state, {
    topics,
    curatedFallbackCandidates: FALLBACK_WARMUP_TOPICS,
    meta,
    provenance: 'host_manual',
    now: NOW + 1_000,
  });
}

function expectArc(deck: SocialTopic[], vibe: Vibe): void {
  expect(deck).toHaveLength(EXPECTED_COUNT[vibe]);
  expect(deck[0]?.safety).toBe('gentle');
  expect(deck[0]?.safety).not.toBe('reflective');
  const depths = deck.map((entry) => entry.depthLevel ?? 1);
  for (let index = 1; index < depths.length; index += 1) {
    expect(depths[index], `light-before-deep at card ${index}: ${depths.join(',')}`)
      .toBeGreaterThanOrEqual(depths[index - 1]);
  }
}

describe('warmup deck arc fixtures', () => {
  it.each(VIBES.flatMap((vibe) => MOODS.map((mood) => ({ vibe, mood }))))(
    'keeps live-shaped $vibe / $mood decks on the existing arc',
    ({ vibe, mood }) => {
      const state = makeState(vibe, mood);
      commitDeck(state, liveShapedDeck(vibe, mood));
      expectArc(state.warmupTopics ?? [], vibe);
    },
  );

  it.each(VIBES.flatMap((vibe) => MOODS.map((mood) => ({ vibe, mood }))))(
    'keeps curated $vibe / $mood decks on the same arc',
    ({ vibe, mood }) => {
      const state = makeState(vibe, mood);
      commitDeck(state, getCuratedWarmupTopics(mood, vibe));
      expectArc(state.warmupTopics ?? [], vibe);
    },
  );

  it('keeps a brave-safe card when served-history filtering removes the original one', () => {
    const state = makeState('balanced', 'relaxed');
    const deck = liveShapedDeck('balanced', 'relaxed');
    const servedBrave = deck[deck.length - 1];
    state.servedTopicKeys = [`id:${servedBrave.id}`, `q:${servedBrave.question}`];

    commitDeck(state, deck);

    expectArc(state.warmupTopics ?? [], 'balanced');
    expect(state.warmupTopics?.filter((entry) => entry.safety === 'reflective')).toHaveLength(1);
  });

  it('deterministically repairs a live-shaped reflective opener without dropping its only brave card', () => {
    const firstState = makeState('chat', 'life');
    const secondState = makeState('chat', 'life');
    const deck = liveShapedDeck('chat', 'life');
    const [opener, ...rest] = deck;
    const reflective = rest.pop()!;
    const reordered = [reflective, ...rest, opener];

    commitDeck(firstState, reordered);
    commitDeck(secondState, reordered.map((entry) => ({ ...entry })));

    expect(firstState.warmupTopics).toEqual(secondState.warmupTopics);
    expectArc(firstState.warmupTopics ?? [], 'chat');
    expect(firstState.warmupTopics?.filter((entry) => entry.safety === 'reflective')).toHaveLength(1);
  });
});
