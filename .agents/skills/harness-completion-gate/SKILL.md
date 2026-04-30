---
name: harness-completion-gate
description: >
  Mandatory Harness Engineering Framework verification gate that runs at the end
  of every implementation task. Evaluates the 5 Harness pillars (Reliability,
  Scalability, Security, Observability, Maintainability) against changed code
  before sign-off. Trigger phrases: "harness gate", "completion check",
  "ready to call done", "verify against harness", "5-pillar review",
  "pre-ship checklist", "process-verification-gate".
---

# Harness Completion Gate

**Core rule:** This is a **mandatory quality gate** that runs at the end of every implementation task. No task is considered complete until the Harness gate produces a PASS verdict for all 5 pillars.

The gate can be run:
- **Automatically** via `npm run harness:gate` (reads git diff, evaluates changed files)
- **Manually** by loading this skill and walking through the checklist
- **Via auto-eval** as the `harness-engineering` module

## When to use this skill

- Before declaring any implementation task complete
- When the user asks for a "harness gate", "5-pillar review", or "pre-ship checklist"
- After tests pass but before merging or deploying changes
- When evaluating whether a change meets Reliability, Scalability, Security, Observability, and Maintainability standards
- As a final quality gate in the `Harness` orchestration lane

## The 5 Pillars (overview)

| Pillar | Concerns |
|--------|----------|
| Reliability | Error handling, idempotency, atomicity, no race conditions |
| Scalability | No N+1, no unbounded lists, caches have TTL, indexes used |
| Security | Auth checks, fail-closed defaults, no secrets in code/logs, input validation |
| Observability | Structured logging, request IDs, metrics for new failures, audit logs |
| Maintainability | Correct layer, no cross-app imports, shared via `@joyjoin/shared`, file size reasonable |

Run the automated gate:

```bash
npm run harness:gate
```

This produces a JSON report and exits:
- `0` = all pillars pass
- `1` = one or more pillars failed (blocking issues found)
- `2` = concerns found (non-blocking, but must be documented)

For full per-pillar checklists, Sprint Contract JSON format, auto-eval integration, and agent workflow steps — see [references/pillar-details.md](references/pillar-details.md).

## Quick examples

- **Run the automated gate:** `npm run harness:gate` → review JSON output → fix all blocking findings before the turn summary.
- **Manual gate after a bugfix:** Walk the 5-pillar checklists for a single-file auth fix; verify fail-closed defaults and error logging even when the automated script is unavailable.
- **Contract-aware gate:** `node scripts/evaluate-sprint-contract.mjs --contract=.git/.orchestration/sprints/sprint-contract.<taskId>.md` → cross-checks diff against contract criteria.

## Troubleshooting

- **Gate exits with code 1 (blocking issues)** → Review the JSON report, fix every `[blocking]` item, and re-run before claiming completion.
- **Gate script is unavailable** → Run the manual 5-pillar checklist in this skill; do not skip the gate.
- **Contract findings show unexpected failures** → Verify the sprint contract path is correct and that criterion IDs match the changed files.
- **Supervisor or Verifier rejects sign-off despite gate passing** → Document the specific pillar concern in the turn summary and re-evaluate.
- **Large diff causes timeout** → Run the gate locally with `--files` to limit scope, or switch to manual review for the affected files.
- **Gate exits with code 2 (concerns)** → Document each concern in the turn summary with a mitigation plan; concerns do not block completion but must not be silently ignored.

## Review checklist

- [ ] Gate was run after the last file edit and before the turn summary
- [ ] All 5 pillars evaluated (Reliability, Scalability, Security, Observability, Maintainability)
- [ ] Every `[blocking]` finding is fixed or explicitly escalated with evidence
- [ ] `[concern]` items are documented in the turn summary with a mitigation plan
- [ ] `harnessVerdict` JSON is included in the agent turn summary
- [ ] Sprint contract cross-check performed when a contract is active
- [ ] Supervisor/Verifier sign-off obtained or documented if gate produces concerns
