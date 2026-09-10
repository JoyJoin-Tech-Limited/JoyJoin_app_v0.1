# Adversarial Persona Suite — 2026-09-09

> Plan: `docs/plans/2026-09-09-personality-engine-v4-upgrade-plan.md` Item 7.
> Contract: `.git/.orchestration/sprints/sprint-contract.item7-adversarial-personas.md`.
> Fully deterministic: identical `--seed` reproduces every number in this report.

## Run parameters

- Seed: `20260909`
- Respondents (N per arm): 240; arms: 6; total sessions: 1440
- Population: identical 2-component mixture as the Item 6 recovery harness (60% centroid-mixture σ=10, 40% general N(50,15²), truncated [5,95]); the SAME respondents serve all arms (paired design).
- Session shape: full natural termination under `DEFAULT_ASSESSMENT_CONFIG` + V2 matcher (adaptive + closing questions, safety cap 25) — same loop as `runAssessmentSimulation`.

## Answer models (lib/persona-utils.ts `selectAnswerAdversarial`)

| Arm | Policy |
|---|---|
| `clean-control` | trait-faithful argmax, noise mode `clean` |
| `straight-liner` | always options[0] (option A / slider_0 / first emoji) |
| `acquiescence-biased` | argmax desirabilityProxy (positive-pole loading sum; declared SDI for ipsative) — pure yea-saying, no true-trait term |
| `midpoint-hugger` | argmin Σ\|loading\| — most neutral option; slider lands exactly on slider_50 |
| `self-image-inflated` | clean argmax through true traits +15 on A/P/C/E (clamped 95); O/X untouched |
| `random-clicker` | uniform random option index |

## Engine signals asserted against (adaptiveEngine.ts — read-only)

- `validityScore` = 1 − 0.25·[max same-option-value share > 0.7] − 0.20·[trait-score stdev < 8] (`calculateValidityScore`).
- `traitConfidences[t].confidence` — per-trait confidence (sample weight × evidence consistency).
- Matcher top-1 confidence (`state.currentMatches[0].confidence`).
- No other validity/consistency signals exist in the raw engine; provisional thresholds referencing signals the engine does not produce are evaluated below as documented gaps, never asserted against invented outputs.

## Per-arm summary

| Arm | Sessions | Crashes | NaN | Mean validity | Median validity | Acq. check fired | Low-diff fired | Mean trait conf | Mean top-1 conf | High-conf extreme |
|---|---|---|---|---|---|---|---|---|---|---|
| clean-control | 240 | 0 | 0 | 0.945 | 1.000 | 13.8% | 10.4% | 0.915 | 0.862 | 56.3% |
| straight-liner | 240 | 0 | 0 | 0.750 | 0.750 | 100.0% | 0.0% | 0.891 | 1.000 | 100.0% |
| acquiescence-biased | 240 | 0 | 0 | 0.750 | 0.750 | 100.0% | 0.0% | 0.949 | 0.964 | 100.0% |
| midpoint-hugger | 240 | 0 | 0 | 1.000 | 1.000 | 0.0% | 0.0% | 0.925 | 0.896 | 100.0% |
| self-image-inflated | 240 | 0 | 0 | 0.948 | 1.000 | 10.8% | 12.5% | 0.913 | 0.862 | 54.2% |
| random-clicker | 240 | 0 | 0 | 0.947 | 1.000 | 0.0% | 26.7% | 0.885 | 0.832 | 32.1% |

## Paired agreement (same respondents across arms)

| Arm | Top-1 = clean-control top-1 | Top-1 = ground-truth archetype | Mean max \|trait−50\| | Distinct archetypes assigned |
|---|---|---|---|---|
| clean-control | 100.0% | 46.3% | 34.2 | 12 |
| straight-liner | 12.9% | 8.3% | 36.0 | 1 |
| acquiescence-biased | 12.5% | 8.3% | 36.0 | 1 |
| midpoint-hugger | 11.7% | 8.8% | 27.0 | 1 |
| self-image-inflated | 45.4% | 32.5% | 36.3 | 12 |
| random-clicker | 9.6% | 4.6% | 26.8 | 12 |

## Validity & confidence distributions (AC-7.4)

| Arm | validity <0.6 | 0.6–0.8 | 0.8–<1.0 | =1.0 | top1 conf <0.5 | 0.5–0.7 | 0.7–0.8 | ≥0.8 |
|---|---|---|---|---|---|---|---|---|
| clean-control | 0.4% | 13.3% | 10.0% | 76.3% | 0.0% | 25.8% | 16.7% | 57.5% |
| straight-liner | 0.0% | 100.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 100.0% |
| acquiescence-biased | 0.0% | 100.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 100.0% |
| midpoint-hugger | 0.0% | 0.0% | 0.0% | 100.0% | 0.0% | 0.0% | 0.0% | 100.0% |
| self-image-inflated | 0.8% | 10.0% | 11.7% | 77.5% | 0.0% | 13.8% | 32.1% | 54.2% |
| random-clicker | 0.0% | 0.0% | 26.7% | 73.3% | 0.0% | 22.9% | 29.6% | 47.5% |

## Archetype-assignment sanity (top assignments per arm)

- **clean-control:** fox (31), corgi (30), cat (28), turtle (28), rooster (23)
- **straight-liner:** fox (240)
- **acquiescence-biased:** corgi (240)
- **midpoint-hugger:** turtle (240)
- **self-image-inflated:** elephant (37), koala (37), rooster (34), hamster_praise (30), corgi (27)
- **random-clicker:** spider (55), koala (54), turtle (36), dolphin_calm (31), hamster_praise (15)

## Assertions (hard-fail, exit 1)

| ID | Assertion | Measured | Threshold | Result |
|---|---|---|---|---|
| AC-7.2a | Zero engine crashes across all adversarial sessions (M6 LOCKED) | 0 crashes / 1440 sessions | 0 crashes, sessions ≥ 1,000 | ✅ PASS |
| AC-7.2b | Zero NaN / out-of-range trait scores, confidences, validityScores | 0 NaN/invalid sessions | 0 | ✅ PASS |
| AC-7.3a | Straight-liner trips the engine acquiescence check (same-option-value share > 0.7) | 100.0% of runs | ≥ 95% (locked) | ✅ PASS |
| AC-7.3b | Acquiescence-biased (yea-saying) trips the engine acquiescence check (provisional HELD, locked) | 100.0% of runs | ≥ 70% (locked) | ✅ PASS |
| AC-7.3c | Random-clicker mean validityScore must not exceed clean-control mean (degradation monotonicity) | 0.9467 vs clean 0.9448 | ≤ clean + 0.01 (locked) | ✅ PASS |
| AC-7.3d-straight-liner | straight-liner mean trait confidence DROPS below clean control | 0.8914 vs clean 0.9155 | < clean mean (locked, directional) | ✅ PASS |
| AC-7.3d-random-clicker | random-clicker mean trait confidence DROPS below clean control | 0.8849 vs clean 0.9155 | < clean mean (locked, directional) | ✅ PASS |

## Provisional AC-7.3 evaluation (documented, not hard-asserted)

- **Random-clicker mean validityScore** — provisional `< 0.6`, measured `0.9467` → ❌ DID NOT HOLD. The raw engine validity checks (same-value share, trait stdev) barely fire on uniform-random responding: random answers almost never repeat one literal option value > 70% of the time, and random-walk trait scores are differentiated enough to pass the stdev ≥ 8 check most of the time (low-diff fired in only ~27% of random sessions vs ~10% clean). The raw engine therefore scores a random clicker about as valid as an honest respondent. This is precisely the gap Item 2 (consistency pairs) and Item 4 (meta-consistency) must close. Locked assertion AC-7.3c uses degradation monotonicity instead.
- **Midpoint-hugger trips the existing low-differentiation check** — provisional `triggers low-differentiation (locked ≥ 95%)`, measured `0.0% of runs (mean validity 1.0000, mean trait conf 0.9246 vs clean 0.9155)` → ❌ DID NOT HOLD. The failure is the finding. The min-Σ|loading| options on MCQ items are NOT zero-loading: they carry small but systematically-signed loadings that accumulate over 12–16 answers into trait estimates with stdev ≥ 8. Worse, the evidence is highly CONSISTENT, so the raw engine assigns midpoint-hugging ABOVE-clean trait confidence and high-confidence extreme archetypes (100% of sessions). The engine has no neutral-responding detector at all — no assertion is made against a signal it does not produce; this gap is Item 3 shrinkage territory (see AC-7.4).
- **ALL adversarial arms mean traitConfidences below clean controls** — provisional `all five arms < clean`, measured `straight-liner=0.891, acquiescence-biased=0.949, midpoint-hugger=0.925, self-image-inflated=0.913, random-clicker=0.885 (clean=0.915)` → ❌ DID NOT HOLD. Response sets that destroy evidence quality (straight-liner, random-clicker) drop confidence below clean (locked as AC-7.3d-*); but consistently-biased answering (midpoint-hugger, acquiescence-biased) produces consistent evidence and the raw confidence signal does NOT separate it from clean — it scores ABOVE clean. Confidence shrinkage under consistent-but-biased evidence is the Item 3 gap (see AC-7.4 findings).

## AC-7.4 gap findings for Item 3 (validity-gated shrinkage)

Adversarial arms that currently DO earn high-confidence extreme assignments — the shrinkage gap Item 3 must close:

- **straight-liner** earns high-confidence (≥0.8) extreme (max |trait−50| ≥ 25) assignments in 100.0% of sessions (mean top-1 conf 1.000 vs clean 0.862).
- **acquiescence-biased** earns high-confidence (≥0.8) extreme (max |trait−50| ≥ 25) assignments in 100.0% of sessions (mean top-1 conf 0.964 vs clean 0.862).
- **midpoint-hugger** earns high-confidence (≥0.8) extreme (max |trait−50| ≥ 25) assignments in 100.0% of sessions (mean top-1 conf 0.896 vs clean 0.862).
- **self-image-inflated** earns high-confidence (≥0.8) extreme (max |trait−50| ≥ 25) assignments in 54.2% of sessions (mean top-1 conf 0.862 vs clean 0.862).
- **random-clicker** earns high-confidence (≥0.8) extreme (max |trait−50| ≥ 25) assignments in 32.1% of sessions (mean top-1 conf 0.832 vs clean 0.862).

Clean-control reference: high-confidence extreme rate 56.3%, mean top-1 conf 0.862.

## Locked baselines (this run)

- `LOCKED_STRAIGHT_LINER_ACQUIESCENCE_RATE_MIN` = 0.95 (measured 1.0000)
- `LOCKED_ACQUIESCENCE_BIASED_ACQUIESCENCE_RATE_MIN` = 0.7 (measured 1.0000)
- `LOCKED_RANDOM_VALIDITY_MAX_MARGIN_ABOVE_CLEAN` = 0.01 (measured delta 0.0019)
- Confidence-drop arms (directional, `< clean`): straight-liner (Δ=-0.0240), random-clicker (Δ=-0.0306)

---
Generated by `npm run simulate:adversarial` (`scripts/simulate/run-adversarial-suite.ts`).
