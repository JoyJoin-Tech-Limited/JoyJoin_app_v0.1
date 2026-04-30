# Velocity Patterns

## Inversion Examples

Inversion asks: *What would make this fail even if we execute perfectly on the wrong thing?*

**Example 1 — Payment retry:**
- Mission: "Add payment retry so users don't lose checkout state."
- Inversion: "Users abandon because they don't know payment failed silently."
- Fix: Idempotent retry + user-visible error state, not just backend retry.

**Example 2 — Onboarding completion:**
- Mission: "Speed up onboarding."
- Inversion: "We remove steps users actually need to make a good first match."
- Fix: Compress UI latency and decision friction, not remove assessment depth.

**Example 3 — New admin dashboard:**
- Mission: "Build an admin analytics dashboard."
- Inversion: "Admins get charts but can't act on them because the data is stale."
- Fix: Real-time pipeline first, pretty charts second.

## Smallest-Proof Examples

The smallest proof is the fastest validating change that still satisfies safety boundaries.

**Too small (skips safety):**
- Add a new API route with no Zod validation
- Skip auth checks to "test faster"
- Ship a migration without a rollback plan

**Right size:**
- One new route + Zod schema + repository + basic test + auth gate
- A feature flag + dark launch + metric tracking
- A targeted E2E test that exercises the critical path

**Too large:**
- Refactor 8 files before verifying the first one works
- Design a 6-month roadmap before writing the first user story

## Quarantine Patterns

When removing or deprecating code:

1. **Identify** — find duplicate paths, dead flags, or "maybe later" branches
2. **Quarantine** — move to a clearly named directory or flag with `// DEPRECATED:`
3. **Verify invariants** — ensure removal does not break matching, payments, onboarding state, or auth
4. **Remove** — delete after a safe observation window
5. **Document** — note the removal in turn summaries for traceability

**Examples of things to quarantine:**
- Legacy onboarding identifiers (`hasCompletedRegistration`, `needsRegistration`)
- Unused feature flags with no rollout plan
- Duplicate wrapper components that shadow shared primitives

## Escalation Rules

Escalate in **one step** with **evidence**.

**Good escalation:**
> "Blocked: `npm run db:generate` fails with `relation does not exist` on `user_semantic_profiles`. Failing file: `packages/shared/src/schema.ts:482`. Repro: `npm run db:push` on clean local DB. Need schema audit."

**Bad escalation:**
> "The DB stuff isn't working. Can someone help?"

**Required evidence:**
- Command output or error message
- Failing check name or file path
- Reproduction steps
- Reference to `AI_WORKFLOW_POLICY.md` if policy decision is needed

## Model Tier Routing

| Task depth | Tier | Examples |
|------------|------|----------|
| Trivial / verification | mini / fast | 20-line CSS tweak, typo fix, lint cleanup |
| Standard implementation | Sonnet / GPT-5.4 xhigh | Single API route, component refactor, test addition |
| Multi-file architecture | Opus / premium | New matching algorithm, auth overhaul, cross-platform feature |
| High-stakes or coordination-heavy | Opus / premium | Payment flow, schema redesign, launch-critical path |

**Rule:** Optimize for outcome first. Use cheaper tiers only when the task is truly shallow or verification-like. Escalate tier when logic, coordination, or stakes rise.

**Catalog source:** [`.github/agents/MODEL_CATALOG.md`](../../agents/MODEL_CATALOG.md)

## Five Execution Themes (Detailed)

### 1. Constraint-first design
Name hard constraints before solution options: data model and invariants, auth and safety boundaries, payment or entitlement rules, platform/runtime limits, latency or cost ceilings.

Pair with domain skills for enforcement detail.

### 2. End-to-end ownership of the critical slice
One lane should own truth for a vertical slice (API contract, client surfaces, tests, operational signals). Hand off only at real boundaries — not "everyone touches the PRP."

### 3. Cycle time over headcount
Compress idea → smallest runnable proof: targeted tests, repo guardrails, then smoke or E2E when policy warrants.

### 4. Ruthless deletion / option value
Prefer remove or quarantine duplicate paths, dead flags, and "maybe later" branches. Large removals stay reviewed and aligned with invariants.

### 5. Direct escalation when blocked
When the critical path is stuck, escalate in one step with evidence. Align with `orchestration-turn-reporting` and `AI_WORKFLOW_POLICY.md`.

## Anti-Patterns

- Parallelizing **dependent** work to "go faster"
- Premium models for **trivial** edits
- Cheapest models for **multi-file architecture** without explicit waiver
- Long chat transcripts instead of structured briefs + JSON
- **Speed theater:** "Smallest change" that skips migrations, auth boundaries, or review
- **Options before constraints** — designing before naming non-negotiable rules
- **Blocked without evidence** — escalation that does not include what failed and where
