---
name: sprint-contract
description: >
  Write, negotiate, and evaluate Sprint Contracts for JoyJoin's Harness Engineering Framework.
  Use when a task requires a Sprint Contract (Tier 2+), when reviewing a contract draft,
  or when evaluating an implemented contract against hard thresholds.
  Trigger phrases: "write a sprint contract", "negotiate done-ness", "contract required",
  "tier 2 task", "harness contract", "acceptance criteria", "what does done look like".
---

# Sprint Contract Skill

## Purpose

The Sprint Contract is the central Harness Engineering Framework artifact for Tier 2+ tasks: it defines what "done" looks like **before** the first file is edited.

## When to Use This Skill

- **Before implementation:** the task is Tier 2 or Tier 3 and needs a contract
- **During negotiation:** reviewing a draft for vagueness, missing edge cases, or pillar gaps
- **After implementation:** evaluating completed work against the contract's hard thresholds

## Contract Format

Contracts are stored at `.git/.orchestration/sprints/sprint-contract.{taskId}.md` with a **hybrid JSON frontmatter + Markdown body**:

```markdown
---
{
  "sprintId": "sprint_20260423_abc123",
  "parentPlanId": "plan_20260423_def456",
  "generatorAgent": "Backend Engineer",
  "contractEvaluator": "Verifier",
  "sprintEvaluator": "QA Agent",
  "status": "accepted",
  "tier": 2,
  "createdAt": "2026-04-23T10:00:00Z",
  "acceptedAt": "2026-04-23T10:08:00Z",
  "maxEvaluatorIterations": 3,
  "goal": "Add refund endpoint with idempotency key"
}
---

# Sprint Contract: {taskId}

## 1. Goal
[One sentence: what must be true when this sprint ends?]

## 2. Acceptance Criteria (testable)

| ID | Criterion | Verification Method | Threshold |
|----|-----------|---------------------|-----------|
| AC-01 | [Concrete, observable condition] | [Command / test / MCP check] | PASS |

## 3. Harness Pillar Criteria

### Reliability
| ID | Criterion | Verification | Threshold |
|----|-----------|--------------|-----------|
| REL-01 | [e.g., All new routes handle 4xx/5xx] | `npm run test` | PASS |

### Scalability
### Security
### Observability
### Maintainability

## 4. Out-of-Scope
[What this sprint explicitly does NOT do]

## 5. Verification Method Summary
[How will the Evaluator verify this contract after implementation?]

## 6. Negotiation Log
- **[timestamp]** Implementer proposed: [initial draft]
- **[timestamp]** Evaluator reviewed: [feedback]
- **[timestamp]** Implementer amended: [changes]
- **[timestamp]** Evaluator accepted / rejected: [final verdict]
```

## Writing a Good Contract

### Acceptance Criteria Rules
- Every criterion must be **observable** (a test can prove it true or false) with a **verification method** (command, test, MCP check).
- Use **numbers, not adjectives**: "< 100ms" not "fast"; "≤50 items" not "reasonable".
- Cover the **happy path, error path, and boundary conditions**.

### Pillar Criteria Rules
- At least one criterion per **relevant** Harness pillar; skip pillars that genuinely don't apply (e.g., scalability for a copy change).
- Link pillar criteria to specific file paths or patterns when possible.

### Out-of-Scope Rules
- Be explicit about what is **not** included — prevents mid-implementation creep and sets reviewer expectations.

## Negotiation Protocol

1. **Implementer writes draft** → saves to `.git/.orchestration/sprints/`
2. **Verifier reviews** → returns ACK with amendments or REJECT with feedback
3. **Implementer amends** → updates file, appends to Negotiation Log
4. **Verifier accepts or rejects** → max 2 cycles
5. **Deadlock?** → escalate to Supervisor

## Evaluation Protocol

1. **QA Agent reads contract** and runs verification method
2. **Grades each criterion:** PASS / PARTIAL / FAIL
3. **Hard threshold:** Any FAIL on required criterion → REJECT
4. **Writes feedback JSON** → `.git/.orchestration/sprints/sprint-{id}-feedback.json`
5. **Or writes verdict JSON** → `.git/.orchestration/sprints/sprint-{id}-verdict.json`
6. **Re-evaluation:** Only re-check failed criteria, not full suite

## Related

- [`harness-completion-gate`](../harness-completion-gate/SKILL.md) — Final 5-pillar gate
- [`harness-kpi-framework`](../../docs/proposals/harness-kpi-framework.md) — Scoring rubrics
- [`harness-consensus-plan`](../../docs/proposals/harness-consensus-plan.md) — Unified architecture
