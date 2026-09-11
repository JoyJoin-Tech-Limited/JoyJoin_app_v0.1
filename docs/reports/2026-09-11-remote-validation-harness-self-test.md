# Remote Validation Report

**Panel:** synthetic-self-test  
**Instrument:** IPIP Big-Five Factor Markers (50-item; 10 per factor)  
**Collected:** 2026-09-11T00:00:00.000Z  
**Respondents:** 400  
**Vibe sessions:** 78

> Generated fixture — planted structure for harness self-test only. NOT real panel data.

## Results

| Analysis | Status | Measured | Threshold |
|---|---|---|---|
| Convergent validity — mean-floor gate (mean r ≥ 0.6, min r ≥ 0.5) | PASS | mean r 0.826, min r 0.811 (n=400) | mean r ≥ 0.6 and min r ≥ 0.5, n ≥ 30 |
| Test-retest stability — mean trait r ≥ 0.7 | PASS | mean r 0.768 (n=400) | mean r ≥ 0.7, n ≥ 20 |
| Vibe-simulation — trait composition predicts 同频 | PASS | R² 0.861, minE β 0.331 | R² ≥ 0.05 and ≥1 core composition predictor positive at α=0.05 |
| Narrative A/B — answer_citing scores higher | PASS | answer_citing 4.54 vs rest 4.12 (Δ=0.43, p=0.0003) | positive Δ and p < 0.05 |

### Convergent validity (per trait)

| ACOEXP | Big Five | sign | r | 95% CI | n | gated |
|---|---|---|---|---|---|---|
| A | agreeableness | + | 0.819 | [0.784, 0.849] | 400 | yes |
| C | conscientiousness | + | 0.816 | [0.78, 0.846] | 400 | yes |
| E | emotional_stability | + | 0.839 | [0.808, 0.866] | 400 | yes |
| O | openness | + | 0.847 | [0.817, 0.872] | 400 | yes |
| X | extraversion | + | 0.811 | [0.774, 0.842] | 400 | yes |
| P | extraversion | + | 0.578 | [0.509, 0.64] | 400 | no |

**Divergent (reported, not gated):**
- P: r=0.578 — Positivity is a JoyJoin-specific positive-affect remix; closest Big Five facet is Extraversion warmth, so its correlation is exploratory.

### Vibe composition regression (standardized)

| Predictor | β | SE | t | p |
|---|---|---|---|---|
| meanA | 0.079 | 0.047 | 1.67 | 0.0995 |
| meanC | 0.194 | 0.045 | 4.34 | 0 |
| minE | 0.331 | 0.047 | 7.11 | 0 |
| spark | 0.333 | 0.052 | 6.38 | 0 |
| xVariance | -0.898 | 0.055 | -16.22 | 0 |

Model R² = 0.861, adj R² = 0.851

### Narrative A/B

| Arm | n | mean |
|---|---|---|
| answer_citing | 200 | 4.544 |
| generic | 200 | 4.115 |

Welch t=3.691, df=397.8, p=0.0003

## Threshold provenance

| Analysis | Threshold | Locked? | Source |
|---|---|---|---|
| convergent | r ≥ 0.6 | LOCKED | scientific-foundation.md §Pre-launch validation program 1 |
| retest | mean r ≥ 0.7 | proposed | proposed — 4-week Big Five domain stability bar |
| vibe | see detail | proposed | proposed — composition predicts 同频 |
| narrative | see detail | proposed | proposed — hypothesized arm scores higher |

Locked = may block rollout. Proposed = requires plan-owner ratification.
