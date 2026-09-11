# Personality Engine Status — Agent Context

> Extracted from AGENTS.md §6. Load when modifying archetypes, assessment questions, matcher logic, or trait scoring. Skill: `personality-system`.

**Personality:** 12 archetypes, V4 adaptive assessment. `packages/shared/src/personality/` owns the engine.

## Profile resolver (2026-09-10)

`assessmentProfile.ts` is the single source of truth for config selection. Three exported functions:

| Function | Role |
|----------|------|
| `resolveAssessmentProfileId(env?)` | Maps `ENABLE_MATCHER_V2` → `"standard"` \| `"extended"` |
| `resolveAssessmentConfig(env?, overrides?)` | Returns the full `AssessmentConfig` for the resolved profile |
| `assessmentConfigForProfile(id)` | Direct lookup by profile ID (no env) |

**Legacy-naming trap:** `ENABLE_MATCHER_V2` does **not** toggle the matcher algorithm. MatcherV2 is always active. The env var selects the **session profile** — see `.github/skills/personality-system/references/engine-details.md` §Config variants.

## V4 measurement program (completed 2026-09-10)

12-item scientific upgrade program. Full plan: `docs/plans/2026-09-09-personality-engine-v4-upgrade-plan.md`.

| Item | Verdict | Flag state |
|------|---------|-----------|
| 11 E/P bank strengthening | M14 PASS (E r 0.612→0.763, P r 0.665→0.730) | live (bank content) |
| 12 confidence calibration | M15 PASS (raw 0.90 → true P 0.34, PAVA isotonic) | dark (`confidenceCalibration.ts`) |
| 6 recovery harness | Delivered; gate-wired | N/A |
| 7 adversarial suite | Delivered; quantified blind spots | N/A |
| 2 consistency pairs + neutral detector | ACs PASS (HC-extreme 100%→0%) | dark (`enableConsistencyFolding`) |
| 4 meta-consistency | M7 structural ceiling (self-inflation undetectable internally) | dark (`enableMetaConsistency`) |
| 3 trait shrinkage | Safe; honestly narrowed, K=75 | dark (`enableTraitShrinkage`) |
| 9 Monte Carlo groups | Baseline locked; M11 reformulated (calibration-anchored) | N/A |
| 5 composition gates | M9/M10 PASS (100% pass, +1.51pp) | dark (`compositionGatesEnabled`) |
| 8 boundary sweep | Baseline locked; M8 RED 3/24 cells | N/A |
| 10 derived chemistry | M12 FAIL (ρ=0.57, ceiling 0.69) | dark (`derivedChemistry.ts`) |
| 1 ipsative items | M4 FAIL ×2 (true no-op) | dark, mothballed |
| P3 CI gate | PASS 9 / KNOWN-FAIL 3 / REGRESSION 0 | `npm run gate:assessment` |

**Production profile:** `DEFAULT_ASSESSMENT_CONFIG` (10–16q, tiered off). `V2_ASSESSMENT_CONFIG` (12–20q, tiered on) is older, longer, and unvalidated — do not enable without A/B.

**Confidence calibration artifact:** `confidenceCalibrationArtifact.ts`, versioned `v1-20260909`. PAVA isotonic fit mapping raw confidence → true P(correct). Stored in `packages/shared/src/personality/`.

## Remote-validation harness (2026-09-11)

External validation is the gate that simulation cannot satisfy (simulated respondents come from the same model under test). Engineering counterpart: `scripts/simulate/analyze-remote-validation.ts` + `scripts/simulate/lib/remote-validation/`. Computes the four `scientific-foundation.md` pre-launch measurements: convergent validity (ACOEXP↔IPIP Big Five, r≥0.6 LOCKED), 4-week test-retest, vibe-composition→同频 regression, narrative A/B. Mapping + panel data contract + thresholds: `docs/strategy/remote-validation-harness.md`. Self-test: `npm run simulate:remote-validation:fixture` (9/9 planted-structure recovery checks). **It does not recruit participants** — the 300–500-person panel is an ops task. No flag may be enabled on simulation evidence alone.

## Baseline metrics (pre-V4, 2026-06-02)

- 12 centroids: **100% exact match**
- 33 boundaries: **66.7%** (30/45). Anchor option conflation bottleneck.
- **`applyMeasurementDriftCorrections`** in `adaptiveEngine.ts`: post-hoc promotion for rooster→corgi and koala→dolphin drift patterns.
- **`classifyFoxVsOctopus`** activated in matcherV2.ts confusion classifier.
- **Persona audit:** 13/33 boundary personas had wrong `expectedArchetype` — fixed.
- **Calibration Qs (Q51-Q54):** 4 pure single-trait questions, `enableCalibrationQuestions` flag. Needs shadow-mode data before production.
- **Results page:** Non-decisive matches show "隐约有[secondary]的影子" blend indicator.

## Dark flags (all default false in `types.ts`)

| Flag | Controls |
|------|----------|
| `enableIpsativeItems` | Ipsative item type (Item 1 — mothballed, no-op) |
| `enableConsistencyFolding` | Consistency pair detection + neutral detector (Item 2) |
| `enableTraitShrinkage` | Confidence-weighted trait shrinkage toward population mean (Item 3) |
| `enableMetaConsistency` | Self-image inflation detection (Item 4 — structural ceiling) |
| `compositionGatesEnabled` | Minimum-E, mean-A, spark, X-var gates on matched groups (Item 5) |
