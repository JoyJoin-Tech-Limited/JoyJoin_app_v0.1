# Engine Details

## Adaptive engine flow

Located in `packages/shared/src/personality/adaptiveEngine.ts`.

```
initializeEngineState(config) → processAnswer(state, question, option)
  → selectNextQuestion(state) → shouldTerminate(state)
  → getFinalResult(state, userSecondaryData?)
```

1. **Anchor phase**: First 8 anchor questions (fixed set from `getAnchorQuestions()`)
2. **Adaptive phase**: Utility-scored selection based on info gain (30%), discrimination (20%), discrimination index (15%), level (5%), forced choice (5%)
3. **Early confusion detection**: After anchors, if top-2 gap < 0.12 for a known confusable pair, inject targeted questions
4. **Closing questions**: `Q_PLAYFUL_SLIDER` (X/P intensity via slider) and `Q_PLAYFUL_EMOJI` (conflictPosture via emoji_tap)
5. **Termination**: hardMax 16, softMax 12, min 10; extends +2 for persistent pairs needing higher confidence (0.72)
6. **Validity**: acquiescence bias check (>70% same option), trait differentiation stdev ≥ 8
7. **Final result**: calls `prototypeMatcher.findBestMatches()` with accumulated trait scores + `userSecondaryData`

### Config variants

| | `DEFAULT_ASSESSMENT_CONFIG` | `V2_ASSESSMENT_CONFIG` |
|---|---|---|
| minQuestions | 10 | 12 |
| softMaxQuestions | 12 | 16 |
| hardMaxQuestions | 16 | 20 |
| confidenceThreshold | 0.65 | 0.70 |
| confusablePairThreshold | 0.70 | 0.80 |
| enableTieredThreshold | false | true |

**Legacy-naming trap:** `ENABLE_MATCHER_V2` does **not** toggle the matcher algorithm. MatcherV2 (`findBestMatchingArchetypesV2`; `useV2Matcher: true`) is always active — both configs set it. The env var only selects the **session profile**:
- unset / `false` → `DEFAULT_ASSESSMENT_CONFIG` (10–16 questions, tiered threshold off). This is the profile validated by the V4 measurement program (`docs/plans/2026-09-09-personality-engine-v4-upgrade-plan.md`) and the intended production profile.
- `true` → `V2_ASSESSMENT_CONFIG` (12–20 questions, tiered threshold on) — an *older, longer* profile (not "newer"). Its extra questions are triggered by the top1–top2 confidence gap, which is uninformative under realistic answer noise (see `docs/reports/2026-09-10-confidence-calibration.md`), and the Item 6 recovery data shows trait recovery beyond ~12–16 questions is flat-to-negative. Do not enable without a measured A/B.

### Assessment profile resolver

`packages/shared/src/personality/assessmentProfile.ts` centralizes config selection. All 6 server call sites import from this module — never construct configs inline.

```ts
resolveAssessmentProfileId(env?: string): "standard" | "extended"
resolveAssessmentConfig(env?: string, overrides?: Partial<AssessmentConfig>): AssessmentConfig
assessmentConfigForProfile(id: "standard" | "extended"): AssessmentConfig
```

**Never use these legacy identifiers** (they create confusion): `V2_ASSESSMENT_CONFIG` as a direct import (use the resolver), `ENABLE_MATCHER_V2` as a feature-flag name (it's a profile selector, not a toggle).

### V4 dark flags (all default false)

| Flag | Module | Controls |
|------|--------|----------|
| `enableIpsativeItems` | `questionsV4Ipsative.ts` | Ipsative item type — **mothballed** (M4 true no-op, zero ΔP) |
| `enableConsistencyFolding` | `consistencyPairs.ts` | Near-paraphrase pair detection + neutral detector (HC-extreme 100%→0%) |
| `enableTraitShrinkage` | `traitShrinkage.ts` | Confidence-weighted shrinkage toward population mean (K=75, W_MIN=0.5) |
| `enableMetaConsistency` | `metaConsistency.ts` | Self-image inflation detection (structural ceiling — undetectable internally) |
| `compositionGatesEnabled` | `poolMatchingService.ts` | Min-E 25, mean-A 45, spark X≥70∨P≥70, X-var cap 750 on matched groups |

### Confidence calibration

`confidenceCalibration.ts` + `confidenceCalibrationArtifact.ts`: PAVA isotonic fit mapping raw session confidence → true P(correct). Artifact versioned `v1-20260909`. Raw 0.90 → calibrated ~0.34. ECE improved 0.605→0.457. Live behind the dark flag.

## Chemistry / compatibility system

The 12×12 chemistry matrix (`archetypeCompatibility.ts`) is consumed by the **matching domain** as one scoring dimension (28% weight in deterministic pair scoring). Personality system owns the matrix data; matching domain owns how it is applied in group formation.

- **Canonical matrix**: `packages/shared/src/personality/archetypeCompatibility.ts`
- **Runtime copy**: `apps/server/src/archetypeChemistry.ts`
- **Narratives**: Xiaoyue voice per-pair in `ARCHETYPE_COMPATIBILITY_DESCRIPTIONS`

**Signal boundary:** `user_interest_signals` must NOT be read by the chemistry path. See `matching-domain` skill.

## Trait score normalization

Raw option scores in `questionsV4.ts` are typically in the -3 to +3 range. They are normalized to 0–100 via:

```ts
normalized = 50 + raw * 15
```

The adaptive engine averages per-trait across all answered questions. Slider questions map 0–100 linearly via `scoreAtZero`/`scoreAt100` in `SliderConfig`.

## Closing questions and secondary data

Two universal closing questions feed into `UserSecondaryData` used by the matcher:

| Question | Type | Maps to | Via |
|----------|------|---------|-----|
| `Q_PLAYFUL_SLIDER` | slider (0–100) | X/P intensity | `sliderConfig.traitMappings` |
| `Q_PLAYFUL_EMOJI` | emoji_tap | `conflictPosture` | `SECONDARY_QUESTION_MAP['Q_PLAYFUL_EMOJI']` |

`SECONDARY_QUESTION_MAP` lives in `secondaryQuestionMap.ts`. Server persists decoded secondary values into `assessment_sessions.preSignupData` during answer submission.

## Archetype skill tree

Each archetype has a Pokemon TCG-style skill set in `archetypeSkills.ts`:
- `attribute` (e.g., "🔥 热情")
- `cardTitle`
- `activeSkill` (energyCost 1–3, shortEffect ≤15 chars)
- `passiveSkill` (energyCost 0)

Used in result reveal and share cards.

## Color system

`packages/shared/src/archetypeColors.ts` defines `CANONICAL_COLORS` as HSL for all 12 archetypes. Used for dynamic theming across all platforms. `DEFAULT_ACCENT` is `{ h: 280, s: 45, l: 55 }`.

## Important: archetype duplication

`apps/server/src/archetypeConfig.ts` is a thin re-export of `ARCHETYPE_CANONICAL_ORDER` from `archetypeNames.ts`. It exists so server code can import archetype names without deep-reaching into `@shared/personality/archetypeNames`. **If you change archetype order or names in the registry, verify `archetypeConfig.ts` re-exports correctly.**

## Important: server inference engine is NOT personality assessment

`apps/server/src/inference/` extracts profile fields (industry, city, lifeStage) from Xiaoyue chat messages. It is **unrelated** to the V4 adaptive assessment engine. Do not confuse `inference/` with personality assignment.
