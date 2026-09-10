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
- **Confidence-weighted trait shrinkage (Plan Item 3): ENABLED via `--shrinkage=on`** — `enableTraitShrinkage: true` in both arms. At the match boundary each estimated trait is reported as `w·estimated + (1−w)·50` with `w = clamp(1 − max(0, err(conf) − 8.492) / 75, 0.5, 1)`, where `err(conf)` is Item 12's calibrated per-trait expected-error curve (`expectedTraitAbsError`, artifact v1-20260909: err 17.57 @ conf 0.578 → 8.49 @ conf 1.0). The A/B below measures r/MAE on the REPORTED (shrunken) vector — what the matcher and downstream consumers see; raw engine state (question selection, termination inputs) is untouched by construction. Per the locked AC-7.4 ceiling the calibrated error curve is flat (≈11.1) across conf 0.85–0.97 where both clean and consistent-but-biased answering sit, so the curve is deliberately conservative: near-identity for well-measured traits, biting only the low-confidence tail (conf < 0.65).

## Noise arm: `clean`

### Per-trait recovery — Pearson r(true, estimated)

| Trait | r @8q | r @12q | r @16q | MAE @16q | mean samples @16q |
|---|---|---|---|---|---|
| A | 0.820 | 0.820 | 0.807 | 9.7 | 6.4 |
| C | 0.678 | 0.758 | 0.707 | 11.6 | 7.9 |
| E | 0.619 | 0.774 | 0.763 | 10.5 | 9.6 |
| O | 0.662 | 0.754 | 0.768 | 10.5 | 7.4 |
| X | 0.787 | 0.816 | 0.865 | 10.2 | 9.3 |
| P | 0.627 | 0.694 | 0.729 | 11.6 | 7.0 |
| **mean** | **0.699** | **0.769** | **0.773** | | |

### Archetype top-1 agreement & confidence

| Metric | @8q | @12q | @16q | natural stop |
|---|---|---|---|---|
| Top-1 agreement | 37.0% | 42.4% | 47.8% | 43.0% |
| — centroid-mixture respondents | 41.2% | 46.5% | 54.3% | 47.3% |
| — general respondents | 30.8% | 36.4% | 38.3% | 36.7% |
| Mean trait confidence | 0.840 | 0.893 | 0.920 | 0.907 |

### Natural-termination session stats

- Adaptive questions: mean 12.4, median 12, range 12–16
- Hit hardMax (16q): 1.9%; stopped ≤12q: 73.3%
- Mean top1–top2 confidence gap at stop: 0.659; sessions stopping with gap < 0.10: 4.3%
- Per-trait r at natural stop: A=0.814, C=0.754, E=0.774, O=0.756, X=0.821, P=0.689

### Trait-shrinkage A/B (Plan Item 3, vs locked post-Item-11 flag-off baseline)

- Mean max |reported − raw| per natural session: 1.142 points (AC-3.3 no-harm side: clean-arm traits must be near-identity)
- Natural mean length: 12.44q (locked baseline 12.4q; M14 band 12.6 ± 0.5) ✅ in band

| Trait | r@16q flag-on | r@16q locked | Δ | r@natural flag-on | r@natural locked | Δ | regression > 0.03? |
|---|---|---|---|---|---|---|---|
| A | 0.807 | 0.809 | -0.002 | 0.814 | 0.816 | -0.002 | ✅ no |
| C | 0.707 | 0.706 | +0.001 | 0.754 | 0.751 | +0.003 | ✅ no |
| E | 0.763 | 0.763 | -0.000 | 0.774 | 0.771 | +0.003 | ✅ no |
| O | 0.768 | 0.767 | +0.001 | 0.756 | 0.754 | +0.002 | ✅ no |
| X | 0.865 | 0.865 | -0.000 | 0.821 | 0.820 | +0.001 | ✅ no |
| P | 0.729 | 0.730 | -0.001 | 0.689 | 0.683 | +0.006 | ✅ no |

Note: r is computed on the REPORTED (shrunken) vector — the shrink is a per-session affine pull toward 50 with w ∈ [~0.88, 1], so clean-arm r moves only through the w-variance across respondents, not through added noise.

### Verdict

- **M1 — recovery r ≥ 0.70 @16q (all traits):** ✅ PASS
- **M2 — r ≥ 0.50 @8q / ≥ 0.60 @12q / monotone:** ❌ FAIL (non-monotone: A,C,E)
- **M3 — archetype top-1 agreement ≥ 85% @16q:** ❌ FAIL (47.8% overall; centroid-mixture 54.3%, general 38.3%)
- **hardMax=16 review:** mean r gain 12q→16q = +0.004, agreement gain = 5.4pp, natural sessions hitting hardMax = 1.9%, natural mean length = 12.4q. hardMax=16 looks well-set: the cap rarely binds and/or the marginal measurement gain beyond 12–14 questions is modest.
- **confidenceGapThreshold=0.10 review (tiered threshold currently disabled):** 4.3% of natural sessions stop with top1–top2 gap < 0.10; their top-1 agreement = 38.4% vs 43.2% for gap ≥ 0.10 sessions. The 0.10 gap split shows little accuracy separation in this population; the threshold adds little as an extension trigger.

## Noise arm: `moderate`

### Per-trait recovery — Pearson r(true, estimated)

| Trait | r @8q | r @12q | r @16q | MAE @16q | mean samples @16q |
|---|---|---|---|---|---|
| A | 0.644 | 0.659 | 0.712 | 12.1 | 6.4 |
| C | 0.572 | 0.638 | 0.635 | 12.7 | 7.6 |
| E | 0.515 | 0.699 | 0.700 | 11.4 | 9.7 |
| O | 0.565 | 0.634 | 0.648 | 11.7 | 7.1 |
| X | 0.722 | 0.753 | 0.824 | 9.4 | 8.9 |
| P | 0.558 | 0.609 | 0.684 | 10.7 | 6.6 |
| **mean** | **0.596** | **0.665** | **0.701** | | |

### Archetype top-1 agreement & confidence

| Metric | @8q | @12q | @16q | natural stop |
|---|---|---|---|---|
| Top-1 agreement | 23.6% | 26.4% | 32.7% | 28.8% |
| — centroid-mixture respondents | 29.0% | 31.6% | 40.1% | 35.1% |
| — general respondents | 15.7% | 18.8% | 22.0% | 19.8% |
| Mean trait confidence | 0.842 | 0.886 | 0.913 | 0.896 |

### Natural-termination session stats

- Adaptive questions: mean 12.3, median 12, range 12–16
- Hit hardMax (16q): 0.9%; stopped ≤12q: 77.5%
- Mean top1–top2 confidence gap at stop: 0.653; sessions stopping with gap < 0.10: 3.3%
- Per-trait r at natural stop: A=0.665, C=0.613, E=0.660, O=0.630, X=0.762, P=0.643

### Trait-shrinkage A/B (Plan Item 3, vs locked post-Item-11 flag-off baseline)

- Mean max |reported − raw| per natural session: 1.146 points (AC-3.3 no-harm side: clean-arm traits must be near-identity)
- Natural mean length: 12.35q (locked baseline 12.4q; M14 band 12.6 ± 0.5) ✅ in band

| Trait | r@16q flag-on | r@16q locked | Δ | r@natural flag-on | r@natural locked | Δ | regression > 0.03? |
|---|---|---|---|---|---|---|---|
| A | 0.712 | 0.708 | +0.004 | 0.665 | 0.657 | +0.008 | ✅ no |
| C | 0.635 | 0.634 | +0.001 | 0.613 | 0.612 | +0.001 | ✅ no |
| E | 0.700 | 0.701 | -0.001 | 0.660 | 0.660 | +0.000 | ✅ no |
| O | 0.648 | 0.647 | +0.001 | 0.630 | 0.626 | +0.004 | ✅ no |
| X | 0.824 | 0.823 | +0.001 | 0.762 | 0.761 | +0.001 | ✅ no |
| P | 0.684 | 0.687 | -0.003 | 0.643 | 0.639 | +0.004 | ✅ no |

Note: r is computed on the REPORTED (shrunken) vector — the shrink is a per-session affine pull toward 50 with w ∈ [~0.88, 1], so clean-arm r moves only through the w-variance across respondents, not through added noise.

### Verdict

- **M1 — recovery r ≥ 0.70 @16q (all traits):** ❌ FAIL (C=0.635, O=0.648, P=0.684)
- **M2 — r ≥ 0.50 @8q / ≥ 0.60 @12q / monotone:** ❌ FAIL (non-monotone: C)
- **M3 — archetype top-1 agreement ≥ 85% @16q:** ❌ FAIL (32.7% overall; centroid-mixture 40.1%, general 22.0%)
- **hardMax=16 review:** mean r gain 12q→16q = +0.035, agreement gain = 6.3pp, natural sessions hitting hardMax = 0.9%, natural mean length = 12.3q. hardMax=16 looks well-set: the cap rarely binds and/or the marginal measurement gain beyond 12–14 questions is modest.
- **confidenceGapThreshold=0.10 review (tiered threshold currently disabled):** 3.3% of natural sessions stop with top1–top2 gap < 0.10; their top-1 agreement = 25.8% vs 29.0% for gap ≥ 0.10 sessions. The 0.10 gap split shows little accuracy separation in this population; the threshold adds little as an extension trigger.

---
Generated by `npm run simulate:recovery` (`scripts/simulate/run-recovery-harness.ts`).
