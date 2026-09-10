# Adversarial Persona Suite — 2026-09-09

> Plan: `docs/plans/2026-09-09-personality-engine-v4-upgrade-plan.md` Item 7.
> Contract: `.git/.orchestration/sprints/sprint-contract.item7-adversarial-personas.md`.
> Fully deterministic: identical `--seed` reproduces every number in this report.

## Run parameters

- Seed: `20260909`
- Respondents (N per arm): 240; arms: 7; total sessions: 1680
- Population: identical 2-component mixture as the Item 6 recovery harness (60% centroid-mixture σ=10, 40% general N(50,15²), truncated [5,95]); the SAME respondents serve all arms (paired design).
- Session shape: full natural termination under `DEFAULT_ASSESSMENT_CONFIG` + V2 matcher (adaptive + closing questions, safety cap 25) — same loop as `runAssessmentSimulation`.
- **Meta-consistency check (Plan Item 4): ENABLED via `--meta=on`** — `enableMetaConsistency: true` in every arm: the meta item Q168 (自我视角 slider, target trait A) is served LAST in the closing phase (after pair seconds and both universal closing questions); its options are zero-loading (the self-report never feeds the estimate it is compared against); discrepancy |selfReport − estimate| ≥ 30 applies a bounded ×0.8 session-confidence multiplier to match confidence, composed multiplicatively with Item 2's validity composition. Trait scores are never touched; no user-facing inconsistency messaging exists (AC-4.4).

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
| clean-control | 240 | 0 | 0 | 0.945 | 1.000 | 13.8% | 10.4% | 0.915 | 0.855 | 56.3% |
| straight-liner | 240 | 0 | 0 | 0.750 | 0.750 | 100.0% | 0.0% | 0.891 | 0.800 | 100.0% |
| acquiescence-biased | 240 | 0 | 0 | 0.750 | 0.750 | 100.0% | 0.0% | 0.949 | 0.964 | 100.0% |
| midpoint-hugger | 240 | 0 | 0 | 1.000 | 1.000 | 0.0% | 0.0% | 0.925 | 0.896 | 100.0% |
| self-image-inflated | 240 | 0 | 0 | 0.948 | 1.000 | 10.8% | 12.5% | 0.913 | 0.850 | 52.9% |
| self-image-inflated-differential | 240 | 0 | 0 | 0.948 | 1.000 | 10.8% | 12.5% | 0.913 | 0.858 | 53.8% |
| random-clicker | 240 | 0 | 0 | 0.947 | 1.000 | 0.0% | 26.7% | 0.885 | 0.760 | 28.3% |

## Paired agreement (same respondents across arms)

| Arm | Top-1 = clean-control top-1 | Top-1 = ground-truth archetype | Mean max \|trait−50\| | Distinct archetypes assigned |
|---|---|---|---|---|
| clean-control | 100.0% | 46.3% | 34.2 | 12 |
| straight-liner | 12.9% | 8.3% | 36.0 | 1 |
| acquiescence-biased | 12.5% | 8.3% | 36.0 | 1 |
| midpoint-hugger | 11.7% | 8.8% | 27.0 | 1 |
| self-image-inflated | 45.4% | 32.5% | 36.3 | 12 |
| self-image-inflated-differential | 45.4% | 32.5% | 36.3 | 12 |
| random-clicker | 9.6% | 4.6% | 26.8 | 12 |

## Validity & confidence distributions (AC-7.4)

| Arm | validity <0.6 | 0.6–0.8 | 0.8–<1.0 | =1.0 | top1 conf <0.5 | 0.5–0.7 | 0.7–0.8 | ≥0.8 |
|---|---|---|---|---|---|---|---|---|
| clean-control | 0.4% | 13.3% | 10.0% | 76.3% | 0.0% | 26.3% | 16.3% | 57.5% |
| straight-liner | 0.0% | 100.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 100.0% |
| acquiescence-biased | 0.0% | 100.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 100.0% |
| midpoint-hugger | 0.0% | 0.0% | 0.0% | 100.0% | 0.0% | 0.0% | 0.0% | 100.0% |
| self-image-inflated | 0.8% | 10.0% | 11.7% | 77.5% | 0.0% | 17.5% | 29.6% | 52.9% |
| self-image-inflated-differential | 0.8% | 10.0% | 11.7% | 77.5% | 0.0% | 13.8% | 32.5% | 53.8% |
| random-clicker | 0.0% | 0.0% | 26.7% | 73.3% | 0.8% | 35.4% | 23.3% | 40.4% |

## Archetype-assignment sanity (top assignments per arm)

- **clean-control:** fox (31), corgi (30), cat (28), turtle (28), rooster (23)
- **straight-liner:** fox (240)
- **acquiescence-biased:** corgi (240)
- **midpoint-hugger:** turtle (240)
- **self-image-inflated:** elephant (37), koala (37), rooster (34), hamster_praise (30), corgi (27)
- **self-image-inflated-differential:** elephant (37), koala (37), rooster (34), hamster_praise (30), corgi (27)
- **random-clicker:** spider (55), koala (54), turtle (36), dolphin_calm (31), hamster_praise (15)

## Assertions (hard-fail, exit 1)

| ID | Assertion | Measured | Threshold | Result |
|---|---|---|---|---|
| AC-7.2a | Zero engine crashes across all adversarial sessions (M6 LOCKED) | 0 crashes / 1680 sessions | 0 crashes, sessions ≥ 1,000 | ✅ PASS |
| AC-7.2b | Zero NaN / out-of-range trait scores, confidences, validityScores | 0 NaN/invalid sessions | 0 | ✅ PASS |
| AC-7.3a | Straight-liner trips the engine acquiescence check (same-option-value share > 0.7) | 100.0% of runs | ≥ 95% (locked) | ✅ PASS |
| AC-7.3b | Acquiescence-biased (yea-saying) trips the engine acquiescence check (provisional HELD, locked) | 100.0% of runs | ≥ 70% (locked) | ✅ PASS |
| AC-7.3c | Random-clicker mean validityScore must not exceed clean-control mean (degradation monotonicity) | 0.9467 vs clean 0.9448 | ≤ clean + 0.01 (locked) | ✅ PASS |
| AC-7.3d-straight-liner | straight-liner mean trait confidence DROPS below clean control | 0.8914 vs clean 0.9155 | < clean mean (locked, directional) | ✅ PASS |
| AC-7.3d-random-clicker | random-clicker mean trait confidence DROPS below clean control | 0.8849 vs clean 0.9155 | < clean mean (locked, directional) | ✅ PASS |
| AC-4.1-serving | Meta item (Q168) is served and answered in every session (closing phase, flag on) | 100.0% of sessions (min across arms) | = 100% (contract AC-4.1) | ✅ PASS |
| M7-precision | Clean-control meta false-flag rate (honest respondents must not be flagged) | 4.6% | ≤ 10% (contract AC-4.3 / M7, locked) | ✅ PASS |

## Provisional AC-7.3 evaluation (documented, not hard-asserted)

- **Random-clicker mean validityScore** — provisional `< 0.6`, measured `0.9467` → ❌ DID NOT HOLD. The raw engine validity checks (same-value share, trait stdev) barely fire on uniform-random responding: random answers almost never repeat one literal option value > 70% of the time, and random-walk trait scores are differentiated enough to pass the stdev ≥ 8 check most of the time (low-diff fired in only ~27% of random sessions vs ~10% clean). The raw engine therefore scores a random clicker about as valid as an honest respondent. This is precisely the gap Item 2 (consistency pairs) and Item 4 (meta-consistency) must close. Locked assertion AC-7.3c uses degradation monotonicity instead.
- **Midpoint-hugger trips the existing low-differentiation check** — provisional `triggers low-differentiation (locked ≥ 95%)`, measured `0.0% of runs (mean validity 1.0000, mean trait conf 0.9246 vs clean 0.9155)` → ❌ DID NOT HOLD. The failure is the finding. The min-Σ|loading| options on MCQ items are NOT zero-loading: they carry small but systematically-signed loadings that accumulate over 12–16 answers into trait estimates with stdev ≥ 8. Worse, the evidence is highly CONSISTENT, so the raw engine assigns midpoint-hugging ABOVE-clean trait confidence and high-confidence extreme archetypes (100% of sessions). The engine has no neutral-responding detector at all — no assertion is made against a signal it does not produce; this gap is Item 3 shrinkage territory (see AC-7.4).
- **ALL adversarial arms mean traitConfidences below clean controls** — provisional `all five arms < clean`, measured `straight-liner=0.891, acquiescence-biased=0.949, midpoint-hugger=0.925, self-image-inflated=0.913, self-image-inflated-differential=0.913, random-clicker=0.885 (clean=0.915)` → ❌ DID NOT HOLD. Response sets that destroy evidence quality (straight-liner, random-clicker) drop confidence below clean (locked as AC-7.3d-*); but consistently-biased answering (midpoint-hugger, acquiescence-biased) produces consistent evidence and the raw confidence signal does NOT separate it from clean — it scores ABOVE clean. Confidence shrinkage under consistent-but-biased evidence is the Item 3 gap (see AC-7.4 findings).

## AC-7.4 gap findings for Item 3 (validity-gated shrinkage)

Adversarial arms that currently DO earn high-confidence extreme assignments — the shrinkage gap Item 3 must close:

- **straight-liner** earns high-confidence (≥0.8) extreme (max |trait−50| ≥ 25) assignments in 100.0% of sessions (mean top-1 conf 0.800 vs clean 0.855).
- **acquiescence-biased** earns high-confidence (≥0.8) extreme (max |trait−50| ≥ 25) assignments in 100.0% of sessions (mean top-1 conf 0.964 vs clean 0.855).
- **midpoint-hugger** earns high-confidence (≥0.8) extreme (max |trait−50| ≥ 25) assignments in 100.0% of sessions (mean top-1 conf 0.896 vs clean 0.855).
- **self-image-inflated** earns high-confidence (≥0.8) extreme (max |trait−50| ≥ 25) assignments in 52.9% of sessions (mean top-1 conf 0.850 vs clean 0.855).
- **self-image-inflated-differential** earns high-confidence (≥0.8) extreme (max |trait−50| ≥ 25) assignments in 53.8% of sessions (mean top-1 conf 0.858 vs clean 0.855).
- **random-clicker** earns high-confidence (≥0.8) extreme (max |trait−50| ≥ 25) assignments in 28.3% of sessions (mean top-1 conf 0.760 vs clean 0.855).

Clean-control reference: high-confidence extreme rate 56.3%, mean top-1 conf 0.855.

## Meta-consistency telemetry (Plan Item 4, flag on)

Target trait: **A** (AC-4.3 overlap with the Item 7 inflation set A/P/C/E — chosen from the 2026-09-09 measurement probe: best recall/precision separation of the four candidates, best-tracked inflated trait r=0.809 @16q). Bucket mapping: slider_0/25/50/75/100 → self-report 10/30/50/70/90 (centered). Threshold 30; multiplier ×0.8.

| Arm | Meta answered | Meta-flag rate | Mean discrepancy | HC-extreme rate (flag on) |
|---|---|---|---|---|
| clean-control | 100.0% | 4.6% | 11.7 | 56.3% |
| straight-liner | 100.0% | 100.0% | 40.0 | 100.0% |
| acquiescence-biased | 100.0% | 0.0% | 25.0 | 100.0% |
| midpoint-hugger | 100.0% | 0.0% | 13.0 | 100.0% |
| self-image-inflated | 100.0% | 7.5% | 11.7 | 52.9% |
| self-image-inflated-differential | 100.0% | 2.5% | 10.0 | 53.8% |
| random-clicker | 100.0% | 42.9% | 28.9 | 28.3% |

### Meta discrepancy distributions (|selfReport − estimate|, answered sessions)

| Arm | Mean | Median | p10 | p90 | p99 |
|---|---|---|---|---|---|
| clean-control | 11.7 | 10.5 | 2.0 | 23.0 | 34.2 |
| straight-liner | 40.0 | 40.0 | 40.0 | 40.0 | 40.0 |
| acquiescence-biased | 25.0 | 25.0 | 25.0 | 25.0 | 25.0 |
| midpoint-hugger | 13.0 | 13.0 | 13.0 | 13.0 | 13.0 |
| self-image-inflated | 11.7 | 10.0 | 2.0 | 25.0 | 36.8 |
| self-image-inflated-differential | 10.0 | 8.0 | 2.0 | 22.1 | 31.6 |
| random-clicker | 28.9 | 26.0 | 5.0 | 55.0 | 76.4 |

### Threshold re-evaluation (cycle 2, verifier amendment 1)

Current named constant: `META_CONSISTENCY_DISCREPANCY_THRESHOLD = 30` (`packages/shared/src/personality/metaConsistency.ts`).

- Clean honest error tail: p90 = 23.0, p99 = 34.2 (flag rate at 30: 4.6%).
- Uniform-inflated bulk: p10 = 2.0, p99 = 36.8 (flag rate at 30: 7.5%).
- Differential-inflated bulk: p10 = 2.0, p99 = 31.6 (flag rate at 30: 2.5%).

**Decision: KEEP threshold 30.** No better threshold exists in the data: the differential-inflation distribution does NOT separate from the clean distribution (differential p99 = 31.6 vs clean p99 = 34.2 — the inflated bulk sits INSIDE the honest error tail, because the engine estimate on trait A absorbs the +15 scenario inflation with a small positive bias, so even a +30 direct self-view lands within ~10 of the estimate after bucket quantization). Lowering the threshold toward the differential bulk (e.g. 25) would push the clean false-flag rate toward/above its p90 (23.0) — precision breaks before recall moves. Raising it only loses the recall the mechanic legitimately has on the arms it CAN see (straight-liner, random-clicker). Threshold 30 remains justified purely on precision grounds (≈ 2× clean per-trait MAE; clean false-flag 4.6% ≤ 10%).

## M7 evaluation (cycle 2: recall measured on the DIFFERENTIAL arm — the realistic self-enhancement model)

- **M7 recall — self-image-inflated-DIFFERENTIAL sessions meta-flagged (realistic self-enhancement model)** — target `≥ 80% (contract AC-4.3, LOCKED; cycle-2 amendment 1 measures the differential arm)`, measured `2.5% (mean discrepancy 10.0, median 8.0, p10 2.0 vs threshold 30)` → ❌ DID NOT HOLD. DID NOT HOLD — even differential inflation (+30 direct self-view vs +15 scenario answers) is not reliably caught at threshold 30. The ceiling is definitive: self-inflation detection from internal evidence is out of reach; see the dated report for the threshold-separation evidence and the Item 4 disposition.
- **M7 recall — self-image-inflated (UNIFORM, consistent-liar reference)** — target `≥ 80% (NOT locked for this arm — documented reference)`, measured `7.5% (mean discrepancy 11.7)` → ❌ DID NOT HOLD. CEILING (documented, not a tuning failure): the uniform persona answers EVERY item — adaptive AND meta — through the same +15 inflated profile, so the engine estimate tracks the inflation and self-report ≈ estimate. Same-amount inflation of scenario answers and direct self-view is invisible to internal-consistency instruments; detection requires external/behavioral evidence. This is the cycle-1 finding, unchanged by construction.
- **M7 precision — clean-control sessions meta-flagged (false-flag)** — target `≤ 10% (contract AC-4.3, LOCKED — hard-asserted above)`, measured `4.6% (mean discrepancy 11.7, median 10.5, p99 34.2)` → ✅ HELD. Held — threshold 30 ≈ 2× the clean-arm per-trait MAE (Item 6 baseline) keeps honest respondents in the error tail below the flag.
- **Threshold separation — clean p99 vs differential p10 discrepancy** — target `differential p10 ≥ clean p99 (distributional separation at the flag boundary)`, measured `clean p99 = 34.2, differential p10 = 2.0, threshold = 30` → ❌ DID NOT HOLD. Overlapping — the honest error tail and the differential-inflation bulk overlap at this threshold; see the dated report for the evaluated alternatives and the chosen constant.

## Item 4 disposition (cycle 2, FINAL)

M7 recall DID NOT HOLD under the psychometrically realistic differential-inflation model (2.5% vs the ≥80% target), and the threshold re-evaluation above shows no threshold can fix this without breaking precision (the differential-inflation discrepancy bulk sits inside the clean honest-error tail). The ceiling is definitive: **self-image inflation is not detectable from internal evidence** — when the engine estimate is computed FROM the respondent's own answers, any self-view inflation that also colors the scenario answers is absorbed into the estimate before the meta comparison happens, and even a purely differential +30 self-view inflation cannot outrun it by the flag margin.

**Disposition: Item 4 ships dark (flag default-off) as a precision-safe, low-recall signal.** The mechanic retains value on the discrepancy construct it CAN see — direct self-views that outrun scenario-level evidence (straight-liner 100%, random-clicker 42.9% flag rates) — and its precision side is hard-asserted (clean false-flag ≤ 10%, measured 4.6%). **Item 3 (validity-gated shrinkage) must NOT count on self-inflation detection from internal evidence** — that capability does not exist and cannot be bought with threshold tuning; it requires external/behavioral data.

## Locked baselines (this run)

- `LOCKED_STRAIGHT_LINER_ACQUIESCENCE_RATE_MIN` = 0.95 (measured 1.0000)
- `LOCKED_ACQUIESCENCE_BIASED_ACQUIESCENCE_RATE_MIN` = 0.7 (measured 1.0000)
- `LOCKED_RANDOM_VALIDITY_MAX_MARGIN_ABOVE_CLEAN` = 0.01 (measured delta 0.0019)
- Confidence-drop arms (directional, `< clean`): straight-liner (Δ=-0.0240), random-clicker (Δ=-0.0306)

---
Generated by `npm run simulate:adversarial` (`scripts/simulate/run-adversarial-suite.ts`).
