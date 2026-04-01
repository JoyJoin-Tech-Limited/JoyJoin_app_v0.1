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

## Review and Quality

Start here when reviewing a pull request or auditing code changes.

| Skill | What it covers |
|-------|---------------|
| [`code-review`](./code-review/SKILL.md) | Structured PR review using the Harness Engineering Framework — correctness, reliability, scalability, security, observability, and architecture fit. **Start here for all PR reviews.** Load domain-specific skills below for deeper review in affected areas. |

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

## UX Polish and Delight

Guidance for adding crafted, brand-aligned micro-interactions and premium emotional moments.

| Skill | What it covers |
|-------|---------------|
| [`wow-elements`](./wow-elements/SKILL.md) | Crafted micro-interactions, completion moments, empty/loading state polish, motion principles, accessibility guardrails, review checklist |

---

## Documentation

Keep docs aligned with the active codebase. Use after significant code changes or when docs are visibly stale.

| Skill | What it covers |
|-------|---------------|
| [`docs-sync`](./docs-sync/SKILL.md) | Scan code changes, map them to documentation targets, draft minimal updates, and enforce active-flow-only guardrails. Use when docs need syncing after a PR merges or an architecture decision is made. |

---

## Review and Quality

Skills for writing, reviewing, auditing, and maintaining skills and code quality.

| Skill | What it covers |
|-------|---------------|
| [`skill-authoring-governance`](./skill-authoring-governance/SKILL.md) | Governing standard for creating, updating, auditing, and improving repo skills — use this when writing a new skill, updating an existing one, or auditing the skills system |

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
| How do I write or audit a skill? | `skill-authoring-governance` |
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
| How do I keep docs in sync after a code change? | `docs-sync` |

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
5. Run `node scripts/validate-skill-routing.mjs` — all 17 skills should show ✅
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

# Run the full routing regression suite (75 test cases)
node scripts/test-skill-routing.mjs
```

### Maintenance rules

- **When you add a trigger phrase** to `SKILL.md`, also add it to `strong_triggers` in `routing.yml`.
- **When a file is moved**, update `owned_files` and run `validate-skill-routing.mjs` to catch stale paths.
- **When a new handoff pattern emerges**, add it to `related_skills` in both skills involved.
- **Never add legacy terms** as triggers — routing metadata must follow the same active-flow-only canon as all other repo content.

See [`docs/architecture/skill-routing.md`](../../docs/architecture/skill-routing.md) for the full routing design, scoring model, observability format, and extension guidance.
