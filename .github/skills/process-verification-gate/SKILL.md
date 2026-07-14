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

Run all 5 Harness pillars. The canonical checklist lives in [`harness-completion-gate/references/harness-pillars.md`](../harness-completion-gate/references/harness-pillars.md) — the single source of truth shared with `code-review`, so the criteria are maintained once. For each pillar (Reliability, Scalability, Security, Observability, Maintainability) mark **PASS**, **CONCERN**, or **FAIL** with a one-line justification.

If a check does not apply, write a quick "N/A — no auth surface touched" note rather than skipping silently.

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

## Quick example

**Direct delivery — new Prometheus counter:** Reliability PASS (additive only), Scalability PASS (no query change), Security PASS (no auth surface), Observability PASS (this IS the metric), Maintainability PASS → **SHIP**. A contrasting HRC payment-flow example (BLOCK on missing idempotency + retry policy) lives in [`references/examples.md`](references/examples.md).

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
