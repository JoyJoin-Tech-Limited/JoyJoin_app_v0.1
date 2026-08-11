# AI Model Routing Strategy

Status: Current shipped behavior
Last updated: 2026-08-11

This document describes the AI model routing and trace behavior that is currently live in the JoyJoin server. It is intentionally current-state only. For broader architecture boundaries, read `docs/ai/ai-agent-harness-separation-strategy.md`. For future rollout ideas, read `docs/ai/AI_INTEGRATION_PLAN.md` as roadmap material only.

## DeepSeek V4 Migration

JoyJoin has migrated from deprecated DeepSeek aliases (`deepseek-chat`, `deepseek-reasoner`) to explicit DeepSeek V4 model names:

- `deepseek-v4-flash` — fast, cheap, excellent for structured JSON and high-volume tasks
- `deepseek-v4-pro` — reasoning-grade, expensive, used for complex inference and match explanations (gated)

Both models support 1M context length, JSON output, tool calls, and thinking mode.

## DeepSeek V4 thinking control (2026-08-11 — transport-level fix)

`deepseek-v4-flash` **reasons by default** when a request carries no thinking control. An unconstrained chain burns the completion budget on `reasoning_content` and returns **empty or truncated `message.content`** at production `max_tokens` budgets (100–500), and thinking + `reasoning_effort: high` stretches simple JSON tasks to 11–15s — beyond the 6s icebreaker `raceWithTimeout` bound. Before 2026-08-11 every DeepSeek-routed surface silently fell back to curated/deterministic content.

Current controls:

- **`buildThinkingExtraBody('flash')`** (`packages/shared/src/aiModels.ts`) now returns `{ thinking: { type: 'disabled' } }` — non-thinking tiers explicitly disable reasoning.
- **`getDeepseekClient()`** (`apps/server/src/ai/deepseekClient.ts`) wraps `chat.completions.create` and injects a **top-level** `thinking: { type: 'disabled' }` into any request that does not already carry thinking control (top-level or in `extra_body`). Every direct call site (icebreaker service, miniscript, match explanations, creative router, industry classifier) is covered by this default.
- **Thinking control must be top-level in the request body.** The openai-node SDK build in use does **not serialize `extra_body`** — neither as a body key nor as RequestOptions (verified with live probes 2026-08-11). `body.thinking` / `body.reasoning_effort` are the only fields that reach DeepSeek.
- `thinking: { type: 'disabled' }` combined with `reasoning_effort: 'low'` is accepted by the API and produces direct content (0 reasoning tokens) — the `xiaoyueAnalysisService` workaround remains valid.

Benchmark: `apps/server/src/benchmarks/socialAIBenchmark.cli.ts` is the regression harness. **It does not load `.env`** — always run with `npx tsx --env-file=.env apps/server/src/benchmarks/socialAIBenchmark.cli.ts`, otherwise the placeholder key produces confusing `401 ... ****back is invalid` failures.

## Current strategy

JoyJoin keeps deterministic product authority outside model calls. The server uses model routing only for copy generation, social facilitation text, explanation text, and creative theme/tag surfaces.

- **DeepSeek V4-Flash (thinking disabled) is preferred for all social functions** — comments, structured JSON, and narrative copy. Fastest path and the default hybrid-mode provider.
- **MiniMax is an explicit override** (`SOCIAL_AI_PROVIDER=minimax`) rather than a hybrid default; when MiniMax is not configured or fails, DeepSeek handles the request.
- **DeepSeek V4-Pro is used selectively** for pair explanations when `ENABLE_PRO_MATCH_EXPLANATIONS=true` (budget-gated via `deepseekBudgetTracker`).
- **Thinking mode is opt-in and reserved for genuinely analytical tasks** — only `analyzeComplexSemantics` (forced DeepSeek, `flash-thinking` + `reasoning_effort: max`). Everything else routes flash with thinking disabled.
- Creative surfaces are routed explicitly per function and remain env-overridable until usage and quality data justify a stricter permanent split.

## Social routing

Source of truth: `apps/server/src/ai/socialModelRouter.ts`

`SOCIAL_AI_PROVIDER` controls the social router in three modes:

- `hybrid` (default): DeepSeek for all functions per the table below (all functions are DeepSeek-preferred)
- `minimax`: route all non-forced social functions to MiniMax when configured, otherwise fall back to DeepSeek
- `deepseek`: route all social functions to DeepSeek except the router still preserves DeepSeek-forced behavior for semantic analysis

### Function routing table

| Function | Owning surface | Hybrid default | DeepSeek Tier | Notes |
| --- | --- | --- | --- | --- |
| `generateWarmupTopics` | `apps/server/src/socialIcebreakerAIService.ts` | DeepSeek | Flash (thinking disabled) | JSON topic questions |
| `generateXiaoYueComment` | `apps/server/src/socialIcebreakerAIService.ts` | DeepSeek | Flash (thinking disabled) | Real-time short comments |
| `generateXiaoyueAdaptiveSuggestion` | `apps/server/src/socialIcebreakerAIService.ts` | DeepSeek | Flash (thinking disabled) | — |
| `generateMomentHighlights` | `apps/server/src/socialIcebreakerAIService.ts` | DeepSeek | Flash (thinking disabled) | Recap-style highlights JSON |
| `generateRecapSummary` | `apps/server/src/socialIcebreakerAIService.ts` | DeepSeek | Flash (thinking disabled) | Recap summary JSON |
| `generateLieDetectiveStatements` | `apps/server/src/socialIcebreakerAIService.ts` | DeepSeek | Flash (thinking disabled) | Two-truths-one-lie JSON |
| `generateMicroChallenges` | `apps/server/src/socialIcebreakerAIService.ts` | DeepSeek | Flash (thinking disabled) | Structured game prompt output |
| `generatePersonalityDiceChallenges` | `apps/server/src/socialIcebreakerAIService.ts` | DeepSeek | Flash (thinking disabled) | Structured game prompt output |
| `generatePersonalityDiceChallengeGroups` | `apps/server/src/socialIcebreakerAIService.ts` | DeepSeek | Flash (thinking disabled) | V4 3-option-per-player generation |
| `generateAuctionLots` | `apps/server/src/socialIcebreakerAIService.ts` | DeepSeek | Flash (thinking disabled) | Auction lots JSON |
| `generateXiaoyueSessionPack` | `apps/server/src/socialIcebreakerAIService.ts` | DeepSeek | Flash (thinking disabled) | Session pack JSON |
| `generateQuipBattlePrompts` | `apps/server/src/socialIcebreakerAIService.ts` | DeepSeek | Flash (thinking disabled) | Creative fill-in-the-blank |
| `generateUndercoverWordPair` | `apps/server/src/socialIcebreakerAIService.ts` | DeepSeek | Flash (thinking disabled) | Word-pair generation |
| `generateGroupMirrorQuestions` | `apps/server/src/socialIcebreakerAIService.ts` | DeepSeek | Flash (thinking disabled) | Question generation |
| `generateWelcomeMessage` | `apps/server/src/icebreakerAIService.ts` | DeepSeek | Flash (thinking disabled) | Warm facilitation copy |
| `generateClosingMessage` | `apps/server/src/icebreakerAIService.ts` | DeepSeek | Flash (thinking disabled) | Warm facilitation copy |
| `generateProfileTagline` | `apps/server/src/profileTaglineService.ts` | DeepSeek | Flash (thinking disabled) | Short expressive onboarding copy; prompt injects `XIAOYUE_CRAFT_LITE` |
| `generatePoolCardHeadline` | pool card AI headline | DeepSeek | Flash (thinking disabled) | Creative copy |
| `generateConversationTopics` | `apps/server/src/conversationTopicsService.ts` | DeepSeek | Flash (thinking disabled) | Group conversation copy |
| `generatePairExplanation` | `apps/server/src/matchExplanationService.ts` | DeepSeek | Flash (thinking disabled); Pro-thinking only when `ENABLE_PRO_MATCH_EXPLANATIONS=true` (budget-gated) | Match narrative copy |
| `generateIceBreakers` | `apps/server/src/matchExplanationService.ts` | DeepSeek | Flash (thinking disabled) | Match narrative copy |
| `generateMiniScriptFramework` | `apps/server/src/socialIcebreakerMiniScriptAI.ts` | DeepSeek | Flash (thinking disabled) | 迷你剧本杀 framework JSON, `max_tokens: 4096` |
| `analyzeComplexSemantics` | `apps/server/src/inference/hybridSemantic.ts` | DeepSeek | Flash-thinking + `reasoning_effort: max` | **Forced** to DeepSeek regardless of mode; the only thinking-tier social function |

### Caller behavior

- Social helper callers that use `callSocialAI(...)` pass an explicit `socialFunction` key when they need function-level routing.
- `callSocialAI(...)` without `socialFunction` uses a plain DeepSeek flash selection (thinking disabled); MiniMax is not engaged on this path.
- `analyzeComplexSemantics` is not routed through `callSocialAI(...)`; it stays on the direct forced-DeepSeek path via `getClientForFunction(...)`.
- Callers that invoke `client.chat.completions.create` directly after `getClientForFunction(...)` rely on the `getDeepseekClient()` wrapper to inject `thinking: disabled` — thinking-tier callers must pass top-level `thinking`/`reasoning_effort` themselves (see the thinking-control section above).

## Creative routing

Source of truth: `apps/server/src/ai/creativeModelRouter.ts`

Creative routing is explicit per function and is resolved on every call. The router does not cache the global override at import time.

### Function routing table

| Function | Owning surface | Default without overrides | Override path |
| --- | --- | --- | --- |
| `generateSocialTags` | `apps/server/src/tagGenerationService.ts` | DeepSeek Flash (thinking disabled), MiniMax failover | `CREATIVE_AI_TAGS_PROVIDER` |
| `generateThemeLLM` | `apps/server/src/themeLLMService.ts` | DeepSeek Flash (thinking disabled), MiniMax failover | `CREATIVE_AI_THEME_PROVIDER` |
| `generateEventThemeTitle` | `apps/server/src/eventThemeTitleGenerator.ts` | DeepSeek Flash (thinking disabled), MiniMax failover | `CREATIVE_AI_TITLE_PROVIDER` |
| `generatePersonalNovelChapter` | personal-story chapter worker | DeepSeek Flash, MiniMax failover | `CREATIVE_AI_PERSONAL_STORY_PROVIDER` |
| `generateFlashPersonalizedDialogue` | Flash NPC dialogue | DeepSeek Flash, MiniMax failover | `CREATIVE_AI_FLASH_STORY_PROVIDER` |

Global creative override order:

1. Function-specific override
2. `CREATIVE_AI_PROVIDER`
3. Default: DeepSeek Flash (thinking disabled), with runtime cross-provider failover to MiniMax when available

## Inference routing

Source of truth: `apps/server/src/inference/llmReasoner.ts`

Profile inference (Xiaoyue attribute extraction) is a hardcoded path independent of the social/creative routers. It uses `pro-thinking` (thinking enabled, `reasoning_effort: high`) when the Pro daily budget is available, otherwise `flash` with thinking disabled. Budget-gated via `deepseekBudgetTracker`.

## Environment variables

### Social routing

- `SOCIAL_AI_PROVIDER` — `hybrid` (default) | `minimax` | `deepseek`
- `SOCIAL_DEFAULT_REASONING_EFFORT` — optional `high` | `max` global override for thinking-tier calls
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
- `CREATIVE_AI_PERSONAL_STORY_PROVIDER`
- `CREATIVE_AI_FLASH_STORY_PROVIDER`
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
