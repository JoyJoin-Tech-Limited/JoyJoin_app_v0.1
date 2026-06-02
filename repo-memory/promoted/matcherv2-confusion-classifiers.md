---
id: repo.personality.matcherv2-confusion-classifiers
title: MatcherV2 Confusion-Aware Classifiers
status: active
owner: personality-engine
lastValidatedAt: 2026-05-27
tags:
  - personality-test
  - matcherV2
  - confusion-pair
  - archetype
  - classification
triggerTerms:
  - matcherV2 confusion
  - elephant turtle
  - dolphin spider
  - confusion aware classifier
  - archetype misclassification
  - matcher veto
relatedPaths:
  - packages/shared/src/personality/matcherV2.ts
  - packages/shared/src/personality/matcherV2Gates.ts
sources:
  - docs/systems/PERSONALITY_TEST_SYSTEM.md
  - packages/shared/src/personality/matcherV2.ts
confidence: high
---

## Summary

MatcherV2 uses dedicated confusion-aware classifiers for historically misclassified archetype pairs. As of 2026-05-27, five pairs are handled in `applyConfusionAwareClassifier` with trait-specific differentiators and veto hardening.

### Handled confusion pairs
1. **小太阳鸡 vs 机灵海豚** (`rooster,dolphin_calm`) — P-gap differentiator
2. **好奇猫头鹰 vs 慢热龟** (`owl,turtle`) — O-gap differentiator
3. **树洞考拉 vs 机灵海豚** (`koala,dolphin_calm`) — A-gap differentiator
4. **靠谱大象 vs 慢热龟** (`elephant,turtle`) — A/P/X differentiators (2026-05-27)
5. **机灵海豚 vs 人脉蛛** (`dolphin_calm,spider`) — E/C/X differentiators (2026-05-27)

### Veto hardening (2026-05-27)
- **慢热龟**: penalizes high-A (`≥70 → 0.5×`) and high-P (`≥58 → 0.6×`)
- **靠谱大象**: penalizes very-low-X (`<32 → 0.5×`) and very-low-P (`<38 → 0.6×`)
- **人脉蛛**: penalizes high-E (`≥78 → 0.5×`)

### Gate threshold fix
- `elephant` gate threshold lowered from `A≥72` (above elephant's actual A=70, never triggered) to `A≥68` (2026-05-27).

### Historical context
- Pre-fix simulation showed ~80% direct accuracy vs V1's 100%. Known misclassifications `turtle→elephant` and `dolphin_calm→spider` are now addressed with dedicated classifiers.
