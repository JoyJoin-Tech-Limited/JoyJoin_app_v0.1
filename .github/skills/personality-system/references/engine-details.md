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

Server selects `V2_ASSESSMENT_CONFIG` when `ENABLE_MATCHER_V2 === 'true'` (default behavior in production).

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
