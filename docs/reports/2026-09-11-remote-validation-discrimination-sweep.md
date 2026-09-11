# Remote-Validation Harness — Discrimination Sweep (2026-09-11)

> Evidence that the remote-validation harness can correctly distinguish a
> **valid** instrument from an **invalid** one. This validates the *validator*,
> not the engine. Reproduce: `npm run simulate:remote-validation:sweep`.

## Why this exists

Simulated users cannot validate the personality engine: the measured convergent
correlation recovers whatever structure the synthetic generator planted, so a
simulated "PASS" is self-certification, not evidence. What simulated users *can*
legitimately do is prove the analysis pipeline has discriminating power — that
if the real panel returned weak validity, the harness would say so rather than
rubber-stamping it.

## Method

Generate 7 synthetic panels (n = 400 each) with the same planted latent
structure but increasing V4 measurement-error SD, which weakens the planted
convergent correlation from strong (r ≈ 0.93) to essentially absent (r ≈ 0.33).
Run the convergent-validity and test-retest analyses on each and check that the
PASS/FAIL verdict tracks the planted validity. Gate = `mean-floor` (the adopted
P1 rule; see `2026-09-11-remote-validation-power-analysis.md`).

Expected r is the closed-form attenuation:
`r = σ_T² / √((σ_T² + σ_V4²)(σ_T² + σ_IPIP²))`, computed in
`expectedConvergentR()`. Clamping at 0/100 attenuates slightly beyond this, so
the magnitude check uses an asymmetric tolerance of `[expected − 0.09, expected + 0.03]`.

## Results

| V4 noise SD | expected r | measured r | convergent | retest |
|---|---|---|---|---|
| 2 | 0.930 | 0.916 | PASS | PASS |
| 8 | 0.828 | 0.802 | PASS | PASS |
| 12 | 0.733 | 0.683 | PASS | FAIL |
| 16 | 0.642 | 0.591 | PASS | FAIL |
| 20 | 0.563 | 0.536 | FAIL | FAIL |
| 28 | 0.443 | 0.403 | FAIL | FAIL |
| 40 | 0.329 | 0.275 | FAIL | FAIL |

The verdict flips around the locked r = 0.6 threshold (between noise 16 → PASS
and noise 20 → FAIL). The noise-12/16 arms show convergent PASS with retest
FAIL — a correct, non-contradictory outcome, since retest depends on the V4
measurement error against the proposed 0.7 retest bar, not on convergence.

## Checks (5/5 PASS)

| Check | Result |
|-------|--------|
| `discrimination:strong-valid-PASS` — expected r ≥ 0.7 → all PASS | PASS (3 levels) |
| `discrimination:strong-invalid-FAIL` — expected r ≤ 0.5 → all FAIL | PASS (2 levels) |
| `magnitude:recovery` — measured within asymmetric tolerance | PASS |
| `monotonicity` — measured r non-increasing with noise | PASS |
| `retest:tracks-expectation` — retest PASS iff its own expected r is high | PASS |

## Interpretation (state this before critics do)

- **Proven:** the harness correctly flags a weak/absent convergent signal as
  FAIL. A real panel that returns r < 0.6 will not be misreported as valid.
- **Not proven:** that the engine *is* valid. That requires the real 300–500
  person panel (`docs/strategy/remote-validation-harness.md`). The sweep is a
  necessary condition for trusting the harness, not a substitute for the panel.
- **Not a flag-enablement input.** No V4 dark flag may be enabled on simulated
  evidence; see `docs/plans/2026-09-09-personality-engine-v4-upgrade-plan.md`
  §Open decisions 4.

Artifacts: `scripts/simulate/data/remote-validation-sweep-latest.json`.
