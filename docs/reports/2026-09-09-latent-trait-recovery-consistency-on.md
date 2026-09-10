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
- **Consistency folding (Plan Item 2): ENABLED via `--consistency=on`** — `enableConsistencyFolding: true` in both arms. CP1's first is the anchor Q150 (position 9, zero slot cost); CP2/CP3 firsts are the pure-C/pure-O calibration items injected at positions 10–11 (superseding the calibration phase 1:1, so the displaced C/O signal is restored by the firsts themselves); seconds serve in the closing phase (≥4 spacing by construction, completion guaranteed). Pair disagreement folds into validityScore (0.15 adjacent-level / 0.20 opposite-pole per pair) and traitConfidences (±0.15, never trait scores); the neutral-responding detector and the match-confidence composition step are active; termination reads raw matcher output (lastRawMatches), so session length geometry is flag-off-identical.

## Noise arm: `clean`

### Per-trait recovery — Pearson r(true, estimated)

| Trait | r @8q | r @12q | r @16q | MAE @16q | mean samples @16q |
|---|---|---|---|---|---|
| A | 0.815 | 0.814 | 0.796 | 9.7 | 6.4 |
| C | 0.671 | 0.808 | 0.749 | 10.8 | 8.5 |
| E | 0.616 | 0.779 | 0.762 | 10.6 | 9.6 |
| O | 0.650 | 0.776 | 0.773 | 10.4 | 7.6 |
| X | 0.782 | 0.802 | 0.862 | 11.1 | 8.8 |
| P | 0.625 | 0.669 | 0.723 | 12.2 | 6.8 |
| **mean** | **0.693** | **0.774** | **0.777** | | |

### Archetype top-1 agreement & confidence

| Metric | @8q | @12q | @16q | natural stop |
|---|---|---|---|---|
| Top-1 agreement | 35.7% | 46.7% | 49.8% | 49.4% |
| — centroid-mixture respondents | 38.9% | 50.8% | 56.5% | 51.8% |
| — general respondents | 31.0% | 40.6% | 40.0% | 45.8% |
| Mean trait confidence | 0.840 | 0.893 | 0.918 | 0.931 |

### Natural-termination session stats

- Adaptive questions: mean 12.5, median 12, range 12–16
- Hit hardMax (16q): 2.0%; stopped ≤12q: 70.7%
- Mean top1–top2 confidence gap at stop: 0.629; sessions stopping with gap < 0.10: 3.7%
- Per-trait r at natural stop: A=0.817, C=0.832, E=0.791, O=0.796, X=0.809, P=0.665

### Consistency-folding A/B (Plan Item 2, vs locked post-Item-11 flag-off baseline)

- Pair completion (started → completed): natural 100.0%, forced-16 0.0%; mean pairs started per natural session: 3.00
- Neutral-responding detector fire rate (natural arm): 0.0%
- Natural mean length: 12.48q (locked baseline 12.4q; M14 band 12.6 ± 0.5 → [12.1, 13.1]) ✅ in band

| Trait | r@16q flag-on | r@16q locked | Δ | r@natural flag-on | r@natural locked | Δ | regression > 0.03? |
|---|---|---|---|---|---|---|---|
| A | 0.796 | 0.809 | -0.013 | 0.817 | 0.816 | +0.001 | ✅ no |
| C | 0.749 | 0.706 | +0.043 | 0.832 | 0.751 | +0.081 | ✅ no |
| E | 0.762 | 0.763 | -0.001 | 0.791 | 0.771 | +0.020 | ✅ no |
| O | 0.773 | 0.767 | +0.006 | 0.796 | 0.754 | +0.042 | ✅ no |
| X | 0.862 | 0.865 | -0.003 | 0.809 | 0.820 | -0.011 | ✅ no |
| P | 0.723 | 0.730 | -0.007 | 0.665 | 0.683 | -0.018 | ✅ no |

### Verdict

- **M1 — recovery r ≥ 0.70 @16q (all traits):** ✅ PASS
- **M2 — r ≥ 0.50 @8q / ≥ 0.60 @12q / monotone:** ❌ FAIL (non-monotone: A,C,E,O)
- **M3 — archetype top-1 agreement ≥ 85% @16q:** ❌ FAIL (49.8% overall; centroid-mixture 56.5%, general 40.0%)
- **hardMax=16 review:** mean r gain 12q→16q = +0.003, agreement gain = 3.1pp, natural sessions hitting hardMax = 2.0%, natural mean length = 12.5q. hardMax=16 looks well-set: the cap rarely binds and/or the marginal measurement gain beyond 12–14 questions is modest.
- **confidenceGapThreshold=0.10 review (tiered threshold currently disabled):** 3.7% of natural sessions stop with top1–top2 gap < 0.10; their top-1 agreement = 33.8% vs 49.9% for gap ≥ 0.10 sessions. Low-gap sessions are measurably less accurate, so the 0.10 gap threshold has discriminative value as an extension trigger.

## Noise arm: `moderate`

### Per-trait recovery — Pearson r(true, estimated)

| Trait | r @8q | r @12q | r @16q | MAE @16q | mean samples @16q |
|---|---|---|---|---|---|
| A | 0.634 | 0.646 | 0.694 | 12.7 | 6.4 |
| C | 0.564 | 0.663 | 0.654 | 12.4 | 8.0 |
| E | 0.513 | 0.698 | 0.697 | 11.5 | 9.7 |
| O | 0.553 | 0.647 | 0.669 | 11.5 | 7.2 |
| X | 0.719 | 0.738 | 0.814 | 10.0 | 8.5 |
| P | 0.553 | 0.595 | 0.684 | 10.8 | 6.5 |
| **mean** | **0.589** | **0.665** | **0.702** | | |

### Archetype top-1 agreement & confidence

| Metric | @8q | @12q | @16q | natural stop |
|---|---|---|---|---|
| Top-1 agreement | 23.8% | 27.0% | 34.0% | 31.1% |
| — centroid-mixture respondents | 29.1% | 31.4% | 41.7% | 37.9% |
| — general respondents | 16.1% | 20.6% | 22.7% | 21.3% |
| Mean trait confidence | 0.842 | 0.887 | 0.912 | 0.858 |

### Natural-termination session stats

- Adaptive questions: mean 12.4, median 12, range 12–16
- Hit hardMax (16q): 0.8%; stopped ≤12q: 75.3%
- Mean top1–top2 confidence gap at stop: 0.425; sessions stopping with gap < 0.10: 5.5%
- Per-trait r at natural stop: A=0.662, C=0.714, E=0.732, O=0.696, X=0.758, P=0.634

### Consistency-folding A/B (Plan Item 2, vs locked post-Item-11 flag-off baseline)

- Pair completion (started → completed): natural 100.0%, forced-16 0.0%; mean pairs started per natural session: 3.00
- Neutral-responding detector fire rate (natural arm): 0.0%
- Natural mean length: 12.37q (locked baseline 12.4q; M14 band 12.6 ± 0.5 → [12.1, 13.1]) ✅ in band

| Trait | r@16q flag-on | r@16q locked | Δ | r@natural flag-on | r@natural locked | Δ | regression > 0.03? |
|---|---|---|---|---|---|---|---|
| A | 0.694 | 0.708 | -0.014 | 0.662 | 0.657 | +0.005 | ✅ no |
| C | 0.654 | 0.634 | +0.020 | 0.714 | 0.612 | +0.102 | ✅ no |
| E | 0.697 | 0.701 | -0.004 | 0.732 | 0.660 | +0.072 | ✅ no |
| O | 0.669 | 0.647 | +0.022 | 0.696 | 0.626 | +0.070 | ✅ no |
| X | 0.814 | 0.823 | -0.009 | 0.758 | 0.761 | -0.003 | ✅ no |
| P | 0.684 | 0.687 | -0.003 | 0.634 | 0.639 | -0.005 | ✅ no |

### Verdict

- **M1 — recovery r ≥ 0.70 @16q (all traits):** ❌ FAIL (A=0.694, C=0.654, E=0.697, O=0.669, P=0.684)
- **M2 — r ≥ 0.50 @8q / ≥ 0.60 @12q / monotone:** ❌ FAIL (12q below 0.60: P; non-monotone: C,E)
- **M3 — archetype top-1 agreement ≥ 85% @16q:** ❌ FAIL (34.0% overall; centroid-mixture 41.7%, general 22.7%)
- **hardMax=16 review:** mean r gain 12q→16q = +0.037, agreement gain = 7.0pp, natural sessions hitting hardMax = 0.8%, natural mean length = 12.4q. hardMax=16 looks well-set: the cap rarely binds and/or the marginal measurement gain beyond 12–14 questions is modest.
- **confidenceGapThreshold=0.10 review (tiered threshold currently disabled):** 5.5% of natural sessions stop with top1–top2 gap < 0.10; their top-1 agreement = 20.7% vs 31.8% for gap ≥ 0.10 sessions. Low-gap sessions are measurably less accurate, so the 0.10 gap threshold has discriminative value as an extension trigger.

---
Generated by `npm run simulate:recovery` (`scripts/simulate/run-recovery-harness.ts`).
