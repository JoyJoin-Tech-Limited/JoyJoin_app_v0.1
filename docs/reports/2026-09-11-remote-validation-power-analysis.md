# Remote-Validation — Convergent-Gate Power Analysis (2026-09-11)

> Settles the convergent-validity decision rule and the panel size (plan P1).
> Reproduce: `npm run simulate:remote-validation:power`.

## Question

The protocol requires convergent validity on five mapped ACOEXP↔IPIP factors at
r ≈ 0.6. Two decision rules are possible:

- **`all`** — every factor r ≥ 0.6 (strict conjunction).
- **`mean-floor`** — mean r ≥ 0.6 **and** every factor ≥ 0.5.

Which rule, at which panel size, avoids false-FAILing a genuinely valid
instrument?

## Method

Monte-Carlo (20,000 reps) over the five gated traits' observed correlations,
sampled by Fisher-z:
`z_obs ~ Normal(fisherZ(r_true), 1/√(N−3))`, `r_obs = tanh(z_obs)`. Traits are
treated as independent across domains (conservative for the conjunction). The
PASS probability is the power when the instrument is genuinely valid.

## Results — PASS probability

**N = 300**

| true r | `all` | `mean-floor` |
|---|---|---|
| 0.55 | 0.000 | 0.002 |
| 0.60 | 0.032 | 0.472 |
| 0.65 | 0.658 | 0.998 |
| 0.70 | 0.993 | 1.000 |
| 0.75 | 1.000 | 1.000 |

**N = 400**

| true r | `all` | `mean-floor` |
|---|---|---|
| 0.55 | 0.000 | 0.000 |
| 0.60 | 0.032 | 0.477 |
| 0.65 | 0.772 | 1.000 |
| 0.70 | 0.999 | 1.000 |
| 0.75 | 1.000 | 1.000 |

**N = 500**

| true r | `all` | `mean-floor` |
|---|---|---|
| 0.55 | 0.000 | 0.000 |
| 0.60 | 0.032 | 0.479 |
| 0.65 | 0.838 | 1.000 |
| 0.70 | 1.000 | 1.000 |
| 0.75 | 1.000 | 1.000 |

**N for 90% power at true r = 0.65:** `all` → **N ≥ 625**; `mean-floor` → **N ≥ 100**.

## Findings

1. **`all` is badly underpowered near the target.** A genuinely valid instrument
   with true per-factor r = 0.65 passes the strict conjunction only 66–84% of the
   time across N = 300–500. The cause is structural: requiring the *minimum* of
   five correlations to exceed 0.6 rejects the instrument whenever any single
   factor dips, which happens routinely even when the true mean is well above 0.6.
2. **`mean-floor` is well-calibrated.** It reaches ~100% power at N = 400 when
   true r = 0.65, and at true r = 0.60 it sits near a coin-flip (0.47) — the
   correct behavior at a threshold value.
3. **At true r = 0.60 both rules are ~50/50 or worse.** This is expected for a
   threshold at 0.6; it is not a defect. The study must therefore target a true
   r comfortably above 0.6, not exactly at it.

## Decision (P1)

- **Adopt `mean-floor`** as the convergent decision rule (mean r ≥ 0.6, every
  factor ≥ 0.5). It preserves the average-validity claim while tolerating one
  mildly-attenuated factor.
- **Set the panel target at N = 400** (the protocol's 300–500 range). `mean-floor`
  is fully powered there; the strict `all` rule would need N ≥ 625 and is out of
  scope.
- **Keep `all` available** via `--gate-mode=all` for sensitivity reporting only.

Reflected in `scientific-foundation.md` §Pre-launch validation program and
`remote-validation-harness.md` §Convergent gate rule. Artifact:
`scripts/simulate/data/remote-validation-power-latest.json`.

## Boundary

This analysis calibrates a *decision rule* under assumed sampling behavior; it
does not measure the engine. Whether true convergent r exceeds 0.6 remains an
empirical question for the real panel.
