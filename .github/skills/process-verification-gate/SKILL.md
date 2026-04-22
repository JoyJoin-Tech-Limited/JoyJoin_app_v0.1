---
name: process-verification-gate
description: >
  Pre-ship verification checklist aligned with the Harness Engineering Framework.
  Use before calling a task "done" or merging a PR. Checks reliability, scalability,
  security, observability, and maintainability pillars plus lane-specific validation.
  Trigger phrases: verify before ship, pre-ship checklist, verification gate, ready
  to merge, done check, final validation, ship check, merge readiness.
---

# Process: Verification Gate

## Purpose

Prevent "it works on my machine" shipping. Before any task is marked complete, run a structured verification against the 5 Harness pillars plus lane-specific criteria. This skill is the cross-tool equivalent of verification-before-completion discipline.

---

## When to use this skill

- Before merging any PR
- Before calling a task "done" in a turn summary
- After implementation but before handoff to QA or staging
- When the user asks "is this ready to ship?"

## When NOT to use this skill

- The task is a one-line typo fix that passed guardrails and typecheck
- You are mid-implementation and need debugging help (use `process-systematic-debugging`)
- You need architecture review before implementation (use `code-review` or HRC)

---

## The verification protocol

Run all 5 Harness pillars. For each, mark **PASS**, **CONCERN**, or **FAIL**.

### Pillar 1: Reliability

- [ ] Partial failures are handled (retries, fallbacks, graceful degradation)
- [ ] State-machine transitions are idempotent where applicable
- [ ] No race conditions in concurrent paths
- [ ] Database writes use transactions where multi-step

### Pillar 2: Scalability

- [ ] No N+1 queries introduced
- [ ] Pagination or bounded result sets for list routes
- [ ] No unbounded memory growth (caches have TTL, loops terminate)
- [ ] LLM calls are fire-and-forget or cached, not on hot paths

### Pillar 3: Security

- [ ] Auth checks present on new routes (`requireAuthenticatedUserId`, `requireAdmin`)
- [ ] No secrets logged or exposed in error messages
- [ ] Input validated (Zod schemas, SQL injection safe via Drizzle)
- [ ] Fail-closed defaults (deny access if unsure)

### Pillar 4: Observability

- [ ] New failure paths have structured logging (`logger.error/warn`)
- [ ] Metrics added for new high-traffic surfaces (Prometheus counters/histograms)
- [ ] Request correlation IDs propagate through new async paths
- [ ] Admin audit logs for sensitive mutations

### Pillar 5: Maintainability

- [ ] Correct layer placement (routes → services → repositories)
- [ ] Shared code lives in `packages/shared`, not copied across apps
- [ ] No cross-app imports
- [ ] New code follows existing naming and structure conventions

---

## Lane-specific validation

Add these checks based on the lane used for the task:

| Lane | Additional checks |
|---|---|
| **HRC** | Sprint Contract acceptance criteria met; Harness transcript artifacts present; risk acceptance signatures documented |
| **DM** | Consensus plan followed; no deviations without documented reason; cross-workspace parity verified |
| **Kickoff** | Research brief and Planner execution plan match the shipped implementation; no scope creep |
| **Direct** | Micro-plan matches the diff; validation path (tests + guardrails) was run |

---

## The ship / no-ship decision

| Verdict | Condition | Action |
|---|---|---|
| **SHIP** | All 5 pillars PASS, lane-specific checks PASS | Merge / mark done |
| **SHIP WITH NOTE** | All PASS, 1–2 minor CONCERNs with documented mitigations | Merge with follow-up ticket |
| **BLOCK** | Any FAIL, or >2 CONCERNs | Fix before merge. If lane = HRC, escalate to Harness Runtime Controller for re-evaluation. |

---

## Examples

### Example 1: Direct delivery — new metric

**Task:** Add Prometheus counter for pool card cache hit/miss.

**Verification:**
- Reliability: PASS — counter is additive only, no failure path
- Scalability: PASS — no query changes
- Security: PASS — no auth surface
- Observability: PASS — this IS the observability
- Maintainability: PASS — follows existing metric pattern
- Lane (Direct): Micro-plan matched diff
- **Verdict: SHIP**

### Example 2: HRC — payment flow change

**Task:** Add refund webhook handler.

**Verification:**
- Reliability: CONCERN — no idempotency key on webhook processing
- Scalability: PASS
- Security: PASS — signature verification present
- Observability: PASS — audit log + structured logging present
- Maintainability: PASS
- Lane (HRC): Sprint Contract AC #3 not fully met (retry policy missing)
- **Verdict: BLOCK** — add idempotency check + retry policy before merge

---

## Troubleshooting

**One pillar has a CONCERN but the user wants to ship**
> Document the CONCERN in the PR description with a follow-up ticket. If the lane was HRC, the Harness Gate should have already accepted or rejected this risk.

**Verification takes longer than the implementation**
> For trivial direct-delivery tasks, run only the pillars that touch the changed files. Skip pillars with zero risk exposure.

**Not sure if a check applies**
> Default to checking it. A quick "N/A — no auth surface touched" note is better than skipping silently.

---

## Review checklist

- [ ] All 5 Harness pillars were evaluated
- [ ] Each pillar has PASS / CONCERN / FAIL with a one-line justification
- [ ] Lane-specific checks were added
- [ ] Ship / no-ship verdict is explicit
- [ ] CONCERNs have documented mitigations or follow-up tickets
- [ ] FAILs block merge until resolved
