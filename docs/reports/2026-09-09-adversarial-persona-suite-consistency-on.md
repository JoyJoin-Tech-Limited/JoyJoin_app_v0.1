# Adversarial Persona Suite — 2026-09-09

> Plan: `docs/plans/2026-09-09-personality-engine-v4-upgrade-plan.md` Item 7.
> Contract: `.git/.orchestration/sprints/sprint-contract.item7-adversarial-personas.md`.
> Fully deterministic: identical `--seed` reproduces every number in this report.

## Run parameters

- Seed: `20260909`
- Respondents (N per arm): 240; arms: 6; total sessions: 1440
- Population: identical 2-component mixture as the Item 6 recovery harness (60% centroid-mixture σ=10, 40% general N(50,15²), truncated [5,95]); the SAME respondents serve all arms (paired design).
- Session shape: full natural termination under `DEFAULT_ASSESSMENT_CONFIG` + V2 matcher (adaptive + closing questions, safety cap 25) — same loop as `runAssessmentSimulation`.
- **Consistency folding (Plan Item 2): ENABLED via `--consistency=on`** — `enableConsistencyFolding: true` in every arm: pair scheduler (CP1 first = anchor Q150 at position 9; CP2/CP3 firsts = pure-C/pure-O calibration items injected at positions 10–11, superseding the calibration phase 1:1; seconds serve in the closing phase with ≥4 spacing satisfied by construction — the completion guarantee), pair-disagreement validity penalties (0.15 adjacent-level / 0.20 opposite-pole per pair), ±0.15 per-trait confidence fold (positive boost void when a legacy response-set check fires), neutral-responding detector (share ≥ 0.7 → −0.25), and the match-confidence composition step (`currentMatches.confidence ×= validityScore`; termination reads the preserved raw matcher output via `lastRawMatches`). Trait scores are never adjusted.

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
| clean-control | 240 | 0 | 0 | 0.949 | 1.000 | 12.5% | 10.0% | 0.942 | 0.784 | 37.5% |
| straight-liner | 240 | 0 | 0 | 0.750 | 0.750 | 100.0% | 0.0% | 0.885 | 0.750 | 0.0% |
| acquiescence-biased | 240 | 0 | 0 | 0.750 | 0.750 | 100.0% | 0.0% | 0.940 | 0.620 | 0.0% |
| midpoint-hugger | 240 | 0 | 0 | 0.750 | 0.750 | 0.0% | 0.0% | 0.953 | 0.675 | 0.0% |
| self-image-inflated | 240 | 0 | 0 | 0.928 | 1.000 | 15.8% | 16.3% | 0.939 | 0.773 | 36.7% |
| random-clicker | 240 | 0 | 0 | 0.552 | 0.500 | 0.0% | 27.1% | 0.836 | 0.459 | 4.6% |

## Paired agreement (same respondents across arms)

| Arm | Top-1 = clean-control top-1 | Top-1 = ground-truth archetype | Mean max \|trait−50\| | Distinct archetypes assigned |
|---|---|---|---|---|
| clean-control | 100.0% | 47.1% | 34.6 | 12 |
| straight-liner | 10.4% | 8.3% | 36.0 | 1 |
| acquiescence-biased | 10.4% | 8.3% | 37.0 | 1 |
| midpoint-hugger | 10.8% | 8.8% | 27.0 | 1 |
| self-image-inflated | 42.9% | 30.8% | 36.3 | 12 |
| random-clicker | 7.1% | 6.7% | 25.8 | 12 |

## Validity & confidence distributions (AC-7.4)

| Arm | validity <0.6 | 0.6–0.8 | 0.8–<1.0 | =1.0 | top1 conf <0.5 | 0.5–0.7 | 0.7–0.8 | ≥0.8 |
|---|---|---|---|---|---|---|---|---|
| clean-control | 0.8% | 11.7% | 9.2% | 78.3% | 1.3% | 37.5% | 23.3% | 37.9% |
| straight-liner | 0.0% | 100.0% | 0.0% | 0.0% | 0.0% | 0.0% | 100.0% | 0.0% |
| acquiescence-biased | 0.0% | 100.0% | 0.0% | 0.0% | 0.0% | 100.0% | 0.0% | 0.0% |
| midpoint-hugger | 0.0% | 100.0% | 0.0% | 0.0% | 0.0% | 100.0% | 0.0% | 0.0% |
| self-image-inflated | 3.3% | 12.5% | 12.9% | 71.3% | 3.3% | 33.8% | 26.3% | 36.7% |
| random-clicker | 54.2% | 32.1% | 12.9% | 0.8% | 61.3% | 29.6% | 4.2% | 5.0% |

## Archetype-assignment sanity (top assignments per arm)

- **clean-control:** cat (28), turtle (26), elephant (26), corgi (25), fox (25)
- **straight-liner:** fox (240)
- **acquiescence-biased:** corgi (240)
- **midpoint-hugger:** turtle (240)
- **self-image-inflated:** elephant (40), koala (38), dolphin_calm (37), corgi (28), rooster (28)
- **random-clicker:** koala (61), turtle (36), dolphin_calm (35), spider (34), elephant (17)

## Assertions (hard-fail, exit 1)

| ID | Assertion | Measured | Threshold | Result |
|---|---|---|---|---|
| AC-7.2a | Zero engine crashes across all adversarial sessions (M6 LOCKED) | 0 crashes / 1440 sessions | 0 crashes, sessions ≥ 1,000 | ✅ PASS |
| AC-7.2b | Zero NaN / out-of-range trait scores, confidences, validityScores | 0 NaN/invalid sessions | 0 | ✅ PASS |
| AC-7.3a | Straight-liner trips the engine acquiescence check (same-option-value share > 0.7) | 100.0% of runs | ≥ 95% (locked) | ✅ PASS |
| AC-7.3b | Acquiescence-biased (yea-saying) trips the engine acquiescence check (provisional HELD, locked) | 100.0% of runs | ≥ 70% (locked) | ✅ PASS |
| AC-7.3c | Random-clicker mean validityScore must not exceed clean-control mean (degradation monotonicity) | 0.5517 vs clean 0.9488 | ≤ clean + 0.01 (locked) | ✅ PASS |
| AC-7.3d-straight-liner | straight-liner mean trait confidence DROPS below clean control | 0.8850 vs clean 0.9423 | < clean mean (locked, directional) | ✅ PASS |
| AC-7.3d-random-clicker | random-clicker mean trait confidence DROPS below clean control | 0.8360 vs clean 0.9423 | < clean mean (locked, directional) | ✅ PASS |
| AC-2.4a | Random-clicker mean validityScore (baseline 0.947) | 0.5517 | < 0.6 (contract) | ✅ PASS |
| AC-2.4b | Midpoint-hugger high-confidence extreme rate (baseline 100%) | 0.0% | < 50% (contract, partial-closure floor) | ✅ PASS |
| AC-2.4c | Straight-liner high-confidence extreme rate (baseline 100%) | 0.0% | ≤ 60% (contract) | ✅ PASS |
| AC-2.4d | Acquiescence-biased high-confidence extreme rate (baseline 100%) | 0.0% | ≤ 60% (contract) | ✅ PASS |
| AC-2.4e | Clean-control mean validityScore must stay high (detector precision; baseline 0.945) | 0.9488 | ≥ 0.9 (contract) | ✅ PASS |
| AC-2.4f | M5: clean-vs-random mean traitConfidence gap (baseline 0.0306) | 0.1063 | ≥ 0.1 (contract, M5) | ✅ PASS |
| AC-2.1-completion | Pair completion guarantee under natural termination (started pairs that completed, mean across arms) | 100.0% | ≥ 95% (contract AC-2.1) | ✅ PASS |

## Provisional AC-7.3 evaluation (documented, not hard-asserted)

- **Random-clicker mean validityScore** — provisional `< 0.6`, measured `0.5517` → ✅ HELD. Held — lock at measured baseline.
- **Midpoint-hugger trips the existing low-differentiation check** — provisional `triggers low-differentiation (locked ≥ 95%)`, measured `0.0% of runs (mean validity 0.7500, mean trait conf 0.9532 vs clean 0.9423)` → ❌ DID NOT HOLD. The failure is the finding. The min-Σ|loading| options on MCQ items are NOT zero-loading: they carry small but systematically-signed loadings that accumulate over 12–16 answers into trait estimates with stdev ≥ 8. Worse, the evidence is highly CONSISTENT, so the raw engine assigns midpoint-hugging ABOVE-clean trait confidence and high-confidence extreme archetypes (100% of sessions). The engine has no neutral-responding detector at all — no assertion is made against a signal it does not produce; this gap is Item 3 shrinkage territory (see AC-7.4).
- **ALL adversarial arms mean traitConfidences below clean controls** — provisional `all five arms < clean`, measured `straight-liner=0.885, acquiescence-biased=0.940, midpoint-hugger=0.953, self-image-inflated=0.939, random-clicker=0.836 (clean=0.942)` → ❌ DID NOT HOLD. Response sets that destroy evidence quality (straight-liner, random-clicker) drop confidence below clean (locked as AC-7.3d-*); but consistently-biased answering (midpoint-hugger, acquiescence-biased) produces consistent evidence and the raw confidence signal does NOT separate it from clean — it scores ABOVE clean. Confidence shrinkage under consistent-but-biased evidence is the Item 3 gap (see AC-7.4 findings).

## AC-7.4 gap findings for Item 3 (validity-gated shrinkage)

Adversarial arms that currently DO earn high-confidence extreme assignments — the shrinkage gap Item 3 must close:

- **self-image-inflated** earns high-confidence (≥0.8) extreme (max |trait−50| ≥ 25) assignments in 36.7% of sessions (mean top-1 conf 0.773 vs clean 0.784).
- **random-clicker** earns high-confidence (≥0.8) extreme (max |trait−50| ≥ 25) assignments in 4.6% of sessions (mean top-1 conf 0.459 vs clean 0.784).

Clean-control reference: high-confidence extreme rate 37.5%, mean top-1 conf 0.784.

## Consistency-pair & detector telemetry (Plan Item 2, flag on)

| Arm | Pairs completed (of started) | Pair mismatch rate | Mean pair validity penalty | Mean neutral share | Neutral detector fired |
|---|---|---|---|---|---|
| clean-control | 100.0% | 0.0% | 0.000 | 0.126 | 0.0% |
| straight-liner | 100.0% | 0.0% | 0.000 | 0.059 | 0.0% |
| acquiescence-biased | 100.0% | 0.0% | 0.000 | 0.000 | 0.0% |
| midpoint-hugger | 100.0% | 0.0% | 0.000 | 1.000 | 100.0% |
| self-image-inflated | 100.0% | 0.0% | 0.000 | 0.101 | 0.0% |
| random-clicker | 100.0% | 75.0% | 0.394 | 0.304 | 0.0% |

## AC-2.4 before/after (vs locked flag-off baselines)

| Metric | Locked baseline (flag off) | This run (flag on) | Target | Result |
|---|---|---|---|---|
| random-clicker mean validity | 0.947 | 0.5517 | < 0.6 | ✅ PASS |
| midpoint-hugger HC-extreme rate | 100.0% | 0.0% | < 50.0% | ✅ PASS |
| straight-liner HC-extreme rate | 100.0% | 0.0% | ≤ 60.0% | ✅ PASS |
| acquiescence-biased HC-extreme rate | 100.0% | 0.0% | ≤ 60.0% | ✅ PASS |
| clean-control mean validity | 0.945 | 0.9488 | ≥ 0.9 | ✅ PASS |
| M5 clean-vs-random mean traitConfidence gap | 0.0306 | 0.1063 | ≥ 0.1 | ✅ PASS |

## Locked baselines (this run)

- `LOCKED_STRAIGHT_LINER_ACQUIESCENCE_RATE_MIN` = 0.95 (measured 1.0000)
- `LOCKED_ACQUIESCENCE_BIASED_ACQUIESCENCE_RATE_MIN` = 0.7 (measured 1.0000)
- `LOCKED_RANDOM_VALIDITY_MAX_MARGIN_ABOVE_CLEAN` = 0.01 (measured delta -0.3971)
- Confidence-drop arms (directional, `< clean`): straight-liner (Δ=-0.0573), random-clicker (Δ=-0.1063)

---
Generated by `npm run simulate:adversarial` (`scripts/simulate/run-adversarial-suite.ts`).
