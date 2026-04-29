---
name: personality-system
description: >
  JoyJoin's 12-archetype personality engine, ACOEXP 6-trait model, V4 adaptive assessment,
  MatcherV2 assignment algorithm, and archetype chemistry system. Use when modifying archetype
  definitions, assessment questions, matcher logic, trait scoring, result display, or the V4
  adaptive API. Triggers: archetype, personality test, trait score, matcher, assessment V4,
  prototype match, chemistry matrix, 开心柯基, 太阳鸡, 12原型.
---

# Personality System

**Core rule:** The personality system is owned by `packages/shared/src/personality/`. It is the single source of truth for archetype definitions, trait models, assessment questions, and assignment algorithms. Server and all clients consume it via `@shared/personality` or `@joyjoin/shared`.

## When to use this skill

- Adding or modifying archetype definitions, narratives, colors, or skills
- Changing assessment questions, options, or trait-score mappings
- Modifying the adaptive engine, matcher algorithm, or termination logic
- Working on result display, share cards, or slot-machine reveal
- Adding new secondary data dimensions (e.g., conflictPosture)
- Debugging incorrect archetype assignment or suspicious trait scores
- Reviewing a change that touches the V4 assessment API or client test UI

## Source of truth

| Concern | Location |
|---------|----------|
| Archetype registry (12 archetypes, profiles, narratives, insights) | `packages/shared/src/personality/archetypeRegistry.ts` |
| Canonical archetype ordering / TYPE numbering | `packages/shared/src/personality/archetypeNames.ts` |
| ACOEXP trait model + AssessmentConfig | `packages/shared/src/personality/types.ts` |
| V4 question bank (60+ questions) | `packages/shared/src/personality/questionsV4.ts` |
| Adaptive engine (select, terminate, result) | `packages/shared/src/personality/adaptiveEngine.ts` |
| MatcherV2 (v2.4-opposite-pole assignment) | `packages/shared/src/personality/matcherV2.ts` |
| Legacy V1 matcher (Euclidean) | `packages/shared/src/personality/prototypes.ts` |
| Chemistry matrix + Xiaoyue narratives | `packages/shared/src/personality/archetypeCompatibility.ts` |
| Archetype skill tree (active + passive) | `packages/shared/src/personality/archetypeSkills.ts` |
| Feedback copy / progress milestones / hints | `packages/shared/src/personality/feedback.ts` |
| Color tokens (HSL) | `packages/shared/src/archetypeColors.ts` |
| Secondary question mapping (closing Qs → user data) | `packages/shared/src/personality/secondaryQuestionMap.ts` |
| Trait display config (bar labels, descriptions) | `packages/shared/src/personality/traitDisplayConfig.ts` |
| Trait inflation correction + per-archetype thresholds | `packages/shared/src/personality/traitCorrection.ts` |
| **Server V4 API routes** | `apps/server/src/routes.ts` (lines ~10754–11750) |
| Server-side archetype config re-export | `apps/server/src/archetypeConfig.ts` |
| Server runtime chemistry matrix | `apps/server/src/archetypeChemistry.ts` |
| Mini-program V4 test UI | `apps/mini-program/src/pages/onboarding/personality-test/` |
| Mini-program result reveal (slot machine) | `apps/mini-program/src/pages/onboarding/personality-test/results/` |

## 12 Archetypes (canonical order)

Canonical order is **load-bearing**: used for TYPE numbering (`#01/12`–`#12/12`), slot-machine sequencing, and share cards.

| # | Name | ID | Energy | Key Traits |
|---|------|-----|--------|-----------|
| 01 | 开心柯基 | corgi | very high | X↑ P↑ |
| 02 | 太阳鸡 | rooster | very high | P↑ C↑ |
| 03 | 夸夸豚 | dolphin_praise | high | A↑ P↑ |
| 04 | 机智狐 | fox | high | O↑ X↑ |
| 05 | 淡定海豚 | dolphin_calm | medium | E↑ C↑ |
| 06 | 织网蛛 | spider | medium | C↑ A↑ |
| 07 | 暖心熊 | bear | medium | A↑ E↑ |
| 08 | 灵感章鱼 | octopus | medium | O↑ C↓ |
| 09 | 沉思猫头鹰 | owl | low | O↑ C↑ |
| 10 | 定心大象 | elephant | low | E↑ C↑ |
| 11 | 稳如龟 | turtle | very low | C↑ E↑ X↓ |
| 12 | 隐身猫 | cat | very low | O↑ X↓ |

**Trait keys:** `A` Affinity, `C` Conscientiousness, `E` Emotional Stability, `O` Openness, `X` Extraversion, `P` Positivity. All scored 0–100.

## Assessment systems: V4 (canonical) vs legacy V1/V2

**V4 adaptive is the canonical assessment.** Legacy V1/V2 routes exist for backward compatibility but are not the active flow.

| Aspect | V4 Adaptive (canonical) | Legacy V1/V2 |
|--------|------------------------|--------------|
| Route prefix | `/api/assessment/v4/*` | `/api/personality-test/*` |
| Questions | 8–16 adaptive (60+ bank) | Fixed 10 |
| Algorithm | MatcherV2 (v2.4-opposite-pole) | V1 Euclidean / V2 simple weighted |
| Question types | choice, slider, emoji_tap | choice only |
| Closing questions | Q_PLAYFUL_SLIDER, Q_PLAYFUL_EMOJI | none |

See [`references/engine-details.md`](./references/engine-details.md) for:
- Full adaptive engine flow and config variants
- Chemistry / compatibility system details
- Trait score normalization
- Closing questions and secondary data mapping
- Archetype skill tree and color system
- Important notes on archetype duplication and server inference engine

## Common mistakes to avoid

- **Using legacy V1 matcher (`findBestMatchingArchetypes` in `prototypes.ts`) for new code.** Always use `findBestMatchingArchetypesV2` or `prototypeMatcher.findBestMatches()`.
- **Importing from the legacy top-level `shared/` directory.** Always import personality code via `@shared/personality` or `@joyjoin/shared`.
- **Reordering `ARCHETYPE_CANONICAL_ORDER` without checking dependents.** This breaks TYPE numbering, slot-machine animation, and share cards.
- **Adding trait-score mappings in questionsV4.ts outside the -3..+3 range without checking normalization.** The `50 + raw * 15` formula assumes this range.
- **Forgetting to update `archetypeConfig.ts` when adding/removing archetypes.**
- **Modifying `archetypeChemistry.ts` (runtime) without updating `archetypeCompatibility.ts` (canonical).** The matching-domain skill expects the canonical source to be the single source of truth.
- **Confusing the server inference engine with personality assessment.** They are separate subsystems.

## Troubleshooting

- **Archetype assignment feels wrong** — Check raw trait scores in the session's `traitConfidences`. Verify the user's answers align with the archetype's `traitProfile` in `archetypeRegistry.ts`. Check if a confusion-pair gate or veto rule fired.
- **Test always ends at hardMax (16) or never terminates** — Check `shouldTerminate()` logic in `adaptiveEngine.ts`. Verify `confidenceGapThreshold` and `dimensionCoverageThreshold` config values. Persistent confusable pairs extend the test by +2 questions.
- **Slot machine shows wrong order** — Verify `ARCHETYPE_CANONICAL_ORDER` in `archetypeNames.ts` matches the client's `ARCHETYPE_SEQUENCE`.
- **Share card color is wrong** — Check `CANONICAL_COLORS` in `archetypeColors.ts` and ensure the archetype name matches exactly (Chinese characters).
- **Secondary data (e.g., conflictPosture) is missing** — Verify `SECONDARY_QUESTION_MAP` has the question ID mapping, and the server answer route persists it into `preSignupData`.

## Review checklist

- [ ] New archetype added to `archetypeRegistry.ts`, `archetypeNames.ts`, `archetypeColors.ts`, `archetypeSkills.ts`, and `archetypeCompatibility.ts`
- [ ] `archetypeConfig.ts` re-export is still valid (if order/names changed)
- [ ] New question options use trait scores in the expected -3..+3 range
- [ ] Matcher changes use V2 API (`findBestMatchingArchetypesV2` or `prototypeMatcher`)
- [ ] Chemistry matrix changes synced to both canonical (`archetypeCompatibility.ts`) and runtime (`archetypeChemistry.ts`) copies
- [ ] Canonical archetype order was not changed unless all dependents (slot machine, TYPE numbering, share cards) were verified
- [ ] New secondary question mapping added to `secondaryQuestionMap.ts` and server answer route
- [ ] `questionsV4.ts` export surface is still correct (re-exports `SECONDARY_QUESTION_MAP`)

## Related skills

- `matching-domain` — How chemistry matrix is consumed in pool matching; signal boundary rules
- `onboarding-state-architecture` — Server-driven onboarding flow that wraps the V4 assessment
- `llm-runtime-safety-and-integration` — If adding AI-generated assessment questions or explanations
- `platform-coordination-protocol` — If changing assessment UI in both mini-program and web clients
- `multi-agent-deliberation` — When archetype or assessment changes are contentious, cross-domain, or high-blast-radius
