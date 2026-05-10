/**
 * Creative Model Router — DeepSeek V4 primary
 *
 * Controls which AI provider handles each creative/identity-facing generation
 * surface. Provider selection is centralised here so that future changes only
 * need a single edit.
 *
 * Resolution order (per function):
 *  1. Function-level env override  (e.g. CREATIVE_AI_TAGS_PROVIDER=minimax)
 *  2. Global creative provider     (CREATIVE_AI_PROVIDER=minimax|deepseek)
 *  3. Default: deepseek
 *
 * Valid provider values: 'minimax' | 'deepseek'
 */

import { isMiniMaxAvailable } from './minimaxClient';

export type AIProvider = 'minimax' | 'deepseek';

export type CreativeFunction =
  | 'generateSocialTags'
  | 'generateThemeLLM'
  | 'generateEventThemeTitle';

const CREATIVE_FUNCTION_ENV_OVERRIDES: Record<CreativeFunction, string> = {
  generateSocialTags: 'CREATIVE_AI_TAGS_PROVIDER',
  generateThemeLLM: 'CREATIVE_AI_THEME_PROVIDER',
  generateEventThemeTitle: 'CREATIVE_AI_TITLE_PROVIDER',
};

function parseProviderOverride(rawValue: string | undefined): AIProvider | null {
  const normalizedValue = (rawValue || '').toLowerCase();
  if (normalizedValue === 'minimax' || normalizedValue === 'deepseek') {
    return normalizedValue;
  }

  return null;
}

/**
 * Resolve the provider for a given function, applying env overrides.
 * Defaults to DeepSeek.
 */
function resolveProvider(fn: CreativeFunction): AIProvider {
  const functionOverrideEnvVar = CREATIVE_FUNCTION_ENV_OVERRIDES[fn];

  // Function-level override takes highest priority
  const fnOverride = parseProviderOverride(process.env[functionOverrideEnvVar]);
  if (fnOverride) {
    return fnOverride;
  }

  // Global creative AI provider override
  const globalOverride = parseProviderOverride(process.env.CREATIVE_AI_PROVIDER);
  if (globalOverride) {
    return globalOverride;
  }

  // Default: use DeepSeek
  return 'deepseek';
}

/**
 * Returns true if the given provider is currently configured and available.
 */
export function isProviderAvailable(provider: AIProvider): boolean {
  if (provider === 'minimax') {
    return isMiniMaxAvailable();
  }
  return Boolean(process.env.DEEPSEEK_API_KEY);
}

export function getProviderForCreativeFunction(fn: CreativeFunction): AIProvider {
  return resolveProvider(fn);
}

/** Provider for social tag generation (`tagGenerationService.ts`) */
export function getTagGenerationProvider(): AIProvider {
  return getProviderForCreativeFunction('generateSocialTags');
}

/** Provider for event theme LLM generation (`themeLLMService.ts`) */
export function getThemeLLMProvider(): AIProvider {
  return getProviderForCreativeFunction('generateThemeLLM');
}

/** Provider for event theme title generation (`eventThemeTitleGenerator.ts`) */
export function getEventThemeTitleProvider(): AIProvider {
  return getProviderForCreativeFunction('generateEventThemeTitle');
}
