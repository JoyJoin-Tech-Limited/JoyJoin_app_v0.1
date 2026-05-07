---
id: repo.orchestration.separate-durable-memory-from-operational-state
title: Separate Durable Memory From Operational State
status: active
owner: workflow-platform
lastValidatedAt: 2026-04-14
tags:
  - orchestration
  - memory
  - operational-state
triggerTerms:
  - durable memory vs operational state
  - memory plane separation
  - do not store durable memory in dot git
relatedPaths:
  - docs/proposals/profile-c-memory-layer-rfc.md
  - .github/ORCHESTRATION_GOVERNANCE.md
  - scripts/orchestration/orchestration-lib.mjs
sources:
  - docs/proposals/profile-c-memory-layer-rfc.md
  - .github/ORCHESTRATION_GOVERNANCE.md
confidence: high
---

- Durable repo memory belongs in reviewable files outside `.git`, so notes stay diffable, attributable, and easy to retire when they go stale.
- `.git/.orchestration/*` and `.git/.auto-eval/pass-state.json` remain operational surfaces only; they are not publication targets for reusable repo knowledge.