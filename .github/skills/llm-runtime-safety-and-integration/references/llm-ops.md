# LLM Operations Reference

## Prompt Versioning Specifics

Thread `promptVersion` through the response or cache metadata so future debugging can distinguish old and new prompt templates.

```ts
// Example trace payload
{
  promptVersion: "social-lie-detective-v1.2",
  generatedAt: new Date().toISOString(),
  fromCache: false,
  fallbackUsed: false,
}
```

Rules:
- Use semantic versioning (`social-auction-lots-v1`, `social-auction-lots-v1.1`)
- Bump version when prompt text, schema constraints, or temperature changes
- Persist version in cache keys and trace logs

## AITrace Logging Format

Use `logAITrace(...)` from `apps/server/src/lib/aiTraceLogger.ts`.

Required fields (non-PII):
- `provider` — which model provider served the request
- `latencyMs` — round-trip time
- `success` — boolean
- `promptVersion` — string
- `fallbackUsed` — boolean

Optional fields:
- `fromCache` — boolean
- `generatedAt` — ISO timestamp
- `modelName` — specific model identifier
- `tokenUsage` — input / output counts when available

Example:
```ts
logAITrace({
  feature: "matchExplanation",
  provider: "deepseek",
  latencyMs: 840,
  success: true,
  promptVersion: "match-explain-v2",
  fallbackUsed: false,
});
```

## Shadow Mode Setup

Shadow-mode inference is non-authoritative and isolated from live deterministic output.

1. Run the new prompt in parallel with the live path
2. Log trace metadata for both paths
3. Store shadow output in a separate column or table
4. Compare shadow vs live output offline before clearing the rollout gate
5. Do not gate deterministic logic on shadow output

## Cache Metadata Rules

- Cache keys must include `promptVersion` so template changes invalidate stale cache entries
- TTL should be feature-appropriate: social icebreaker content (short), match explanations (medium), profile taglines (longer)
- Document `fromCache: true` in traces so reviewers can distinguish cached vs fresh output
- Do not cache PII or user-generated content without explicit policy approval

## socialModelRouter Config

`apps/server/src/ai/socialModelRouter.ts` is the main routed entry for social-experience AI calls.

- **Purpose:** Route social icebreaker, match explanation, and personality content to the appropriate provider
- **Fallback chain:** Primary provider → secondary provider → deterministic fallback content
- **Do not** instantiate ad-hoc clients in route handlers; always route through the approved service boundary

## creativeModelRouter Config

`apps/server/src/ai/creativeModelRouter.ts` owns marketing copy, asset descriptions, and creative variant generation.

- Keep creative generation separate from social/product authority
- Creative output must be reviewed before automatic publication

## Current Repo Anchors

- `apps/server/src/ai/socialModelRouter.ts`
- `apps/server/src/ai/creativeModelRouter.ts`
- `apps/server/src/lib/aiTraceLogger.ts`
- `apps/server/src/matchExplanationService.ts`
- `apps/server/src/socialIcebreakerAIService.ts`
- `apps/server/src/profileTaglineService.ts`
- `apps/server/src/inference/runtimeLLMFallback.ts`
- `apps/server/src/inference/llmFallbackInference.ts`
