---
name: matching-domain
description: >
  Deterministic server-owned matching — default 6D pair weights; optional 7D when ENABLE_SEMANTIC_SIMILARITY.
  Signal boundary: user_interest_signals never in scoring path. Use for pool matching, pair/group
  formation, match explanation. Triggers: scoring factor, match weights, groups not forming, low scores,
  match explanation, semantic similarity dimension.
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
| Optional 7th pair dimension (semantic similarity) | `apps/server/src/matchingSemantic.ts` — active only when `ENABLE_SEMANTIC_SIMILARITY=true` |
| Archetype chemistry matrix | `apps/server/src/archetypeChemistry.ts` |
| AI match explanation | `apps/server/src/matchExplanationService.ts` |
| `AIResponseMeta` contract | `packages/shared/src/types/aiMeta.ts` |

## 6D/7D scoring overview

Default matching uses 6 dimensions (chemistry, interest, social affinity, background diversity, preference, language). When `ENABLE_SEMANTIC_SIMILARITY=true`, a 7th semantic-similarity dimension is added and weights are redistributed. Pair cache keys include `semantic` vs `legacy` so the paths do not collide.

See [`references/scoring-details.md`](references/scoring-details.md) for full weight tables, MatcherV2 specifics, chemistry matrix notes, and semantic similarity details.

## Signal boundary (enforced invariant)

`user_interest_signals` must **not** be read by `calculateInterestScoreAsync()` or any function in the deterministic scoring path.

- `user_interest_signals` feed AI explanation layers only
- This invariant is tested in `apps/server/src/__tests__/interestSignalBoundary.test.ts`
- Do not add `user_interest_signals` reads to scoring code

## Grill-me stress-test

After modifying matching logic, run [`references/grill-me-checklist.md`](references/grill-me-checklist.md) — a one-question-per-turn interview that stress-tests scoring weights, signal boundaries, L1 filters, concurrent execution guards, and group formation edge cases. "It works for 10 users" ≠ "it works for 1000."

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

## Group-level gender balance (wired 2026-07-14)

Distinct from L1 user filters — these are per-pool group-formation controls on `event_pools`:

- `genderBalanceMode` — `none` / `soft` (default) / `hard`. `genderRestriction="女性"` implies `none`.
- Soft mode: post-clamp bonus in `calculateGroupDiversity` for exact male/female balance (capped by `genderBalanceBonusPoints`, 0–100). Never blocks formation; bonus default-ON is the intended 1:1 nudge.
- Hard mode: `minFemaleCount`/`minMaleCount` (0–20) floors gate every group commit **and** all redistribution phases; failing groups are discarded, members returned to the candidate pool.
- Floors are hard-mode-only. Undisclosed gender counts toward neither floor.
- Full spec: `docs/systems/MATCHING_ALGORITHM_REFERENCE.md` §4.2.1. Decision trail: Sprint Contract `sprint_20260714_gender_ratio_enforcement`.

## Execution safety

- Pool matching must not run concurrently for the same pool — use an execution guard
- The matching result is persisted before notifications fire
- On error, the execution guard must always be released (`finally` block)
- When `matchingOperatorReviewEnabled` is true, post-match side effects are deferred until an operator approves; `executePostMatchCommitSideEffects` is invoked from both the normal auto-match path and the admin approval path

## Quick examples

**User says:** "Add a `language_affinity` scoring dimension weighted at 10%."
**Apply this skill by:** Extending the weighted pair-score path in `poolMatchingService.ts`, adjusting **both** default 6D and semantic 7D weight tables so each sums to 100%, sourcing data only from allowed tables (not `user_interest_signals`), and updating `poolMatchingService.test.ts`.

**User says:** "Groups aren't forming even though we have 8 users in the pool."
**Apply this skill by:** Checking pair scores against the `avgScore ≥ 60` threshold and verifying all 8 users pass the L1 hard constraints (budget, gender, industry, education, age). See [`references/scoring-details.md`](references/scoring-details.md) for debug steps.
**Result:** Root cause is identified — either scores are below threshold or users are failing an L1 filter.

## Troubleshooting

- **All pair scores are unexpectedly low** — check that `user_interests.selections` is non-empty for both users in each pair, and verify the archetype chemistry matrix has entries for the relevant archetypes.
- **`user_interest_signals` appears in a scoring function** — this violates the signal boundary invariant. Remove it immediately; AI signals feed only `matchExplanationService.ts`. Confirm the test in `interestSignalBoundary.test.ts` catches the violation.
- **Matching ran twice concurrently and produced duplicate groups** — the execution guard was not set correctly or was not released in a `finally` block. Review `poolRealtimeMatchingService.ts` for guard acquisition and release.
- **Groups form but are too small** — fewer than `minGroupSize` (4) users may pass all L1 filters. Check constraints and pool config.

## Review checklist

- [ ] New scoring data is read only from approved tables (not `user_interest_signals`)
- [ ] Scoring weights still sum to 100% after any change (check **both** 6D default and 7D semantic paths if `ENABLE_SEMANTIC_SIMILARITY` is relevant)
- [ ] Hard constraints (budget, gender, industry) are applied as L1 filters, not soft scores
- [ ] Matching execution is guarded against concurrent runs with a `finally` release
- [ ] Match result is persisted before notifications fire
- [ ] New or changed scoring logic is covered by `poolMatchingService.test.ts`
- [ ] Grill-me interview completed for any scoring dimension change or group formation change (see `references/grill-me-checklist.md`)
