# Skill Routing — Architecture & Maintenance Guide

**Version:** 1.0  
**Owner:** Platform team  
**Last Updated:** April 2026

---

## Overview

The JoyJoin skill routing system ensures that the right repo skill is loaded at the right time for every ask or task. It follows a **simple, observable, maintainable** design — a lightweight rule-based router rather than a learned model.

---

## Routing philosophy

1. **Simple first.** A rule-based router with explicit signals is easier to maintain and debug than a trained classifier. Start here; upgrade only if signal quality degrades.
2. **Observable.** Every routing decision emits a structured log with reasons, confidence, and scores. You can always explain why a skill was selected.
3. **Metadata as contract.** Routing signals live in `routing.yml` inside each skill directory — part of the skill's ownership contract, not a hidden central config.
4. **Anti-legacy guard.** A cross-cutting canonical check fires on every ask and warns whenever a deprecated pattern (like `/guide`, `shared/` root import, or direct messaging) is referenced.
5. **Clarify on low confidence.** When confidence is low or two skills score closely, the router recommends clarification rather than committing to the wrong skill.

---

## Repository structure

```
.github/skills/
├── README.md                          # Skills index
├── routing-schema.yml                 # Documented metadata schema
├── <skill-name>/
│   ├── SKILL.md                       # Skill content
│   └── routing.yml                    # Routing metadata (new)

scripts/
├── skill-router.mjs                   # Router implementation (importable + CLI)
├── validate-skill-routing.mjs         # Freshness validator
└── test-skill-routing.mjs             # Executable routing examples / regression tests

docs/architecture/
└── skill-routing.md                   # This file
```

---

## Routing metadata format (`routing.yml`)

Each core skill has a `routing.yml` alongside its `SKILL.md`. The schema is defined in `.github/skills/routing-schema.yml`.

### Required fields

| Field | Description |
|-------|-------------|
| `skill` | Kebab-case name matching the parent directory |
| `primary_ownership` | One-sentence summary of what this skill owns |
| `use_when` | List of scenarios / phrases that indicate this skill applies |
| `strong_triggers` | High-confidence keywords, symbols, or file patterns |

### Recommended fields

| Field | Description |
|-------|-------------|
| `do_not_use_when` | Scenarios where this skill should NOT be loaded |
| `owned_files` | Glob patterns for files this skill owns |
| `owned_paths` | API route prefixes or URL path patterns |
| `owned_symbols` | TypeScript symbols, hooks, or entity names |
| `related_skills` | Handoff notes for neighbouring skills |

### Example

```yaml
skill: onboarding-state-architecture

primary_ownership: >
  Server-driven nextStep model, active onboarding routing authority,
  profile completion gating, and legacy onboarding quarantine.

use_when:
  - user asks about onboarding flow, nextStep, or setup/extended/review routing
  - user is debugging why a user is stuck in onboarding

do_not_use_when:
  - task is about admin login permissions only
  - task is purely about generic ui styling

strong_triggers:
  - nextStep
  - /onboarding/setup
  - /onboarding/extended
  - /onboarding/review
  - profileEssentialComplete
  - hasSeenProfileReview

owned_files:
  - apps/user-client/src/features/onboarding/
  - apps/user-client/src/hooks/useAuth.ts

owned_paths:
  - /onboarding/setup
  - /onboarding/extended
  - /onboarding/review

owned_symbols:
  - nextStep
  - useOnboardingOrchestrator
  - AuthenticatedRouter

related_skills:
  - skill: reliability-and-state-integrity
    when: onboarding change involves retries or re-entry guards
```

---

## Router scoring model

The router scores every skill against three input signals:

| Signal type | Source | Weight |
|-------------|--------|--------|
| Strong trigger match (ask text) | `strong_triggers` | 10 |
| Strong trigger match (file path) | `strong_triggers` | 10 |
| Strong trigger match (symbol) | `strong_triggers` | 10 |
| `use_when` phrase overlap | `use_when` | 3 |
| Owned file prefix match | `owned_files` | 12 |
| Owned path match | `owned_paths` | 6 |
| Owned symbol match | `owned_symbols` | 7 |
| `do_not_use_when` exclusion | `do_not_use_when` | -5 |

### Confidence bands

| Band | Condition |
|------|-----------|
| `high` | Top score ≥ 20 and gap to second ≥ 10 |
| `medium` | Top score ≥ 10 |
| `low` | Top score < 10 or no signals matched |

### Loading rule

- **Primary skill:** highest-scoring skill if score > 0
- **Secondary skill:** second-highest if score ≥ 40% of primary score
- **Clarification recommended:** when confidence is `low` or top two scores differ by < 5

---

## Anti-legacy guard

A cross-cutting guard fires on every ask regardless of which skill is selected. It warns on any of the following patterns:

| Pattern | Label |
|---------|-------|
| `/guide` | Deprecated onboarding step (active flow uses `/onboarding/setup|extended|review`) |
| `shared/` (root import) | Use `packages/shared/src/` instead |
| `direct messaging` / DM | Removed; use `/connections` |
| `/chats` or `圈子` | Replaced by `/connections` |
| `hasCompletedRegistration`, `needsRegistration`, `registration_sessions`, `interestsTop` | Legacy onboarding identifiers |
| `会员` / `VIP会员` | Replaced by `权益` |
| 14-archetype V1/V2 system | Replaced by 12-archetype V4 |
| `createDemoDataForUser` | Must be gated on `NODE_ENV !== 'production'` |

Warnings appear in the `anti_legacy` field of the routing result and are printed to the CLI.

---

## When multiple skills are loaded

It is normal and expected for 2 skills to be loaded simultaneously. Common combinations:

| Primary | Secondary | Scenario |
|---------|-----------|----------|
| `onboarding-state-architecture` | `reliability-and-state-integrity` | Onboarding step with atomic write requirement |
| `server-domain-architecture` | `platform-observability-and-ops` | New API route + structured logging |
| `matching-domain` | `reliability-and-state-integrity` | Pool matching with idempotency guard |
| `social-icebreaker-domain` | `testing-and-regression-guardrails` | Host/player invariant with regression test |
| `frontend-component-architecture` | `design-system-governance` | New shared component with token requirements |

The router caps secondary skills at 1 in the first version to avoid context bloat.

---

## Clarification behavior

When `clarification_recommended` is true, the agent should ask a clarifying question before proceeding. Example templates:

- "Are you asking about the **onboarding state flow** (nextStep, completion gating) or about the **UI implementation** of the onboarding screens?"
- "Are you asking where a new route should live (**server domain architecture**), or how to make the write operation atomic (**reliability**)?"
- "This task touches both **matching logic** and **icebreaker session state**. Which area should I focus on first?"

---

## Routing observability

Every `routeSkill()` call returns a `routing_log` object:

```json
{
  "ask": "Add a new rule after profile review before pool registration",
  "files": [],
  "symbols": [],
  "primary_skill": "onboarding-state-architecture",
  "secondary_skills": ["reliability-and-state-integrity"],
  "confidence": "high",
  "clarification_recommended": false,
  "anti_legacy": { "triggered": false, "warnings": [] },
  "top_scores": [
    { "skill": "onboarding-state-architecture", "score": 40 },
    { "skill": "reliability-and-state-integrity", "score": 20 }
  ],
  "matched_signals": [
    "strong_trigger:ask:\"profile-review\"",
    "strong_trigger:ask:\"onboarding step\""
  ],
  "timestamp": "2026-04-01T00:00:00.000Z"
}
```

Pass `emitLog: true` to `routeSkill()` to write this to stdout as JSON.

---

## CLI usage

```bash
# Basic routing
node scripts/skill-router.mjs "Add a nextStep rule after profile review"

# With file context
node scripts/skill-router.mjs "Fix this component" \
  --files "apps/user-client/src/components/matching/NoMatchScreen.tsx"

# With symbol context
node scripts/skill-router.mjs "Refactor this hook" \
  --symbols "useOnboardingOrchestrator"
```

---

## Running validation

```bash
# Validate routing metadata freshness (checks required fields, path existence, legacy refs)
node scripts/validate-skill-routing.mjs

# Run representative routing examples (37 test cases)
node scripts/test-skill-routing.mjs
```

Both scripts exit `0` on success and `1` on failure.

---

## How to add or update routing metadata

1. **Add a new skill:** create a `routing.yml` in `.github/skills/<skill-name>/` following the schema in `routing-schema.yml`. The `skill` field must match the directory name exactly.
2. **Add a trigger:** update `strong_triggers` with the new keyword or symbol. Prefer repo-specific terms (TypeScript symbols, route paths, component names) over generic keywords.
3. **Update owned files:** update `owned_files` when files are moved or renamed. Run `node scripts/validate-skill-routing.mjs` to catch stale paths.
4. **Update related_skills:** when a new handoff pattern emerges, add it to both skills involved.
5. **Test changes:** run `node scripts/test-skill-routing.mjs` to verify existing routing still works. Add a new test case for the new scenario.

---

## Ownership and maintenance

| Artifact | Owner | Update frequency |
|----------|-------|-----------------|
| `routing.yml` files | Skill owner (domain team) | When skill scope changes |
| `skill-router.mjs` | Platform team | When scoring model needs adjustment |
| `validate-skill-routing.mjs` | Platform team | When new validation rules are needed |
| `test-skill-routing.mjs` | Platform team | When new scenarios emerge |
| This document | Platform team | When routing philosophy changes |

**Primary ownership boundaries** are defined in each `routing.yml` under `primary_ownership`. When two skills could both own a concept, prefer the more specific/domain-focused skill as primary and list the other as `related_skills`.

---

## Extending to phase 2 (future)

The current router is intentionally simple. If signal quality degrades, consider:

- Weighted scoring with per-skill calibration factors
- Embedding-based similarity for phrase matching
- CI enforcement: add `node scripts/validate-skill-routing.mjs` to CI pipeline
- Routing precision/recall tracking from real usage data
- Automated trigger suggestion from recently changed files

Do not add complexity until there is evidence the simple router is under-performing.
