# Monte Carlo Group-Formation Harness — 2026-09-10

> Plan: `docs/plans/2026-09-09-personality-engine-v4-upgrade-plan.md` Item 9.
> Contract: `.git/.orchestration/sprints/sprint-contract.item9-monte-carlo-groups.md`.
> Fully deterministic: identical `--seed` reproduces every number in this report.
> **Instrument-first:** this is the gate-off BASELINE measuring instrument for
> Item 5's M9/M10 gates and Item 3's M11 — `poolMatchingService` is used
> read-only; no matcher or engine source was modified.

## Run parameters

- Seed: `20260910`
- Pools: 500 (sizes 12–60), M11 pools: 200
- Population: 6000 synthetic respondents (pools sample without replacement within pool; members recur across pools — documented Monte Carlo relaxation)
- Engine sessions computed: 13986 (memoized per respondent × arm)
- Runtime: 13.9s

## How the matcher was driven (feasibility wiring)

- `runGreedyPoolMatchingCore` (the real in-memory matcher core used by `matchEventPool`) is called directly with: config `{minGroupSize: 4, maxGroupSize: 6, targetGroups: ceil(size/6)}`, a COMPLETE interests cache (every member present → `calculateInterestScoreAsync` never falls through to the DB), `chemistryCalibrationMap: undefined` (static hand-authored matrix — production default while the calibration flag is off), `semanticSimilarityEnabled: false` (6D production default), `strictness: 50` (Match Compass neutral), `magnetismGroupRulesEnabled: false` (**gate-off baseline** — R1–R3 commit gates inert; Item 5 measures its gates against this picture).
- The matcher reads stored `archetype` strings, never raw engine state. Arm wiring therefore runs each respondent through the adaptive engine per arm and feeds the matcher the stored-profile products: flags-off → raw estimates, archetype = engine top-1 on raw vector; flags-on (`enableConsistencyFolding` + `enableTraitShrinkage`) → engine matches on the shrunken vector at the processAnswer match boundary, reported vector = `shrinkTraitsTowardNeutral(traits, confidences)`. Composition metrics below are computed on the REPORTED vectors — exactly what downstream consumers see.
- Duo bonds use the production `duoPairs` parameter ([DUO] atomic-unit guards: atomic seed/admission, MAX 1 duo per group, R1 duo-internal exclusion, 整组顺延 fallback).

## Population & pool generation

1. **Centroid mixture (60.0%):** pick one of the 12 archetype centroids uniformly; each trait ~ Normal(centroid_t, σ=10), truncated to [5, 95].
2. **General population (40.0%):** each trait ~ Normal(μ=50, σ=15), truncated to [5, 95].
Realized split: 3654 centroid-mixture / 2346 general.
- Pool size: uniform 12–60. Duo binding: 15.0% of members (≥1 duo per pool), exercising the [DUO] guards.
- Fixed per-respondent profile fields (gender, age 21–37, 8 industries, education, life stage, languages, intents, 3–5 interest topics with heat 10/25) are drawn once and are IDENTICAL across flag arms — only the trait/archetype arm products vary.

## Assertion classes

**HARD (exit 1; failing pool index + seed printed for replay):**
- INV-1 every committed group size ∈ [4, 6]
- INV-2 no member in two groups of the same run
- INV-3 duo partners co-located or both unmatched; ≤1 duo unit per group
- INV-4 no NaN/undefined matcher metric
- INV-5 M11 shrinkage stabilization ≥ 50.0% reduction (LOCKED, AC-9.4) — **hard only in `--mode=gated`**; baseline mode reports the verdict + replay seeds without failing (contract verification method #1: baseline exits 0) so the instrument can run while the ≥50% target and the K=75 no-harm mechanic are reconciled

**MEASUREMENT-ONLY (reported, not gated — thresholds lock in Item 5):**
- (i) stability floor: group min-E < 25 (PROVISIONAL, Bell 2007 bad-apple prior)
- (ii) viability floor: group mean-A < 45 (PROVISIONAL, Barrick et al. 1998)
- (iii) spark distribution: member with X ≥ 70 or P ≥ 70 (Item 5 target: exactly one)
- (iv) X-variance cap: var(X) > 400 (PROVISIONAL; std 20 mirrors harmonyScore natural-stdDev ≤ 20)
- (v) clone group: max intra-group 6D distance < 15 (PROVISIONAL locked minimum)
- (vi) unmatched rate + flags-on delta (M10 preview: ≤ +2pp once locked)

## Baseline composition (flags OFF — today's gate-off picture)

2967 committed groups across 500 pools.

| Measurement | Distribution (mean, p10/p50/p90) | Violation rate (PROVISIONAL) |
|---|---|---|
| (i) min-E per group | 53.31 (p10 41.00 / p50 50.00 / p90 68.00) | 0.8% below 25 |
| (ii) mean-A per group | 61.77 (p10 51.17 / p50 61.83 / p90 72.67) | 2.0% below 45 |
| (iv) X-variance per group | 371.95 (p10 67.19 / p50 384.58 / p90 620.89) | 45.9% above 400 |
| (v) max intra-group distance | 82.62 (p10 64.84 / p50 84.50 / p90 97.53) | 0.0% clone groups (< 15) |
| (vi) unmatched rate per pool | 0.11 (p10 0.03 / p50 0.10 / p90 0.22) | — |

**(iii) Spark-count distribution (high-X/P members per committed group):**

| Sparks per group | Share of groups |
|---|---|
| 0 | 6.1% |
| 1 (Item 5 target) | 14.6% |
| 2+ | 79.3% |

**Unmatched-member trait profile (mean reported-trait delta: unmatched − matched, per pool):**

| Trait | Δ (unmatched − matched) |
|---|---|
| A | -6.47 |
| C | -1.33 |
| E | -0.53 |
| O | -0.83 |
| X | -1.34 |
| P | -2.09 |

## Flags-ON vs flags-OFF (enableConsistencyFolding + enableTraitShrinkage)

| Metric | flags OFF | flags ON | Δ |
|---|---|---|---|
| Committed groups | 2967 | 2958 | -9 |
| min-E mean | 53.31 | 50.05 | -3.27 |
| stability-floor violation | 0.8% | 1.0% | 0.2pp |
| mean-A mean | 61.77 | 61.41 | -0.36 |
| mean-A floor violation | 2.0% | 2.2% | 0.1pp |
| spark 0 / 1 / 2+ | 6.1% / 14.6% / 79.3% | 6.3% / 14.1% / 79.6% | — |
| X-variance mean | 371.95 | 375.14 | +3.19 |
| X-variance cap violation | 45.9% | 47.8% | 1.9pp |
| clone-group rate | 0.0% | 0.0% | 0.0pp |
| unmatched rate (mean) | 11.1% | 11.2% | +0.1pp (M10 preview: ≤ +2pp once locked) |

## M11 — shrinkage group-level payoff (LOCKED target: ≥50% reduction)

Injection model: 20.0% of each M11 pool's members replaced by low-confidence respondents answering via the random-clicker policy (Item 7 machinery, same true traits) — the only adversarial arm whose session confidence lands in the shrinkage bite-zone (conf < 0.65). Reference = the same pool with zero injection under the SAME flag state. Delta = mean per-trait |Δ group mean| over deterministic Jaccard-aligned groups.

**Mechanical ceiling (shipped Item-3 mechanic):** the AC-3.3 no-harm tuning (K = 75) clamps the shrinkage weight to w ≥ 0.879 even at worst-case confidence (calibrated err clamps to 17.57 below conf 0.578; floor 8.49). First-order per-trait stabilization is therefore capped at ≈ 12.1% — a ≥ 50.0% reduction is unreachable through the report channel under the current calibration, independent of injection model. The measured end-to-end reduction below (which also includes group-membership churn effects) should be read against BOTH the locked target and this ceiling: a FAIL here is evidence that the M11 target and the AC-3.3 no-harm K are in conflict, to be reconciled by the plan owners (raise K / gate a stronger shrink on the low-confidence tail / re-derive the target).

| Arm | Mean per-trait group-mean delta | Aligned group pairs |
|---|---|---|
| injection, shrinkage OFF | 4.922 | 1160 |
| injection, shrinkage ON | 4.761 | 1152 |

**M11: ❌ FAIL** — reduction 3.3% (target ≥ 50.0%).

## Item 10 derived chemistry ON vs OFF (AC-10.5 rollout evidence)

Same pools, flags-off reported vectors. **OFF** = hand-authored `compatibilityMatrix`; **ON** = mechanically derived matrix (similarity on A/E/C + complementarity on X/P, `derivedChemistryEnabled`). Chemistry is 28% of the 6D pair score (70% primary / 15%+15% cross), so a rank shift can move members between groups.

| Metric | derived OFF | derived ON | Δ |
|---|---|---|---|
| Committed groups | 2967 | 2968 | +1 |
| Mean group chemistry score | 81.62 | 81.53 | -0.09 |
| Mean group pair score | 64.32 | 64.26 | -0.05 |
| min-E mean | 53.31 | 53.44 | +0.13 |
| mean-A mean | 61.77 | 61.36 | -0.41 |
| spark 0 / 1 / 2+ | 6.1% / 14.6% / 79.3% | 7.5% / 15.8% / 76.7% | — |
| X-variance mean | 371.95 | 343.12 | -28.83 |
| clone-group rate | 0.0% | 0.0% | 0.0pp |
| unmatched rate (mean) | 11.1% | 11.2% | +0.1pp |

**Group-formation agreement (pairwise co-membership, OFF vs ON): 88.4%**
**Pools with at least one member changing group/unmatched status: 93.4%** (of 500).

Verdict: **material group-formation shift** — the derived matrix re-assigns members; rollout must weigh quality (above) against churn before enabling.

## Structural invariants

- INV-1 group size bounds: ✅ PASS
- INV-2 member uniqueness: ✅ PASS
- INV-3 duo atomicity + ≤1 duo per group: ✅ PASS
- INV-4 no NaN metrics: ✅ PASS

---
Generated by `npm run simulate:groups` (`scripts/simulate/run-group-monte-carlo.ts`).
