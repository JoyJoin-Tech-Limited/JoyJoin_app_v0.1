---
name: matching-domain
description: >
  Deterministic server-owned matching system — scoring boundaries, execution safety, persistence
  expectations, and separation from AI explanation/enrichment layers. Use when working on pool
  matching, pair scoring, group formation, or match explanation features. Trigger phrases: "add a
  scoring factor", "modify match weights", "why are groups not forming?", "debug low match
  scores", "add match explanation".
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

## Quick examples

**User says:** "Add a `language_affinity` scoring dimension weighted at 10%."
**Apply this skill by:** Adding the dimension to `calculateInterestScoreAsync()` in `poolMatchingService.ts`, adjusting existing weights so they still sum to 100%, sourcing data only from the allowed tables (not `user_interest_signals`), and updating `poolMatchingService.test.ts`.
**Result:** New dimension is deterministic, correctly bounded, and covered by tests.

---

**User says:** "Groups aren't forming even though we have 8 users in the pool."
**Apply this skill by:** Checking pair scores against the `avgScore ≥ 60` threshold and verifying all 8 users pass the L1 hard constraints (budget, gender, industry, education, age). Use the debug steps in the "Debugging poor scores" section.
**Result:** Root cause is identified — either scores are below threshold or users are failing an L1 filter.

## Troubleshooting

- **All pair scores are unexpectedly low** — check that `user_interests.selections` is non-empty for both users in each pair, and verify the archetype chemistry matrix has entries for the relevant archetypes.
- **`user_interest_signals` appears in a scoring function** — this violates the signal boundary invariant. Remove it immediately; AI signals feed only `matchExplanationService.ts`. Confirm the test in `interestSignalBoundary.test.ts` catches the violation.
- **Matching ran twice concurrently and produced duplicate groups** — the execution guard was not set correctly or was not released in a `finally` block. Review `poolRealtimeMatchingService.ts` for guard acquisition and release.
- **Groups form but are too small** — the pool may have fewer than `minGroupSize` (4) users passing all filters. Check hard constraint filters and verify `targetGroupSize`/`minGroupSize` config values.

## Review checklist

- [ ] New scoring data is read only from approved tables (not `user_interest_signals`)
- [ ] Scoring weights still sum to 100% after any change
- [ ] Hard constraints (budget, gender, industry) are applied as L1 filters, not soft scores
- [ ] Matching execution is guarded against concurrent runs with a `finally` release
- [ ] Match result is persisted before notifications fire
- [ ] New or changed scoring logic is covered by `poolMatchingService.test.ts`
