import { describe, expect, it } from 'vitest';
import type { SocialTopic } from '@shared/socialIcebreaker';
import { selectWarmupTopicDeck } from '../lib/warmupServedTopics';

function topic(id: string, depthLevel?: 1 | 2 | 3, safety?: SocialTopic['safety']): SocialTopic {
  return {
    id,
    question: `question ${id}`,
    mood: 'relaxed',
    emoji: '',
    ...(depthLevel ? { depthLevel } : {}),
    ...(safety ? { safety } : {}),
  };
}

describe('warmup fallback arc', () => {
  it('uses fallback depth metadata instead of opening with a reflective card', () => {
    const result = selectWarmupTopicDeck({
      topics: [topic('legacy-1'), topic('legacy-2')],
      curatedFallbackCandidates: [
        topic('deep', 3, 'reflective'),
        topic('light', 1, 'gentle'),
        topic('mid', 2, 'open'),
      ],
      targetCount: 4,
    });

    expect(result.topics).toHaveLength(4);
    expect(result.topics[0]?.safety).not.toBe('reflective');
    const depths = result.topics.map((entry) => entry.depthLevel ?? 1);
    for (let index = 1; index < depths.length; index += 1) {
      expect(depths[index]).toBeGreaterThanOrEqual(depths[index - 1]);
    }
  });
});
