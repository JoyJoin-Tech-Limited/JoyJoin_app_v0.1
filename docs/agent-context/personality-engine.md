# Personality Engine Status — Agent Context

> Extracted from AGENTS.md §6 (2026-07-31). Load when modifying archetypes, assessment questions, matcher logic, or trait scoring. Skill: `personality-system`.

**Personality:** 12 archetypes, V4 adaptive assessment. `packages/shared/src/personality/` owns the engine. **2026-06-02 status:**
- 12 centroids: **100% exact match**
- 33 boundaries: **66.7%** (30/45). Anchor option conflation is the bottleneck — 8 anchors with 3-5 trait scores per option create measurement drift of 10-26 pts on traits like X. Attempted fixes (all regressed or net-zero): purity weighting, surgical option edits, ±3 calibration Qs, per-trait multipliers.
- **`applyMeasurementDriftCorrections`** in `adaptiveEngine.ts`: post-hoc promotion for rooster→corgi and koala→dolphin drift patterns. Proven to fix centroid regressions.
- **`classifyFoxVsOctopus`** activated in matcherV2.ts confusion classifier (method existed, wasn't in switch case).
- **Persona audit:** 13/33 boundary personas had wrong `expectedArchetype` — matcher isolation revealed the true labels. Fixed `scripts/simulate/data/all-personas.json`.
- **Calibration Qs (Q51-Q54):** 4 pure single-trait questions (±2 magnitude), feature-flagged via `enableCalibrationQuestions`. Default `true` in V2 config. Performance impact: +2 avg Q, neutral to slightly negative exact-match. Needs shadow-mode data before production enablement.
- **Results page:** Non-decisive matches show subtle "隐约有[secondary]的影子" blend indicator on hero card, prefers `xiaoyueAnalysis.blendLine`.
- New config options: `traitScoreMultiplier`, `traitScoreBaselines`, `useFixedQuestions`, `fixedQuestionIds`, `enableCalibrationQuestions`, `maxCalibrationQuestions`.
