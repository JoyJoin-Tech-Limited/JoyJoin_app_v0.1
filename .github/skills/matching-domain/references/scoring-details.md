# Scoring Details and Matcher Reference

## Default 6D weight table

| Dimension | Weight | Reads from |
|-----------|--------|-----------|
| Chemistry | 28% | archetype chemistry matrix |
| Interest | 28% | `user_interests` table |
| Social Affinity | 20% | `workMode`, `educationLevel`, `hometownRegionCity` |
| Background Diversity | 15% | industry, gender |
| Preference | 5% | event intent, venue preferences |
| Language | 4% | `preferredLanguages` |

## Optional 7D weight table (ENABLE_SEMANTIC_SIMILARITY)

When `ENABLE_SEMANTIC_SIMILARITY=true`, the first six weights are redistributed to make room for semantic similarity (approximately: chemistry 26% / interest 26% / socialAffinity 19% / backgroundDiversity 14% / preference 5% / language 4% / **semanticSimilarity 6%**). Pair cache keys include `semantic` vs `legacy` so 6D and 7D paths do not collide.

Full narrative and matrices: `docs/MATCHING_ALGORITHM_REFERENCE.md`.

## MatcherV2 specifics

- Start with highest-scoring pair
- Add members with `avgScore ≥ 60`
- Stop at `targetGroupSize` (default 6)
- Require `minGroupSize` (default 4) — groups below minimum are not formed

## Chemistry matrix notes

- Runtime matrix: `apps/server/src/archetypeChemistry.ts`
- Canonical matrix: `packages/shared/src/personality/archetypeCompatibility.ts`

## Semantic similarity dimension details

- Location: `apps/server/src/matchingSemantic.ts`
- Active only when `ENABLE_SEMANTIC_SIMILARITY=true`
- Uses deterministic 64-dim feature-hash vectors or neural embeddings via DeepSeek
- Async user semantic profile cache

## Debugging poor scores

- Check `CHEMISTRY_MATRIX` values in `archetypeChemistry.ts`
- Verify `user_interests.selections` is non-empty for both users
- Check `workMode` and `educationLevel` fields for social affinity issues
- Verify users pass all L1 hard constraints (budget, gender, industry, education, age)
- Minimum group `avgScore` threshold is 60 — review pair scores to understand why groups aren't forming

## Common mistakes to avoid

- Reading `user_interest_signals` in pair scoring functions
- Applying hard constraint logic inside the scoring path instead of the L1 filter stage
- Returning scores from client-side heuristics instead of server-computed values
- Running matching without an execution guard
- Committing match results inside a transaction that also fires notifications

## Related files

- `apps/server/src/poolMatchingService.ts`
- `apps/server/src/poolRealtimeMatchingService.ts`
- `apps/server/src/matchingSemantic.ts`
- `apps/server/src/archetypeChemistry.ts`
- `apps/server/src/matchExplanationService.ts`
- `apps/server/src/__tests__/poolMatchingService.test.ts`
- `apps/server/src/__tests__/interestSignalBoundary.test.ts`
- `packages/shared/src/personality/archetypeCompatibility.ts`
- `packages/shared/src/types/aiMeta.ts`
- `docs/MATCHING_ALGORITHM_REFERENCE.md`
- `docs/interest-signal-boost.md`
