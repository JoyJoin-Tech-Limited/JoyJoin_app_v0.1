---
id: mini-program.squad-unboxing-redesign-v2
title: Squad Unboxing Redesign v2 (2026-06-29)
status: candidate
owner: mini-program-frontend
lastValidatedAt: 2026-06-29
tags:
  - mini-program
  - squad-unboxing
  - ui
  - match-reveal
  - analytics
  - 情绪价值
triggerTerms:
  - squad unboxing redesign
  - squad-unboxing
  - match reveal
  - 桌友揭晓
relatedPaths:
  - apps/mini-program/src/pages/squad-unboxing/index.tsx
  - apps/mini-program/src/pages/squad-unboxing/index.scss
  - apps/mini-program/src/pages/squad-unboxing/useSquadUnboxingController.ts
  - apps/mini-program/src/pages/squad-unboxing/TeammateCard.tsx
  - apps/mini-program/src/pages/squad-unboxing/SquadDeckStage.tsx
  - apps/mini-program/src/pages/squad-unboxing/TeammateCardDetail.tsx
  - apps/mini-program/src/lib/analytics/squadUnboxingAnalytics.ts
  - apps/server/src/routes/domains/analytics.ts
  - apps/server/src/routes/domains/userEventPools.ts
sources:
  - AGENTS.md
  - docs/mini-program/mini-program-product-reference.md
  - apps/mini-program/src/pages/squad-unboxing/index.tsx
confidence: high
---

## Squad Unboxing Redesign v2 — what to remember

- **Page:** `apps/mini-program/src/pages/squad-unboxing/index` is the primary match-reveal surface. It runs after `matching-status` for first-time matched users and respects the per-group `jj_revealed_${groupId}` storage flag on repeat visits.
- **Visual system:** light warm gradient background (`$color-bg-tint-cream` → `$color-bg-tint-pink` → `$color-bg-tint-purple`); no dark cosmic background. Archetype-tinted card borders/shadows via `@shared/archetypeColors`.
- **Reveal flow:** `ready` → drag/tap to open (`DragRevealRibbon`) → `shaking` (blind-box lid lift, preloads card-back pattern) → `revealed`. Revealed state shows a fanned `SquadDeckStage` of collectible `TeammateCard` components. Tap a card to focus it and show `TeammateCardDetail` inline (no separate bottom panel).
- **AI 团魂 bubble:** Xiaoyue appears after reveal with `TypewriterText` capped at 3000 ms, displaying the archetype-mix line and group-theme companion.
- **Action dock:** primary `确认出席`; secondary row `生成队伍海报` + `查看活动详情`; tertiary `稍后再看`. Confirming attendance triggers a Xiaoyue success overlay before routing to the event/pool group.
- **Analytics:** `squad_unboxing_card_focus` (with `source: 'deck_tap'`), `squad_unboxing_confirm_attendance_tap`, `squad_unboxing_confirm_attendance_success`, `squad_unboxing_confirm_attendance_error`, `squad_unboxing_share_poster_tap`, `squad_unboxing_bubble_reveal_complete`, `squad_unboxing_box_open_milestone`.
- **Server:** `POST /api/pool-groups/:groupId/confirm-attendance` is idempotent — returns clean 200 when attendance is already `confirmed`, no DB write or re-broadcast.
- **Shared changes:** `TypewriterText` gained a `maxDuration` prop. `ConnectionPointPill` and `DragRevealRibbon` were tokenized for guardrails compliance.
- **Out of scope:** dynamic share-poster generation is Phase 2; Phase 1 only wires the static CTA + analytics.
