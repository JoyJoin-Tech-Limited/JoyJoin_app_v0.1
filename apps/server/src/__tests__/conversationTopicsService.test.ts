import { beforeEach, describe, expect, it, vi } from 'vitest';

const { callSocialAIMock, logAITraceMock } = vi.hoisted(() => ({
  callSocialAIMock: vi.fn(),
  logAITraceMock: vi.fn(),
}));

vi.mock('../ai/socialModelRouter', () => ({
  callSocialAI: callSocialAIMock,
}));

vi.mock('../lib/aiTraceLogger', () => ({
  logAITrace: logAITraceMock,
}));

import { generateConversationTopics } from '../conversationTopicsService';

const participants = [
  {
    displayName: '阿晴',
    archetype: 'fox',
    interests: ['美食', '摄影'],
  },
  {
    displayName: '小周',
    archetype: 'corgi',
    interests: ['美食', '旅行'],
  },
];

describe('conversationTopicsService', () => {
  beforeEach(() => {
    callSocialAIMock.mockReset();
    logAITraceMock.mockReset();
  });

  it('passes the explicit socialFunction key and traces successful AI output', async () => {
    callSocialAIMock.mockResolvedValue({
      content: JSON.stringify({
        topics: [
          {
            topic: '城市新发现',
            reason: '两个人都爱找吃的，也喜欢拍下有意思的瞬间。',
            icebreaker: '最近有没有哪家店让你想立刻带朋友再去一次？',
          },
        ],
        commonInterests: ['美食'],
      }),
      provider: 'minimax',
      model: 'minimax-m2.7',
      latencyMs: 42,
      fallbackUsed: false,
    });

    const result = await generateConversationTopics(participants, '饭局');

    expect(callSocialAIMock).toHaveBeenCalledWith(
      expect.objectContaining({
        callerTag: 'conversationTopics',
        socialFunction: 'generateConversationTopics',
      })
    );
    expect(logAITraceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        domain: 'match_explanation',
        feature: 'generateConversationTopics',
        provider: 'minimax',
        model: 'minimax-m2.7',
        success: true,
        fallbackUsed: false,
        promptVersion: 'conversation-topics-v1',
      })
    );
    expect(result.topics).toHaveLength(1);
    expect(result.commonInterests).toEqual(['美食']);
  });

  it('traces parse fallback when AI output is unusable', async () => {
    callSocialAIMock.mockResolvedValue({
      content: 'not-json',
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
      latencyMs: 18,
      fallbackUsed: true,
    });

    const result = await generateConversationTopics(participants, '酒局');

    expect(logAITraceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        domain: 'match_explanation',
        feature: 'generateConversationTopics',
        provider: 'deepseek',
        model: 'deepseek-v4-flash',
        success: false,
        fallbackUsed: true,
        promptVersion: 'conversation-topics-v1',
        errorCode: 'parse_error',
      })
    );
    expect(result.topics.length).toBeGreaterThan(0);
  });
});