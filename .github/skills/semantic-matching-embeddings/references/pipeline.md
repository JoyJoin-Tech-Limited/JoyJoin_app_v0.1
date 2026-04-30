# Semantic Matching Pipeline Reference

## DeepSeek client details

Located in `apps/server/src/embeddingClient.ts`.

| Variable | Default | Purpose |
|----------|---------|---------|
| `DEEPSEEK_API_KEY` | — | **Required.** DeepSeek OpenAI-compatible API key |
| `EMBEDDING_MODEL` | `text-embedding-3-small` | Model id passed to embeddings API |
| `EMBEDDING_TIMEOUT_MS` | `10000` | API call timeout |
| `EMBEDDING_MAX_RETRIES` | `2` | Retry count on failure |

**Policy:** JoyJoin does not use OpenAI (vendor) for embeddings. Only DeepSeek.

## Async cache pipeline

Located in `apps/server/src/userSemanticProfileService.ts` + `embeddingClient.ts`.

- `UserSemanticProfileService` queues recomputes per user; coalesces concurrent requests
- Triggered on: `profile_setup`, `interests_update`, `interests_nudge`, `full_profile_update`
- Builds a human-readable profile document from bio, archetype, city, hometown, education, work mode, industry, intent, languages, interests
- Calls `embeddingClient.embed()` → DeepSeek OpenAI-compatible API only
- Default model: `text-embedding-3-small` (overridable via `EMBEDDING_MODEL`)
- Stores result in `user_semantic_profiles` table with version vector for invalidation
- Degrades gracefully: status = `degraded` with null embedding if provider fails
- Version vector checks `profileUpdatedAt`, `interestsUpdatedAt`, and `generatorVersion` to skip unnecessary recomputes

## Feature-hash vector details

Located in `apps/server/src/matchingSemantic.ts`.

- Builds a **64-dimensional feature-hash vector** from deterministic profile fields:
  - archetype (weight 2.5), secondary archetype (1.25)
  - work mode (1.5), education (1.25), industry niche (1.25), hometown (0.75)
  - preferred languages (0.75), event/user intent (1.0)
  - bar themes + alcohol comfort (only for 酒局 events)
  - top 10 interest topics, heat-weighted (1 + heat/25)
- Uses FNV-style `hashToken` into buckets with secondary spillover (×0.5)
- L2-normalised; cosine similarity computed at pair time
- Score mapped to `[35, 100]` range
- Neutral score = 50 when both profiles missing; partial score = 45 when only one missing

## Cosine similarity thresholds

Pair cache keys prefix with `semantic|` vs `legacy|` so paths never collide.

## Dialogue insight storage

Located in `apps/server/src/dialogueEmbeddingsService.ts`.

- Stores insights detected during AI onboarding chat sessions
- Categories: `safety`, `emotional`, `lifestyle`, `relationship`, `career`, `preference`, `dialect`, `signature`
- Auto-creates `registration_sessions` record if missing (auto-heal for FK constraints)
- Links sessions to users by `sessionId` or `phoneNumber` (cross-session)
- Updates user profile with extracted insights: `safetyNoteHost`, `hasPets`, `petTypes`, `groupSizeComfort`
- Only `isSuccessful=true` (complete) records update the user profile; partial records are skipped

## Canonical References

- `apps/server/src/matchingSemantic.ts` — Feature-hash semantic similarity (64-dim vectors, cosine similarity, 7D weight tables)
- `apps/server/src/userSemanticProfileService.ts` — Async neural embedding pipeline (document builder, version vector, queue coalescing)
- `apps/server/src/embeddingClient.ts` — DeepSeek embedding client (OpenAI SDK, timeout, retries, policy)
- `apps/server/src/dialogueEmbeddingsService.ts` — Dialogue insight storage, session linking, user profile enrichment
- `apps/server/src/poolMatchingService.ts` — Integration point: `buildSemanticProfileCache`, `calculateSemanticSimilarityScore`, pair cache keys
- `apps/server/src/matchingMetrics.ts` — Prometheus metrics for semantic similarity
- `apps/server/src/repositories/userSemanticProfilesRepo.ts` — DB access for `user_semantic_profiles`
- `apps/server/src/__tests__/userSemanticProfileService.test.ts` — Pipeline boundary and degradation tests
- `packages/shared/src/schema.ts` — `userSemanticProfiles`, `dialogueEmbeddings` table definitions
- `docs/ai-feature-flags.md` — Embedding env var reference
- `docs/MATCHING_ALGORITHM_REFERENCE.md` — Full algorithm narrative including semantic similarity section
- `docs/LAUNCH_CONFIG.md` — `ENABLE_SEMANTIC_SIMILARITY` rollout guidance
