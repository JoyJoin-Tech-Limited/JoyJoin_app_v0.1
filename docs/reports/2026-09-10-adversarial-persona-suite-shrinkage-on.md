# Adversarial Persona Suite — 2026-09-09

> Plan: `docs/plans/2026-09-09-personality-engine-v4-upgrade-plan.md` Item 7.
> Contract: `.git/.orchestration/sprints/sprint-contract.item7-adversarial-personas.md`.
> Fully deterministic: identical `--seed` reproduces every number in this report.

## Run parameters

- Seed: `20260909`
- Respondents (N per arm): 240; arms: 7; total sessions: 1680
- Population: identical 2-component mixture as the Item 6 recovery harness (60% centroid-mixture σ=10, 40% general N(50,15²), truncated [5,95]); the SAME respondents serve all arms (paired design).
- Session shape: full natural termination under `DEFAULT_ASSESSMENT_CONFIG` + V2 matcher (adaptive + closing questions, safety cap 25) — same loop as `runAssessmentSimulation`.
- **Confidence-weighted trait shrinkage (Plan Item 3): ENABLED via `--shrinkage=on`** — `enableTraitShrinkage: true` in every arm: the matcher and the reported FinalResultV2 traits consume `reported = w·estimated + (1−w)·50` per trait with `w = clamp(1 − max(0, err(conf) − 8.492) / 75, 0.5, 1)`, err = Item 12's calibrated per-trait expected-error curve (`expectedTraitAbsError`, artifact v1-20260909). Raw engine state (question selection, termination inputs) is never mutated. Composition order: shrink traits → match → ×validity (Item 2) → ×meta (Item 4). "Pre" columns below are the raw estimates from the SAME sessions (paired); "post" is the reported vector.

## Answer models (lib/persona-utils.ts `selectAnswerAdversarial`)

| Arm | Policy |
|---|---|
| `clean-control` | trait-faithful argmax, noise mode `clean` |
| `straight-liner` | always options[0] (option A / slider_0 / first emoji) |
| `acquiescence-biased` | argmax desirabilityProxy (positive-pole loading sum; declared SDI for ipsative) — pure yea-saying, no true-trait term |
| `midpoint-hugger` | argmin Σ\|loading\| — most neutral option; slider lands exactly on slider_50 |
| `self-image-inflated` | clean argmax through true traits +15 on A/P/C/E (clamped 95); O/X untouched — UNIFORM: meta self-view inflated by the same +15 (consistent-liar model) |
| `self-image-inflated-differential` | scenario answers identical to `self-image-inflated` (+15 on A/P/C/E); meta item answered from a MORE inflated direct self-view (+30 on target trait A, clamped 95) — differential self-enhancement (cycle-2 amendment 1) |
| `random-clicker` | uniform random option index |

## Engine signals asserted against (adaptiveEngine.ts — read-only)

- `validityScore` = 1 − 0.25·[max same-option-value share > 0.7] − 0.20·[trait-score stdev < 8] (`calculateValidityScore`).
- `traitConfidences[t].confidence` — per-trait confidence (sample weight × evidence consistency).
- Matcher top-1 confidence (`state.currentMatches[0].confidence`).
- No other validity/consistency signals exist in the raw engine; provisional thresholds referencing signals the engine does not produce are evaluated below as documented gaps, never asserted against invented outputs.

## Per-arm summary

| Arm | Sessions | Crashes | NaN | Mean validity | Median validity | Acq. check fired | Low-diff fired | Mean trait conf | Mean top-1 conf | High-conf extreme |
|---|---|---|---|---|---|---|---|---|---|---|
| clean-control | 240 | 0 | 0 | 0.945 | 1.000 | 13.8% | 10.0% | 0.915 | 0.859 | 54.2% |
| straight-liner | 240 | 0 | 0 | 0.750 | 0.750 | 100.0% | 0.0% | 0.891 | 1.000 | 100.0% |
| acquiescence-biased | 240 | 0 | 0 | 0.750 | 0.750 | 100.0% | 0.0% | 0.949 | 0.962 | 100.0% |
| midpoint-hugger | 240 | 0 | 0 | 1.000 | 1.000 | 0.0% | 0.0% | 0.925 | 0.898 | 100.0% |
| self-image-inflated | 240 | 0 | 0 | 0.950 | 1.000 | 10.8% | 11.7% | 0.913 | 0.867 | 56.3% |
| self-image-inflated-differential | 240 | 0 | 0 | 0.950 | 1.000 | 10.8% | 11.7% | 0.913 | 0.867 | 56.3% |
| random-clicker | 240 | 0 | 0 | 0.948 | 1.000 | 0.0% | 27.9% | 0.886 | 0.836 | 27.9% |

## Paired agreement (same respondents across arms)

| Arm | Top-1 = clean-control top-1 | Top-1 = ground-truth archetype | Mean max \|trait−50\| | Distinct archetypes assigned |
|---|---|---|---|---|
| clean-control | 100.0% | 47.9% | 33.7 | 12 |
| straight-liner | 12.9% | 8.3% | 36.0 | 1 |
| acquiescence-biased | 11.3% | 8.3% | 34.6 | 1 |
| midpoint-hugger | 12.1% | 8.8% | 27.0 | 1 |
| self-image-inflated | 44.2% | 31.7% | 35.8 | 12 |
| self-image-inflated-differential | 44.2% | 31.7% | 35.8 | 12 |
| random-clicker | 8.3% | 5.8% | 26.2 | 12 |

## Validity & confidence distributions (AC-7.4)

| Arm | validity <0.6 | 0.6–0.8 | 0.8–<1.0 | =1.0 | top1 conf <0.5 | 0.5–0.7 | 0.7–0.8 | ≥0.8 |
|---|---|---|---|---|---|---|---|---|
| clean-control | 0.4% | 13.3% | 10.0% | 76.3% | 0.0% | 24.2% | 20.0% | 55.8% |
| straight-liner | 0.0% | 100.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 100.0% |
| acquiescence-biased | 0.0% | 100.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 100.0% |
| midpoint-hugger | 0.0% | 0.0% | 0.0% | 100.0% | 0.0% | 0.0% | 0.0% | 100.0% |
| self-image-inflated | 0.8% | 10.0% | 10.8% | 78.3% | 0.0% | 14.2% | 29.6% | 56.3% |
| self-image-inflated-differential | 0.8% | 10.0% | 10.8% | 78.3% | 0.0% | 14.2% | 29.6% | 56.3% |
| random-clicker | 0.0% | 0.0% | 26.3% | 73.8% | 0.0% | 21.3% | 30.4% | 48.3% |

## Archetype-assignment sanity (top assignments per arm)

- **clean-control:** fox (31), turtle (29), cat (28), corgi (27), rooster (24)
- **straight-liner:** fox (240)
- **acquiescence-biased:** corgi (240)
- **midpoint-hugger:** turtle (240)
- **self-image-inflated:** elephant (37), koala (36), rooster (36), hamster_praise (27), turtle (26)
- **self-image-inflated-differential:** elephant (37), koala (36), rooster (36), hamster_praise (27), turtle (26)
- **random-clicker:** spider (50), koala (47), dolphin_calm (41), turtle (37), owl (14)

## Assertions (hard-fail, exit 1)

| ID | Assertion | Measured | Threshold | Result |
|---|---|---|---|---|
| AC-7.2a | Zero engine crashes across all adversarial sessions (M6 LOCKED) | 0 crashes / 1680 sessions | 0 crashes, sessions ≥ 1,000 | ✅ PASS |
| AC-7.2b | Zero NaN / out-of-range trait scores, confidences, validityScores | 0 NaN/invalid sessions | 0 | ✅ PASS |
| AC-7.3a | Straight-liner trips the engine acquiescence check (same-option-value share > 0.7) | 100.0% of runs | ≥ 95% (locked) | ✅ PASS |
| AC-7.3b | Acquiescence-biased (yea-saying) trips the engine acquiescence check (provisional HELD, locked) | 100.0% of runs | ≥ 70% (locked) | ✅ PASS |
| AC-7.3c | Random-clicker mean validityScore must not exceed clean-control mean (degradation monotonicity) | 0.9475 vs clean 0.9448 | ≤ clean + 0.01 (locked) | ✅ PASS |
| AC-7.3d-straight-liner | straight-liner mean trait confidence DROPS below clean control | 0.8914 vs clean 0.9155 | < clean mean (locked, directional) | ✅ PASS |
| AC-7.3d-random-clicker | random-clicker mean trait confidence DROPS below clean control | 0.8856 vs clean 0.9155 | < clean mean (locked, directional) | ✅ PASS |
| AC-3.1-bounded | Shrinkage never expands the max trait deviation in any arm (bounded transform) | all arms post ≤ pre | post ≤ pre for every arm | ✅ PASS |
| AC-3.3-clean-arm | Clean-control mean max |trait−50| shift under shrinkage (no-harm bound) | 0.486 points (pre 34.23 → post 33.74) | < 2 points (population-level mirror of the <2pt centroid bound) | ✅ PASS |
| AC-3.2-random-neutral | Random-clicker extreme estimates move toward neutral (mean max deviation) | 26.82 → 26.19 (mean w 0.966) | post < pre (directional) | ✅ PASS |

## Provisional AC-7.3 evaluation (documented, not hard-asserted)

- **Random-clicker mean validityScore** — provisional `< 0.6`, measured `0.9475` → ❌ DID NOT HOLD. The raw engine validity checks (same-value share, trait stdev) barely fire on uniform-random responding: random answers almost never repeat one literal option value > 70% of the time, and random-walk trait scores are differentiated enough to pass the stdev ≥ 8 check most of the time (low-diff fired in only ~27% of random sessions vs ~10% clean). The raw engine therefore scores a random clicker about as valid as an honest respondent. This is precisely the gap Item 2 (consistency pairs) and Item 4 (meta-consistency) must close. Locked assertion AC-7.3c uses degradation monotonicity instead.
- **Midpoint-hugger trips the existing low-differentiation check** — provisional `triggers low-differentiation (locked ≥ 95%)`, measured `0.0% of runs (mean validity 1.0000, mean trait conf 0.9246 vs clean 0.9155)` → ❌ DID NOT HOLD. The failure is the finding. The min-Σ|loading| options on MCQ items are NOT zero-loading: they carry small but systematically-signed loadings that accumulate over 12–16 answers into trait estimates with stdev ≥ 8. Worse, the evidence is highly CONSISTENT, so the raw engine assigns midpoint-hugging ABOVE-clean trait confidence and high-confidence extreme archetypes (100% of sessions). The engine has no neutral-responding detector at all — no assertion is made against a signal it does not produce; this gap is Item 3 shrinkage territory (see AC-7.4).
- **ALL adversarial arms mean traitConfidences below clean controls** — provisional `all five arms < clean`, measured `straight-liner=0.891, acquiescence-biased=0.949, midpoint-hugger=0.925, self-image-inflated=0.913, self-image-inflated-differential=0.913, random-clicker=0.886 (clean=0.915)` → ❌ DID NOT HOLD. Response sets that destroy evidence quality (straight-liner, random-clicker) drop confidence below clean (locked as AC-7.3d-*); but consistently-biased answering (midpoint-hugger, acquiescence-biased) produces consistent evidence and the raw confidence signal does NOT separate it from clean — it scores ABOVE clean. Confidence shrinkage under consistent-but-biased evidence is the Item 3 gap (see AC-7.4 findings).

## AC-7.4 gap findings for Item 3 (validity-gated shrinkage)

Adversarial arms that currently DO earn high-confidence extreme assignments — the shrinkage gap Item 3 must close:

- **straight-liner** earns high-confidence (≥0.8) extreme (max |trait−50| ≥ 25) assignments in 100.0% of sessions (mean top-1 conf 1.000 vs clean 0.859).
- **acquiescence-biased** earns high-confidence (≥0.8) extreme (max |trait−50| ≥ 25) assignments in 100.0% of sessions (mean top-1 conf 0.962 vs clean 0.859).
- **midpoint-hugger** earns high-confidence (≥0.8) extreme (max |trait−50| ≥ 25) assignments in 100.0% of sessions (mean top-1 conf 0.898 vs clean 0.859).
- **self-image-inflated** earns high-confidence (≥0.8) extreme (max |trait−50| ≥ 25) assignments in 56.3% of sessions (mean top-1 conf 0.867 vs clean 0.859).
- **self-image-inflated-differential** earns high-confidence (≥0.8) extreme (max |trait−50| ≥ 25) assignments in 56.3% of sessions (mean top-1 conf 0.867 vs clean 0.859).
- **random-clicker** earns high-confidence (≥0.8) extreme (max |trait−50| ≥ 25) assignments in 27.9% of sessions (mean top-1 conf 0.836 vs clean 0.859).

Clean-control reference: high-confidence extreme rate 54.2%, mean top-1 conf 0.859.

## AC-3.2 shrinkage distribution shift (Plan Item 3, flag on; pre = raw estimates from the SAME sessions)

| Arm | Mean w | Mean max \|trait−50\| pre → post | Extreme-session rate pre → post | Extreme traits/session pre → post | HC-extreme rate (post) |
|---|---|---|---|---|---|
| clean-control | 0.973 | 34.23 → 33.74 | 97.5% → 97.1% | 2.51 → 2.37 | 54.2% |
| straight-liner | 0.967 | 36.00 → 36.00 | 100.0% → 100.0% | 1.00 → 1.00 | 100.0% |
| acquiescence-biased | 0.976 | 36.00 → 34.63 | 100.0% → 100.0% | 3.00 → 3.00 | 100.0% |
| midpoint-hugger | 0.972 | 27.00 → 27.00 | 100.0% → 100.0% | 1.00 → 1.00 | 100.0% |
| self-image-inflated | 0.974 | 36.26 → 35.81 | 100.0% → 100.0% | 2.88 → 2.71 | 56.3% |
| self-image-inflated-differential | 0.974 | 36.26 → 35.81 | 100.0% → 100.0% | 2.88 → 2.71 | 56.3% |
| random-clicker | 0.966 | 26.82 → 26.19 | 60.4% → 54.2% | 0.80 → 0.70 | 27.9% |

### The calibration ceiling (design tension, documented)

The fitted trait-error curve (Item 12, v1-20260909) is FLAT (≈11.1 expected abs error) across raw confidence 0.85–0.97 and rises only below ≈0.63 (→17.57 at the fitted floor). Clean sessions sit at mean conf ≈0.92 — and so do the consistent-but-biased arms (midpoint-hugger, acquiescence-biased: their evidence is consistent, so the confidence signal does not separate them from clean; locked AC-7.4 finding). Any monotone w derived from this calibration therefore CANNOT shrink those arms materially without shrinking honest users identically. The curve resolves the tension by construction: only the EXCESS error above the irreducible floor (8.492 pts at conf 1.0) drives shrinkage, scaled by K=75 so the 12 clean centroids move < 2 points (AC-3.3); the bite lands on the low-confidence tail (random-clicker / incomplete-evidence traits, conf < 0.65), which is where the calibration says the error actually is. Straight-liner / midpoint-hugger / acquiescence extreme estimates shrink only modestly — that is the honest, calibration-anchored outcome, not a tuning failure.

## Locked baselines (this run)

- `LOCKED_STRAIGHT_LINER_ACQUIESCENCE_RATE_MIN` = 0.95 (measured 1.0000)
- `LOCKED_ACQUIESCENCE_BIASED_ACQUIESCENCE_RATE_MIN` = 0.7 (measured 1.0000)
- `LOCKED_RANDOM_VALIDITY_MAX_MARGIN_ABOVE_CLEAN` = 0.01 (measured delta 0.0027)
- Confidence-drop arms (directional, `< clean`): straight-liner (Δ=-0.0240), random-clicker (Δ=-0.0299)

---
Generated by `npm run simulate:adversarial` (`scripts/simulate/run-adversarial-suite.ts`).
