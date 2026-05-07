---
description: JoyJoin Harness Engineering Framework — tier classification, Sprint Contract protocol, 5-pillar quality gates. Always applies to implementation agents.
globs: "**/*"
alwaysApply: true
---
# JoyJoin Harness Engineering Framework (OpenCode)

Canonical source: `docs/proposals/harness-consensus-plan.md`

## The 5 Harness Pillars

Every change must be evaluated against:
1. **Reliability** — partial-failure risk, atomicity, idempotency, recovery/re-entry semantics
2. **Scalability** — concurrency safety, query efficiency, data-size bounds
3. **Security** — auth gates, fail-closed behaviour, trust boundaries, secret handling
4. **Observability** — structured logs, metrics, tracing, audit records for significant actions
5. **Maintainability / architecture fit** — correct code placement, domain boundary respect, pattern consistency

## Tier Classification

Before any file edits on non-trivial work, classify the task:

**Tier 1** ($0 baseline)
- ≤50 lines, 1 workspace, small fixes
- Flow: Implement → `npm run guardrails` → Auto-Eval gate
- No Sprint Contract needed

**Tier 2** ($0.50-$2, 1.3-1.7×)
- New routes, multi-file, auth, stateful ops, new public API
- Flow: Sprint Contract draft → Verifier review → implement → QA Agent Sprint Evaluation
- Contract required BEFORE file edits
- Sprint Contract stored at: `.git/.orchestration/sprints/sprint-contract.{taskId}.md`

**Tier 3** ($10-$25, 5-10×)
- Core engine, payment, major refactor, personality system
- Flow: Harness Runtime Controller → PGE → Council → Consensus → locked contract → implement → QA Agent + Verifier
- Harness Runtime Controller orchestrates the full deliberation

## Auto-Trigger Classification

```bash
node scripts/harness-auto-trigger.mjs --prompt="<user request>" --proposed-files=<files>
```

Output format to announce:
```
🔍 Harness Classification
- Tier: {1|2|3}
- Contract required: {yes|no}
- Triggered by: {words}
- Action: {proceed|pause for contract}
```

If `Action: PAUSE_FOR_CONTRACT` → STOP. Do not edit files. Generate Sprint Contract first.

## Sprint Contract Protocol

### Draft format (saved to `.git/.orchestration/sprints/sprint-contract.{taskId}.md`):

```markdown
# Sprint Contract: {taskId}
## Goal
[One sentence — what must be delivered]

## Acceptance Criteria
- [ ] Criterion 1: [testable condition]
- [ ] Criterion 2: [testable condition]

## Harness Pillar Criteria
- [ ] Reliability: [specific check]
- [ ] Security: [specific check]
- [ ] Observability: [specific check]

## Out of Scope
- [Explicit exclusions to prevent creep]

## Verification Method
[How each criterion will be verified: command, test name, manual check]

## Negotiation Log
[Verifier feedback cycles]
```

### Evaluation flow
1. Engineer drafts contract → route to `@verifier`
2. Verifier reviews → ACK (with amendments) or REJECT (max 2 cycles)
3. ACK → contract locked → implement
4. Route to `@qa-agent` for Sprint Evaluation → PASS/PARTIAL/FAIL per criterion
5. Any FAIL on required criterion → REJECT → return to engineer (max 3 total iterations)
6. All PASS → route to `@auto-eval` for dirty-worktree gate

## Harness Runtime Controller (Tier 3)

For Tier 3 work, the Harness Runtime Controller runs:
1. **PGE Phase**: Problem → Goal → Evidence iterative refinement
2. **Council Mode**: 5 Harness-pillar delegates evaluate independently
3. **Consensus Synthesis**: Merge evaluations into a locked plan with Sprint Contract
4. **Token Circulation (optional)**: Emergent consensus for unresolved dissent

## Harness Completion Gate

Before sign-off on any implementation:
```bash
npm run guardrails          # Env, secrets, legacy, import checks
npm run typecheck           # Full workspace type check
npm run test -w @joyjoin/server  # Server tests
node scripts/auto-eval.mjs --mode manual-report  # Auto-Eval gate
node scripts/orchestration/orchestration-supervisor.mjs validate  # Orchestration contract
```

## Escalation Path

| When | Action |
|------|--------|
| Sprint Contract rejected 2+ times by Verifier | Escalate to `@supervisor` → re-plan or re-scope |
| Sprint Evaluation failed 3+ times | Escalate to `@supervisor` → reassign or re-plan |
| Unresolved Harness deliberation dissent | Escalate to Deliberation Moderator |
| Launch-blocking issue found | Escalate to Launch Readiness Agent |
