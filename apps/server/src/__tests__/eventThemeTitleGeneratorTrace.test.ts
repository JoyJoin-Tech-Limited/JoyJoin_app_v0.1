import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  chatCreateMock,
  getEventThemeTitleProviderMock,
  isProviderAvailableMock,
  getMiniMaxClientMock,
  logAITraceMock,
  selectWhereMock,
  updateWhereMock,
} = vi.hoisted(() => ({
  chatCreateMock: vi.fn(),
  getEventThemeTitleProviderMock: vi.fn(),
  isProviderAvailableMock: vi.fn(),
  getMiniMaxClientMock: vi.fn(),
  logAITraceMock: vi.fn(),
  selectWhereMock: vi.fn(),
  updateWhereMock: vi.fn(),
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
  getEventThemeTitleProvider: getEventThemeTitleProviderMock,
  isProviderAvailable: isProviderAvailableMock,
}));

vi.mock('../ai/minimaxClient', () => ({
  getMiniMaxClient: getMiniMaxClientMock,
  MINIMAX_MODEL: 'minimax-m2.7',
}));

vi.mock('../lib/aiTraceLogger', () => ({
  logAITrace: logAITraceMock,
}));

vi.mock('../db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: selectWhereMock,
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: updateWhereMock,
      })),
    })),
  },
}));

import { generateAndAssignEventThemeTitle } from '../eventThemeTitleGenerator';

describe('eventThemeTitleGenerator trace coverage', () => {
  const group = {
    temperatureLevel: 'warm',
    members: [{ userId: 'user-1' }, { userId: 'user-2' }],
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    getEventThemeTitleProviderMock.mockReturnValue('deepseek');
    isProviderAvailableMock.mockReturnValue(true);
    getMiniMaxClientMock.mockReturnValue(null);
    selectWhereMock
      .mockResolvedValueOnce([
        { id: 'user-1', archetype: '开心柯基' },
        { id: 'user-2', archetype: '机智狐' },
      ])
      .mockResolvedValueOnce([
        {
          userId: 'user-1',
          selections: [{ label: '咖啡' }, { label: 'CityWalk' }],
        },
      ]);
    updateWhereMock.mockResolvedValue(undefined);
  });

  it('traces provider_unavailable before template fallback', async () => {
    isProviderAvailableMock.mockReturnValue(false);

    const result = await generateAndAssignEventThemeTitle('group-1', group, '饭局');

    expect(result).not.toBeNull();
    expect(chatCreateMock).not.toHaveBeenCalled();
    expect(logAITraceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        domain: 'theme_generation',
        feature: 'generateEventThemeTitle',
        provider: null,
        success: false,
        fallbackUsed: true,
        promptVersion: 'event-theme-title-v1',
        errorCode: 'provider_unavailable',
      }),
    );
  });

  it('traces validation_failed when AI output fails title validation', async () => {
    chatCreateMock.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            eventThemeTitle: '有效标题',
            tagline: '有效副标题',
            emoji: '⚡',
            highlights: [],
            vibe: 'playful',
          }),
        },
      }],
    });

    const result = await generateAndAssignEventThemeTitle('group-1', group, '饭局');

    expect(result).not.toBeNull();
    expect(logAITraceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'deepseek',
        model: 'deepseek-chat',
        success: false,
        fallbackUsed: true,
        promptVersion: 'event-theme-title-v1',
        errorCode: 'validation_failed',
      }),
    );
  });

  it('traces llm_error when the title provider throws before fallback', async () => {
    chatCreateMock.mockRejectedValue(new Error('provider down'));

    const result = await generateAndAssignEventThemeTitle('group-1', group, '饭局');

    expect(result).not.toBeNull();
    expect(logAITraceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'deepseek',
        model: 'deepseek-chat',
        success: false,
        fallbackUsed: true,
        promptVersion: 'event-theme-title-v1',
        errorCode: 'llm_error',
      }),
    );
  });
});
