---
name: Matching Domain
description: Deterministic server-owned matching system — scoring boundaries, execution safety, persistence expectations, and separation from AI explanation/enrichment layers. Use when working on pool matching, pair scoring, group formation, or match explanation features.
---

# Matching Domain

**Core rule:** Matching is deterministic, server-owned, and bounded. `calculateInterestScoreAsync()` reads only `user_interests`. AI explanation and enrichment are separate layers that must not feed back into deterministic scores.

## When to use this skill

- Modifying pool matching logic or pair scoring weights
- Adding a new scoring dimension
- Reviewing a change that touches `poolMatchingService.ts`
- Working on match explanation or AI enrichment surfaces
- Debugging low or unexpected match scores

## Source of truth

| Concern | Location |
|---------|----------|
| Pair scoring + group formation | `apps/server/src/poolMatchingService.ts` |
| Scheduled/realtime matching | `apps/server/src/poolRealtimeMatchingService.ts` |
| Archetype chemistry matrix | `apps/server/src/archetypeChemistry.ts` (runtime) |
| Chemistry matrix canonical | `packages/shared/src/personality/archetypeCompatibility.ts` |
| AI match explanation | `apps/server/src/matchExplanationService.ts` |
| `AIResponseMeta` contract | `packages/shared/src/types/aiMeta.ts` |

## Active scoring dimensions (6)

| Dimension | Weight | Reads from |
|-----------|--------|-----------|
| Chemistry | 28% | archetype chemistry matrix |
| Interest | 28% | `user_interests` table |
| Social Affinity | 20% | `workMode`, `educationLevel`, `hometownRegionCity` |
| Background Diversity | 15% | industry, gender |
| Preference | 5% | event intent, venue preferences |
| Language | 4% | `preferredLanguages` |

## Signal boundary (enforced invariant)

`user_interest_signals` must **not** be read by `calculateInterestScoreAsync()` or any function in the deterministic scoring path.

- `user_interest_signals` feed AI explanation layers only
- This invariant is tested in `apps/server/src/__tests__/interestSignalBoundary.test.ts`
- Do not add `user_interest_signals` reads to scoring code

## Layer separation

| Layer | Purpose | May read |
|-------|---------|---------|
| Deterministic matching | Pair scores, group formation | `user_interests`, `users`, archetype matrix |
| AI explanation | Human-readable reasons, connection points | `user_interest_signals`, match results |
| Optional enrichment | Interest signal boost, vibe brief, tagline | AI enrichment only — no scoring impact |

## Hard constraints (L1 filters)

Applied before scoring:
- Budget (hard constraint — not a soft score)
- Gender restriction
- Industry restriction
- Education level restriction
- Age range

Only users passing all hard constraints are scored.

## Group formation rules

- Start with highest-scoring pair
- Add members with `avgScore ≥ 60`
- Stop at `targetGroupSize` (default 6)
- Require `minGroupSize` (default 4) — groups below minimum are not formed

## Execution safety

- Pool matching must not run concurrently for the same pool — use an execution guard
- The matching result is persisted before notifications fire
- On error, the execution guard must always be released (`finally` block)

## Debugging poor scores

- Check `CHEMISTRY_MATRIX` values in `archetypeChemistry.ts`
- Verify `user_interests.selections` is non-empty for both users
- Check `workMode` and `educationLevel` fields for social affinity issues
- Verify users pass all L1 hard constraints (budget, gender, industry)
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
- `apps/server/src/archetypeChemistry.ts`
- `apps/server/src/matchExplanationService.ts`
- `apps/server/src/__tests__/poolMatchingService.test.ts`
- `apps/server/src/__tests__/interestSignalBoundary.test.ts`
- `packages/shared/src/personality/archetypeCompatibility.ts`
- `packages/shared/src/types/aiMeta.ts`
- `docs/MATCHING_ALGORITHM_REFERENCE.md` — full algorithm reference
- `docs/interest-signal-boost.md` — interest signal feature and boundary invariant
