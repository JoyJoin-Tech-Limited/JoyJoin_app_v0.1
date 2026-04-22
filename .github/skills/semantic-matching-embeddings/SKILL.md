---
name: semantic-matching-embeddings
description: >
  Semantic matching and embedding pipeline: feature-flagged 7th pair-scoring dimension
  (ENABLE_SEMANTIC_SIMILARITY), deterministic 64-dim feature-hash vectors, neural embedding
  generation via DeepSeek, async user semantic profile cache, and dialogue insight storage.
  Use when modifying semantic similarity scoring, embedding clients, profile vector pipelines,
  or dialogue embeddings. Triggers: semantic similarity, embedding, vector, cosine similarity,
  user_semantic_profiles, dialogue_embeddings, DeepSeek embedding, matchingSemantic.
---

# semantic-matching-embeddings

**Core rule:** Semantic similarity is an *optional* 7th pair-scoring dimension (6% weight) gated by `ENABLE_SEMANTIC_SIMILARITY`. It is deterministic at match time (feature-hash vectors) and has a separate async neural embedding pipeline (`user_semantic_profiles`) that is not yet consumed by live pair scoring. Dialogue embeddings (`dialogue_embeddings`) store conversation insights and are intentionally separate from matching scoring.

## When to use this skill

- Modifying the semantic similarity scoring dimension or its weights
- Working on the embedding client, model selection, or provider configuration
- Adding or changing the async user semantic profile pipeline (generation, invalidation, storage)
- Working on dialogue insight detection, storage, or user-linking logic
- Debugging why semantic similarity scores look wrong or why embeddings are degrading
- Adding metrics, observability, or fallback behavior around embeddings

## When NOT to use this skill

- Task is about the core 6D matching algorithm or group formation (use `matching-domain`)
- Task is purely about event pool lifecycle, registration, or match-run operations (use `event-pool-and-matching-operations`)
- Task is only about AI chat/completion routing (use `llm-runtime-safety-and-integration`)
- Task is purely about feature flag rollout strategy (use `feature-flags-launch-config`)

## Two semantic systems (do not confuse)

| System | Purpose | Data source | Consumed by matching? |
|--------|---------|-------------|----------------------|
| **Feature-hash semantic similarity** | 7th pair-scoring dimension | `users` + `user_interests` fields (deterministic hash) | Yes — when `ENABLE_SEMANTIC_SIMILARITY=true` |
| **Neural semantic profile pipeline** | Async persisted embeddings | `users` + `user_interests` compiled into a text document, then embedded via DeepSeek | No — stored in `user_semantic_profiles` for future use |
| **Dialogue embeddings** | Conversation insight storage | AI chat session transcripts + insight detection | No — feeds user profile enrichment only |

## Feature-hash semantic similarity (live scoring)

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

### Weight redistribution (7D vs 6D)

When `ENABLE_SEMANTIC_SIMILARITY=true`:

| Dimension | 6D default | 7D semantic |
|-----------|-----------|-------------|
| chemistry | 28% | 26% |
| interest | 28% | 26% |
| socialAffinity | 20% | 19% |
| backgroundDiversity | 15% | 14% |
| preference | 5% | 5% |
| language | 4% | 4% |
| semanticSimilarity | — | 6% |

Pair cache keys prefix with `semantic|` vs `legacy|` so paths never collide.

## Neural embedding pipeline (async background)

Located in `apps/server/src/userSemanticProfileService.ts` + `embeddingClient.ts`.

- `UserSemanticProfileService` queues recomputes per user; coalesces concurrent requests
- Triggered on: `profile_setup`, `interests_update`, `interests_nudge`, `full_profile_update`
- Builds a human-readable profile document from bio, archetype, city, hometown, education, work mode, industry, intent, languages, interests
- Calls `embeddingClient.embed()` → DeepSeek OpenAI-compatible API only
- Default model: `text-embedding-3-small` (overridable via `EMBEDDING_MODEL`)
- Stores result in `user_semantic_profiles` table with version vector for invalidation
- Degrades gracefully: status = `degraded` with null embedding if provider fails
- Version vector checks `profileUpdatedAt`, `interestsUpdatedAt`, and `generatorVersion` to skip unnecessary recomputes

## Embedding client configuration

Located in `apps/server/src/embeddingClient.ts`.

| Variable | Default | Purpose |
|----------|---------|---------|
| `DEEPSEEK_API_KEY` | — | **Required.** DeepSeek OpenAI-compatible API key |
| `EMBEDDING_MODEL` | `text-embedding-3-small` | Model id passed to embeddings API |
| `EMBEDDING_TIMEOUT_MS` | `10000` | API call timeout |
| `EMBEDDING_MAX_RETRIES` | `2` | Retry count on failure |

**Policy:** JoyJoin does not use OpenAI (vendor) for embeddings. Only DeepSeek.

## Dialogue embeddings

Located in `apps/server/src/dialogueEmbeddingsService.ts`.

- Stores insights detected during AI onboarding chat sessions
- Categories: `safety`, `emotional`, `lifestyle`, `relationship`, `career`, `preference`, `dialect`, `signature`
- Auto-creates `registration_sessions` record if missing (auto-heal for FK constraints)
- Links sessions to users by `sessionId` or `phoneNumber` (cross-session)
- Updates user profile with extracted insights: `safetyNoteHost`, `hasPets`, `petTypes`, `groupSizeComfort`
- Only `isSuccessful=true` (complete) records update the user profile; partial records are skipped

## Observability

Metrics (from `apps/server/src/matchingMetrics.ts`):

- `joyjoin_matching_semantic_feature_enabled` — gauge (`1` when flag on)
- `joyjoin_matching_semantic_similarity_score` — histogram of raw semantic scores
- `joyjoin_matching_semantic_pair_score_delta` — histogram of pair-score delta vs 6D baseline

## Quick Examples

**User says:** "Why are semantic similarity scores always near 50?"
**Apply this skill by:** Checking `matchingSemantic.ts` — a neutral score of 50 is returned when *both* users have empty semantic profiles (no archetype, interests, or profile fields). Verify that `user_interests.selections` is non-empty and `users.archetype` is set for the users in question. Also confirm `ENABLE_SEMANTIC_SIMILARITY=true` and check the `joyjoin_matching_semantic_feature_enabled` gauge.
**Result:** Root cause identified as missing profile data or disabled flag.

---

**User says:** "Add a fallback embedding provider when DeepSeek is down."
**Apply this skill by:** Modifying `embeddingClient.ts` — extend `getProviderConfig()` to return a secondary provider config (e.g., OpenAI vendor) when `DEEPSEEK_API_KEY` is absent, update `EmbeddingResult.provider` union type, and add a retry loop that cycles through providers. Preserve the existing policy comment and update `docs/ai-feature-flags.md` if the policy changes.
**Result:** Fallback provider wired; embedding pipeline degrades more gracefully.

## Troubleshooting

- **Semantic similarity scores are all 50 or 45** — Both users likely have empty profiles (50) or one has empty data (45). Verify `users.archetype`, `user_interests.selections`, and intent fields are populated. These are the primary features driving the feature-hash vector.
- **`ENABLE_SEMANTIC_SIMILARITY=true` but scores look identical to 6D** — Check `joyjoin_matching_semantic_feature_enabled` gauge in `/api/metrics`. If `0`, the process was started without the env var. Also verify pair cache keys include the `semantic|` prefix; stale `legacy|` cache entries could survive if the cache map is reused across flag toggles.
- **Embedding pipeline shows `degraded` status for all users** — `DEEPSEEK_API_KEY` is missing or invalid, or the embedding API is timing out. Check `EMBEDDING_TIMEOUT_MS` and `EMBEDDING_MAX_RETRIES`. Review server logs for `Semantic embedding generation degraded` warnings.
- **User semantic profile never updates after profile changes** — Verify `queueSemanticProfileRecompute()` is called from the relevant route handler (`profile_setup`, `interests_update`, etc.). Check that the version vector changed (`profileUpdatedAt` or `interestsUpdatedAt` differs from the stored value).
- **Dialogue insights are not linking to users after registration** — Confirm the chat session stored a `phoneNumber` in the embedding JSONB, or that `linkSessionToUser()` is called with the correct `sessionId`. Partial (`isSuccessful=false`) records do not update the user profile.

## Review checklist

- [ ] Changes to scoring weights preserve 100% sum in **both** 6D and 7D weight tables
- [ ] `ENABLE_SEMANTIC_SIMILARITY` gate is respected — 7D logic does not run when flag is off
- [ ] Pair cache keys distinguish `semantic|` from `legacy|` to prevent cross-contamination
- [ ] Embedding client fallback behavior degrades safely (null embedding → `degraded` status, not a thrown error)
- [ ] Neural embedding pipeline updates do not block user-facing requests (async queue only)
- [ ] `user_interest_signals` is **not** added to the deterministic feature-hash vector in `matchingSemantic.ts`
- [ ] Dialogue embeddings service skips partial records when updating user profiles (`isSuccessful=true` only)
- [ ] New embedding provider or model changes include updates to `docs/ai-feature-flags.md` and env examples

## Related skills

| Skill | When to hand off |
|-------|-----------------|
| `matching-domain` | Task changes core 6D scoring, group formation, or L1 hard constraints |
| `llm-runtime-safety-and-integration` | Task changes AI chat/completion routing, prompt versioning, or model routers |
| `feature-flags-launch-config` | Task is purely about rolling out `ENABLE_SEMANTIC_SIMILARITY` safely |
| `platform-observability-and-ops` | Task adds metrics, logging, or dashboards for embedding/matching telemetry |
| `backend-models-standards` | Task adds or modifies tables (`user_semantic_profiles`, `dialogue_embeddings`) |
| `database-migration-safety` | Task requires schema changes to vector-storage columns or indexes |

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
