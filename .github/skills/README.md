# JoyJoin Skills

`.github/skills/` contains reusable engineering and product-domain skills for contributors and GitHub Copilot.

Each skill is a focused, actionable reference — not a comprehensive handbook. Skills document the project's active architecture, conventions, and boundaries so that contributors and AI coding assistants can make correct decisions without having to reverse-engineer intent from the codebase.

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
| [`onboarding-state-architecture`](./onboarding-state-architecture/SKILL.md) | Server-driven `nextStep`, active onboarding module ownership, routing authority, legacy quarantine |
| [`server-domain-architecture`](./server-domain-architecture/SKILL.md) | `routes.ts` as composition root, `routes/domains/*` ownership, `repositories/*` for new persistence, `storage.ts` as compatibility facade |
| [`monorepo-workspace-governance`](./monorepo-workspace-governance/SKILL.md) | Root orchestration-only principle, workspace dependency ownership, tsconfig/script normalization, env/secret/legacy guardrails |

---

## Safety, Correctness, and Operations

Patterns for making the system reliable, secure, and observable.

| Skill | What it covers |
|-------|---------------|
| [`auth-session-and-safety-boundaries`](./auth-session-and-safety-boundaries/SKILL.md) | Policy-based auth gating, typed session contracts, dev/debug isolation, fail-closed defaults, webhook validation |
| [`reliability-and-state-integrity`](./reliability-and-state-integrity/SKILL.md) | Transactions, idempotency, execution guards, recovery/re-entry semantics, expiry handling, critical writes vs side effects |
| [`testing-and-regression-guardrails`](./testing-and-regression-guardrails/SKILL.md) | Regression tests, invariant tests, structural tests, CI guardrail scripts, test placement by workspace |
| [`platform-observability-and-ops`](./platform-observability-and-ops/SKILL.md) | Structured logging, request IDs, Prometheus metrics, health/readiness, alerts, synthetic monitoring, audit logging |

---

## Product Domains

Deep expertise for the two core product engines.

| Skill | What it covers |
|-------|---------------|
| [`matching-domain`](./matching-domain/SKILL.md) | Deterministic pair scoring, 6-dimension weights, signal boundary invariant, execution safety, AI explanation separation |
| [`social-icebreaker-domain`](./social-icebreaker-domain/SKILL.md) | Session lifecycle, host/player authority, persistence/rejoin, roster vs presence, action integrity, secrecy boundaries, AI content |

---

## Existing Specialized Skills

| Skill | What it covers |
|-------|---------------|
| [`backend-models-standards`](./backend-models-standards/SKILL.md) | Drizzle/ORM model naming, data types, constraints, relationships, validation layers, index strategy |
| [`joyjoin-brand-guidelines`](./joyjoin-brand-guidelines/SKILL.md) | Brand essence, colour system, typography, mascots, UI tone, motion guidance |

---

## Quick reference

| Question | Skill |
|----------|-------|
| Where does this component go? | `frontend-component-architecture` |
| How do I add a new button variant? | `design-system-governance` |
| What controls the onboarding step a user sees? | `onboarding-state-architecture` |
| Where does a new API route go? | `server-domain-architecture` |
| How do I add a dependency to the monorepo? | `monorepo-workspace-governance` |
| How do I gate a route for admin-only access? | `auth-session-and-safety-boundaries` |
| How do I make a multi-step operation atomic? | `reliability-and-state-integrity` |
| How do I lock in an architectural boundary with a test? | `testing-and-regression-guardrails` |
| How do I add structured logging to a new route? | `platform-observability-and-ops` |
| Can I add `user_interest_signals` to the matching score? | `matching-domain` (no — see signal boundary) |
| Can a player advance the icebreaker phase? | `social-icebreaker-domain` (no — host only) |
| How do I define a new database model? | `backend-models-standards` |
| What colours can I use for a new UI element? | `joyjoin-brand-guidelines` + `design-system-governance` |
