/**
 * AI model constants, tier resolution, and thinking-mode helpers.
 *
 * Covers the active model pool used for agent execution and server-side
 * product AI services:
 *   - DeepSeek V4 Flash / Pro (default coding model)
 *   - Kimi K2.6 (Moonshot AI — multi-file coordination)
 *   - GLM 5.1 (Zhipu AI / Z.AI — systems engineering)
 *
 * Pricing reference (per 1M tokens):
 *   DeepSeek V4 Flash: input $0.14 (cache miss), output $0.28 — 1M context
 *   DeepSeek V4 Pro:   input $1.74 (cache miss), output $3.48 — 1M context
 *   Kimi K2.6:         input $0.16 (cache hit) / $0.95 (cache miss), output $4.00 — 256K context
 *   GLM 5.1:           Z.AI Coding Plan subscription (~1% of standard API pricing) — ~128K context
 */

// ═══════════════════════════════════════════════════════════════════════════════
// DeepSeek V4
// ═══════════════════════════════════════════════════════════════════════════════

export const DEEPSEEK_V4_FLASH = 'deepseek-v4-flash';
export const DEEPSEEK_V4_PRO = 'deepseek-v4-pro';

/** Deprecated aliases — do not use in new code. */
export const DEPRECATED_DEEPSEEK_CHAT = 'deepseek-chat';
export const DEPRECATED_DEEPSEEK_REASONER = 'deepseek-reasoner';

export type DeepSeekModelTier = 'flash' | 'flash-thinking' | 'pro-thinking';

/**
 * Resolve a DeepSeek tier to the exact model name string.
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
 * Whether the given DeepSeek tier enables thinking mode.
 */
export function isDeepSeekThinkingTier(tier: DeepSeekModelTier): boolean {
  return tier === 'flash-thinking' || tier === 'pro-thinking';
}

/** @deprecated Use isDeepSeekThinkingTier */
export const isThinkingTier = isDeepSeekThinkingTier;

// ═══════════════════════════════════════════════════════════════════════════════
// Kimi K2.6 (Moonshot AI)
// ═══════════════════════════════════════════════════════════════════════════════

export const KIMI_K26 = 'kimi-k2.6';

/** @deprecated Use KIMI_K26. Kimi K2 is being discontinued May 2026. */
export const KIMI_K2_DEPRECATED = 'kimi-k2-0905-preview';
export const KIMI_K2_THINKING_DEPRECATED = 'kimi-k2-thinking';

export type KimiModelTier = 'k26' | 'k26-thinking';

/**
 * Resolve a Kimi tier to the exact model name string.
 * Kimi K2.6 uses toggleable thinking mode — the thinking variant
 * enables interleaved reasoning between tool call steps.
 */
export function resolveKimiModel(tier: KimiModelTier): string {
  return KIMI_K26; // Single model ID, thinking toggled via extra_body
}

/**
 * Whether the Kimi tier enables thinking mode.
 * Kimi's thinking mode supports interleaved reasoning between
 * tool call steps within a single turn (Agent Swarm compatible).
 */
export function isKimiThinkingTier(tier: KimiModelTier): boolean {
  return tier === 'k26-thinking';
}

/**
 * Build Kimi-specific thinking mode configuration.
 * Kimi uses a toggle rather than reasoning_effort levels.
 */
export function buildKimiThinkingConfig(
  tier: KimiModelTier,
): { thinking?: { type: 'enabled' } } | undefined {
  if (!isKimiThinkingTier(tier)) return undefined;
  return { thinking: { type: 'enabled' } };
}

/**
 * Maximum context length for Kimi K2.6.
 * 256K tokens — sufficient for moderate repo analysis but
 * not full-monorepo passes.
 */
export const KIMI_MAX_CONTEXT_TOKENS = 262_144;

// ═══════════════════════════════════════════════════════════════════════════════
// GLM 5.1 (Zhipu AI / Z.AI)
// ═══════════════════════════════════════════════════════════════════════════════

export const GLM_51_FP8 = 'glm-5.1-fp8';
export const GLM_5_FP8 = 'glm-5-fp8';

export type GlmModelTier = 'glm5' | 'glm51' | 'glm5-reasoning' | 'glm51-reasoning';

/**
 * Resolve a GLM tier to the exact model name string.
 */
export function resolveGlmModel(tier: GlmModelTier): string {
  switch (tier) {
    case 'glm5':
    case 'glm5-reasoning':
      return GLM_5_FP8;
    case 'glm51':
    case 'glm51-reasoning':
      return GLM_51_FP8;
  }
}

/**
 * Whether the GLM tier enables reasoning mode.
 * GLM uses a server-side reasoning parser (--reasoning-parser glm45),
 * not per-request reasoning_effort like DeepSeek.
 */
export function isGlmReasoningTier(tier: GlmModelTier): boolean {
  return tier === 'glm5-reasoning' || tier === 'glm51-reasoning';
}

/**
 * Maximum context length for GLM 5.1.
 * ~128K tokens with DeepSeek Sparse Attention (DSA) for efficiency.
 */
export const GLM_MAX_CONTEXT_TOKENS = 131_072;

// ═══════════════════════════════════════════════════════════════════════════════
// Unified model pool (for agent execution routing)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Agent execution model identifiers.
 * Used by Planner / Supervisor for model recommendations and
 * by the tool-input repair layer for per-model telemetry.
 */
export type AgentModelId =
  | typeof DEEPSEEK_V4_FLASH
  | typeof DEEPSEEK_V4_PRO
  | typeof KIMI_K26
  | typeof GLM_51_FP8
  | typeof GLM_5_FP8;

/**
 * All active agent execution model constants as an array.
 */
export const AGENT_MODEL_IDS: readonly AgentModelId[] = [
  DEEPSEEK_V4_FLASH,
  DEEPSEEK_V4_PRO,
  KIMI_K26,
  GLM_51_FP8,
  GLM_5_FP8,
] as const;

/**
 * Context window sizes for agent execution models.
 */
export const AGENT_MODEL_CONTEXTS: Record<AgentModelId, number> = {
  [DEEPSEEK_V4_FLASH]: 1_000_000,
  [DEEPSEEK_V4_PRO]: 1_000_000,
  [KIMI_K26]: KIMI_MAX_CONTEXT_TOKENS,
  [GLM_51_FP8]: GLM_MAX_CONTEXT_TOKENS,
  [GLM_5_FP8]: GLM_MAX_CONTEXT_TOKENS,
};

/**
 * Recommended reasoning_effort level for a DeepSeek tier.
 * Flash defaults to 'medium' (cost-efficient); Pro defaults to 'high'.
 * Returns undefined for non-thinking tiers.
 */
export function getReasoningEffort(
  tier: DeepSeekModelTier,
  override?: 'medium' | 'high' | 'max',
): 'medium' | 'high' | 'max' | undefined {
  if (!isDeepSeekThinkingTier(tier)) return undefined;
  if (override) return override;
  return tier === 'pro-thinking' ? 'high' : 'medium';
}

/**
 * Build the DeepSeek-specific extra_body payload for thinking mode.
 */
export function buildThinkingExtraBody(
  tier: DeepSeekModelTier,
  override?: 'medium' | 'high' | 'max',
): { thinking?: { type: 'enabled' }; reasoning_effort?: 'medium' | 'high' | 'max' } | undefined {
  if (!isDeepSeekThinkingTier(tier)) return undefined;
  return {
    thinking: { type: 'enabled' },
    reasoning_effort: getReasoningEffort(tier, override),
  };
}

/**
 * Check whether a model ID is one of the known agent execution models.
 */
export function isKnownAgentModel(modelId: string): modelId is AgentModelId {
  return (AGENT_MODEL_IDS as readonly string[]).includes(modelId);
}
