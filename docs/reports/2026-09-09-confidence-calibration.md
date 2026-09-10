# Confidence Calibration — 2026-09-09

> Plan: `docs/plans/2026-09-09-personality-engine-v4-upgrade-plan.md` Item 12.
> Contract: `.git/.orchestration/sprints/sprint-contract.item12-confidence-calibration.md`.
> Artifact: `packages/shared/src/personality/confidenceCalibrationArtifact.ts` (version `v1-20260909`).
> Fully deterministic: `npm run simulate:calibration` at the fixed seed reproduces every number and byte of the artifact.

## Run parameters

- Seed: `20260909`
- Respondents (N): 2000
- Noise arms: `clean`, `moderate`
- Fit set: natural-termination sessions only (4000 sessions, pooled across noise arms)
- Fit method: PAVA isotonic regression on (raw mean trait confidence -> top-1 correct), 6dp rounding; piecewise-linear curve through block centroids

**Fit-set choice (documented per contract):** natural termination matches production session composition (min=10/softMax=12/hardMax=16, confidence early-stop active); forced checkpoints are a measurement instrument, not a production flow. Pooling clean + moderate stands in for unknown real-world answer noise (clean = model ceiling, moderate = realistic bar per the P1a audit). Forced-16 is examined below for comparison only.

## Why: raw confidence is inflated

- Mean raw confidence on the fit set: 0.901
- Observed top-1 agreement on the fit set: 36.6%
- Expected calibration error (ECE), raw confidence: 0.605 -> calibrated: 0.457

| Bin (raw confidence) | n | mean raw | observed agreement | raw inflation | calibrated prediction |
|---|---|---|---|---|---|
| [0.0, 0.1) | 0 | — | — | — | — |
| [0.1, 0.2) | 0 | — | — | — | — |
| [0.2, 0.3) | 0 | — | — | — | — |
| [0.3, 0.4) | 0 | — | — | — | — |
| [0.4, 0.5) | 0 | — | — | — | — |
| [0.5, 0.6) | 0 | — | — | — | — |
| [0.6, 0.7) | 0 | — | — | — | — |
| [0.7, 0.8) | 24 | 0.784 | 25.0% | +0.534 | 0.165 |
| [0.8, 0.9) | 1838 | 0.870 | 33.5% | +0.536 | 0.320 |
| [0.9, 1.0) | 2138 | 0.929 | 39.4% | +0.535 | 0.402 |

## Fitted artifact

### Isotonic blocks (raw mean trait confidence -> observed top-1 agreement)

| Block | x range | n | fitted p |
|---|---|---|---|
| 1 | [0.753, 0.753] | 1 | 0.000 |
| 2 | [0.768, 0.789] | 13 | 0.154 |
| 3 | [0.794, 0.837] | 139 | 0.281 |
| 4 | [0.837, 0.908] | 2054 | 0.330 |
| 5 | [0.908, 0.924] | 622 | 0.341 |
| 6 | [0.924, 0.925] | 43 | 0.372 |
| 7 | [0.925, 0.934] | 257 | 0.405 |
| 8 | [0.934, 0.945] | 303 | 0.449 |
| 9 | [0.945, 0.948] | 149 | 0.450 |
| 10 | [0.948, 0.958] | 213 | 0.465 |
| 11 | [0.958, 0.958] | 6 | 0.500 |
| 12 | [0.958, 0.958] | 4 | 0.500 |
| 13 | [0.958, 0.989] | 196 | 0.536 |

### Correctness curve nodes (piecewise-linear)

| raw confidence x | calibrated P(correct) |
|---|---|
| 0.753 | 0.000 |
| 0.776 | 0.154 |
| 0.822 | 0.281 |
| 0.879 | 0.330 |
| 0.915 | 0.341 |
| 0.925 | 0.372 |
| 0.930 | 0.405 |
| 0.939 | 0.449 |
| 0.946 | 0.450 |
| 0.952 | 0.465 |
| 0.958 | 0.500 |
| 0.958 | 0.500 |
| 0.962 | 0.536 |

### Per-trait error curve nodes (raw per-trait confidence -> expected |trait error|, 0-100 scale)

| raw trait confidence x | expected |error| |
|---|---|
| 0.578 | 17.571 |
| 0.603 | 17.130 |
| 0.605 | 16.807 |
| 0.612 | 15.295 |
| 0.627 | 14.273 |
| 0.634 | 13.516 |
| 0.634 | 13.122 |
| 0.777 | 12.423 |
| 0.863 | 11.337 |
| 0.870 | 11.159 |
| 0.884 | 11.147 |
| 0.967 | 11.092 |
| 1.000 | 8.492 |

Spot check: raw 0.90 -> calibrated 0.336; raw 0.95 -> 0.460; raw 0.70 -> 0.000.

## M15 verification (LOCKED)

Rule: bin the fit set by CALIBRATED confidence (10 equal-width bins); every bin with n >= 50 must satisfy |observed agreement - mean calibrated| <= 0.1.

| Bin (calibrated) | n | mean calibrated | observed agreement | |gap| | status |
|---|---|---|---|---|---|
| [0.0, 0.1) | 2 | 0.048 | 50.0% | 0.452 | insufficient |
| [0.1, 0.2) | 12 | 0.144 | 8.3% | 0.061 | insufficient |
| [0.2, 0.3) | 219 | 0.281 | 30.6% | 0.025 | pass |
| [0.3, 0.4) | 2745 | 0.334 | 34.0% | 0.006 | pass |
| [0.4, 0.5) | 816 | 0.445 | 43.0% | 0.015 | pass |
| [0.5, 0.6) | 206 | 0.515 | 53.4% | 0.019 | pass |
| [0.6, 0.7) | 0 | — | — | — | insufficient |
| [0.7, 0.8) | 0 | — | — | — | insufficient |
| [0.8, 0.9) | 0 | — | — | — | insufficient |
| [0.9, 1.0) | 0 | — | — | — | insufficient |

**M15: PASS** (4 bins evaluated, 0 failed; bins with n < 50 reported as insufficient and not gated).

### Per-noise-arm reliability (context, same rule)

Key structural finding: raw engine confidence is blind to answer noise — at equal raw confidence, clean sessions are systematically MORE accurate than moderate sessions. The pooled fit therefore under-predicts the clean arm and over-predicts the moderate arm, and one or both per-arm tables can show a bin outside ±0.10 even when the pooled M15 gate passes. Consequence for Item 3: calibrated confidence is a noise-regime-averaged probability; shrinkage weights derived from it are conservative for noisy answerers and slightly lax for clean ones.

Arm `clean` — FAIL (4 evaluated, 1 failed, ECE 0.481):

| Bin (calibrated) | n | mean calibrated | observed agreement | |gap| | status |
|---|---|---|---|---|---|
| [0.0, 0.1) | 1 | 0.096 | 100.0% | 0.904 | insufficient |
| [0.1, 0.2) | 2 | 0.115 | 0.0% | 0.115 | insufficient |
| [0.2, 0.3) | 66 | 0.282 | 50.0% | 0.218 | fail |
| [0.3, 0.4) | 1295 | 0.334 | 40.4% | 0.070 | pass |
| [0.4, 0.5) | 491 | 0.447 | 51.3% | 0.066 | pass |
| [0.5, 0.6) | 145 | 0.510 | 56.6% | 0.055 | pass |
| [0.6, 0.7) | 0 | — | — | — | insufficient |
| [0.7, 0.8) | 0 | — | — | — | insufficient |
| [0.8, 0.9) | 0 | — | — | — | insufficient |
| [0.9, 1.0) | 0 | — | — | — | insufficient |

Arm `moderate` — FAIL (4 evaluated, 1 failed, ECE 0.433):

| Bin (calibrated) | n | mean calibrated | observed agreement | |gap| | status |
|---|---|---|---|---|---|
| [0.0, 0.1) | 1 | 0.000 | 0.0% | 0.000 | insufficient |
| [0.1, 0.2) | 10 | 0.150 | 10.0% | 0.050 | insufficient |
| [0.2, 0.3) | 153 | 0.280 | 22.2% | 0.058 | pass |
| [0.3, 0.4) | 1450 | 0.335 | 28.3% | 0.052 | pass |
| [0.4, 0.5) | 325 | 0.442 | 30.5% | 0.138 | fail |
| [0.5, 0.6) | 61 | 0.525 | 45.9% | 0.066 | pass |
| [0.6, 0.7) | 0 | — | — | — | insufficient |
| [0.7, 0.8) | 0 | — | — | — | insufficient |
| [0.8, 0.9) | 0 | — | — | — | insufficient |
| [0.9, 1.0) | 0 | — | — | — | insufficient |

## Forced-16 comparison (context only — not the fit set)

Forced-16 sessions evaluated against the natural-fitted artifact: PASS (ECE 0.469). Forcing every session to 16 questions lifts raw confidence (more samples) without changing production termination, so mild drift vs the natural fit is expected; the artifact intentionally reflects production sessions.

| Bin (calibrated) | n | mean calibrated | observed agreement | |gap| | status |
|---|---|---|---|---|---|
| [0.0, 0.1) | 0 | — | — | — | insufficient |
| [0.1, 0.2) | 0 | — | — | — | insufficient |
| [0.2, 0.3) | 5 | 0.278 | 20.0% | 0.078 | insufficient |
| [0.3, 0.4) | 2701 | 0.343 | 36.5% | 0.023 | pass |
| [0.4, 0.5) | 1061 | 0.445 | 48.1% | 0.036 | pass |
| [0.5, 0.6) | 233 | 0.530 | 48.5% | 0.045 | pass |
| [0.6, 0.7) | 0 | — | — | — | insufficient |
| [0.7, 0.8) | 0 | — | — | — | insufficient |
| [0.8, 0.9) | 0 | — | — | — | insufficient |
| [0.9, 1.0) | 0 | — | — | — | insufficient |
(4000 forced-16 sessions.)

## Consumption boundary

- The calibration is NOT wired into `adaptiveEngine.ts`, `matcherV2.ts`, or any runtime path. Item 3 (confidence-weighted shrinkage, Tier 3) is the sole intended shipping consumer.
- The shared module is pure: no I/O, no randomness, no mutable state. The fitted table is embedded as a versioned constant; regenerate with `npm run simulate:calibration`.

---
Generated by `npm run simulate:calibration` (`scripts/simulate/fit-confidence-calibration.ts`).
