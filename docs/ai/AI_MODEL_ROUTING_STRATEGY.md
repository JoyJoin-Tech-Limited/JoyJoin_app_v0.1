# AI Model Routing Strategy

Status: Current shipped behavior
Last updated: 2026-04-24

This document describes the AI model routing and trace behavior that is currently live in the JoyJoin server. It is intentionally current-state only. For broader architecture boundaries, read `docs/ai/ai-agent-harness-separation-strategy.md`. For future rollout ideas, read `docs/ai/AI_INTEGRATION_PLAN.md` as roadmap material only.

## DeepSeek V4 Migration

JoyJoin has migrated from deprecated DeepSeek aliases (`deepseek-chat`, `deepseek-reasoner`) to explicit DeepSeek V4 model names:

- `deepseek-v4-flash` — fast, cheap, excellent for structured JSON and high-volume tasks
- `deepseek-v4-pro` — reasoning-grade, expensive, used for complex inference and match explanations (gated)

Both models support 1M context length, JSON output, tool calls, and thinking mode.

## Current strategy

JoyJoin keeps deterministic product authority outside model calls. The server uses model routing only for copy generation, social facilitation text, explanation text, and creative theme/tag surfaces.

- MiniMax is preferred for warm, expressive social copy where narrative tone matters most.
- DeepSeek V4-Flash is preferred for structured or semantic inference, and remains the hard requirement for semantic analysis that depends on provider-specific JSON behavior.
- DeepSeek V4-Pro is used selectively for match explanations and profile inference when explicitly enabled.
- Creative surfaces are routed explicitly per function and remain env-overridable until usage and quality data justify a stricter permanent split.

## Social routing

Source of truth: `apps/server/src/ai/socialModelRouter.ts`

`SOCIAL_AI_PROVIDER` controls the social router in three modes:

- `hybrid`: use the function table below
- `minimax`: route all non-forced social functions to MiniMax when configured, otherwise fall back to DeepSeek
- `deepseek`: route all social functions to DeepSeek except the router still preserves DeepSeek-forced behavior for semantic analysis

### Function routing table

| Function | Owning surface | Hybrid default | DeepSeek Tier | Notes |
| --- | --- | --- | --- | --- |
| `generateWarmupTopics` | `apps/server/src/socialIcebreakerAIService.ts` | MiniMax | Flash non-thinking | Warm narrative copy |
| `generateXiaoYueComment` | `apps/server/src/socialIcebreakerAIService.ts` | MiniMax | Flash non-thinking | Warm narrative copy |
| `generateRecapSummary` | `apps/server/src/socialIcebreakerAIService.ts` | MiniMax | Flash non-thinking | Warm narrative copy |
| `generateLieDetectiveStatements` | `apps/server/src/socialIcebreakerAIService.ts` | MiniMax | Flash non-thinking | Warm narrative copy |
| `generateMicroChallenges` | `apps/server/src/socialIcebreakerAIService.ts` | MiniMax | Flash non-thinking | Structured game prompt output |
| `generatePersonalityDiceChallenges` | `apps/server/src/socialIcebreakerAIService.ts` | MiniMax | Flash non-thinking | Structured game prompt output |
| `generatePersonalityDiceChallengeGroups` | `apps/server/src/socialIcebreakerAIService.ts` | DeepSeek | Flash thinking, `reasoningEffort: 'high'` | V4 3-option-per-player generation |
| `generateProfileTagline` | `apps/server/src/profileTaglineService.ts` | MiniMax | Flash non-thinking | Short expressive onboarding copy |
| `generateConversationTopics` | `apps/server/src/conversationTopicsService.ts` | MiniMax | Flash non-thinking | Group conversation copy |
| `generateWelcomeMessage` | `apps/server/src/icebreakerAIService.ts` | MiniMax | Flash non-thinking | Warm facilitation copy |
| `generateClosingMessage` | `apps/server/src/icebreakerAIService.ts` | MiniMax | Flash non-thinking | Warm facilitation copy |
| `generatePairExplanation` | `apps/server/src/matchExplanationService.ts` | MiniMax | Flash thinking (Pro when `ENABLE_PRO_MATCH_EXPLANATIONS=true`) | Match narrative copy |
| `generateIceBreakers` | `apps/server/src/matchExplanationService.ts` | MiniMax | Flash non-thinking | Match narrative copy |
| `analyzeComplexSemantics` | `apps/server/src/inference/hybridSemantic.ts` | DeepSeek | Flash thinking | Forced to DeepSeek regardless of mode |

### Caller behavior

- Social helper callers that use `callSocialAI(...)` now pass an explicit `socialFunction` key when they need function-level routing.
- Legacy `callSocialAI(...)` callers without `socialFunction` still keep the old MiniMax-first behavior when MiniMax is configured.
- `analyzeComplexSemantics` is not routed through `callSocialAI(...)`; it stays on the direct forced-DeepSeek path via `getClientForFunction(...)`.

## Creative routing

Source of truth: `apps/server/src/ai/creativeModelRouter.ts`

Creative routing is explicit per function and is resolved on every call. The router does not cache the global override at import time.

### Function routing table

| Function | Owning surface | Default without overrides | Override path |
| --- | --- | --- | --- |
| `generateSocialTags` | `apps/server/src/tagGenerationService.ts` | MiniMax if configured, otherwise DeepSeek Flash | `CREATIVE_AI_TAGS_PROVIDER` |
| `generateThemeLLM` | `apps/server/src/themeLLMService.ts` | MiniMax if configured, otherwise DeepSeek Flash | `CREATIVE_AI_THEME_PROVIDER` |
| `generateEventThemeTitle` | `apps/server/src/eventThemeTitleGenerator.ts` | MiniMax if configured, otherwise DeepSeek Flash | `CREATIVE_AI_TITLE_PROVIDER` |

Global creative override order:

1. Function-specific override
2. `CREATIVE_AI_PROVIDER`
3. Default: MiniMax if available, otherwise DeepSeek Flash

## Inference routing

Source of truth: `apps/server/src/inference/llmReasoner.ts`

Profile inference uses DeepSeek V4-Pro in thinking mode (`reasoning_effort: high`) for complex Chain-of-Thought attribute extraction. This is a hardcoded path independent of the social/creative routers.

## Environment variables

### Social routing

- `SOCIAL_AI_PROVIDER`
- `MINIMAX_API_KEY`
- `MINIMAX_MODEL`
- `DEEPSEEK_API_KEY`
- `ENABLE_PRO_MATCH_EXPLANATIONS` — default `false`; set to `true` to use V4-Pro for pair explanations
- `DEEPSEEK_PRO_DAILY_BUDGET_USD` — default `5.00`; spend cap for Pro tier

### Creative routing

- `CREATIVE_AI_PROVIDER`
- `CREATIVE_AI_TAGS_PROVIDER`
- `CREATIVE_AI_THEME_PROVIDER`
- `CREATIVE_AI_TITLE_PROVIDER`
- `MINIMAX_API_KEY`
- `MINIMAX_MODEL`
- `DEEPSEEK_API_KEY`

## Trace and observability expectations

Source of truth: `apps/server/src/lib/aiTraceLogger.ts`

AI-backed server surfaces are expected to emit a single structured `[AITrace]` log line for each completed request path.

Required shape for live traced surfaces:

- `domain`
- `feature`
- `provider`
- `model` — exact model name (`deepseek-v4-flash`, `deepseek-v4-pro`, `minimax-m2.7`, etc.)
- `latencyMs`
- `success`
- `fallbackUsed`
- `fromCache`

Included when available:

- `reasoningTokens` — when DeepSeek thinking mode is enabled
- `promptVersion`

Current expectations after this routing update:

- Social helper callers using `callSocialAI(...)` log success and deterministic fallback outcomes with prompt-version tags and exact model names.
- Creative surfaces log success and final fallback outcomes, including provider-unavailable and validation-rejection paths where no AI output is accepted.
- Traces remain non-PII: no prompt text, no user text, no user identifiers.

## Current traced surfaces covered by this strategy

- `apps/server/src/profileTaglineService.ts`
- `apps/server/src/conversationTopicsService.ts`
- `apps/server/src/icebreakerAIService.ts`
- `apps/server/src/tagGenerationService.ts`
- `apps/server/src/themeLLMService.ts`
- `apps/server/src/eventThemeTitleGenerator.ts`
- `apps/server/src/matchExplanationService.ts`
- `apps/server/src/socialIcebreakerAIService.ts`
- `apps/server/src/inference/llmReasoner.ts`
- `apps/server/src/inference/hybridSemantic.ts`

## Planned next iteration backlog

Planned only, not current behavior:

- Add focused regression tests for the remaining creative trace branches beyond router coverage.
- Normalize trace domains across older AI helpers where naming still reflects historical service boundaries.
- Revisit whether creative routing should remain fully overrideable per function once provider-quality and latency data are stable.
- Evaluate Pro tier cost-effectiveness for pair explanations after 2-week shadow mode.
