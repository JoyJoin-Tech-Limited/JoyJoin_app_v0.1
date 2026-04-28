import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ThemeLLMInput } from '@shared/types/eventTheme';

const {
  chatCreateMock,
  getThemeLLMProviderMock,
  isProviderAvailableMock,
  getMiniMaxClientMock,
  logAITraceMock,
} = vi.hoisted(() => ({
  chatCreateMock: vi.fn(),
  getThemeLLMProviderMock: vi.fn(),
  isProviderAvailableMock: vi.fn(),
  getMiniMaxClientMock: vi.fn(),
  logAITraceMock: vi.fn(),
}));

vi.mock('openai', () => ({
  default: function MockOpenAI() {
    return {
      chat: {
        completions: {
          create: chatCreateMock,
        },
      },
    };
  },
}));

vi.mock('../ai/creativeModelRouter', () => ({
  getThemeLLMProvider: getThemeLLMProviderMock,
  isProviderAvailable: isProviderAvailableMock,
}));

vi.mock('../ai/minimaxClient', () => ({
  getMiniMaxClient: getMiniMaxClientMock,
  MINIMAX_MODEL: 'minimax-m2.7',
}));

vi.mock('../lib/aiTraceLogger', () => ({
  logAITrace: logAITraceMock,
}));

import { generateThemeWithLLM } from '../themeLLMService';

describe('themeLLMService trace coverage', () => {
  const input: ThemeLLMInput = {
    archetypeDynamics: 'corgi×fox',
    avgEnergy: 88,
    pattern: 'complementary',
    hometown: { city: '广州', count: 2 },
    interest: { name: '咖啡', count: 3, avgHeat: 21 },
    intent: { intent: '拓展人脉', count: 2 },
    energyProfile: {
      avgEnergy: 88,
      highCount: 2,
      mediumCount: 0,
      lowCount: 0,
      pattern: 'complementary',
    },
    eventType: '饭局',
    city: '广州',
    memberCount: 4,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    getThemeLLMProviderMock.mockReturnValue('deepseek');
    isProviderAvailableMock.mockReturnValue(true);
    getMiniMaxClientMock.mockReturnValue(null);
  });

  it('traces provider_unavailable before deterministic fallback', async () => {
    isProviderAvailableMock.mockReturnValue(false);

    const result = await generateThemeWithLLM(input, 1);

    expect(result.usedFallback).toBe(true);
    expect(result.attempt).toBe(0);
    expect(logAITraceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        domain: 'theme_generation',
        feature: 'generateThemeLLM',
        provider: null,
        success: false,
        fallbackUsed: true,
        promptVersion: 'event-theme-llm-v1',
        errorCode: 'provider_unavailable',
      }),
    );
  });

  it('traces empty_response when the final attempt returns no content', async () => {
    chatCreateMock.mockResolvedValue({
      choices: [{ message: { content: '' } }],
    });

    const result = await generateThemeWithLLM(input, 1);

    expect(result.usedFallback).toBe(true);
    expect(result.attempt).toBe(1);
    expect(result.validationErrors).toEqual(['Empty response from LLM']);
    expect(logAITraceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'deepseek',
        model: 'deepseek-v4-flash',
        success: false,
        fallbackUsed: true,
        promptVersion: 'event-theme-llm-v1',
        errorCode: 'empty_response',
      }),
    );
  });

  it('traces validation_failed when the final attempt still violates theme rules', async () => {
    chatCreateMock.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            theme: '周末聚会',
            subtitle: '普通的活动安排',
            vibe: '🔥 超高能 (88分)',
            emoji: '⚡',
          }),
        },
      }],
    });

    const result = await generateThemeWithLLM(input, 1);

    expect(result.usedFallback).toBe(true);
    expect(result.attempt).toBe(1);
    expect(result.validationErrors.length).toBeGreaterThan(0);
    expect(logAITraceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'deepseek',
        model: 'deepseek-v4-flash',
        success: false,
        fallbackUsed: true,
        promptVersion: 'event-theme-llm-v1',
        errorCode: 'validation_failed',
      }),
    );
  });

  it('traces llm_error when the provider throws on the final attempt', async () => {
    chatCreateMock.mockRejectedValue(new Error('provider down'));

    const result = await generateThemeWithLLM(input, 1);

    expect(result.usedFallback).toBe(true);
    expect(result.attempt).toBe(1);
    expect(result.validationErrors[0]).toContain('LLM error: Error: provider down');
    expect(logAITraceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'deepseek',
        model: 'deepseek-v4-flash',
        success: false,
        fallbackUsed: true,
        promptVersion: 'event-theme-llm-v1',
        errorCode: 'llm_error',
      }),
    );
  });
});
