import type { AIProvider } from '@shared/types/aiMeta';

// ============ provider 元数据归并 ============

/**
 * Collapse component-level provider signals to a single response-level provider.
 *
 * @param providers Providers reported by individual Match Intelligence
 *   components (pair explanations, ice-breakers, etc.).
 * @returns The single provider when all successful LLM-generated components
 *   came from the same provider; otherwise null for mixed-provider or
 *   no-provider responses.
 */
export function mergeProviders(...providers: AIProvider[]): AIProvider {
  const successfulProviders = Array.from(
    new Set(providers.filter((provider): provider is Exclude<AIProvider, null> => provider !== null))
  );

  if (successfulProviders.length === 1) {
    return successfulProviders[0];
  }

  return null;
}

export function didComponentUseLLM(metadata: {
  provider: AIProvider;
  fallbackUsed: boolean;
}): boolean {
  return metadata.provider !== null || metadata.fallbackUsed === false;
}
