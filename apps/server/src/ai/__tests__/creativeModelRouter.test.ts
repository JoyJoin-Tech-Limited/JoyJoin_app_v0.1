import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { isMiniMaxAvailableMock } = vi.hoisted(() => ({
  isMiniMaxAvailableMock: vi.fn(),
}));

vi.mock('../minimaxClient', () => ({
  isMiniMaxAvailable: isMiniMaxAvailableMock,
}));

import {
  getEventThemeTitleProvider,
  getProviderForCreativeFunction,
  getTagGenerationProvider,
  getThemeLLMProvider,
} from '../creativeModelRouter';

describe('creativeModelRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isMiniMaxAvailableMock.mockReturnValue(false);
    delete process.env.CREATIVE_AI_PROVIDER;
    delete process.env.CREATIVE_AI_TAGS_PROVIDER;
    delete process.env.CREATIVE_AI_THEME_PROVIDER;
    delete process.env.CREATIVE_AI_TITLE_PROVIDER;
  });

  afterEach(() => {
    delete process.env.CREATIVE_AI_PROVIDER;
    delete process.env.CREATIVE_AI_TAGS_PROVIDER;
    delete process.env.CREATIVE_AI_THEME_PROVIDER;
    delete process.env.CREATIVE_AI_TITLE_PROVIDER;
  });

  it('lets function-level override beat the global override', () => {
    process.env.CREATIVE_AI_PROVIDER = 'minimax';
    process.env.CREATIVE_AI_TAGS_PROVIDER = 'deepseek';
    isMiniMaxAvailableMock.mockReturnValue(true);

    expect(getTagGenerationProvider()).toBe('deepseek');
    expect(getThemeLLMProvider()).toBe('minimax');
  });

  it('resolves the global override dynamically on each call instead of caching it at import time', () => {
    process.env.CREATIVE_AI_PROVIDER = 'minimax';
    expect(getEventThemeTitleProvider()).toBe('minimax');

    process.env.CREATIVE_AI_PROVIDER = 'deepseek';
    expect(getEventThemeTitleProvider()).toBe('deepseek');
  });

  it('defaults to deepseek as the primary provider', () => {
    expect(getProviderForCreativeFunction('generateSocialTags')).toBe('deepseek');
    expect(getProviderForCreativeFunction('generateThemeLLM')).toBe('deepseek');
    expect(getProviderForCreativeFunction('generateEventThemeTitle')).toBe('deepseek');

    // MiniMax available does not change the default
    isMiniMaxAvailableMock.mockReturnValue(true);
    expect(getProviderForCreativeFunction('generateSocialTags')).toBe('deepseek');
  });
});
