/**
 * DeepSeek V4 model constants and tier resolution.
 *
 * DeepSeek has deprecated `deepseek-chat` and `deepseek-reasoner` aliases.
 * All server code should use these explicit model names.
 *
 * Pricing reference (per 1M tokens):
 *   deepseek-v4-flash: input $0.14 (cache miss), output $0.28
 *   deepseek-v4-pro:   input $1.74 (cache miss), output $3.48
 *
 * Both support 1M context length, JSON output, and tool calls.
 */

export const DEEPSEEK_V4_FLASH = 'deepseek-v4-flash';
export const DEEPSEEK_V4_PRO = 'deepseek-v4-pro';

/** Deprecated aliases — do not use in new code. */
export const DEPRECATED_DEEPSEEK_CHAT = 'deepseek-chat';
export const DEPRECATED_DEEPSEEK_REASONER = 'deepseek-reasoner';

export type DeepSeekModelTier = 'flash' | 'flash-thinking' | 'pro-thinking';

/**
 * Resolve a tier to the exact model name string.
 */
export function resolveDeepSeekModel(tier: DeepSeekModelTier): string {
  switch (tier) {
    case 'flash':
    case 'flash-thinking':
      return DEEPSEEK_V4_FLASH;
    case 'pro-thinking':
      return DEEPSEEK_V4_PRO;
  }
}

/**
 * Whether the given tier enables thinking mode.
 * Thinking mode adds a `reasoning_content` field to the response
 * and increases token usage / latency.
 */
export function isThinkingTier(tier: DeepSeekModelTier): boolean {
  return tier === 'flash-thinking' || tier === 'pro-thinking';
}

/**
 * Recommended reasoning_effort level for a tier.
 * Returns undefined for non-thinking tiers.
 *
 * @param override - Optional per-call override (e.g. 'max' for tasks that
 *   demand deeper reasoning).  When omitted, the tier default is used.
 */
export function getReasoningEffort(
  tier: DeepSeekModelTier,
  override?: 'high' | 'max',
): 'high' | 'max' | undefined {
  if (!isThinkingTier(tier)) return undefined;
  if (override) return override;
  return tier === 'pro-thinking' ? 'high' : 'high';
}

/**
 * Build the DeepSeek-specific extra_body payload for thinking mode.
 * This must be passed via `extra_body` in the OpenAI SDK.
 *
 * @param override - Optional per-call reasoning_effort override.
 */
export function buildThinkingExtraBody(
  tier: DeepSeekModelTier,
  override?: 'high' | 'max',
): { thinking?: { type: 'enabled' }; reasoning_effort?: 'high' | 'max' } | undefined {
  if (!isThinkingTier(tier)) return undefined;
  return {
    thinking: { type: 'enabled' },
    reasoning_effort: getReasoningEffort(tier, override),
  };
}
