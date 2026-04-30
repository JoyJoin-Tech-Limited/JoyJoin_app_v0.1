# JoyJoin Skill Taxonomy

> Classification of all `.agents/skills/` into **ai-runtime** (skills that orchestrate or configure AI services invoked at runtime in the product flow) and **internal** (developer tooling, design guidance, infrastructure, process).

---

## Why this matters

Loading the wrong skill set wastes tokens and produces lower-quality output:
- Loading `frontend-design-audit` during an AI icebreaker run-plan compilation adds no value
- Loading `game-design-icebreaker-compilation` during a CI guardrail fix adds no value

Taxonomy-aware orchestration can pre-filter skills by whether the task involves **runtime AI services**.

---

## Categories

### `ai-runtime` — 9 skills

Primary purpose is to **configure, orchestrate, or document AI-powered runtime features** that generate content or experiences for users during the live product flow.

| Skill | AI service / runtime role |
|-------|--------------------------|
| `game-design-icebreaker-compilation` | Compiles AI-generated icebreaker run plans (`social-icebreaker-run-plan-v1`) |
| `icebreaker-auction-phase` | Generates auction lots via AI (`social-auction-lots-v1`) |
| `lie-detective-icebreaker` | Generates lie detective statements via AI (`social-lie-detective-v1`) |
| `llm-runtime-safety-and-integration` | Manages LLM provider routing, prompt versioning, fallback, shadow mode |
| `lovart-design-workflow` | Generates brand illustrations and mascot assets via Lovart AI |
| `miniscript-story-framework` | Generates mini-script stories via AI (`social-miniscript-v1`) |
| `personality-dice-icebreaker` | Generates personality dice challenges via AI (`social-personality-dice-v1`) |
| `semantic-matching-embeddings` | Generates neural embeddings via DeepSeek for matching similarity |
| `stitch-design-workflow` | Generates UI mockups and screen explorations via Stitch AI |

**Key distinction:** These skills are invoked *because* the product flow needs AI-generated content. They are not generic developer guidance — they are the bridge between the product feature and the AI service.

---

### `internal` — 53 skills

Primary work product is consumed by **developers**, **AI agents**, **CI systems**, or **designers**. This includes skills that guide building user-facing features but do **not** themselves invoke AI services at runtime.

**Examples of what is NOT `ai-runtime`:**
- `frontend-design-audit` — audits UI quality; does not call an AI service
- `mini-program-frontend-excellence` — guides Taro implementation; does not call an AI service
- `onboarding-state-architecture` — documents server-driven onboarding; no AI generation
- `matching-domain` — documents deterministic scoring; the skill itself is not the AI call
- `social-icebreaker-domain` — documents session lifecycle; AI phases are hosted *within* it but the skill is domain documentation
- `payment-entitlement-authority` — payment logic; no AI generation
- `viewport-zero-scroll` — layout policy guidance; no AI generation

**Internal sub-groups (for human reference only, not enforced in routing):**

| Sub-group | Skills |
|-----------|--------|
| **Code & review** | `code-review`, `skill-authoring-governance`, `security-scan`, `backend-models-standards` |
| **Frontend guidance** | `frontend-component-architecture`, `frontend-performance-and-loading`, `frontend-design-audit`, `mini-program-frontend-excellence`, `viewport-zero-scroll`, `wow-elements`, `design-system-governance`, `joyjoin-brand-guidelines` |
| **Backend / infra** | `server-domain-architecture`, `database-query-optimization`, `database-migration-safety`, `caching-strategy`, `reliability-and-state-integrity`, `platform-observability-and-ops`, `error-handling-patterns`, `auth-session-and-safety-boundaries`, `websocket-realtime`, `monorepo-workspace-governance` |
| **Testing & QA** | `e2e-test-runner`, `testing-and-regression-guardrails`, `performance-benchmark`, `harness-completion-gate` |
| **Docs & process** | `docs-sync`, `draft-prd`, `first-principles-velocity`, `task-creator`, `pm-sin-mapper`, `agent-coordination-patterns`, `multi-agent-deliberation`, `subagent-context-delegation`, `orchestration-turn-reporting` |
| **Product domain** | `onboarding-state-architecture`, `matching-domain`, `event-pool-and-matching-operations`, `payment-entitlement-authority`, `notification-system`, `venue-location-services`, `platform-coordination-protocol`, `wechat-ecosystem-integration`, `content-safety-abuse-detection`, `analytics-tracking`, `feature-flags-launch-config`, `admin-client-frontend`, `admin-audit-and-rbac-governance` |

---

## Usage in routing

Every `routing.yml` should include:

```yaml
category: ai-runtime   # or internal
```

Orchestration can then filter skills by category before loading them into the system prompt.

---

## Edge cases and rationale

**Why is `social-icebreaker-domain` internal, not ai-runtime?**
The skill documents the session lifecycle, phase system, REST routes, and host/player authority. While AI-powered phases exist *within* social icebreaker (auction, lie detective, etc.), those phases have their own dedicated `ai-runtime` skills. The domain skill itself is reference documentation, not an AI orchestration layer.

**Why is `matching-domain` internal?**
The matching algorithm is deterministic (6D/7D scoring). The skill documents weights, signals, and guardrails. AI may enrich match *explanations*, but the skill itself does not orchestrate the AI call — that belongs to `llm-runtime-safety-and-integration`.

**Why is `frontend-design-audit` internal?**
It provides a scoring rubric and anti-pattern checklist for developers reviewing UI. It does not invoke any AI service at runtime.
