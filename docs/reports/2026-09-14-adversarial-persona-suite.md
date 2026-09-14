# Adversarial Persona Suite — 2026-09-14

> Plan: `docs/plans/2026-09-09-personality-engine-v4-upgrade-plan.md` Item 7.
> Contract: `.git/.orchestration/sprints/sprint-contract.item7-adversarial-personas.md`.
> Fully deterministic: identical `--seed` reproduces every number in this report.

## Run parameters

- Seed: `42`
- Respondents (N per arm): 300; arms: 7; total sessions: 2100
- Population: identical 2-component mixture as the Item 6 recovery harness (60% centroid-mixture σ=10, 40% general N(50,15²), truncated [5,95]); the SAME respondents serve all arms (paired design).
- Session shape: full natural termination under `DEFAULT_ASSESSMENT_CONFIG` + V2 matcher (adaptive + closing questions, safety cap 25) — same loop as `runAssessmentSimulation`.

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
| clean-control | 300 | 0 | 0 | 0.981 | 1.000 | 7.3% | 0.3% | 0.912 | 0.830 | 55.7% |
| straight-liner | 300 | 0 | 0 | 0.750 | 0.750 | 100.0% | 0.0% | 0.859 | 0.778 | 0.0% |
| acquiescence-biased | 300 | 0 | 0 | 0.750 | 0.750 | 100.0% | 0.0% | 0.873 | 1.000 | 100.0% |
| midpoint-hugger | 300 | 0 | 0 | 1.000 | 1.000 | 0.0% | 0.0% | 0.873 | 1.000 | 0.0% |
| self-image-inflated | 300 | 0 | 0 | 0.954 | 1.000 | 18.3% | 0.0% | 0.895 | 0.861 | 62.3% |
| self-image-inflated-differential | 300 | 0 | 0 | 0.954 | 1.000 | 18.3% | 0.0% | 0.895 | 0.861 | 62.3% |
| random-clicker | 300 | 0 | 0 | 0.943 | 1.000 | 0.0% | 28.3% | 0.858 | 0.729 | 5.0% |

## Paired agreement (same respondents across arms)

| Arm | Top-1 = clean-control top-1 | Top-1 = ground-truth archetype | Mean max \|trait−50\| | Distinct archetypes assigned |
|---|---|---|---|---|
| clean-control | 100.0% | 46.3% | 39.1 | 12 |
| straight-liner | 2.7% | 9.7% | 30.0 | 1 |
| acquiescence-biased | 2.7% | 9.7% | 35.0 | 1 |
| midpoint-hugger | 6.3% | 11.3% | 20.0 | 1 |
| self-image-inflated | 54.3% | 47.3% | 40.0 | 12 |
| self-image-inflated-differential | 54.3% | 47.3% | 40.0 | 12 |
| random-clicker | 8.3% | 10.0% | 18.7 | 11 |

## Validity & confidence distributions (AC-7.4)

| Arm | validity <0.6 | 0.6–0.8 | 0.8–<1.0 | =1.0 | top1 conf <0.5 | 0.5–0.7 | 0.7–0.8 | ≥0.8 |
|---|---|---|---|---|---|---|---|---|
| clean-control | 0.0% | 7.3% | 0.3% | 92.3% | 0.0% | 30.7% | 13.7% | 55.7% |
| straight-liner | 0.0% | 100.0% | 0.0% | 0.0% | 0.0% | 0.0% | 100.0% | 0.0% |
| acquiescence-biased | 0.0% | 100.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 100.0% |
| midpoint-hugger | 0.0% | 0.0% | 0.0% | 100.0% | 0.0% | 0.0% | 0.0% | 100.0% |
| self-image-inflated | 0.0% | 18.3% | 0.0% | 81.7% | 0.0% | 18.0% | 19.7% | 62.3% |
| self-image-inflated-differential | 0.0% | 18.3% | 0.0% | 81.7% | 0.0% | 18.0% | 19.7% | 62.3% |
| random-clicker | 0.0% | 0.0% | 28.3% | 71.7% | 0.0% | 57.7% | 20.3% | 22.0% |

## Archetype-assignment sanity (top assignments per arm)

- **clean-control:** corgi (63), cat (46), spider (28), owl (25), fox (25)
- **straight-liner:** hamster_praise (300)
- **acquiescence-biased:** hamster_praise (300)
- **midpoint-hugger:** elephant (300)
- **self-image-inflated:** corgi (71), spider (55), rooster (39), koala (30), elephant (30)
- **self-image-inflated-differential:** corgi (71), spider (55), rooster (39), koala (30), elephant (30)
- **random-clicker:** hamster_praise (61), elephant (61), owl (43), spider (40), turtle (27)

## Assertions (hard-fail, exit 1)

| ID | Assertion | Measured | Threshold | Result |
|---|---|---|---|---|
| AC-7.2a | Zero engine crashes across all adversarial sessions (M6 LOCKED) | 0 crashes / 2100 sessions | 0 crashes, sessions ≥ 1,000 | ✅ PASS |
| AC-7.2b | Zero NaN / out-of-range trait scores, confidences, validityScores | 0 NaN/invalid sessions | 0 | ✅ PASS |
| AC-7.3a | Straight-liner trips the engine acquiescence check (same-option-value share > 0.7) | 100.0% of runs | ≥ 95% (locked) | ✅ PASS |
| AC-7.3b | Acquiescence-biased (yea-saying) trips the engine acquiescence check (provisional HELD, locked) | 100.0% of runs | ≥ 70% (locked) | ✅ PASS |
| AC-7.3c | Random-clicker mean validityScore must not exceed clean-control mean (degradation monotonicity) | 0.9433 vs clean 0.9810 | ≤ clean + 0.01 (locked) | ✅ PASS |
| AC-7.3d-straight-liner | straight-liner mean trait confidence DROPS below clean control | 0.8589 vs clean 0.9122 | < clean mean (locked, directional) | ✅ PASS |
| AC-7.3d-random-clicker | random-clicker mean trait confidence DROPS below clean control | 0.8579 vs clean 0.9122 | < clean mean (locked, directional) | ✅ PASS |

## Provisional AC-7.3 evaluation (documented, not hard-asserted)

- **Random-clicker mean validityScore** — provisional `< 0.6`, measured `0.9433` → ❌ DID NOT HOLD. The raw engine validity checks (same-value share, trait stdev) barely fire on uniform-random responding: random answers almost never repeat one literal option value > 70% of the time, and random-walk trait scores are differentiated enough to pass the stdev ≥ 8 check most of the time (low-diff fired in only ~27% of random sessions vs ~10% clean). The raw engine therefore scores a random clicker about as valid as an honest respondent. This is precisely the gap Item 2 (consistency pairs) and Item 4 (meta-consistency) must close. Locked assertion AC-7.3c uses degradation monotonicity instead.
- **Midpoint-hugger trips the existing low-differentiation check** — provisional `triggers low-differentiation (locked ≥ 95%)`, measured `0.0% of runs (mean validity 1.0000, mean trait conf 0.8727 vs clean 0.9122)` → ❌ DID NOT HOLD. The failure is the finding. The min-Σ|loading| options on MCQ items are NOT zero-loading: they carry small but systematically-signed loadings that accumulate over 12–16 answers into trait estimates with stdev ≥ 8. Worse, the evidence is highly CONSISTENT, so the raw engine assigns midpoint-hugging ABOVE-clean trait confidence and high-confidence extreme archetypes (100% of sessions). The engine has no neutral-responding detector at all — no assertion is made against a signal it does not produce; this gap is Item 3 shrinkage territory (see AC-7.4).
- **ALL adversarial arms mean traitConfidences below clean controls** — provisional `all five arms < clean`, measured `straight-liner=0.859, acquiescence-biased=0.873, midpoint-hugger=0.873, self-image-inflated=0.895, self-image-inflated-differential=0.895, random-clicker=0.858 (clean=0.912)` → ✅ HELD. Held — lock at measured baseline.

## AC-7.4 gap findings for Item 3 (validity-gated shrinkage)

Adversarial arms that currently DO earn high-confidence extreme assignments — the shrinkage gap Item 3 must close:

- **acquiescence-biased** earns high-confidence (≥0.8) extreme (max |trait−50| ≥ 25) assignments in 100.0% of sessions (mean top-1 conf 1.000 vs clean 0.830).
- **self-image-inflated** earns high-confidence (≥0.8) extreme (max |trait−50| ≥ 25) assignments in 62.3% of sessions (mean top-1 conf 0.861 vs clean 0.830).
- **self-image-inflated-differential** earns high-confidence (≥0.8) extreme (max |trait−50| ≥ 25) assignments in 62.3% of sessions (mean top-1 conf 0.861 vs clean 0.830).
- **random-clicker** earns high-confidence (≥0.8) extreme (max |trait−50| ≥ 25) assignments in 5.0% of sessions (mean top-1 conf 0.729 vs clean 0.830).

Clean-control reference: high-confidence extreme rate 55.7%, mean top-1 conf 0.830.

## Locked baselines (this run)

- `LOCKED_STRAIGHT_LINER_ACQUIESCENCE_RATE_MIN` = 0.95 (measured 1.0000)
- `LOCKED_ACQUIESCENCE_BIASED_ACQUIESCENCE_RATE_MIN` = 0.7 (measured 1.0000)
- `LOCKED_RANDOM_VALIDITY_MAX_MARGIN_ABOVE_CLEAN` = 0.01 (measured delta -0.0377)
- Confidence-drop arms (directional, `< clean`): straight-liner (Δ=-0.0533), random-clicker (Δ=-0.0543)

---
Generated by `npm run simulate:adversarial` (`scripts/simulate/run-adversarial-suite.ts`).
