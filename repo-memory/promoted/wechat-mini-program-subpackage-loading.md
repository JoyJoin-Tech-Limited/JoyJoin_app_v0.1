---
id: repo.mini-program.wechat-subpackage-loading-strategy
title: WeChat Mini-Program Subpackage Loading Strategy
status: active
owner: mini-program-platform
lastValidatedAt: 2026-04-14
tags:
  - mini-program
  - wechat
  - subpackages
  - performance
triggerTerms:
  - wechat subpackage
  - independent subpackage
  - preloadRule
  - mini-program package loading
  - ordinary subpackage
relatedPaths:
  - apps/mini-program/README.md
  - apps/mini-program/src/app.config.ts
  - apps/mini-program/src/app.ts
  - apps/mini-program/src/providers/AuthProvider.tsx
  - apps/mini-program/src/lib/navigation/tabBarConfig.ts
  - docs/reference/perf.md
  - .github/skills/frontend-performance-and-loading/SKILL.md
  - .github/skills/performance-benchmark/SKILL.md
  - .github/agents/taro-mini-program-frontend-engineer.agent.md
sources:
  - apps/mini-program/README.md
  - apps/mini-program/src/app.config.ts
  - apps/mini-program/src/app.ts
  - apps/mini-program/src/providers/AuthProvider.tsx
  - docs/reference/perf.md
confidence: high
---

- TabBar pages stay in the main package.
- JoyJoin default split path for mini-program loading work is ordinary subpackages plus preloadRule for heavy non-tab flows.
- Independent subpackages are not banned, but they are only worth doing when a benchmark shows material launch or first-entry wins after ordinary splitting, preload, and asset cleanup.
