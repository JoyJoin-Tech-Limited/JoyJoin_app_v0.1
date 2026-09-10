# Latent-Trait Recovery Harness — 2026-09-09

> Plan: `docs/plans/2026-09-09-personality-engine-v4-upgrade-plan.md` Item 6.
> Contract: `.git/.orchestration/sprints/sprint-contract.item6-recovery-harness.md`.
> Fully deterministic: identical `--seed` reproduces every number in this report.

## Run parameters

- Seed: `20260909`
- Respondents (N): 2000
- Noise arms: `clean`, `moderate` (persona-utils answer model: trait-proportional option scoring + mode-specific jitter/suboptimal/contrarian rates)
- Checkpoints (forced stop, adaptive questions only): 8 / 12 / 16

## Ground-truth distribution (documented multivariate mixture)

1. **Centroid mixture (60.0% of N):** pick one of the 12 archetype centroids uniformly; each trait ~ Normal(centroid_t, σ=10) independently, truncated to [5, 95] by rejection sampling.
2. **General population (40.0% of N):** each trait ~ Normal(μ=50, σ=15) independently (multivariate normal, identity covariance), truncated to [5, 95].

Ground-truth archetype = MatcherV2 isolation top-1 on the true vector (same definition as `simulate:personas:run:ci`, which is 12/12 at exact centroids).

Realized split: 1185 centroid-mixture / 815 general.

| True archetype | Count |
|---|---|
| octopus | 415 |
| fox | 202 |
| cat | 199 |
| elephant | 180 |
| rooster | 163 |
| turtle | 159 |
| hamster_praise | 146 |
| spider | 135 |
| owl | 121 |
| corgi | 114 |
| koala | 84 |
| dolphin_calm | 82 |

## Engine configuration

- Forced-stop arms: `DEFAULT_ASSESSMENT_CONFIG` with `minQuestions = softMaxQuestions = hardMaxQuestions = 16`, `defaultConfidenceThreshold = 2`, `confusablePairThreshold = 2` (unreachable → confidence early-stop disabled), `enableTieredThreshold = false`, `useV2Matcher = true`. Session composition (9 anchors + ≤2 calibration + adaptive utility picks) is otherwise production-identical; checkpoints snapshot engine state after exactly 8/12/16 answered questions. Engine source unmodified.
- Natural arm: unmodified `DEFAULT_ASSESSMENT_CONFIG` (min=10, softMax=12, hardMax=16, defaultConfidenceThreshold=0.65, confusablePairThreshold=0.7, tieredThresholdConfig.confidenceGapThreshold=0.1 [tiered disabled]).

## Noise arm: `clean`

### Per-trait recovery — Pearson r(true, estimated)

| Trait | r @8q | r @12q | r @16q | MAE @16q | mean samples @16q |
|---|---|---|---|---|---|
| A | 0.815 | 0.816 | 0.809 | 9.9 | 6.3 |
| C | 0.671 | 0.757 | 0.706 | 11.6 | 7.9 |
| E | 0.616 | 0.774 | 0.763 | 10.6 | 9.6 |
| O | 0.650 | 0.752 | 0.767 | 10.8 | 7.4 |
| X | 0.782 | 0.813 | 0.865 | 10.7 | 9.3 |
| P | 0.625 | 0.687 | 0.730 | 11.9 | 6.9 |
| **mean** | **0.693** | **0.766** | **0.773** | | |

### Archetype top-1 agreement & confidence

| Metric | @8q | @12q | @16q | natural stop |
|---|---|---|---|---|
| Top-1 agreement | 35.7% | 43.8% | 47.9% | 44.5% |
| — centroid-mixture respondents | 38.9% | 48.6% | 54.3% | 49.6% |
| — general respondents | 31.0% | 36.8% | 38.5% | 37.2% |
| Mean trait confidence | 0.840 | 0.893 | 0.920 | 0.906 |

### Natural-termination session stats

- Adaptive questions: mean 12.4, median 12, range 12–16
- Hit hardMax (16q): 1.9%; stopped ≤12q: 73.4%
- Mean top1–top2 confidence gap at stop: 0.647; sessions stopping with gap < 0.10: 5.7%
- Per-trait r at natural stop: A=0.816, C=0.751, E=0.771, O=0.754, X=0.820, P=0.683

### Verdict

- **M1 — recovery r ≥ 0.70 @16q (all traits):** ✅ PASS
- **M2 — r ≥ 0.50 @8q / ≥ 0.60 @12q / monotone:** ❌ FAIL (non-monotone: A,C,E)
- **M3 — archetype top-1 agreement ≥ 85% @16q:** ❌ FAIL (47.9% overall; centroid-mixture 54.3%, general 38.5%)
- **hardMax=16 review:** mean r gain 12q→16q = +0.007, agreement gain = 4.0pp, natural sessions hitting hardMax = 1.9%, natural mean length = 12.4q. hardMax=16 looks well-set: the cap rarely binds and/or the marginal measurement gain beyond 12–14 questions is modest.
- **confidenceGapThreshold=0.10 review (tiered threshold currently disabled):** 5.7% of natural sessions stop with top1–top2 gap < 0.10; their top-1 agreement = 45.1% vs 44.5% for gap ≥ 0.10 sessions. The 0.10 gap split shows little accuracy separation in this population; the threshold adds little as an extension trigger.

## Noise arm: `moderate`

### Per-trait recovery — Pearson r(true, estimated)

| Trait | r @8q | r @12q | r @16q | MAE @16q | mean samples @16q |
|---|---|---|---|---|---|
| A | 0.634 | 0.651 | 0.708 | 12.5 | 6.4 |
| C | 0.564 | 0.635 | 0.634 | 12.7 | 7.6 |
| E | 0.513 | 0.698 | 0.701 | 11.5 | 9.7 |
| O | 0.553 | 0.631 | 0.647 | 11.9 | 7.1 |
| X | 0.719 | 0.751 | 0.823 | 9.6 | 8.9 |
| P | 0.553 | 0.604 | 0.687 | 10.7 | 6.6 |
| **mean** | **0.589** | **0.662** | **0.700** | | |

### Archetype top-1 agreement & confidence

| Metric | @8q | @12q | @16q | natural stop |
|---|---|---|---|---|
| Top-1 agreement | 23.8% | 26.4% | 32.7% | 28.6% |
| — centroid-mixture respondents | 29.1% | 31.3% | 40.0% | 34.8% |
| — general respondents | 16.1% | 19.3% | 22.1% | 19.6% |
| Mean trait confidence | 0.842 | 0.886 | 0.913 | 0.896 |

### Natural-termination session stats

- Adaptive questions: mean 12.4, median 12, range 12–16
- Hit hardMax (16q): 0.9%; stopped ≤12q: 77.6%
- Mean top1–top2 confidence gap at stop: 0.655; sessions stopping with gap < 0.10: 3.5%
- Per-trait r at natural stop: A=0.657, C=0.612, E=0.660, O=0.626, X=0.761, P=0.639

### Verdict

- **M1 — recovery r ≥ 0.70 @16q (all traits):** ❌ FAIL (C=0.634, O=0.647, P=0.687)
- **M2 — r ≥ 0.50 @8q / ≥ 0.60 @12q / monotone:** ❌ FAIL (non-monotone: C)
- **M3 — archetype top-1 agreement ≥ 85% @16q:** ❌ FAIL (32.7% overall; centroid-mixture 40.0%, general 22.1%)
- **hardMax=16 review:** mean r gain 12q→16q = +0.038, agreement gain = 6.3pp, natural sessions hitting hardMax = 0.9%, natural mean length = 12.4q. hardMax=16 looks well-set: the cap rarely binds and/or the marginal measurement gain beyond 12–14 questions is modest.
- **confidenceGapThreshold=0.10 review (tiered threshold currently disabled):** 3.5% of natural sessions stop with top1–top2 gap < 0.10; their top-1 agreement = 27.5% vs 28.6% for gap ≥ 0.10 sessions. The 0.10 gap split shows little accuracy separation in this population; the threshold adds little as an extension trigger.

---
Generated by `npm run simulate:recovery` (`scripts/simulate/run-recovery-harness.ts`).
