---
id: repo.personality.split-brain-prevention
title: Personality Test Split-Brain Prevention Pattern
status: active
owner: mini-program-platform
lastValidatedAt: 2026-05-27
tags:
  - personality-test
  - archetype
  - split-brain
  - validation
  - results
triggerTerms:
  - personality test mismatch
  - slot animation wrong archetype
  - split brain
  - finalResult validation
  - archetype drift
  - displayArchetype mismatch
relatedPaths:
  - apps/mini-program/src/pages/onboarding/personality-test/results/index.tsx
  - apps/mini-program/src/pages/onboarding/personality-test/index.tsx
  - apps/server/src/routes/domains/assessmentV4.ts
  - apps/mini-program/src/pages/onboarding/personality-test/visuals.ts
sources:
  - docs/systems/PERSONALITY_TEST_SYSTEM.md
  - apps/mini-program/src/pages/onboarding/personality-test/results/index.tsx
confidence: high
---

## Summary

The personality test results flow has a split-brain prevention pattern that ensures the slot animation and the result page always show the same archetype.

### Root causes of historical mismatches
1. **CDN spritesheet staleness** — The slot machine loaded a CDN spritesheet that could be cached/stale, causing the animation grid to differ from the result page's expectation.
2. **`finalResult` discarded** — `completeAnonymousAssessment` was saving `result: null` instead of the server's `finalResult`, causing the client to compute divergent fallbacks.

### Prevention measures (2026-05-27)
- **Local spritesheet only**: `getArchetypeSpritesheetLocalPath()` returns `/pages/onboarding/assets/archetypes/archetype-spritesheet.webp` (onboarding subpackage). CDN path exists only as emergency fallback.
- **Server validation**: `validateFinalResult()` in `assessmentV4.ts` checks that `primaryArchetype` is a valid string in `ARCHETYPE_NAMES` before persisting. Invalid results fall back to `'corgi'` and log an error.
- **Client hard validation**: `isValidFinalResult()` blocks transition to results with an error toast if `primaryArchetype` is missing or invalid.
- **Unified fallback chain**: Both slot target and display archetype use identical resolution:
  ```
  resolvedResult.result.primaryArchetype
    → sessionSnapshot.result.primaryArchetype
    → topMatches[0].archetype
    → 'corgi'
  ```
- **Telemetry**: Client logs `[PersonalityResults] SPLIT_BRAIN_DETECTED` when slot target ≠ display archetype. Server logs divergence between `currentMatches[0]` and `finalResult.primaryArchetype` with top-3 scores.
- **GET /result guard**: Returns `500` "Result data is incomplete" if `session.finalResult` is null/malformed, rather than violating the client's `NonNullable` assumption.
