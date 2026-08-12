# JoyJoin Documentation Index

This directory contains the active architecture, product-domain, operations, and implementation docs for JoyJoin.

## Read first

Use these as the main entry points before branching into topic-specific documents:

1. [`../DEVELOPER_QUICK_REFERENCE.md`](../DEVELOPER_QUICK_REFERENCE.md) — canonical engineering guardrails
2. [`../PRODUCT_REQUIREMENTS.md`](../PRODUCT_REQUIREMENTS.md) — product canon and terminology
3. [`architecture/current-state.md`](./architecture/current-state.md) — active architecture map and domain ownership

### Launch focus — WeChat Mini Program (Taro)

The **Taro mini-program** (`apps/mini-program`) is the **launch-primary** client for the current track. Start here for structure, commands, tab bar, and package strategy:

- [`../apps/mini-program/README.md`](../apps/mini-program/README.md) — workspace entry points, `onboardingRoutes.ts` registration, native custom tab bar, build commands
- [`mini-program-product-reference.md`](./mini-program-product-reference.md) — compact product-to-code bridge for page inventory, active journeys, admin impact, and docs-sync triggers
- [`reference/PLATFORM_COORDINATION.md`](./reference/PLATFORM_COORDINATION.md) — web vs mini-program auth, API, and payment coordination
- [`reference/perf.md`](./reference/perf.md) — web Vitals + **mini-program** subpackage / preload strategy
- [`reference/emotional-value-rubric.md`](./reference/emotional-value-rubric.md) — 6-dimension 情绪价值 scoring (0–24) — measures emotional value as predictor of premium willingness-to-pay
- [`reference/wechat-mini-program-reference.md`](./reference/wechat-mini-program-reference.md) — supplemental WeChat primitives (rpx, APIs); **not** the Taro source of truth
- [`mini-program-data-fetching.md`](./mini-program-data-fetching.md) — mini-program React Query key conventions for pool/matching data
- [`.github/skills/mini-program-frontend-excellence/SKILL.md`](../.github/skills/mini-program-frontend-excellence/SKILL.md) — quality bar (pixel precision, DevTools gate)
- [`ai/ai-workflow-documentation-refresh.md`](./ai/ai-workflow-documentation-refresh.md) — if you are touching docs + skills + agents together

## By audience

### Leaders and product owners (non-technical)

- [`reference/repo-memory-decisions-for-leaders.md`](./reference/repo-memory-decisions-for-leaders.md) — plain-English choices for durable repo memory (draft vs official, review, automation)

### New contributors

- [`../CONTRIBUTING.md`](../CONTRIBUTING.md)
- [`architecture/current-state.md`](./architecture/current-state.md)
- [`systems/onboarding-flow.md`](./systems/onboarding-flow.md)

### Backend and platform engineers

- [`architecture/current-state.md`](./architecture/current-state.md)
- [`systems/observability.md`](./systems/observability.md)
- [`reference/PLATFORM_COORDINATION.md`](./reference/PLATFORM_COORDINATION.md)
- [`product/launch-risks.md`](./product/launch-risks.md)

### Frontend engineers and designers

- [`../apps/mini-program/README.md`](../apps/mini-program/README.md) — Taro mini-program (launch-primary): layout, tab bar, subpackages
- [`mobile-design-system.md`](./mobile-design-system.md)
- [`MOBILE_UI_IMPLEMENTATION_SUMMARY.md`](./architecture/implementation-summaries/MOBILE_UI_IMPLEMENTATION_SUMMARY.md)
- [`design/button-design.md`](./design/button-design.md)
- [`design/lovart-brief-gathering-room.md`](./design/lovart-brief-gathering-room.md)
- [`reference/ui-matching-reveal-improvements.md`](./reference/ui-matching-reveal-improvements.md)

### Ops and maintainers

- [`product/LAUNCH_CONFIG.md`](./product/LAUNCH_CONFIG.md)
- [`systems/observability.md`](./systems/observability.md)
- [`runbooks/observability.md`](./runbooks/observability.md)
- [`runbooks/alerting.md`](./runbooks/alerting.md)
- [`runbooks/mini-program-events-tab-smoke.md`](./runbooks/mini-program-events-tab-smoke.md)

## By topic

### Architecture and source-of-truth docs

- [`architecture/current-state.md`](./architecture/current-state.md)
- [`architecture/skill-routing.md`](./architecture/skill-routing.md)
- [`agent-context/`](./agent-context/) — domain briefs for agent onboarding (canonical source for `AGENTS.md` §6)

### Onboarding and auth

- [`systems/onboarding-flow.md`](./systems/onboarding-flow.md) — active onboarding flow
- [`MIGRATION_2026-02-04_SIGNUP_FLOW.md`](./MIGRATION_2026-02-04_SIGNUP_FLOW.md) — historical migration record
- [`ONBOARDING_ROUTING_FIX_2026-02-10.md`](./ONBOARDING_ROUTING_FIX_2026-02-10.md) — historical routing-fix record

### Personality, matching, and event experience

- [`systems/PERSONALITY_TEST_SYSTEM.md`](./systems/PERSONALITY_TEST_SYSTEM.md) — V4 engine + web vs mini-program client surfaces
- [`systems/MATCHING_ALGORITHM_REFERENCE.md`](./systems/MATCHING_ALGORITHM_REFERENCE.md)
- [`icebreaker/icebreaker-system.md`](./icebreaker/icebreaker-system.md)
- [`product/gathering-room-prd.md`](./product/gathering-room-prd.md) — 集结房间 (gathering room) PRD: pre-event online anteroom for matched groups
- [`matching-reveal-implementation-summary.md`](./matching-reveal-implementation-summary.md)

### Venue and location services

- [`systems/VENUE_ASSIGNMENT_SERVICE.md`](./systems/VENUE_ASSIGNMENT_SERVICE.md) — venue auto-assignment algorithm, scoring, DB schema, and operational runbooks

### AI systems

- [`ai/AI_FEATURE_INVENTORY.md`](./ai/AI_FEATURE_INVENTORY.md) — mini-program-visible AI features and fallbacks (keep in sync with `apps/mini-program` + server)
- [`mini-program-ai-roadmap-handoff.md`](./mini-program-ai-roadmap-handoff.md) — kickoff lane + deeper AI tranches for MP (see `ai/AI_INTEGRATION_PLAN.md`)
- [`mini-program-ai-further-execution-plan.md`](./mini-program-ai-further-execution-plan.md) — next implementation packages (instrumentation, shadow, gates) and verification
- [`ai/ai-feature-flags.md`](./ai/ai-feature-flags.md) — environment variables and kill-switches for AI paths
- [`ai/ai-prompt-registry.md`](./ai/ai-prompt-registry.md) — prompt version IDs by service
- [`runbooks/mini-program-ai-smoke.md`](./runbooks/mini-program-ai-smoke.md) — manual smoke checklist for MP AI
- [`runbooks/matching-stress-simulation.md`](./runbooks/matching-stress-simulation.md) — local greedy matcher + optional AI chat-flow CPU benchmark (`npm run benchmark:matching-stress` in `apps/server`)
- [`ai/ai-agent-harness-separation-strategy.md`](./ai/ai-agent-harness-separation-strategy.md) — current-state AI architecture and invariants
- [`ai/AI_MODEL_ROUTING_STRATEGY.md`](./ai/AI_MODEL_ROUTING_STRATEGY.md) — current-state provider allocation, function-level routing tables, and AI trace expectations
- [`ai/AI_INTEGRATION_PLAN.md`](./ai/AI_INTEGRATION_PLAN.md) — phased roadmap and execution gates
- [`ai/AI_EXECUTION_ROADMAP.md`](./ai/AI_EXECUTION_ROADMAP.md) — 30-60-90 roadmap for repo AI workflow governance, validation, and tooling maturity
- [`ai/ai-workflow-documentation-refresh.md`](./ai/ai-workflow-documentation-refresh.md) — scope tiers, routing lanes (kickoff vs docs-sync vs governance), and Workflow Governance Reviewer vs bulk doc sync
- [`proposals/profile-c-memory-layer-rfc.md`](./proposals/profile-c-memory-layer-rfc.md) — proposal for adding a durable memory plane to JoyJoin's AI workflow system without reusing `.git` operational state

### Platform coordination and launch readiness

- [`reference/PLATFORM_COORDINATION.md`](./reference/PLATFORM_COORDINATION.md)
- [`reference/perf.md`](./reference/perf.md) — performance budgets; mini-program package loading
- [`reference/wechat-mini-program-reference.md`](./reference/wechat-mini-program-reference.md) — WeChat API / rpx supplement (Taro app is canonical)
- [`product/launch-risks.md`](./product/launch-risks.md)
- [`product/LAUNCH_CONFIG.md`](./product/LAUNCH_CONFIG.md)

### Operations and runbooks

- [`systems/observability.md`](./systems/observability.md)
- [`runbooks/admin-incident-handling.md`](./runbooks/admin-incident-handling.md)
- [`runbooks/alerting.md`](./runbooks/alerting.md)
- [`runbooks/observability.md`](./runbooks/observability.md)

## Contributor resources outside this directory

- [`../.github/AI_WORKFLOW_POLICY.md`](../.github/AI_WORKFLOW_POLICY.md)
- [`../.github/ORCHESTRATION_GOVERNANCE.md`](../.github/ORCHESTRATION_GOVERNANCE.md)
- [`../.github/ORCHESTRATION.md`](../.github/ORCHESTRATION.md)
- [`../.github/skills/README.md`](../.github/skills/README.md)
- [`../.github/agents/README.md`](../.github/agents/README.md)
- [`../apps/server/src/README.md`](../apps/server/src/README.md)
- [`../packages/shared/src/README.md`](../packages/shared/src/README.md)
- In-product legal copy (用户协议 / 隐私政策，中文单一事实来源): [`../packages/shared/src/legal/joyjoinTermsZh.ts`](../packages/shared/src/legal/joyjoinTermsZh.ts) — keep web and mini-program in sync via this module.
