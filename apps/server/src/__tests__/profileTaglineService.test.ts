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
    expect(result.meta.promptVersion).toBe('profile-tagline-v1');
    expect(result.meta.evaluatorRejectionReason).toBe('no_context');
  });

  it('returns live metadata when AI succeeds with a valid line', async () => {
    callSocialAIMock.mockResolvedValue({
      content: '你常常能把轻松的话题自然带向更有意思的交流。',
      provider: 'deepseek',
      latencyMs: 123,
    });

    const result = await generateProfileTagline({
      archetype: 'fox',
      categoryHeat: { culture: 18, lifestyle: 12 },
      intentKeys: ['friends', 'networking'],
    });

    expect(callSocialAIMock).toHaveBeenCalledTimes(1);
    expect(callSocialAIMock).toHaveBeenCalledWith(
      expect.objectContaining({
        callerTag: 'profileTagline',
        socialFunction: 'generateProfileTagline',
      })
    );
    expect(result.insightLine).toBe('你常常能把轻松的话题自然带向更有意思的交流。');
    const prompt = callSocialAIMock.mock.calls[0][0].messages[0].content as string;
    expect(prompt).toContain('寻宝狐');
    expect(prompt).toContain('文化');
    expect(prompt).toContain('交新朋友');
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
      archetype: 'koala',
      categoryHeat: { lifestyle: 9 },
      intentKeys: ['friends'],
    });

    expect(callSocialAIMock).toHaveBeenCalledTimes(1);
    expect(result.insightLine).toBeTruthy();
    expect(result.meta.provider).toBeNull();
    expect(result.meta.fallbackUsed).toBe(true);
    expect(result.meta.promptVersion).toBe('profile-tagline-v1');
    expect(result.meta.evaluatorRejectionReason).toBe('low_quality_score');
  });

  it('falls back when the AI call throws', async () => {
    callSocialAIMock.mockRejectedValue(new Error('provider down'));

    const result = await generateProfileTagline({
      archetype: 'cat',
      categoryHeat: { social: 7 },
      intentKeys: ['flexible'],
    });

    expect(callSocialAIMock).toHaveBeenCalledTimes(1);
    expect(result.insightLine).toBeTruthy();
    expect(result.meta.provider).toBeNull();
    expect(result.meta.fromCache).toBe(false);
    expect(result.meta.fallbackUsed).toBe(true);
    expect(result.meta.promptVersion).toBe('profile-tagline-v1');
    expect(result.meta.evaluatorRejectionReason).toBe('provider_error');
  });
});
