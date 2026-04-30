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
- Adding or changing the async user semantic profile pipeline
- Working on dialogue insight detection, storage, or user-linking logic
- Debugging why semantic similarity scores look wrong or why embeddings are degrading

## When NOT to use this skill

- Task is about the core 6D matching algorithm or group formation (use `matching-domain`)
- Task is purely about event pool lifecycle, registration, or match-run operations (use `event-pool-and-matching-operations`)
- Task is only about AI chat/completion routing (use `llm-runtime-safety-and-integration`)
- Task is purely about feature flag rollout strategy (use `feature-flags-launch-config`)

## Two semantic systems (do not confuse)

| System | Purpose | Consumed by matching? |
|--------|---------|----------------------|
| **Feature-hash semantic similarity** | 7th pair-scoring dimension | Yes — when `ENABLE_SEMANTIC_SIMILARITY=true` |
| **Neural semantic profile pipeline** | Async persisted embeddings | No — stored for future use |
| **Dialogue embeddings** | Conversation insight storage | No — feeds user profile enrichment only |

### Weight redistribution (7D vs 6D)

| Dimension | 6D default | 7D semantic |
|-----------|-----------|-------------|
| chemistry | 28% | 26% |
| interest | 28% | 26% |
| socialAffinity | 20% | 19% |
| backgroundDiversity | 15% | 14% |
| preference | 5% | 5% |
| language | 4% | 4% |
| semanticSimilarity | — | 6% |

For DeepSeek client details, async cache pipeline, dialogue insight storage, cosine similarity thresholds, and profile vector examples — see [references/pipeline.md](references/pipeline.md).

## Quick examples

**User says:** "Why are semantic similarity scores always near 50?"
**Apply this skill by:** Checking `matchingSemantic.ts` — a neutral score of 50 is returned when *both* users have empty semantic profiles. Verify that `user_interests.selections` is non-empty and `users.archetype` is set. Also confirm `ENABLE_SEMANTIC_SIMILARITY=true` and check the `joyjoin_matching_semantic_feature_enabled` gauge.
**Result:** Root cause identified as missing profile data or disabled flag.

---

**User says:** "Add a fallback embedding provider when DeepSeek is down."
**Apply this skill by:** Modifying `embeddingClient.ts` — extend `getProviderConfig()` to return a secondary provider config when `DEEPSEEK_API_KEY` is absent, update `EmbeddingResult.provider` union type, and add a retry loop that cycles through providers. Preserve the existing policy comment and update `docs/ai-feature-flags.md` if the policy changes.
**Result:** Fallback provider wired; embedding pipeline degrades more gracefully.

## Troubleshooting

- **Semantic similarity scores are all 50 or 45** — Both users likely have empty profiles (50) or one has empty data (45). Verify `users.archetype`, `user_interests.selections`, and intent fields are populated.
- **`ENABLE_SEMANTIC_SIMILARITY=true` but scores look identical to 6D** — Check `joyjoin_matching_semantic_feature_enabled` gauge in `/api/metrics`. If `0`, the process was started without the env var. Also verify pair cache keys include the `semantic|` prefix.
- **Embedding pipeline shows `degraded` status for all users** — `DEEPSEEK_API_KEY` is missing or invalid, or the embedding API is timing out. Check `EMBEDDING_TIMEOUT_MS` and `EMBEDDING_MAX_RETRIES`.
- **User semantic profile never updates after profile changes** — Verify `queueSemanticProfileRecompute()` is called from the relevant route handler. Check that the version vector changed.

## Review checklist

- [ ] Changes to scoring weights preserve 100% sum in **both** 6D and 7D weight tables
- [ ] `ENABLE_SEMANTIC_SIMILARITY` gate is respected — 7D logic does not run when flag is off
- [ ] Pair cache keys distinguish `semantic|` from `legacy|` to prevent cross-contamination
- [ ] Embedding client fallback behavior degrades safely (null embedding → `degraded` status, not a thrown error)
- [ ] Neural embedding pipeline updates do not block user-facing requests (async queue only)
- [ ] `user_interest_signals` is **not** added to the deterministic feature-hash vector
- [ ] Dialogue embeddings service skips partial records when updating user profiles
