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
 *  3. Default: DeepSeek, including personal-story chapters, with runtime
 *     cross-provider failover to MiniMax.
 *
 * Valid provider values: 'minimax' | 'deepseek'
 */

import {
  getMiniMaxClient,
  getMinimaxModel,
  isMiniMaxAvailable,
} from './minimaxClient';
import { getDeepseekClient, getDeepseekModel } from './deepseekClient';
import { logger } from '../lib/logger';

export type AIProvider = 'minimax' | 'deepseek';

export type CreativeFunction =
  | 'generateSocialTags'
  | 'generateThemeLLM'
  | 'generateEventThemeTitle'
  | 'generatePersonalNovelChapter';

const CREATIVE_FUNCTION_ENV_OVERRIDES: Record<CreativeFunction, string> = {
  generateSocialTags: 'CREATIVE_AI_TAGS_PROVIDER',
  generateThemeLLM: 'CREATIVE_AI_THEME_PROVIDER',
  generateEventThemeTitle: 'CREATIVE_AI_TITLE_PROVIDER',
  generatePersonalNovelChapter: 'CREATIVE_AI_PERSONAL_STORY_PROVIDER',
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

export interface CreativeAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CreativeAICallOptions {
  fn: CreativeFunction;
  messages: CreativeAIMessage[];
  temperature?: number;
  maxTokens?: number;
  jsonObject?: boolean;
  timeoutMs?: number;
  /**
   * Optional owning-domain evaluator. A non-empty provider response is not a
   * successful call until this validator accepts its schema and grounding.
   * Rejection is failover-eligible and never returns the rejected content.
   */
  validateContent?: (content: string) => CreativeAIContentValidation;
}

export interface CreativeAIContentValidation {
  valid: boolean;
  /** Bounded, non-PII code used only for operational logs. */
  errorCode?: string;
}

export interface CreativeAICallResult {
  content: string;
  provider: AIProvider;
  model: string;
  latencyMs: number;
  fallbackUsed: boolean;
}

function getProviderRuntime(provider: AIProvider): {
  client: ReturnType<typeof getDeepseekClient>;
  model: string;
} | null {
  if (!isProviderAvailable(provider)) return null;

  if (provider === 'minimax') {
    const client = getMiniMaxClient();
    return client ? { client, model: getMinimaxModel() } : null;
  }

  return {
    client: getDeepseekClient(),
    model: getDeepseekModel('flash'),
  };
}

/**
 * Execute a creative call with real cross-provider failover. Prompts and model
 * output are intentionally never logged here; the owning domain emits its
 * non-PII AI trace after validating the result.
 */
export async function callCreativeAI(
  options: CreativeAICallOptions,
): Promise<CreativeAICallResult> {
  const primaryProvider = resolveProvider(options.fn);
  const providers: AIProvider[] = [
    primaryProvider,
    primaryProvider === 'minimax' ? 'deepseek' : 'minimax',
  ];
  const startedAt = Date.now();
  let lastError: unknown = null;
  let contentRejectionCount = 0;
  let providerFailureCount = 0;

  for (const [index, provider] of providers.entries()) {
    const runtime = getProviderRuntime(provider);
    if (!runtime) continue;

    try {
      const response = await runtime.client.chat.completions.create(
        {
          model: runtime.model,
          messages: options.messages,
          temperature: options.temperature ?? 0.2,
          max_tokens: options.maxTokens ?? 700,
          ...(options.jsonObject
            ? { response_format: { type: 'json_object' as const } }
            : {}),
        },
        { signal: AbortSignal.timeout(options.timeoutMs ?? 20_000) },
      );

      const content = response.choices[0]?.message?.content?.trim();
      if (!content) {
        throw new Error('CREATIVE_AI_EMPTY_RESPONSE');
      }

      const validation = options.validateContent?.(content);
      if (validation && !validation.valid) {
        contentRejectionCount += 1;
        logger.warn('[CreativeModelRouter] Provider content rejected', {
          feature: options.fn,
          provider,
          errorCode: validation.errorCode || 'content_rejected',
        });
        continue;
      }

      return {
        content,
        provider,
        model: runtime.model,
        latencyMs: Date.now() - startedAt,
        fallbackUsed: index > 0,
      };
    } catch (error) {
      lastError = error;
      providerFailureCount += 1;
      logger.warn('[CreativeModelRouter] Provider call failed', {
        feature: options.fn,
        provider,
        errorCode:
          error instanceof Error && error.name === 'TimeoutError'
            ? 'timeout'
            : 'provider_error',
      });
    }
  }

  if (contentRejectionCount > 0 && providerFailureCount === 0) {
    throw new Error('CREATIVE_AI_ALL_RESPONSES_REJECTED');
  }
  if (!lastError) {
    throw new Error('CREATIVE_AI_PROVIDER_UNAVAILABLE');
  }
  throw new Error('CREATIVE_AI_ALL_PROVIDERS_FAILED', { cause: lastError });
}
