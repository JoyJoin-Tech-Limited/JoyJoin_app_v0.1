# AI Feature Inventory

## Scope And Counting Rules

This inventory is based on code paths that are reachable from the mini-program today.

Counted as an AI feature only when at least one of the following is true:

- The mini-program directly calls a server route that makes an LLM or embedding request.
- A mini-program action triggers a backend AI pipeline asynchronously.
- The mini-program has a concrete render path for the resulting AI output, even if the wiring is incomplete.

Not counted as AI for this document:

- Deterministic scoring, heuristics, or template generation.
- Repo AI endpoints that exist on the server but have no confirmed mini-program caller.
- Backend helper functions whose output is not currently consumed by the mini-program UI.

## Summary Table

| Feature | Mini-program entry point | Backend path | Model/service | Current state | Fallback behavior |
| --- | --- | --- | --- | --- | --- |
| Social icebreaker warmup topics | `apps/mini-program/src/pages/icebreaker-session/index.tsx` -> `POST /api/social-icebreaker/:id/topics` | `generateWarmupTopics` in `apps/server/src/socialIcebreakerAIService.ts` | `socialModelRouter` with MiniMax preferred in hybrid mode, DeepSeek fallback | Active | Curated `FALLBACK_WARMUP_TOPICS` |
| Social icebreaker micro-challenges | `apps/mini-program/src/pages/icebreaker-session/index.tsx` -> `POST /api/social-icebreaker/:id/advance` into `micro_challenge` | `generateMicroChallenges` in `apps/server/src/socialIcebreakerAIService.ts` | `socialModelRouter`; DeepSeek default in hybrid mode | Active | Curated `FALLBACK_MICRO_CHALLENGES` |
| Social icebreaker lie-detective statements | `apps/mini-program/src/pages/icebreaker-session/index.tsx` -> `POST /api/social-icebreaker/:id/lie-detective/generate` | `generateLieDetectiveStatements` in `apps/server/src/socialIcebreakerAIService.ts` | `socialModelRouter` with MiniMax preferred in hybrid mode, DeepSeek fallback | Active | Curated `FALLBACK_LIE_DETECTIVE_STATEMENTS` |
| Social icebreaker recap summary | `apps/mini-program/src/pages/icebreaker-session/index.tsx` -> `GET /api/social-icebreaker/:id/recap` | `generateRecapSummary` in `apps/server/src/socialIcebreakerAIService.ts` | `socialModelRouter` with MiniMax preferred in hybrid mode, DeepSeek fallback | Active | Deterministic `getDefaultRecap(...)` |
| Social icebreaker personality-dice challenges | `apps/mini-program/src/pages/icebreaker-session/index.tsx` -> `POST /api/social-icebreaker/:id/personality-dice/generate` | `generatePersonalityDiceChallenges` in `apps/server/src/socialIcebreakerAIService.ts` | `socialModelRouter`; DeepSeek default in hybrid mode | Active when `personality_dice` phase is enabled | Curated `DICE_CURATED` map by dominant trait |
| Semantic profile embeddings | Onboarding/profile update pages submit profile and interests | `queueSemanticProfileRecompute(...)` -> `embeddingClient.embed(...)` | OpenAI embeddings preferred, DeepSeek embedding fallback, default model `text-embedding-3-small` | Active backend AI triggered by mini-program actions | Stores profile as `degraded` with null embedding instead of breaking user flow |
| Event theme title reveal | `apps/mini-program/src/pages/matching-status/index.tsx` listens for `EVENT_THEME_TITLE_REVEALED` and conditionally renders theme fields | `generateAndAssignEventThemeTitle(...)` in `apps/server/src/eventThemeTitleGenerator.ts` | `creativeModelRouter` with MiniMax or DeepSeek | Partial / incompletely surfaced | Template fallback via `generateFallbackEventThemeTitle(...)`; can also be fully disabled by env flag |

## Feature Identification

### Confirmed live, user-facing AI in the mini-program

1. Social icebreaker warmup topic generation.
2. Social icebreaker micro-challenge generation.
3. Social icebreaker lie-detective statement generation.
4. Social icebreaker recap summary generation.
5. Social icebreaker personality-dice challenge generation.

### Confirmed backend AI triggered by mini-program actions

1. Semantic profile embedding generation after profile or interests updates.

### Confirmed partial AI feature with incomplete mini-program wiring

1. Event theme title reveal after matching.

### Deterministic or non-reachable surfaces excluded from the counted inventory

1. The V4 personality assessment flow and `login-with-test` import path are deterministic scoring and persistence logic, not LLM-backed AI.
2. `group.matchExplanation` shown by the squad/group detail pages currently comes from deterministic `generateGroupExplanation(...)` in `apps/server/src/userMatchingService.ts`.
3. The initial event theme metadata produced during match save uses deterministic logic from `apps/server/src/services/eventThemeTitleGenerator.ts`, even though a later async AI title generator also exists.
4. `generateXiaoYueComment(...)` is mostly a default comment map first and only falls back to model generation when no canned comment exists; the mini-program code does not currently reference `xiaoYueComment` directly.
5. AI match-intelligence endpoints exist at `/api/event-pool-groups/:groupId/match-explanations` and `/api/event-pool-groups/:groupId/ice-breakers`, but no mini-program caller was confirmed during this audit.

## Detailed Breakdown Per Feature

### 1. Social Icebreaker Warmup Topic Generation

- Description: Generates a fresh set of five opening prompts for the live social-icebreaker session.
- Entry point(s): `apps/mini-program/src/pages/icebreaker-session/index.tsx` host action `handleGenerateTopics(...)`, calling `POST /api/social-icebreaker/:socialSessionId/topics`.
- AI model/service: `generateWarmupTopics(...)` in `apps/server/src/socialIcebreakerAIService.ts`, routed through `apps/server/src/ai/socialModelRouter.ts`. In default `hybrid` mode, this function prefers MiniMax and falls back to DeepSeek if MiniMax is unavailable.
- Configuration location: Prompt version `social-warmup-topics-v1` in `apps/server/src/socialIcebreakerAIService.ts`; provider routing in `apps/server/src/ai/socialModelRouter.ts`; model defaults in `apps/server/src/ai/minimaxClient.ts`.
- Current state: Active and directly wired into the mini-program host flow.
- Fallback behavior: On empty response, parse failure, or provider error, the service returns curated prompts from `FALLBACK_WARMUP_TOPICS` and marks the AI metadata as fallback.

### 2. Social Icebreaker Micro-Challenge Generation

- Description: Generates short table-friendly challenges when the host advances the session into the `micro_challenge` phase.
- Entry point(s): `apps/mini-program/src/pages/icebreaker-session/index.tsx` phase advance action, which calls `POST /api/social-icebreaker/:socialSessionId/advance`.
- AI model/service: `generateMicroChallenges(...)` in `apps/server/src/socialIcebreakerAIService.ts`, again via `apps/server/src/ai/socialModelRouter.ts`.
- Configuration location: Prompt version `social-micro-challenges-v1` in `apps/server/src/socialIcebreakerAIService.ts`; provider selection in `apps/server/src/ai/socialModelRouter.ts`.
- Current state: Active. In default `hybrid` routing, this function is not in the MiniMax-designated set, so it uses DeepSeek unless the global provider mode is forced to MiniMax.
- Fallback behavior: Uses `FALLBACK_MICRO_CHALLENGES` on empty, invalid, or failed model output.

### 3. Social Icebreaker Lie-Detective Statement Generation

- Description: Generates a personalized "two truths and a lie" set for each player.
- Entry point(s): `apps/mini-program/src/pages/icebreaker-session/index.tsx` calling `POST /api/social-icebreaker/:socialSessionId/lie-detective/generate`.
- AI model/service: `generateLieDetectiveStatements(...)` in `apps/server/src/socialIcebreakerAIService.ts`, routed through `apps/server/src/ai/socialModelRouter.ts`.
- Configuration location: Prompt version `social-lie-detective-v1` in `apps/server/src/socialIcebreakerAIService.ts`; provider routing in `apps/server/src/ai/socialModelRouter.ts`.
- Current state: Active. The route also persists the true lie server-side and sends only sanitized statements back to clients.
- Fallback behavior: Returns one curated statement set from `FALLBACK_LIE_DETECTIVE_STATEMENTS` if the model response is empty, malformed, or fails.

### 4. Social Icebreaker Recap Summary Generation

- Description: Produces the closing headline, key moments, and closing line for the recap phase.
- Entry point(s): `apps/mini-program/src/pages/icebreaker-session/index.tsx` uses `GET /api/social-icebreaker/:socialSessionId/recap` once the session reaches the recap phase.
- AI model/service: `generateRecapSummary(...)` in `apps/server/src/socialIcebreakerAIService.ts`, routed through `apps/server/src/ai/socialModelRouter.ts`.
- Configuration location: Prompt version `social-recap-summary-v1` in `apps/server/src/socialIcebreakerAIService.ts`; routing in `apps/server/src/ai/socialModelRouter.ts`.
- Current state: Active and directly rendered in the recap view.
- Fallback behavior: Uses deterministic `getDefaultRecap(...)` output if the model response is empty, malformed, or errors.

### 5. Social Icebreaker Personality-Dice Challenge Generation

- Description: Creates one personalized live challenge per participant based on dominant trait scores.
- Entry point(s): `apps/mini-program/src/pages/icebreaker-session/index.tsx` calling `POST /api/social-icebreaker/:socialSessionId/personality-dice/generate`.
- AI model/service: `generatePersonalityDiceChallenges(...)` in `apps/server/src/socialIcebreakerAIService.ts`, routed through `apps/server/src/ai/socialModelRouter.ts`.
- Configuration location: Prompt version `social-personality-dice-v1` in `apps/server/src/socialIcebreakerAIService.ts`; phase gating in `apps/server/src/socialIcebreakerPhaseConfig.ts`; provider routing in `apps/server/src/ai/socialModelRouter.ts`.
- Current state: Active when the `personality_dice` phase is present in the server-enabled phase list. This phase is enabled by default unless explicitly disabled by env.
- Fallback behavior: Generates a deterministic per-trait challenge from `DICE_CURATED` when the model output is empty, malformed, or errors.

### 6. Semantic Profile Embedding Pipeline

- Description: Rebuilds a semantic profile document from profile and interests data, then generates and stores an embedding for downstream matching and enrichment.
- Entry point(s): Mini-program profile submission flows, including onboarding and profile editing. Confirmed server triggers include `/api/profile/setup`, `/api/user/interests`, `/api/user/interests/nudge`, and `PATCH /api/profile`.
- AI model/service: `queueSemanticProfileRecompute(...)` in `apps/server/src/userSemanticProfileService.ts` builds the profile document and calls `embeddingClient.embed(...)` from `apps/server/src/embeddingClient.ts`.
- Configuration location: Provider selection and model defaults in `apps/server/src/embeddingClient.ts`; generator version `semantic-profile-v1` in `apps/server/src/userSemanticProfileService.ts`.
- Current state: Active, but backend-only. The mini-program triggers it indirectly; it does not render the raw embedding output.
- Fallback behavior: If no provider is configured or embedding generation fails, the service stores the semantic profile record with status `degraded`, null embedding data, and a soft error marker instead of failing the user request.

### 7. Event Theme Title Reveal

- Description: Generates a themed title, subtitle, emoji, highlights, and vibe for a matched group after match results are saved.
- Entry point(s): The mini-program matching-status page listens for `EVENT_THEME_TITLE_REVEALED` via WebSocket and conditionally renders `theme`, `subtitle`, `themeEmoji`, `highlights`, and `vibe` if they are present in the registration payload.
- AI model/service: `generateAndAssignEventThemeTitle(...)` in `apps/server/src/eventThemeTitleGenerator.ts`, routed through `apps/server/src/ai/creativeModelRouter.ts`. Function-level provider override is `CREATIVE_AI_TITLE_PROVIDER`, then `CREATIVE_AI_PROVIDER`, then MiniMax-if-configured else DeepSeek.
- Configuration location: `apps/server/src/eventThemeTitleGenerator.ts`, `apps/server/src/ai/creativeModelRouter.ts`, and `apps/server/src/ai/minimaxClient.ts`.
- Current state: Partial. The backend does generate AI titles and broadcasts `EVENT_THEME_TITLE_REVEALED`, but the mini-program only invalidates and refetches `/api/my-pool-registrations`. That route currently does not select or return `theme`, `subtitle`, `themeEmoji`, `highlights`, or `vibe`, so the visible theme card is not reliably fed by the refetch path.
- Fallback behavior: If generation is disabled or the provider fails validation, the service falls back to template generation via `generateFallbackEventThemeTitle(...)`. Separately, initial match save also uses deterministic title generation from `apps/server/src/services/eventThemeTitleGenerator.ts`.

## Cross-Cutting Concerns

### Shared AI utilities and contracts the mini-program depends on

- `apps/server/src/ai/socialModelRouter.ts`: Central routing for social-experience AI calls, including MiniMax-vs-DeepSeek policy and failover.
- `apps/server/src/ai/creativeModelRouter.ts`: Central routing for creative identity/title generation, including event theme title generation.
- `apps/server/src/ai/minimaxClient.ts`: MiniMax client wiring and `MINIMAX_MODEL` default.
- `apps/server/src/embeddingClient.ts`: Embedding provider abstraction for semantic profiles.
- `apps/server/src/lib/aiTraceLogger.ts`: Trace logging for social-icebreaker and match-intelligence AI calls.
- `@shared/types/aiMeta`: Shared response metadata contract for live-vs-fallback AI responses.
- `packages/shared/src/api.ts`: Shared registration and group DTOs, including optional theme fields and `matchExplanation` fields used by mini-program pages.
- `packages/shared/src/wsEvents.ts`: Shared WebSocket event contract; `EVENT_THEME_TITLE_REVEALED` includes theme payload fields even though the mini-program currently refetches instead of consuming them directly.

### Feature flags and rollout controls

No explicit client-side A/B testing or experiment bucketing was found for AI features in `apps/mini-program/src`. The current rollout controls are server-side environment flags and provider selection variables.

Relevant server-side flags and env controls found during the audit:

- `SOCIAL_AI_PROVIDER`: `hybrid`, `minimax`, or `deepseek` for social-icebreaker and match-intelligence routing.
- `MINIMAX_API_KEY`, `MINIMAX_MODEL`, `MINIMAX_BASE_URL`, `MINIMAX_TIMEOUT_MS`: MiniMax enablement and model/runtime configuration.
- `DEEPSEEK_API_KEY`: DeepSeek enablement for chat and embedding fallback paths.
- `OPENAI_API_KEY`: Primary embedding provider enablement in `embeddingClient.ts`.
- `EMBEDDING_MODEL`, `EMBEDDING_TIMEOUT_MS`, `EMBEDDING_MAX_RETRIES`: Embedding runtime controls.
- `CREATIVE_AI_PROVIDER`: Global creative-provider override.
- `CREATIVE_AI_TITLE_PROVIDER`: Function-level override for event theme title generation.
- `ENABLE_EVENT_THEME_TITLE_GENERATION`: Hard on/off gate for the async event-theme AI flow.
- `AI_USAGE_TRACKING_ENABLED`: Enables event-theme AI usage tracking logs.
- `AI_TIMEOUT_MS`, `DEEPSEEK_TIMEOUT_MS`, `MINIMAX_TIMEOUT_MS`: Timeouts used by the event-theme generator.
- `SOCIAL_ICEBREAKER_ENABLE_PERSONALITY_DICE`: Removes the personality-dice AI phase when set false.
- `SOCIAL_ICEBREAKER_ENABLE_AUCTION`: Inserts a non-AI `auction` phase into the social-icebreaker flow.
- `SOCIAL_ICEBREAKER_ENABLE_MINI_SCRIPT_BETA`: Adds a beta phase into the social-icebreaker phase list.

### Local or on-device AI in the mini-program

No evidence of local or on-device model inference was found under `apps/mini-program/src`.

The audit specifically found no matches for common local-inference libraries or runtimes such as:

- TensorFlow.js / `@tensorflow`
- `mediapipe`
- `onnx` / `onnxruntime`
- `tflite`

All confirmed AI execution paths for the mini-program are server-side.

### Reliability and fallback patterns

- Social icebreaker features consistently attach AI metadata and fall back to curated or deterministic content on empty responses, parse failures, or provider errors.
- Semantic embeddings fail soft: user flows continue even when embeddings are unavailable.
- Event theme title generation includes timeout protection, response validation, blocked-keyword filtering, and template fallback.

## Bottom Line

The confirmed mini-program AI footprint is narrower than the repo-wide AI surface.

Today, the mini-program has:

1. One clearly live AI suite: social icebreaker generation.
2. One active backend AI enrichment pipeline triggered by mini-program profile actions: semantic embeddings.
3. One partial AI experience with incomplete client wiring: event theme title reveal.

Several nearby surfaces that may look AI-powered in the UI or schema are currently deterministic, backend-only, or server-present but not mini-program-reachable.
