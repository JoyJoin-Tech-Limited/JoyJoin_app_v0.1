# Docs-Sync Source-to-Documentation Mapping Guide

This guide maps areas of the JoyJoin codebase to the documentation files and agent memories that must be updated when those areas change. Apply this guide during **Step 2 (Impact analysis)** of the sync process.

**Path notation:** Some source paths use `*` as a glob wildcard (e.g., `.github/skills/*/SKILL.md`, `apps/*/package.json`). These mean "check all files matching this pattern" — not a single literal file.

**Priority rule:** Always update canonical docs first. Canonical order:
1. `DEVELOPER_QUICK_REFERENCE.md`
2. `docs/architecture/current-state.md`
3. `docs/` top-level files (e.g. `onboarding-flow.md`, `MATCHING_ALGORITHM_REFERENCE.md`, `observability.md`)
4. `.github/skills/` SKILL.md files
5. Workspace-level READMEs (`apps/server/src/README.md`, `packages/shared/src/README.md`, etc.)
6. Agent memory (via MCP `agentMemory`) — last, after docs are authoritative

**Coordinated multi-tier refresh:** When the task is explicitly to align **product docs, skills, and agents** (not a single feature PR), read [`docs/ai/ai-workflow-documentation-refresh.md`](../../../../docs/ai/ai-workflow-documentation-refresh.md) first for scope tiers, lane choice (kickoff vs this skill vs Workflow Governance Reviewer), and validation commands. Prefer **one PR per tier** when diffs are large.

**Anti-legacy rule:** Never propagate a legacy identifier, deprecated route, or removed component into any documentation target or agent memory, even a supplementary one.

**Memory rule:** Agent memory is for *non-obvious facts* and *cross-session context*. If the code change invalidates a previously stored memory (e.g. a route rename, a reversed decision, an updated step list), update or delete that memory. Do not let memory drift from docs.

---

## 1. Shared UI / Design system changes

**Source paths:**
- `packages/shared/src/ui/`
- `packages/shared/src/ui/buttonVariants.ts`
- `packages/shared/src/ui/Button.tsx`

**Documentation targets:**

| Doc | Agent memory | What to update |
|-----|-------------|---------------|
| `packages/shared/src/README.md` | — | Add/update entry for the new or changed component — include export path, purpose, and intended use |
| `.github/skills/design-system-governance/SKILL.md` | — | Update the token/variant/component reference if a new CVA variant or design token was added |
| `.github/skills/frontend-component-architecture/SKILL.md` | — | Update shared primitive listing if a new primitive was added |
| `docs/button-design.md` | — | If the change involves the `Button` primitive or `buttonVariants.ts` — add variant rationale |
| `apps/admin-client/src/components/ui/button.tsx` comments | — | Confirm re-export wrapper still documents the correct shared source |

**When to skip:** Purely internal implementation change (e.g. adding a className helper function used only inside the file) with no change to exported API.

---

## 2. Frontend app architecture changes

**Source paths:**
- `apps/mini-program/src/app.ts`
- `apps/mini-program/src/pages/`
- `apps/mini-program/src/components/`
- `apps/mini-program/src/hooks/`
- `apps/admin-client/src/`

**Documentation targets:**

| Doc | Agent memory | What to update |
|-----|-------------|---------------|
| `DEVELOPER_QUICK_REFERENCE.md` | — | Update Monorepo Structure section if a new top-level directory or feature area was added |
| `docs/architecture/current-state.md` | — | Update authority chain descriptions if routing, auth gating, or feature ownership changed |
| `.github/skills/frontend-component-architecture/SKILL.md` | — | Update placement rules or examples if component placement patterns changed |
| `.github/skills/onboarding-state-architecture/SKILL.md` | Update if onboarding step list or auth router facts were cached | If changes touch `App.tsx` `AuthenticatedRouter` or onboarding pages — update authority chain, step table |
| `apps/mini-program/README.md` | — | If onboarding feature structure changed — update module boundary description |

**When to skip:** Adding a new page component without changing routing logic, hooks, or shared patterns.

---

## 2b. WeChat Mini Program — personality test, login, payment, matching status, social icebreaker, share flows

**Source paths:**
- `apps/mini-program/src/pages/onboarding/personality-test/`
- `apps/mini-program/src/pages/index/LandingPage.tsx` (`loggedOut` re-auth state — `pages/login/` retired 2026-09-01)
- `apps/mini-program/src/hooks/auth/useWeChatLogin.ts`
- `apps/mini-program/src/lib/auth/anonymousOnboarding.ts`
- `apps/mini-program/src/pages/blind-box-payment/`
- `apps/mini-program/src/pages/payment-verification/`
- `apps/mini-program/src/lib/api/api.ts`, `payment/paymentEntry.ts`, `payment/paymentPendingOrder.ts`, `payment/paymentPendingOrderStorage.ts`
- `apps/mini-program/src/lib/onboarding/onboardingRoutes.ts` (page registration / subpackages)
- `apps/mini-program/src/app.ts` (pending-order resume on cold start)
- `apps/mini-program/src/pages/matching-status/` (matching result, chemistry reveal, connection points, share poster)
- `apps/mini-program/src/pages/connections/` (connection list, reveal flow)
- `apps/mini-program/src/pages/icebreaker-session/` (social icebreaker phases)

**Documentation targets:**

| Doc | Agent memory | What to update |
|-----|-------------|---------------|
| `PRODUCT_REQUIREMENTS.md` | — | Mini-Program screen families table: add new page, update flow description, or mark feature as shipped |
| `docs/mini-program-product-reference.md` | — | Page inventory, user flow description, AI features note, platform-parity table |
| `docs/PLATFORM_COORDINATION.md` | Update if cross-platform auth/payment flow facts were cached | Cross-platform auth and payment table; mini-program file map |
| `docs/PERSONALITY_TEST_SYSTEM.md` | — | Client surfaces table (web vs mini-program) if assessment UI or storage changes |
| `docs/onboarding-flow.md` | Update if onboarding route list was memorized | Mini Program path mirror table if routes or auth endpoints change |
| `docs/architecture/current-state.md` | — | Mini-program onboarding / payment / matching / icebreaker bullets |
| `DEVELOPER_QUICK_REFERENCE.md` | — | Taro mini-program table |
| `apps/mini-program/README.md` | — | Source-of-truth bullets |
| `.github/skills/platform-coordination-protocol/SKILL.md` | Update if platform coordination rules were stored | Coordinated areas table and related files |

**When to skip:** Purely visual SCSS changes with no routing, API, or storage key changes.

---

## 3. Backend / API changes

**Source paths:**
- `apps/server/src/routes.ts`
- `apps/server/src/routes/domains/`
- `apps/server/src/repositories/`
- `apps/server/src/storage.ts`

**Documentation targets:**

| Doc | Agent memory | What to update |
|-----|-------------|---------------|
| `PRODUCT_REQUIREMENTS.md` | — | If a new API powers a user-facing feature documented in screen families, update the data-flow or capability description |
| `DEVELOPER_QUICK_REFERENCE.md` | Delete or update cached route lists / endpoint facts | Update Key Commands, Monorepo Structure, or guardrail tables if API-surface or CLI-script changed |
| `docs/api/` (if present) | — | Update route table with new/renamed/removed endpoint, HTTP method, auth requirement |
| `apps/server/src/README.md` | — | Update the domain list and responsibility summary if a new `routes/domains/` file was added |
| `.github/skills/server-domain-architecture/SKILL.md` | — | Update domain ownership listing; add new domain or repository to the reference table |
| `.github/skills/auth-session-and-safety-boundaries/SKILL.md` | — | If a new route has auth requirements or changes fail-closed defaults |

**Handling ambiguous internal-only changes:** If a route was internally refactored (logic moved between functions, service extracted) with identical public signature, no doc update is needed unless the change affects observable behaviour described in docs.

---

## 4. Onboarding / auth flow changes

**Source paths:**
- `apps/server/src/routes/domains/auth.ts`
- `apps/server/src/routes/domains/onboarding.ts`
- `apps/mini-program/src/pages/onboarding/`
- `apps/mini-program/src/hooks/auth/useWeChatLogin.ts`

**Documentation targets:**

| Doc | Agent memory | What to update |
|-----|-------------|---------------|
| `PRODUCT_REQUIREMENTS.md` | — | Onboarding screen family: update step sequence, completion flags, or new entry/exit points |
| `docs/onboarding-flow.md` | Update if step sequence was memorized | Update step sequence, completion flags, and authority chain diagram if any step was added, removed, or reordered |
| `DEVELOPER_QUICK_REFERENCE.md` | — | Update the active onboarding steps list; add/remove banned legacy identifiers if a column was added or deprecated |
| `.github/skills/onboarding-state-architecture/SKILL.md` | Update if step authority chain was cached | Update active onboarding steps table, authority chain, and legacy quarantine list |
| `docs/architecture/current-state.md` | — | If overall auth architecture or route gating changed |
| `scripts/check-guardrails.mjs` | — | If a new banned identifier was introduced (ensure CI enforcement and docs are in sync) |

**Anti-legacy guardrail:** Never document a new step using legacy identifiers (`hasCompletedRegistration`, `needsRegistration`, `registration_sessions`, `interestsTop`). If these appear in a change, flag them as bugs before documenting.

---

## 5. Matching domain changes

**Source paths:**
- `apps/server/src/poolMatchingService.ts`
- `apps/server/src/matchExplanationService.ts`
- `apps/server/src/routes/domains/matchingAdmin.ts`, `matchExplanations.ts`, `matchingConfig.ts`
- Matching-related data structures in `packages/shared/src/schema.ts` / `@shared/schema`
- `apps/mini-program/src/pages/matching-status/` (matching result UI, chemistry reveal, connection points)

**Documentation targets:**

| Doc | Agent memory | What to update |
|-----|-------------|---------------|
| `PRODUCT_REQUIREMENTS.md` | — | Matching-State screen family: update data flow, reveal patterns, user stories, or acceptance criteria |
| `docs/MATCHING_ALGORITHM_REFERENCE.md` | — | Update dimension descriptions or threshold ranges if scoring logic changed; do not expose raw numeric weights |
| `docs/architecture/connection-points-system.md` | — | Update data flow, component inventory, or platform parity table if connection-points / spark-prediction UI changed |
| `.github/skills/matching-domain/SKILL.md` | Update if scoring rules or signal boundaries were cached | Update signal boundary table, execution safety notes, or AI explanation separation rules |
| `DEVELOPER_QUICK_REFERENCE.md` | — | If a new legacy constraint was added (e.g. a banned signal type) |

**Handling ambiguous changes:** Changes to internal scoring math without altering the public interface (which signals are accepted, what thresholds gate actions) do not require doc updates. Changes that alter which signals are accepted or how explanations are generated do require doc updates.

**Never document raw numeric weights.** The `matching-domain` skill explicitly prohibits exposing score thresholds in public documentation.

---

## 6. Social icebreaker domain changes

**Source paths:**
- `apps/server/src/routes/socialIcebreaker.ts`
- `apps/mini-program/src/pages/icebreaker-session/` and related hooks

**Documentation targets:**

| Doc | Agent memory | What to update |
|-----|-------------|---------------|
| `.github/skills/social-icebreaker-domain/SKILL.md` | Update if phase list or host authority rules were cached | Update phase list, host/player authority table, secrecy boundary rules, or rejoin semantics if any changed |
| `docs/icebreaker-system.md` (if present) | — | Update phase lifecycle and action descriptions |
| `DEVELOPER_QUICK_REFERENCE.md` | — | If a new icebreaker route was added or a route was removed |

**Secrecy guardrail:** Never document the server-side truth data (e.g. `isLie` in lie-detective) in client-visible documentation. Only document sanitized state fields.

---

## 7. Observability / ops changes

**Source paths:**
- Logging calls (`logger.*`) in `apps/server/src/`
- Prometheus metric registrations
- Health/readiness endpoint changes
- `apps/server/src/routes/domains/` — any new structured log field

**Documentation targets:**

| Doc | Agent memory | What to update |
|-----|-------------|---------------|
| `docs/observability.md` | — | Update metric names, log field list, or health endpoint description |
| `.github/skills/platform-observability-and-ops/SKILL.md` | — | Update the structured logging field table or metrics reference |
| `docs/runbooks/` | — | If a new alert or health check was added, add/update the relevant runbook |

**When to skip:** Adding a log line to an existing code path with no new field names or metric names — no doc update needed.

---

## 8. Config / environment / deployment changes

**Source paths:**
- `.env.example`
- `deployment/.env.production.example`
- `deployment/.env.staging.example`
- `package.json` root scripts
- `apps/*/package.json` workspace scripts

**Documentation targets:**

| Doc | Agent memory | What to update |
|-----|-------------|---------------|
| `DEVELOPER_QUICK_REFERENCE.md` | — | Update Key Commands section if a root script was added, renamed, or removed; add new env variable description in the Prerequisites/Configuration section |
| `.env.example` inline comments | — | Add a comment explaining what the new variable controls and whether it is required or optional |
| `.github/skills/monorepo-workspace-governance/SKILL.md` | — | If root script naming convention changed or a new workspace was added |

**Secret guardrail:** Never add actual secret values to documentation. If a new secret variable is introduced, document only the variable name and its purpose.

---

## 9. Database / schema changes

**Source paths:**
- `packages/shared/src/schema.ts` (or Drizzle schema files)
- Migration files

**Documentation targets:**

| Doc | Agent memory | What to update |
|-----|-------------|---------------|
| `DEVELOPER_QUICK_REFERENCE.md` | — | If a new column name could become a legacy identifier (add to guardrail list when the column is deprecated) |
| `.github/skills/backend-models-standards/SKILL.md` | — | Note new data type conventions, constraint patterns, or index strategies if introduced |
| `docs/architecture/current-state.md` | — | If a significant new table or relationship changes the data model overview |

**When to skip:** Adding a column that is purely internal (not referenced in any doc, not a completion flag, not a guardrail-protected identifier). A column only becomes a doc target when it is referenced by name in skills, quick references, or onboarding docs.

---

## 10. Skills / contributor guidance changes (bidirectional)

**Source paths:**
- `.github/skills/*/SKILL.md`
- `.github/skills/README.md`
- `DEVELOPER_QUICK_REFERENCE.md`
- `PRODUCT_REQUIREMENTS.md`

**Documentation targets:**

| Doc | Agent memory | What to update |
|-----|-------------|---------------|
| `PRODUCT_REQUIREMENTS.md` | — | **Also a target:** when skills, quick-reference rules, or onboarding flows change, update the relevant screen-family or capability description |
| `.github/skills/README.md` | — | Add new skill row, update description, or remove row for a deleted skill |
| `DEVELOPER_QUICK_REFERENCE.md` | — | If a new canonical rule was established, update the relevant guardrail or quick-reference table |
| The specific `SKILL.md` | — | Update trigger phrases, related files, quick examples, or review checklist to match current reality |

**Skill freshness rule:** If a skill's **Related files** section references a path that no longer exists, or its trigger phrases use identifiers that have been renamed, the skill must be updated immediately. Stale skill metadata degrades agent routing quality.

**Bidirectional note:** `PRODUCT_REQUIREMENTS.md` and `DEVELOPER_QUICK_REFERENCE.md` appear in this section as *sources* (they can trigger skill updates), but they are also *targets* for changes originating in other sections. When editing any mapping section, check whether these two canonical docs need updates — they are the most frequently missed targets.

---

## Handling ambiguous changes

When a change touches multiple areas (e.g. a new onboarding step that touches frontend, backend, and the schema), work through each mapping row independently and collect a combined list of impacted docs and memories. Present them together in the impact summary so the user can approve all at once.

When a change is purely internal with no observable API, flow, or architecture impact, state "No documentation impact — internal implementation change" and skip the update.
