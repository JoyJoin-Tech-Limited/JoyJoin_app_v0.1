---
id: repo.orchestration.runtime-state-truthfulness
title: Runtime State Truthfulness
status: active
owner: workflow-platform
lastValidatedAt: 2026-04-14
tags:
  - orchestration
  - runtime-state
  - governance
triggerTerms:
  - runtime state truthfulness
  - advisory runtime state
  - stale scope handling
relatedPaths:
  - .github/ORCHESTRATION.md
  - .github/ORCHESTRATION_GOVERNANCE.md
  - scripts/orchestration-lib.mjs
sources:
  - .github/ORCHESTRATION.md
  - .github/ORCHESTRATION_GOVERNANCE.md
confidence: high
---

- Runtime state under `.git/.orchestration/` is advisory and session-scoped; it must not overstate certainty.
- When changed-file scope, kickoff context, or cached prompt state becomes stale, the safe fallback is to clear or recompute it instead of treating it as current truth.