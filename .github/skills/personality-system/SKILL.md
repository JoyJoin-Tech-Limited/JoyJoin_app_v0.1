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
| Archetype registry (12 archetypes) | `packages/shared/src/personality/archetypeRegistry.ts` |
| Canonical ordering / TYPE numbering | `packages/shared/src/personality/archetypeNames.ts` |
| ACOEXP trait model + AssessmentConfig | `packages/shared/src/personality/types.ts` |
| V4 question bank (60+ questions) | `packages/shared/src/personality/questionsV4.ts` |
| Adaptive engine | `packages/shared/src/personality/adaptiveEngine.ts` |
| MatcherV2 | `packages/shared/src/personality/matcherV2.ts` |
| Chemistry matrix + Xiaoyue narratives | `packages/shared/src/personality/archetypeCompatibility.ts` |
| Color tokens (HSL) | `packages/shared/src/archetypeColors.ts` |
| **Server V4 API routes** | `apps/server/src/routes.ts` (lines ~10754–11750) |
| Mini-program V4 test UI | `apps/mini-program/src/pages/onboarding/personality-test/` |
| Mini-program result reveal | `apps/mini-program/src/pages/onboarding/personality-test/results/` |
## 12 Archetypes (canonical order)
Canonical order is **load-bearing**: used for TYPE numbering, slot-machine sequencing, and share cards.
| # | Name | ID | Key Traits |
|---|------|-----|-----------|
| 01 | 开心柯基 | corgi | X↑ P↑ |
| 02 | 太阳鸡 | rooster | P↑ C↑ |
| 03 | 捧场王仓鼠 | hamster_praise | A↑ P↑ |
| 04 | 机智狐 | fox | O↑ X↑ |
| 05 | 淡定海豚 | dolphin_calm | E↑ C↑ |
| 06 | 织网蛛 | spider | C↑ A↑ |
| 07 | 情绪树洞考拉 | koala | A↑ E↑ |
| 08 | 灵感章鱼 | octopus | O↑ C↓ |
| 09 | 沉思猫头鹰 | owl | O↑ C↑ |
| 10 | 定心大象 | elephant | E↑ C↑ |
| 11 | 稳如龟 | turtle | C↑ E↑ X↓ |
| 12 | 隐身猫 | cat | O↑ X↓ |
**Trait keys:** `A` Affinity, `C` Conscientiousness, `E` Emotional Stability, `O` Openness, `X` Extraversion, `P` Positivity. All scored 0–100.
## Assessment systems: V4 (canonical) vs legacy V1/V2
**V4 adaptive is the canonical assessment.** Legacy V1/V2 routes exist for backward compatibility but are not the active flow.
| Aspect | V4 Adaptive (canonical) | Legacy V1/V2 |
|--------|------------------------|--------------|
| Route prefix | `/api/assessment/v4/*` | `/api/personality-test/*` |
| Questions | 8–16 adaptive (60+ bank) | Fixed 10 |
| Algorithm | MatcherV2 (v2.4-opposite-pole) | V1 Euclidean / V2 simple weighted |
| Question types | choice, slider, emoji_tap | choice only |
See [`references/engine-details.md`](./references/engine-details.md) for full adaptive engine flow, config variants, chemistry system, trait normalization, closing questions, and archetype skill tree.
## Common mistakes to avoid
- **Using legacy V1 matcher for new code.** Always use `findBestMatchingArchetypesV2` or `prototypeMatcher.findBestMatches()`.
- **Reordering `ARCHETYPE_CANONICAL_ORDER` without checking dependents.** This breaks TYPE numbering, slot-machine animation, and share cards.
- **Adding trait-score mappings outside the -3..+3 range without checking normalization.** The `50 + raw * 15` formula assumes this range.
- **Modifying `archetypeChemistry.ts` (runtime) without updating `archetypeCompatibility.ts` (canonical).** The matching-domain skill expects the canonical source to be the single source of truth.
## Troubleshooting
- **Archetype assignment feels wrong** — Check raw trait scores in `traitConfidences`. Verify answers align with the archetype's `traitProfile` in `archetypeRegistry.ts`. Check if a confusion-pair gate fired.
- **Test always ends at hardMax (16) or never terminates** — Check `shouldTerminate()` logic in `adaptiveEngine.ts`. Verify `confidenceGapThreshold` and `dimensionCoverageThreshold`.
- **Slot machine shows wrong order** — Verify `ARCHETYPE_CANONICAL_ORDER` in `archetypeNames.ts` matches the client's `ARCHETYPE_SEQUENCE`.
- **Share card color is wrong** — Check `CANONICAL_COLORS` in `archetypeColors.ts` and ensure the archetype name matches exactly (Chinese characters).
## Review checklist
- [ ] New archetype added to `archetypeRegistry.ts`, `archetypeNames.ts`, `archetypeColors.ts`, `archetypeSkills.ts`, and `archetypeCompatibility.ts`
- [ ] `archetypeConfig.ts` re-export is still valid (if order/names changed)
- [ ] New question options use trait scores in the expected -3..+3 range
- [ ] Matcher changes use V2 API (`findBestMatchingArchetypesV2` or `prototypeMatcher`)
- [ ] Chemistry matrix changes synced to both canonical (`archetypeCompatibility.ts`) and runtime (`archetypeChemistry.ts`) copies
- [ ] Canonical archetype order was not changed unless all dependents were verified
## Quick examples
**User says:** "Add a new archetype to the roster."
**Apply this skill by:** Updating `archetypeRegistry.ts`, `archetypeNames.ts`, `archetypeColors.ts`, `archetypeSkills.ts`, and `archetypeCompatibility.ts`, then verifying `archetypeConfig.ts` re-export and canonical order dependents.
**Result:** A fully integrated archetype that renders correctly in assessment results and share cards.
**User says:** "The test feels too short and assigns the wrong archetype."
**Apply this skill by:** Checking `adaptiveEngine.ts` termination logic and verifying the user's `traitConfidences` against the target archetype's `traitProfile`.
**Result:** Root cause identified as either premature termination or a confusion-pair veto rule firing incorrectly.
## Related skills
- `matching-domain` — How chemistry matrix is consumed in pool matching; signal boundary rules
- `onboarding-state-architecture` — Server-driven onboarding flow that wraps the V4 assessment
- `platform-coordination-protocol` — If changing assessment UI in both mini-program and web clients
