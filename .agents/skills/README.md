# JoyJoin Skills Index

This directory contains the canonical skill system for JoyJoin agents.

## Taxonomy

Every skill is tagged with a `category` in its `routing.yml`:

- **`ai-runtime`** — Skills that orchestrate or configure AI services invoked at runtime in the product flow (e.g., icebreaker compilation, asset generation, embedding pipelines)
- **`internal`** — Developer tooling, design guidance, infrastructure, process, and domain documentation (everything else)

See [`skill-taxonomy.md`](./skill-taxonomy.md) for full definitions and edge-case rationale.

---

## AI-Runtime Skills (9)

| Skill | Description |
|-------|-------------|
| [`game-design-icebreaker-compilation`](./game-design-icebreaker-compilation/SKILL.md) | Compile post-match Social Icebreaker run plans via AI |
| [`icebreaker-auction-phase`](./icebreaker-auction-phase/SKILL.md) | Virtual-coin English auction phase (`social-auction-lots-v1`) |
| [`lie-detective-icebreaker`](./lie-detective-icebreaker/SKILL.md) | Two-truths-one-lie phase (`social-lie-detective-v1`) |
| [`llm-runtime-safety-and-integration`](./llm-runtime-safety-and-integration/SKILL.md) | LLM provider routing, prompt versioning, fallback, shadow mode |
| [`lovart-design-workflow`](./lovart-design-workflow/SKILL.md) | Generate brand illustrations and mascot assets via Lovart AI |
| [`miniscript-story-framework`](./miniscript-story-framework/SKILL.md) | Mini-script story phase (`social-miniscript-v1`) |
| [`personality-dice-icebreaker`](./personality-dice-icebreaker/SKILL.md) | Personality dice challenge phase (`social-personality-dice-v1`) |
| [`semantic-matching-embeddings`](./semantic-matching-embeddings/SKILL.md) | Neural embedding generation via DeepSeek for matching |
| [`stitch-design-workflow`](./stitch-design-workflow/SKILL.md) | Generate UI mockups and screen explorations via Stitch AI |

---

## Internal Skills (53)

### Architecture & Backend

| Skill | Description |
|-------|-------------|
| [`api-contract-versioning`](./api-contract-versioning/SKILL.md) | Cross-platform API contract governance |
| [`auth-session-and-safety-boundaries`](./auth-session-and-safety-boundaries/SKILL.md) | Policy-based auth gating and fail-closed handling |
| [`backend-models-standards`](./backend-models-standards/SKILL.md) | DB schema conventions and relationships |
| [`caching-strategy`](./caching-strategy/SKILL.md) | Caching, TTL design, invalidation, rate limiting |
| [`database-migration-safety`](./database-migration-safety/SKILL.md) | Safe schema evolution and rollout planning |
| [`database-query-optimization`](./database-query-optimization/SKILL.md) | Drizzle ORM patterns, N+1 avoidance, query plans |
| [`error-handling-patterns`](./error-handling-patterns/SKILL.md) | Consistent API error shapes and retry patterns |
| [`event-pool-and-matching-operations`](./event-pool-and-matching-operations/SKILL.md) | Event pool lifecycle, match runs, group outcomes |
| [`matching-domain`](./matching-domain/SKILL.md) | Deterministic 6D/7D pair scoring and match explanation |
| [`monorepo-workspace-governance`](./monorepo-workspace-governance/SKILL.md) | Root orchestration, workspace deps, guardrails |
| [`notification-system`](./notification-system/SKILL.md) | In-app notifications, broadcast, mark-read |
| [`payment-entitlement-authority`](./payment-entitlement-authority/SKILL.md) | Payment creation, verification, refunds, credits |
| [`platform-observability-and-ops`](./platform-observability-and-ops/SKILL.md) | Logging, metrics, health/readiness, alerts |
| [`reliability-and-state-integrity`](./reliability-and-state-integrity/SKILL.md) | Transactions, idempotency, recovery, execution guards |
| [`security-scan`](./security-scan/SKILL.md) | Security posture review and vulnerability audit |
| [`semantic-matching-embeddings`](./semantic-matching-embeddings/SKILL.md) | *(see AI-Runtime)* |
| [`server-domain-architecture`](./server-domain-architecture/SKILL.md) | Route composition, domain ownership, repositories |
| [`venue-location-services`](./venue-location-services/SKILL.md) | Venue catalog, assignment, geocoding |
| [`websocket-realtime`](./websocket-realtime/SKILL.md) | WebSocket lifecycle, auth, rooms, broadcasting |
| [`wechat-ecosystem-integration`](./wechat-ecosystem-integration/SKILL.md) | WeChat auth, Mini Program APIs, WeChat Pay |

### Frontend & Design

| Skill | Description |
|-------|-------------|
| [`admin-client-frontend`](./admin-client-frontend/SKILL.md) | Admin portal UI with Recharts, shadcn/ui, RBAC |
| [`design-system-governance`](./design-system-governance/SKILL.md) | Tokens, variants, accessibility, migration |
| [`frontend-component-architecture`](./frontend-component-architecture/SKILL.md) | Shared primitives, app wrappers, composition |
| [`frontend-design-audit`](./frontend-design-audit/SKILL.md) | Systematic UI quality audits, AI slop detection |
| [`frontend-hook-engine`](./frontend-hook-engine/SKILL.md) | Screen-level product audit with sin mapping |
| [`frontend-performance-and-loading`](./frontend-performance-and-loading/SKILL.md) | Route splitting, Suspense, bundle size, LCP |
| [`joyjoin-brand-guidelines`](./joyjoin-brand-guidelines/SKILL.md) | Brand identity, color, typography, motion |
| [`mini-program-frontend-excellence`](./mini-program-frontend-excellence/SKILL.md) | Taro-native premium UI, pixel precision, 8rpx rhythm |
| [`mini-program-screenshot-workflow`](./mini-program-screenshot-workflow/SKILL.md) | Screenshot capture and visual verification |
| [`viewport-zero-scroll`](./viewport-zero-scroll/SKILL.md) | Zero-scroll viewport policy, 100dvh, ResponsiveSpacer |
| [`wow-elements`](./wow-elements/SKILL.md) | Micro-interactions and emotional polish |

### Product & Domain

| Skill | Description |
|-------|-------------|
| [`analytics-tracking`](./analytics-tracking/SKILL.md) | Event tracking, funnels, KPIs, registration dropoff |
| [`content-safety-abuse-detection`](./content-safety-abuse-detection/SKILL.md) | Abuse detection, filtering, bans, moderation |
| [`feature-flags-launch-config`](./feature-flags-launch-config/SKILL.md) | Feature gates, kill switches, rollout config |
| [`onboarding-state-architecture`](./onboarding-state-architecture/SKILL.md) | Server-driven `nextStep`, checkpoint recovery |
| [`personality-system`](./personality-system/SKILL.md) | 12-archetype engine, ACOEXP, MatcherV2 |
| [`platform-coordination-protocol`](./platform-coordination-protocol/SKILL.md) | Mini-program vs web parity, sibling review |
| [`social-icebreaker-domain`](./social-icebreaker-domain/SKILL.md) | Session lifecycle, phases, host/player authority |

### Agent Orchestration & Process

| Skill | Description |
|-------|-------------|
| [`agent-coordination-patterns`](./agent-coordination-patterns/SKILL.md) | Multi-agent pipelines, swarms, dependency graphs |
| [`docs-sync`](./docs-sync/SKILL.md) | Knowledge-base editor: memory, AGENTS.md, docs |
| [`draft-prd`](./draft-prd/SKILL.md) | Product requirements, acceptance criteria, scope |
| [`omo-orchestration-bridge`](./omo-orchestration-bridge/SKILL.md) | Bridge OMO discipline-agent workflows into Kimi Code CLI — ultrawork, boulder management, Prometheus→Atlas→Sisyphus→Oracle |
| [`first-principles-velocity`](./first-principles-velocity/SKILL.md) | Critical-path execution, bottleneck removal |
| [`multi-agent-deliberation`](./multi-agent-deliberation/SKILL.md) | 5-phase architecture deliberation protocol |
| [`orchestration-turn-reporting`](./orchestration-turn-reporting/SKILL.md) | Turn-end summaries, iterative improvement |
| [`pm-sin-mapper`](./pm-sin-mapper/SKILL.md) | Product audit via Seven Deadly Sins heuristic |
| [`subagent-context-delegation`](./subagent-context-delegation/SKILL.md) | Packaging context for subagent efficiency |
| [`task-creator`](./task-creator/SKILL.md) | Task structuring, lane routing, mission briefs |

### Quality & Testing

| Skill | Description |
|-------|-------------|
| [`code-review`](./code-review/SKILL.md) | Harness Framework PR review (5 pillars) |
| [`e2e-test-runner`](./e2e-test-runner/SKILL.md) | End-to-end journey verification, smoke tests |
| [`harness-completion-gate`](./harness-completion-gate/SKILL.md) | Mandatory 5-pillar quality gate before sign-off |
| [`performance-benchmark`](./performance-benchmark/SKILL.md) | Baseline measurement, before/after comparison |
| [`testing-and-regression-guardrails`](./testing-and-regression-guardrails/SKILL.md) | Boundary tests, invariant tests, CI scripts |

---

## Skill Quality Standards

All skills must comply with [`skill-authoring-governance`](./skill-authoring-governance/SKILL.md):

- `SKILL.md` ≤ 100 lines (detailed material in `references/`)
- YAML frontmatter with `name` (kebab-case), `description` (< 1024 chars, includes triggers)
- Sections: `## When to use this skill`, `## Troubleshooting`, `## Review checklist`, `## Quick examples`
- `routing.yml` with `category: ai-runtime | internal`
- No `README.md` inside skill folders
