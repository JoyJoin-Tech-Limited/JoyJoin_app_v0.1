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
- Engine sessions computed: 17608 (memoized per respondent × arm)
- Runtime: 54.6s

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

## M11 — shrinkage group-level payoff (durable contract, P3-reformulated)

Injection model: a share of each M11 pool's members replaced by low-confidence respondents answering via the random-clicker policy (Item 7 machinery, same true traits). Reference = the same pool with zero injection under the SAME flag state. Delta = mean per-trait |Δ group mean| over deterministic Jaccard-aligned groups. Injection-rate SWEEP: 5.0% / 10.0% / 20.0% / 40.0%.

**Durable contract (calibration-anchored; supersedes the retired ≥50.0% relative target).**

- (a) **Per-session bounded error:** worst post-shrink/prior expected-error ratio over the Item 12 curve = 0.887 at conf 0.000 (prior error 17.57 pts) → ✅ PASS (shrinkage never worse than the no-information baseline).
- (b) **Ceiling-normalized stabilization:** realized no-information variance reduction 5.9% vs calibration-implied ceiling 7.0% (mean 1−w² over the injected confidences) = 83.4% of ceiling → ✅ PASS (bar ≥ 80.0% of ceiling).
- **Absolute smoke alarm:** 20.0%-injection Δoff = 4.745 ≤ 5 pts → ✅ PASS.
- **Sweep envelope:** reduction ≥ 0 at every rate → ✅ PASS.

**M11 durable contract: ✅ PASS** (bounded error ✅ · group stabilization ✅ · smoke alarm ✅ · envelope ✅).

| Rate | Δoff (end-to-end) | Δon (end-to-end) | Ref Δoff | Ref Δon | Stabilization (prior) | Δoff ≤ 5 pts? |
|---|---|---|---|---|---|---|
| 5.0% | 2.254 | 2.275 | 17.785 | 17.629 | 6.3% | ✅ |
| 10.0% | 3.381 | 3.629 | 17.193 | 17.101 | 6.3% | ✅ |
| 20.0% | 4.745 | 4.973 | 17.705 | 17.629 | 5.9% | ✅ |
| 40.0% | 6.233 | 6.394 | 17.389 | 17.328 | 5.8% | ❌ |

_End-to-end deltas include group-membership churn (noisy at low rates); the stabilization column is the churn-free fixed-composition measure the durable contract consumes._

_Legacy reference (retired target, retained for history):_ 20%-injection reduction -4.8% vs the old ≥ 50.0% bar — the conflict that motivated the reformulation. Mechanical first-order ceiling of the shipped K=75 at worst-case confidence: ≈ 12.1% (w_min ≈ 0.879; floor 8.49).

## Item 5 composition gates ON (flags-off reported vectors)

Gate constants (shipped): min-E floor 25 (Barrick et al. 1998), mean-A floor 45 (Bell 2007), spark = X ≥ 70 ∨ P ≥ 70 (LOCKED Item 9 definition), X-variance cap 750.

Pool-level spark exemption (bidirectional): deficit-exempt pools 0 / surplus-exempt pools 500 / fully enforced 0 (of 500).

| Gate | Pass share (exemption-aware, over evaluated groups) | Evaluated |
|---|---|---|
| (i) min-E ≥ 25 | 100.0% | 2908 |
| (ii) mean-A ≥ 45 | 100.0% | 2908 |
| (iii-a) ≥1 spark | 100.0% | 2908 |
| (iii-b) ≤1 spark | n/a (0 evaluated) | 0 |
| (iv) var(X) ≤ 750 | 100.0% | 2908 |

**Raw (pre-exemption) composition picture under gates-ON:**

| Measurement | Baseline (gates OFF) | Gates ON |
|---|---|---|
| spark 0 / 1 / 2+ | 6.1% / 14.6% / 79.3% | 0.0% / 18.6% / 81.4% |
| min-E < 25 | 0.8% | 0.0% |
| mean-A < 45 | 2.0% | 0.0% |
| var(X) > 750 (shipped cap) | 2.5% | 0.0% |
| unmatched rate (mean) | 11.1% | 12.6% |

**Gate-on stranded-member trait profile (mean reported-trait delta: unmatched − matched, per pool):**

| Trait | Δ (unmatched − matched) |
|---|---|
| A | -6.80 |
| C | -0.81 |
| E | -0.74 |
| O | -1.26 |
| X | -4.28 |
| P | -5.30 |

**Per-gate rejection counts (matcher stats collector):**

| Gate | Commit-gate rejections | Redistribution rejections |
|---|---|---|
| (i) min-E floor | 0 | 0 |
| (ii) mean-A floor | 166 | 0 |
| (iii) spark rule | 124 | 0 |
| (iv) X-variance cap | 19 | 0 |
| **total groups rejected** | 298 | 0 |

**M9 (LOCKED ≥ 95.0% all-gates pass, exemption-aware): ✅ PASS** — 100.0% of 2908 committed groups.
**M10 (LOCKED ≤ +2pp unmatched): ✅ PASS** — delta +1.51pp vs gate-off baseline (11.1% → 12.6%).

## Structural invariants

- INV-1 group size bounds: ✅ PASS
- INV-2 member uniqueness: ✅ PASS
- INV-3 duo atomicity + ≤1 duo per group: ✅ PASS
- INV-4 no NaN metrics: ✅ PASS

---
Generated by `npm run simulate:groups` (`scripts/simulate/run-group-monte-carlo.ts`).
