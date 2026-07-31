---
name: harness-verification-gate
description: >
  Lightweight bridge between deliberation consensus and implementation start.
  Runs the 5-pillar Harness Engineering Framework checklist against a deliberation
  transcript, PR diff, or implementation claim. Outputs GATE: PASS or GATE: BLOCK
  with pillar-specific guidance. Use when a Harness deliberation exists but needs
  a rapid re-check, or when a PR touches core engines and needs a Harness sanity
  check without full deliberation. Trigger phrases: harness gate, verification gate,
  harness sanity check, pillar check, run the harness checklist, engineering sign-off.
---

# Harness Verification Gate

**Purpose:** Fast, deterministic validation that a change or plan satisfies the 5 Harness Engineering Framework pillars before execution proceeds.

A **bridge**, not a replacement for full deliberation. Use when a Harness deliberation transcript exists but needs re-checking, a PR touches core engines and needs a rapid sanity check, an implementation agent claims work is done and wants structured sign-off, or a Supervisor needs to verify a plan before routing.

---

## When to use this skill

- "Run the harness gate on this plan" / "Harness sanity check this PR" / "Does this change pass the 5 pillars?" / "Engineering sign-off before merge"
- Post-deliberation when the Moderator or Controller wants an independent verification

## When NOT to use this skill

- The task needs full deliberation (use `harness-engineering-deliberation` instead)
- The change is trivial and no pillar risk exists
- A full `code-review` PR review is already planned (co-load this skill inside that review instead)

---

## Workflow

### 1. Ingest context

Read one of:
- **Deliberation transcript:** `.git/.orchestration/harness/{sessionId}.json`
- **Deliberation transcript (legacy):** `.git/.orchestration/deliberation/{sessionId}.json`
- **PR diff / changed files:** When run as part of PR review
- **Implementation claim:** Agent's turn summary describing what was built

### 2. Run the 5-pillar checklist

Evaluate each pillar explicitly. Standard: `PASS` (no concerns), `CONCERN` (non-blocking, documented), `FAIL` (blocking).

#### Reliability
- [ ] Partial-failure paths are handled (retries, timeouts, circuit breakers)
- [ ] Multi-step operations are atomic or have compensating actions
- [ ] Idempotency is respected where needed (payments, webhooks, retries)
- [ ] State-machine transitions are explicit and guarded

#### Scalability
- [ ] No N+1 queries or unbounded loops
- [ ] Pagination or bounded scanning is present where data grows
- [ ] Concurrency is safe (no race conditions, proper locking if needed)
- [ ] Memory and CPU bounds are reasonable under expected load

#### Security
- [ ] Fail-closed defaults are preserved (no weakened auth/permission checks)
- [ ] Secrets are not exposed in logs, responses, or error messages
- [ ] Trust boundaries are respected (user vs admin, internal vs external)
- [ ] Input validation and sanitization are present

#### Observability
- [ ] New failure paths are logged with structured fields and request IDs
- [ ] Key decisions and state changes are traceable
- [ ] Audit-worthy actions (auth, data mutation, payment events) are recorded
- [ ] Metrics or alerts exist for new critical paths

#### Maintainability / Architecture fit
- [ ] Code is placed in the correct layer (route, service, repository, shared)
- [ ] Domain boundaries from repo skills are respected
- [ ] Abstraction level is appropriate (not too thin, not too deep)
- [ ] The change does not drift from established patterns without documented justification

### 3. Render verdict

```
## Harness Verification Gate

**Verdict:** GATE: PASS | GATE: BLOCK

**Pillar scores:**
- reliability: PASS / CONCERN / FAIL — [one-line reason]
- scalability: PASS / CONCERN / FAIL — [one-line reason]
- security: PASS / CONCERN / FAIL — [one-line reason]
- observability: PASS / CONCERN / FAIL — [one-line reason]
- maintainability: PASS / CONCERN / FAIL — [one-line reason]

**Blocking concerns (if any):**
- [pillar]: [specific concern and concrete fix suggestion]

**Non-blocking concerns (if any):**
- [pillar]: [specific concern and suggested follow-up]
```

### 4. Route based on verdict

- **GATE: PASS** → Clear for implementation or merge. Hand off to Supervisor or implementation agent.
- **GATE: BLOCK** → Route back to owning engineer or Deliberation Moderator / Harness Runtime Controller with pillar-specific guidance. Do not proceed to implementation until re-gated.
- **Any CONCERN without FAIL** → Proceed with documented follow-up item. Create a tracking note in `repo-memory/candidates/` if the concern is recurring.

---

## Integration with other skills

| Context | Co-load with |
|---------|--------------|
| PR review | `code-review` (this gate runs inside the Harness pillar section) |
| Post-deliberation | `harness-engineering-deliberation` (gate is already Phase 5b; this skill is for standalone re-checks) |
| Post-implementation | `testing-and-regression-guardrails` (verify tests cover the blocking concern) |
| Launch readiness | `launch-readiness-agent` (gate feeds into go/no-go) |

---

## Quick examples

**"Harness gate this payment webhook PR"** → Read diff. Reliability (idempotency key? retry with backoff?), security (signature verification? fail-closed?), observability (structured logs per event?). Verdict: GATE: PASS with CONCERN on observability — webhook timeout path not logged.

**"Does this cache layer change pass the pillars?"** → Read diff + transcript. Scalability (TTL bounded? eviction policy?), reliability (stampede protection?), maintainability (placement per caching-strategy skill?). Verdict: GATE: BLOCK on reliability — no stampede protection documented.

---

## Review checklist

- [ ] Context ingested (transcript, diff, or claim)
- [ ] All 5 pillars evaluated explicitly
- [ ] Verdict is PASS, BLOCK, or PASS-with-CONCERN
- [ ] Blocking concerns include concrete fix suggestions
- [ ] Non-blocking concerns include follow-up recommendations
- [ ] Routing decision is explicit based on verdict
- [ ] If re-gating is needed, the path back to engineer/Moderator/Controller is clear

## Canonical references

- `.github/skills/harness-engineering-deliberation/SKILL.md`
- `.github/skills/code-review/SKILL.md`
- `.github/agents/harness-runtime-controller.agent.md`
- `.github/agents/deliberation-moderator.agent.md`
