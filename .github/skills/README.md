# JoyJoin Skills

`.github/skills/` contains reusable engineering and product-domain skills for contributors and AI assistants. **Cursor and GitHub Copilot share this directory** as the single skill tree—do not duplicate skills under `.cursor/`; see `.github/AI_TOOLING_UNIFIED_BRAIN.md`. **Cursor only:** the Superpowers plugin adds separate **process** skills; see `.github/SUPERPOWERS_JOYOIN_INTEGRATION.md` for how they fit with these repo skills.

Each skill is a focused, actionable reference — not a comprehensive handbook. Skills document the project's active architecture, conventions, and boundaries so that contributors and AI coding assistants can make correct decisions without having to reverse-engineer intent from the codebase.

**Taxonomy:** All skills are classified as `ai-runtime` (orchestrate AI services invoked at runtime) or `internal` (developer tooling, design guidance, infrastructure, process). See [`skill-taxonomy.md`](./skill-taxonomy.md) for the full classification, edge-case rationale, and usage in routing.

**Roadmap:** Prioritized skill-system follow-ups (briefing rollout, model catalog dedupe, tests) live in [`ITERATION_ROADMAP.md`](./ITERATION_ROADMAP.md).

## How to use these skills

**Contributors:** Read the relevant skill before working in a new area of the codebase. Skills tell you where code belongs, what invariants must be respected, and what common mistakes to avoid.

**GitHub Copilot:** Skills are loaded as context when the skill is activated. Invoke a skill when your task falls into one of its stated "When to use this skill" categories.

---

## Foundation and Architecture

Core structure, ownership, and placement rules. Start here if you are new to the repo or working across multiple areas.

| Skill | What it covers |
|-------|---------------|
| [`frontend-component-architecture`](./frontend-component-architecture/SKILL.md) | Shared UI primitives in `packages/shared/src/ui/`, thin app wrappers, semantic correctness, composition patterns |
| [`design-system-governance`](./design-system-governance/SKILL.md) | CSS tokens, CVA variants, accessibility expectations, documented visual exceptions, migration discipline |
| [`frontend-performance-and-loading`](./frontend-performance-and-loading/SKILL.md) | Route splitting, Suspense, asset loading, long-list heuristics, and platform-appropriate loading strategy |
| [`onboarding-state-architecture`](./onboarding-state-architecture/SKILL.md) | Server-driven `nextStep`, active onboarding module ownership, routing authority, legacy quarantine |
| [`server-domain-architecture`](./server-domain-architecture/SKILL.md) | `routes.ts` as composition root, `routes/domains/*` ownership, `repositories/*` for new persistence, `storage.ts` as compatibility facade |
| [`monorepo-workspace-governance`](./monorepo-workspace-governance/SKILL.md) | Root orchestration-only principle, workspace dependency ownership, tsconfig/script normalization, env/secret/legacy guardrails |
| [`api-contract-versioning`](./api-contract-versioning/SKILL.md) | Zod schemas, shared DTOs in `packages/shared/src/api.ts`, cross-platform type consumption, and the `/api/v1/*` versioning rewrite |
| [`platform-coordination-protocol`](./platform-coordination-protocol/SKILL.md) | PRIMARY/SECONDARY/SHARED ownership, sibling-platform review, shared API contract boundaries, impact-check workflow |
| [`admin-client-frontend`](./admin-client-frontend/SKILL.md) | Admin portal UI in `apps/admin-client` — Recharts dashboards, shadcn/ui tables/forms, RBAC gating, pool admin, auth patterns |
| [`viewport-zero-scroll`](./viewport-zero-scroll/SKILL.md) | Zero-scroll viewport policy (`100dvh`), no-scroll containers, `ResponsiveSpacer`, `ScrollSentinel`, `FormStepper` density caps |
| [`caching-strategy`](./caching-strategy/SKILL.md) | Backend selection, TTL design, key naming, invalidation contracts, rate limiting, horizontal-scaling guardrails |
| [`lane-selection-governance`](./lane-selection-governance/SKILL.md) | Deterministic 4-gate heuristic for choosing the correct delivery lane (HRC / DM / Kickoff / Direct) before implementation begins |
| [`process-brainstorming`](./process-brainstorming/SKILL.md) | Divergent-thinking discipline: constraint-first ideation, 3-option evaluation, lane mapping before convergence |
| [`process-systematic-debugging`](./process-systematic-debugging/SKILL.md) | Structured root-cause analysis: reproduce → isolate → hypothesize → verify |
| [`process-verification-gate`](./process-verification-gate/SKILL.md) | Pre-ship Harness 5-pillar checklist (reliability, scalability, security, observability, maintainability) |
| [`process-test-first`](./process-test-first/SKILL.md) | Red-green-refactor discipline for deterministic logic, bug fixes, and stateful workflows |
| [`websocket-realtime`](./websocket-realtime/SKILL.md) | WebSocket connection lifecycle, auth, room broadcasting, heartbeat/reconnect, rate limiting, HTTP polling boundaries |
---

## Review and Quality

Start here when reviewing a pull request or auditing code changes.

| Skill | What it covers |
|-------|---------------|
| [`code-review`](./code-review/SKILL.md) | Structured PR review using the Harness Engineering Framework — correctness, reliability, scalability, security, observability, and architecture fit. **Start here for all PR reviews.** Load domain-specific skills below for deeper review in affected areas. |
| [`ui-layout-audit`](./ui-layout-audit/SKILL.md) | Pixel-level UI/UX audit: spacing hierarchy, typography comfort, emoji discipline, visual coherence (孤字 guard), and emotional craft. Use before shipping UI-heavy PRs or when a screen feels cheap / crowded / unbalanced. |
| [`completeness-audit`](./completeness-audit/SKILL.md) | 11-dimension 完成度 audit (0–44) for mini-program implementations: functional, state, copy, interaction, delight, flow, accessibility, Taro discipline, visual finish, brand soul, and operational completeness. Produces ROI-ranked gap register via 2-axis scatter (User Impact × Engineering Hours). Pipeline Mode auto-sequences `ui-layout-audit → frontend-design-audit → completeness-audit`. |

---

## Safety, Correctness, and Operations

Patterns for making the system reliable, secure, and observable.

| Skill | What it covers |
|-------|---------------|
| [`auth-session-and-safety-boundaries`](./auth-session-and-safety-boundaries/SKILL.md) | Policy-based auth gating, typed session contracts, dev/debug isolation, fail-closed defaults, webhook validation |
| [`llm-runtime-safety-and-integration`](./llm-runtime-safety-and-integration/SKILL.md) | Safe runtime AI integration, provider routing, prompt metadata, fallback behavior, trace logging, deterministic-boundary protection |
| [`admin-audit-and-rbac-governance`](./admin-audit-and-rbac-governance/SKILL.md) | Admin role hierarchy, endpoint permission mapping, audit-log obligations, and safe handling of sensitive admin writes |
| [`reliability-and-state-integrity`](./reliability-and-state-integrity/SKILL.md) | Transactions, idempotency, execution guards, recovery/re-entry semantics, expiry handling, critical writes vs side effects |
| [`payment-entitlement-authority`](./payment-entitlement-authority/SKILL.md) | Payment creation, verification, entitlement gating, refunds, event-pack credits, and cross-platform payment coordination |
| [`database-migration-safety`](./database-migration-safety/SKILL.md) | Safe schema evolution, idempotent migration scripts, pre/post verification, rollout sequencing, and rollback thinking |
| [`database-query-optimization`](./database-query-optimization/SKILL.md) | Drizzle query patterns, index strategy, N+1 avoidance, batch loading, and query-plan review for PostgreSQL |
| [`error-handling-patterns`](./error-handling-patterns/SKILL.md) | Consistent API error shapes, Zod validation formatting, client-safe responses, transport errors, and retry patterns across server, web, and mini-program |
| [`testing-and-regression-guardrails`](./testing-and-regression-guardrails/SKILL.md) | Regression tests, invariant tests, structural tests, CI guardrail scripts, test placement by workspace |
| [`platform-observability-and-ops`](./platform-observability-and-ops/SKILL.md) | Structured logging, request IDs, Prometheus metrics, health/readiness, alerts, synthetic monitoring, audit logging |
| [`analytics-tracking`](./analytics-tracking/SKILL.md) | Product analytics events, KPI dashboards (CSAT/NPS/engagement/churn), registration funnel analysis, trigger performance, matching benchmarks |
| [`security-scan`](./security-scan/SKILL.md) | Security scan and posture review for auth/debug surfaces, secret handling, dependency risk, CI guardrails, and production overrides |
| [`content-safety-abuse-detection`](./content-safety-abuse-detection/SKILL.md) | Abuse detection, content filtering, user moderation, trust-and-safety mechanics, rate limiting, and admin moderation surfaces |
| [`feature-flags-launch-config`](./feature-flags-launch-config/SKILL.md) | Feature flags, launch configuration, env-gated behavior, kill switches, safe rollout/rollback discipline, and startup validation |
| [`notification-system`](./notification-system/SKILL.md) | In-app notification persistence, WebSocket broadcast fallback, admin broadcast/send, per-user unread counts, and mark-read semantics |

---

## Product Domains

Deep expertise for the two core product engines.

| Skill | What it covers |
|-------|---------------|
| [`event-pool-and-matching-operations`](./event-pool-and-matching-operations/SKILL.md) | Event-pool lifecycle, pool stats semantics, match-run operations, and post-match group outcome handling |
| [`matching-domain`](./matching-domain/SKILL.md) | Deterministic pair scoring, 6-dimension weights, signal boundary invariant, execution safety, AI explanation separation |
| [`personality-system`](./personality-system/SKILL.md) | 12-archetype engine, ACOEXP 6-trait model, V4 adaptive assessment, MatcherV2 assignment, archetype chemistry |
| [`social-icebreaker-domain`](./social-icebreaker-domain/SKILL.md) | Session lifecycle, host/player authority, persistence/rejoin, roster vs presence, action integrity, secrecy boundaries, AI content |
| [`miniscript-story-framework`](./miniscript-story-framework/SKILL.md) | MiniScript `MiniScriptStoryFramework` schema, LLM vs stub orchestration, host authority (`style` / `genres` / `playerCount`), idempotent generate route |
| [`lie-detective-icebreaker`](./lie-detective-icebreaker/SKILL.md) | `lie_detective` secrecy (`isLie`), votes/reveals, routes, `social-lie-detective-v1` |
| [`personality-dice-icebreaker`](./personality-dice-icebreaker/SKILL.md) | `personality_dice` roster-sized challenges, routes, `social-personality-dice-v1`, tone/safety |
| [`icebreaker-auction-phase`](./icebreaker-auction-phase/SKILL.md) | `auction` virtual-coin flow, optional `generateAuctionLots` (`social-auction-lots-v1`), bid/close-lot routes, advance guard |
| [`venue-location-services`](./venue-location-services/SKILL.md) | Venue catalog, assignment, matching, time slots, deals, AMap geocoding, and data quality |
| [`wechat-ecosystem-integration`](./wechat-ecosystem-integration/SKILL.md) | WeChat auth (Mini Program / OA OAuth), WeChat Pay v3, Taro patterns, JSAPI/H5 payments, webhooks, and cross-platform WeChat coordination |
| [`semantic-matching-embeddings`](./semantic-matching-embeddings/SKILL.md) | Semantic similarity 7th scoring dimension, feature-hash vectors, DeepSeek embedding client, async semantic profile pipeline, and dialogue insight storage |
| [`xiaoyue-writing-craft`](./xiaoyue-writing-craft/SKILL.md) | Canonical Chinese writing craft system — 8 verifiable axioms (rhythm, imagery, concreteness, anti-AI aesthetics), deterministic post-generation scoring (0-100), retry loop integration for all Xiaoyue LLM output |

---

## Product Planning

Planning artifacts and scoping help before implementation begins.

| Skill | What it covers |
|-------|---------------|
| [`draft-prd`](./draft-prd/SKILL.md) | Product requirements drafts, user stories, scope boundaries, measurable success metrics, and proposal framing |
| [`pm-sin-mapper`](./pm-sin-mapper/SKILL.md) | Structured Seven Deadly Sins product diagnosis for feature ideas, funnels, activation gaps, and PM-ready recommendations with Brainstorm / Execute / Debug outputs |

---

## UX Polish and Delight

Guidance for adding crafted, brand-aligned micro-interactions and premium emotional moments.

| Skill | What it covers |
|-------|---------------|
| [`mini-program-frontend-excellence`](./mini-program-frontend-excellence/SKILL.md) | Premium, brand-governed Taro UI workflow for `apps/mini-program` — native-quality execution, full state design, WeChat-safe polish; **pixel precision** (spec-exact or 8rpx rhythm, DevTools gate) in [`references/pixel-precision.md`](./mini-program-frontend-excellence/references/pixel-precision.md); structural Taro rules in [`references/taro-ui-framework.md`](./mini-program-frontend-excellence/references/taro-ui-framework.md) |
| [`frontend-design-audit`](./frontend-design-audit/SKILL.md) | Systematic design-quality audits on mini-program and web surfaces — scores 5 dimensions, detects AI slop / generic patterns, produces actionable fix lists |
| [`frontend-hook-engine`](./frontend-hook-engine/SKILL.md) | Screen-level Seven Deadly Sins UI diagnosis for CTA hierarchy, state design, interaction clarity, and build-ready component/state plans |
| [`wow-elements`](./wow-elements/SKILL.md) | Crafted micro-interactions, completion moments, empty/loading state polish, motion principles, accessibility guardrails, review checklist |
| [`lovart-design-workflow`](./lovart-design-workflow/SKILL.md) | Lovart AI Design Agent prompt generation, brand-aligned visual asset briefs, and design-to-code handoff for illustrations, mockups, marketing graphics, and icons |

---

## Documentation

Keep docs aligned with the active codebase. Use after significant code changes or when docs are visibly stale.

**Large refresh across `docs/`, `.github/skills/`, and `.github/agents/`:** Use scope tiers, pick the right lane (kickoff vs `docs-sync` vs governance), and run `npm run orchestration:validate` when orchestration or skill routing changes—see [`docs/ai-workflow-documentation-refresh.md`](../../docs/ai-workflow-documentation-refresh.md). **Workflow Governance Reviewer** (`self-iteration.agent.md`) is for governance reviewer packets, not a substitute for [`docs-sync`](./docs-sync/SKILL.md).

| Skill | What it covers |
|-------|---------------|
| [`docs-sync`](./docs-sync/SKILL.md) | Scan code changes, map them to documentation targets, draft minimal updates, and enforce active-flow-only guardrails. Use when docs need syncing after a PR merges or an architecture decision is made. |

---

## Workflow Orchestration

Skills for structured agent delivery loops, turn-end summaries, and bounded workflow-state reporting.

| Skill | What it covers |
|-------|---------------|
| [`orchestration-turn-reporting`](./orchestration-turn-reporting/SKILL.md) | Per-agent turn-summary JSON, supervisor consolidation, last-5-turn feedback loops, and operational persistence under `.git/.orchestration/` |
| [`first-principles-velocity`](./first-principles-velocity/SKILL.md) | Mission → inversion → critical path → model-tier fit ([`MODEL_CATALOG.md`](../agents/MODEL_CATALOG.md)); **five themes:** constraints first, slice ownership, smallest proof, deletion/quarantine, blocked with evidence. Cross-lane policy: [`AI_WORKFLOW_POLICY.md`](../AI_WORKFLOW_POLICY.md) (core policy point 9); orchestration context: [`ORCHESTRATION.md`](../ORCHESTRATION.md) *Execution discipline*. Pairs with [`orchestration-turn-reporting`](./orchestration-turn-reporting/SKILL.md). |
| [`subagent-context-delegation`](./subagent-context-delegation/SKILL.md) | Context capsules, parallel explore swarms, subagent resume/reuse, and parent-session hygiene for effective Kimi Code Agent delegation |
| [`agent-coordination-patterns`](./agent-coordination-patterns/SKILL.md) | Sequential pipelines, parallel swarms, dependency graphs, fan-out/fan-in, convergence strategies, conflict resolution, and workload partitioning for multi-agent workflows |
| [`omo-orchestration-bridge`](../../.agents/skills/omo-orchestration-bridge/SKILL.md) | Bridge Oh My OpenAgent (OMO) discipline-agent workflows into Kimi Code CLI. Maps `ultrawork`, `/start-work`, and boulder state to Kimi-native `Agent` tool orchestration using existing `.github/agents/` definitions |

---

## Delivery Validation

Skills for flow-level verification and concrete performance measurement.

| Skill | What it covers |
|-------|---------------|
| [`e2e-test-runner`](./e2e-test-runner/SKILL.md) | End-to-end journeys, smoke tests, synthetic probes, and flow-level verification gaps |
| [`performance-benchmark`](./performance-benchmark/SKILL.md) | Before/after measurement for route metrics, bundle behavior, script throughput, and repeatable performance baselines |

---

## Review and Quality

Skills for writing, reviewing, auditing, and maintaining skills and code quality.

| Skill | What it covers |
|-------|---------------|
| [`skill-authoring-governance`](./skill-authoring-governance/SKILL.md) | Governing standard for creating, updating, auditing, and improving repo skills — use this when writing a new skill, updating an existing one, or auditing the skills system |
| [`multi-agent-deliberation`](./multi-agent-deliberation/SKILL.md) | Structured 5-phase deliberation protocol: delegate roles, anonymous peer review, roundtable debate, ACK-ALL consensus with veto powers |

---

## Existing Specialized Skills

| Skill | What it covers |
|-------|---------------|
| [`backend-models-standards`](./backend-models-standards/SKILL.md) | Drizzle/ORM model naming, data types, constraints, relationships, validation layers, index strategy |
| [`joyjoin-brand-guidelines`](./joyjoin-brand-guidelines/SKILL.md) | Brand essence, colour system, typography, mascots, UI tone, motion guidance |
| [`cto-mentor`](./cto-mentor/SKILL.md) | After-task mentor mode — 4-section breakdown (what we built, key ideas with metaphors, trade-offs, learning paths). Use `/mentor` or "teach me". |

---

## Quick reference

| Question | Skill |
|----------|-------|
| How do I write or audit a skill? | `skill-authoring-governance` |
| Where does this component go? | `frontend-component-architecture` |
| How do I add a new button variant? | `design-system-governance` |
| How do I keep a new screen fast to load? | `frontend-performance-and-loading` |
| What controls the onboarding step a user sees? | `onboarding-state-architecture` |
| Where does a new API route go? | `server-domain-architecture` |
| How do I add a dependency to the monorepo? | `monorepo-workspace-governance` |
| How do I define or change a shared API contract? | `api-contract-versioning` |
| How do I know whether I need to update the sibling platform too? | `platform-coordination-protocol` |
| How do I build or update the admin portal UI? | `admin-client-frontend` |
| How do I gate a route for admin-only access? | `auth-session-and-safety-boundaries` |
| How do I add an LLM call safely at runtime? | `llm-runtime-safety-and-integration` |
| How do I wire RBAC and audit logging for an admin refund, ban, or override? | `admin-audit-and-rbac-governance` |
| How do I make a multi-step operation atomic? | `reliability-and-state-integrity` |
| Who owns payment creation, verification, refunds, or shared payment contracts? | `payment-entitlement-authority` |
| How do I plan a safe migration or column rename? | `database-migration-safety` |
| How do I optimize a slow database query? | `database-query-optimization` |
| How do I handle API errors consistently? | `error-handling-patterns` |
| How do I lock in an architectural boundary with a test? | `testing-and-regression-guardrails` |
| How do I add structured logging to a new route? | `platform-observability-and-ops` |
| How do I add product analytics or track a funnel? | `analytics-tracking` |
| How do I audit this change for security risk or missing scan coverage? | `security-scan` |
| How do I detect abuse or filter content? | `content-safety-abuse-detection` |
| How do I safely roll out a feature behind a flag? | `feature-flags-launch-config` |
| How do I send or debug notifications? | `notification-system` |
| How do I create an event pool or interpret `estimatedGroups` correctly? | `event-pool-and-matching-operations` |
| Can I add `user_interest_signals` to the matching score? | `matching-domain` (no — see signal boundary) |
| How does the personality assessment or archetype assignment work? | `personality-system` |
| How do I add or change an assessment question? | `personality-system` |
| Can a player advance the icebreaker phase? | `social-icebreaker-domain` (no — host only) |
| How do I draft a PRD or feature brief? | `draft-prd` |
| How do I run a product sin-mapping review on a funnel or feature idea? | `pm-sin-mapper` |
| How do I audit a screen for CTA hierarchy, states, or UI conversion risk? | `frontend-hook-engine` |
| How do I run a smoke test or end-to-end journey check? | `e2e-test-runner` |
| How do I benchmark before and after a performance change? | `performance-benchmark` |
| How do I add turn-end summaries or a supervisor consolidation loop? | `orchestration-turn-reporting` |
| How do I pick model tier vs task depth or run critical-path prioritization? | `first-principles-velocity` + `MODEL_CATALOG.md` |
| How do I delegate work to subagents without losing context? | `subagent-context-delegation` |
| How do I keep my parent session from bloating? | `subagent-context-delegation` |
| How do I coordinate multiple agents on one task? | `agent-coordination-patterns` |
| How do I merge outputs from parallel agents? | `agent-coordination-patterns` |
| How do I resolve conflicting agent outputs? | `agent-coordination-patterns` |
| How do I decide parallel vs sequential agents? | `agent-coordination-patterns` |
| How do I run OMO workflows (ultrawork, boulder, Prometheus) in Kimi? | `omo-orchestration-bridge` |
| How do I define a new database model? | `backend-models-standards` |
| What colours can I use for a new UI element? | `joyjoin-brand-guidelines` + `design-system-governance` |
| How do I keep a mini-program screen premium, on-brand, and Taro-native? | `mini-program-frontend-excellence` |
| How do I audit a screen for pixel-level layout and spacing? | `ui-layout-audit` |
| How do I run a complete design-quality audit on a frontend surface? | `frontend-design-audit` |
| How do I run a 完成度 audit with ROI-ranked gap recommendations? | `completeness-audit` (pipeline: `ui-layout-audit → frontend-design-audit → completeness-audit`) |
| How do I enforce zero-scroll viewport lock or `100dvh` shell? | `viewport-zero-scroll` |
| How do I add caching or rate limiting? | `caching-strategy` |
| How do I add or debug WebSocket real-time notifications? | `websocket-realtime` |
| Why isn't the client receiving real-time match updates? | `websocket-realtime` |
| How do I keep docs in sync after a code change? | `docs-sync` |
| How do I assign venues or handle location/geocoding? | `venue-location-services` |
| How do I work with WeChat auth, Taro, or Mini Program APIs? | `wechat-ecosystem-integration` |
| How does semantic similarity matching work? | `semantic-matching-embeddings` |
| How do I plan a cross-cutting refresh of product docs, skills, and agents? | [`docs/ai-workflow-documentation-refresh.md`](../../docs/ai-workflow-documentation-refresh.md) + `docs-sync` where applicable |
| How do I run a structured multi-agent review or architecture consensus? | `multi-agent-deliberation` |
| How do I get a mentor-style breakdown of what we just built? | `cto-mentor` |

---

## Skill authoring conventions

- frontmatter `name` must match the folder name exactly in kebab-case
- `description` should explain what the skill does and when to use it; include a few trigger phrases
- keep `description` under 1024 characters
- keep `SKILL.md` concise and operational — place deeper examples in `references/` when needed
- every skill should include `## Quick examples`, `## Troubleshooting`, and `## Review checklist`

---

## Skill routing

All active skills under `.github/skills/` participate in the lightweight skill routing system. The router selects the right skill for an ask using signals declared in each skill's `routing.yml`.

**Coverage requirement:** every new skill directory must include a `routing.yml` (or, rarely, a `routing-exempt.yml` with a written reason). The validator enforces this — a missing routing file causes `validate-skill-routing.mjs` to fail.

### Adding routing metadata for a new skill

1. Create `.github/skills/<skill-name>/routing.yml` following the schema in `routing-schema.yml`
2. Add `strong_triggers` with repo-specific terms (symbols, file paths, route patterns, canonical phrases)
3. Fill `use_when` / `do_not_use_when` to sharpen routing boundaries
4. List `related_skills` for natural handoff points
5. Run `node scripts/validate-skill-routing.mjs` — all skills should show ✅
6. Add test cases to `scripts/test-skill-routing.mjs` for the new skill's key asks
7. Run `node scripts/test-skill-routing.mjs` to confirm all tests pass

See `docs/architecture/skill-routing.md` for full documentation, scoring model, and worked examples.

### Special routing notes

- **`code-review`** is the mandatory entry point for all PR reviews. Start here, then load domain-specific skills for the affected areas. The router selects it for asks like "review this PR", "audit this pull request", or "evaluate against the Harness framework".
- **`skill-authoring-governance`** routes any ask about creating, updating, or auditing skills — including routing metadata maintenance. Use it when writing a new skill or updating a `SKILL.md`.
- **`docs-sync`** routes post-change documentation hygiene — use when docs are stale after a merge.

## Routing metadata

Each core skill directory contains a `routing.yml` file alongside `SKILL.md`. This is the skill's **routing contract** — `scripts/skill-router.mjs` reads the current `routing.yml` files at runtime to decide when and why to load a skill.

### Minimal required fields

```yaml
skill: <kebab-case-name-matching-directory>
primary_ownership: > one-sentence summary of what this skill owns
use_when:
  - scenario or phrase that indicates this skill applies
strong_triggers:
  - TypeScript symbol, route path, or repo-specific keyword
```

### Full schema

See `.github/skills/routing-schema.yml` for the complete documented schema including `do_not_use_when`, `owned_files`, `owned_paths`, `owned_symbols`, and `related_skills`.

### Tooling

```bash
# Validate all routing.yml files (required fields, path freshness, legacy refs as blocking errors)
node scripts/validate-skill-routing.mjs

# Route an ask interactively
node scripts/skill-router.mjs "add a nextStep rule after profile review"

# Run the full routing regression suite
node scripts/test-skill-routing.mjs
```

The production pipeline also runs both routing commands from `.github/workflows/cicd.yml`, so stale routing metadata is now blocked in CI as well as during local validation.

### Maintenance rules

- **When you add a trigger phrase** to `SKILL.md`, also add it to `strong_triggers` in `routing.yml`.
- **When a file is moved**, update `owned_files` and run `validate-skill-routing.mjs` to catch stale paths.
- **When a new handoff pattern emerges**, add it to `related_skills` in both skills involved.
- **Never add legacy terms** as triggers — routing metadata must follow the same active-flow-only canon as all other repo content.

See [`docs/architecture/skill-routing.md`](../../docs/architecture/skill-routing.md) for the full routing design, scoring model, observability format, and extension guidance.
