# Production AI surfaces (Social Icebreaker)

Audit map for **in-event** LLM-backed behaviour: server generators, HTTP entrypoints, `promptVersion` strings (see `apps/server/src/socialIcebreakerAIService.ts` and `MINI_SCRIPT_FRAMEWORK_PROMPT_VERSION`), and `logAITrace` (`domain` / `feature`) from `apps/server/src/lib/aiTraceLogger.ts`.

**Provider routing:** `apps/server/src/ai/socialModelRouter.ts` (`callSocialAI`, `getClientForFunction`, `SOCIAL_AI_PROVIDER`). **Governance:** [llm-runtime-safety-and-integration](../../llm-runtime-safety-and-integration/SKILL.md).

**MiniScript vertical** (schema, UI binding, framework skill): [miniscript-story-framework](../../miniscript-story-framework/SKILL.md) — code in `packages/shared/src/miniscriptStoryFramework.ts`, `apps/server/src/lib/miniscriptAgent.ts`, `apps/server/src/routes/domains/miniscript.ts`.

## By `SocialIcebreakerPhase`

| Phase | Server generator(s) | Route / trigger | `promptVersion` | `logAITrace` domain / feature |
| --- | --- | --- | --- | --- |
| `warmup` | `generateWarmupTopics` | `POST /api/social-icebreaker/:socialSessionId/topics` | `social-warmup-topics-v1` | `icebreaker` / `generateWarmupTopics` |
| `micro_challenge` | `generateMicroChallenges` | On advance **into** `micro_challenge` (`POST .../advance` path in `socialIcebreaker.ts`) | `social-micro-challenges-v1` | `icebreaker` / `generateMicroChallenges` |
| `lie_detective` | `generateLieDetectiveStatements` | `POST .../lie-detective/generate` | `social-lie-detective-v1` | `icebreaker` / `generateLieDetectiveStatements` |
| `auction` | `generateAuctionLots` (skipped when `SOCIAL_AUCTION_LLM_ENABLED` unset/false — curated fallbacks) | `POST .../auction/generate-lots` | `social-auction-lots-v1` | `icebreaker` / `generateAuctionLots` |
| `personality_dice` | `generatePersonalityDiceChallenges` | `POST .../personality-dice/generate` | `social-personality-dice-v1` | `icebreaker` / `generatePersonalityDiceChallenges` |
| `mini_script` | `generateMiniScriptFramework` (`miniscriptAgent` → `fetchMiniScriptFrameworkModelJson`) | `POST /api/miniscript/generate` (mounted in `routes/domains/icebreaker.ts`) | `social-miniscript-framework-v1` | `miniscript` / `generateMiniScriptFramework` |
| `recap` | `generateRecapSummary` | `GET .../recap` | `social-recap-summary-v2` | `icebreaker` / `generateRecapSummary` |

## Auxiliary (cross-phase)

| Generator | When | `promptVersion` | Observability |
| --- | --- | --- | --- |
| `generateXiaoYueComment` | Host advance (`POST .../advance`) and other flows — short host-facing copy when no canned line matches | `social-xiaoyue-comment-v1` when the **LLM** path runs | **Canned copy:** no model call, no trace. **LLM path:** `logAITrace` — `icebreaker` / `generateXiaoYueComment` |

## Env flags (mini_script LLM)

- `SOCIAL_MINISCRIPT_LLM_ENABLED` — when false, `miniscriptAgent` uses deterministic stub framework (see `apps/server/src/lib/miniscriptAgent.ts`).

## Maintenance

When adding a new AI-backed phase or generator: update this table, the owning `promptVersion` constant, `logAITrace` calls, and [llm-runtime-safety-and-integration](../../llm-runtime-safety-and-integration/SKILL.md) expectations.

**Prometheus / Grafana:** see [docs/ops/icebreaker-ai-observability.md](../../../../docs/ops/icebreaker-ai-observability.md) for `joyjoin_ai_*` metrics and example alerts.

**Human quality protocol & feedback:** [docs/ops/icebreaker-ai-quality-protocol.md](../../../../docs/ops/icebreaker-ai-quality-protocol.md) — `AIResponseMeta.aiCorrelationId` matches `[AITrace].traceId`; `POST /api/social-icebreaker/:socialSessionId/ai-feedback`; admin summary `GET /api/admin/icebreaker-ai-feedback/summary`.
