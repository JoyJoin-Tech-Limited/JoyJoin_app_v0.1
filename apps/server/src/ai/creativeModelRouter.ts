/**
 * Creative Model Router — Phase 3 hybrid AI provider
 *
 * Controls which AI provider handles each creative/identity-facing generation
 * surface introduced in Phase 3. Provider selection is centralised here so
 * that future changes only need a single edit.
 *
 * Resolution order (per function):
 *  1. Function-level env override  (e.g. CREATIVE_AI_TAGS_PROVIDER=deepseek)
 *  2. Global creative provider     (CREATIVE_AI_PROVIDER=minimax|deepseek)
 *  3. Default: minimax if configured, otherwise deepseek
 *
 * Valid provider values: 'minimax' | 'deepseek'
 */

import { isMiniMaxAvailable } from './minimaxClient';

export type AIProvider = 'minimax' | 'deepseek';

const GLOBAL_OVERRIDE = (process.env.CREATIVE_AI_PROVIDER || '').toLowerCase() as AIProvider | '';

/**
 * Resolve the provider for a given function, applying env overrides.
 * Falls back to MiniMax when available, otherwise DeepSeek.
 */
function resolveProvider(functionOverrideEnvVar: string): AIProvider {
  // Function-level override takes highest priority
  const fnOverride = (process.env[functionOverrideEnvVar] || '').toLowerCase();
  if (fnOverride === 'minimax' || fnOverride === 'deepseek') {
    return fnOverride;
  }

  // Global creative AI provider override
  if (GLOBAL_OVERRIDE === 'minimax' || GLOBAL_OVERRIDE === 'deepseek') {
    return GLOBAL_OVERRIDE;
  }

  // Default: use MiniMax if configured
  return isMiniMaxAvailable() ? 'minimax' : 'deepseek';
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

/** Provider for social tag generation (`tagGenerationService.ts`) */
export function getTagGenerationProvider(): AIProvider {
  return resolveProvider('CREATIVE_AI_TAGS_PROVIDER');
}

/** Provider for event theme LLM generation (`themeLLMService.ts`) */
export function getThemeLLMProvider(): AIProvider {
  return resolveProvider('CREATIVE_AI_THEME_PROVIDER');
}

/** Provider for event theme title generation (`eventThemeTitleGenerator.ts`) */
export function getEventThemeTitleProvider(): AIProvider {
  return resolveProvider('CREATIVE_AI_TITLE_PROVIDER');
}
