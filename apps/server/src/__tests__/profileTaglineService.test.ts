import { beforeEach, describe, expect, it, vi } from 'vitest';

const { callSocialAIMock } = vi.hoisted(() => ({
  callSocialAIMock: vi.fn(),
}));

vi.mock('../ai/socialModelRouter', () => ({
  callSocialAI: callSocialAIMock,
}));

import { generateProfileTagline } from '../profileTaglineService';

describe('profileTaglineService', () => {
  beforeEach(() => {
    callSocialAIMock.mockReset();
  });

  it('returns fallback meta and does not call AI when no context is available', async () => {
    const result = await generateProfileTagline();

    expect(callSocialAIMock).not.toHaveBeenCalled();
    expect(result.insightLine).toBeTruthy();
    expect(result.meta.provider).toBeNull();
    expect(result.meta.fromCache).toBe(false);
    expect(result.meta.fallbackUsed).toBe(true);
    expect(result.meta.evaluatorRejectionReason).toBe('no_context');
  });

  it('returns live metadata when AI succeeds with a valid line', async () => {
    callSocialAIMock.mockResolvedValue({
      content: '你常常能把轻松的话题自然带向更有意思的交流。',
      provider: 'deepseek',
      latencyMs: 123,
    });

    const result = await generateProfileTagline({
      archetype: '机智狐',
      categoryHeat: { philosophy: 18, culture: 12 },
      intentKeys: ['make_friends', 'expand_network'],
    });

    expect(callSocialAIMock).toHaveBeenCalledTimes(1);
    expect(result.insightLine).toBe('你常常能把轻松的话题自然带向更有意思的交流。');
    expect(result.meta.provider).toBe('deepseek');
    expect(result.meta.fromCache).toBe(false);
    expect(result.meta.fallbackUsed).toBe(false);
    expect(result.meta.promptVersion).toBe('profile-tagline-v1');
    expect(result.meta.generatedAt).toEqual(expect.any(String));
  });

  it('falls back when the AI response is too long', async () => {
    callSocialAIMock.mockResolvedValue({
      content: '你'.repeat(121),
      provider: 'minimax',
      latencyMs: 88,
    });

    const result = await generateProfileTagline({
      archetype: '暖心熊',
      categoryHeat: { lifestyle: 9 },
      intentKeys: ['make_friends'],
    });

    expect(callSocialAIMock).toHaveBeenCalledTimes(1);
    expect(result.insightLine).toBeTruthy();
    expect(result.meta.provider).toBeNull();
    expect(result.meta.fallbackUsed).toBe(true);
    expect(result.meta.evaluatorRejectionReason).toBe('low_quality_score');
  });

  it('falls back when the AI call throws', async () => {
    callSocialAIMock.mockRejectedValue(new Error('provider down'));

    const result = await generateProfileTagline({
      archetype: '隐身猫',
      categoryHeat: { city: 7 },
      intentKeys: ['flexible'],
    });

    expect(callSocialAIMock).toHaveBeenCalledTimes(1);
    expect(result.insightLine).toBeTruthy();
    expect(result.meta.provider).toBeNull();
    expect(result.meta.fromCache).toBe(false);
    expect(result.meta.fallbackUsed).toBe(true);
    expect(result.meta.evaluatorRejectionReason).toBe('provider_error');
  });
});
