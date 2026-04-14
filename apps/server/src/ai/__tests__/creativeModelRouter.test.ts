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

  it('defaults to minimax when available and deepseek otherwise', () => {
    isMiniMaxAvailableMock.mockReturnValue(true);
    expect(getProviderForCreativeFunction('generateSocialTags')).toBe('minimax');
    expect(getProviderForCreativeFunction('generateThemeLLM')).toBe('minimax');

    isMiniMaxAvailableMock.mockReturnValue(false);
    expect(getProviderForCreativeFunction('generateSocialTags')).toBe('deepseek');
    expect(getProviderForCreativeFunction('generateEventThemeTitle')).toBe('deepseek');
  });
});