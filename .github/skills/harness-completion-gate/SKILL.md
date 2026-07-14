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

## Purpose

This is a **mandatory quality gate** that runs at the end of every implementation task. No task is considered complete until the Harness gate produces a PASS verdict for all 5 pillars.

The gate can be run:
- **Automatically** via `npm run harness:gate` (reads git diff, evaluates changed files)
- **Manually** by loading this skill and walking through the checklist
- **Via auto-eval** as the `harness-engineering` module

## When to run

Run the gate **before** declaring any task complete:
- After the last file edit, before the turn summary
- After tests pass but before claiming "done"
- Before routing to `Verifier` or `QA Agent` for sign-off

## The 5 Pillars

The full five-pillar checklist (Reliability, Scalability, Security, Observability, Maintainability / Architecture Fit) is maintained once in [`references/harness-pillars.md`](references/harness-pillars.md) — the canonical source that backs `npm run harness:gate` and is shared with `code-review` and `process-verification-gate`. Evaluate each pillar as PASS / CONCERN / FAIL; any FAIL is blocking, CONCERNs are documented but non-blocking.

## Gate Script

Run the automated gate:

```bash
npm run harness:gate
```

This produces a JSON report and exits:
- `0` = all pillars pass
- `1` = one or more pillars failed (blocking issues found)
- `2` = concerns found (non-blocking, but must be documented)

## Sprint Contract Awareness

If an active Sprint Contract exists at `.git/.orchestration/sprints/sprint-contract.{taskId}.md`, the gate script reads it and cross-checks the diff against the contract's pillar criteria, tagging findings with criterion IDs (e.g., `REL-01` pass, `SEC-02` fail) alongside the `harnessVerdict` map. Run contract-aware evaluation:

```bash
node scripts/evaluate/evaluate-sprint-contract.mjs --contract=.git/.orchestration/sprints/sprint-contract.<taskId>.md
```

## Integration with auto-eval

The Harness gate is also available as an auto-eval module:

```bash
node scripts/auto/auto-eval.mjs --mode=manual-report
```

When the `harness-engineering` module is enabled, it runs the same checks as `npm run harness:gate`.

Auto-eval's status mapping mirrors the gate's own blocking semantics (fail-safe): gate verdict `pass` **or `concern`** (exit 2 — non-blocking by the gate's design, e.g. a pre-existing >1500-line file-size warning on a touched file) maps to an auto-eval module **pass** with concerns surfaced as minor findings; `fail` maps to **fail**; an unknown/unparseable verdict maps to **fail**. Concerns never hard-fail auto-eval, but they stay visible in the report.

## Agent Workflow

At the end of every implementation turn:

1. **Run `npm run harness:gate`** (or manual checklist if script unavailable)
2. **Review findings** — classify each as [blocking], [concern], or [nit]
3. **Fix all [blocking] items** before claiming completion
4. **Document [concern] items** in the turn summary with mitigation plan
5. **Include Harness verdict** in `agent_turn_summary`:

```json
{
  "harnessVerdict": {
    "reliability": "pass",
    "scalability": "pass",
    "security": "pass",
    "observability": "concern",
    "maintainability": "pass"
  },
  "harnessFindings": [
    { "pillar": "observability", "severity": "concern", "message": "..." }
  ]
}
```

## Related

- [`code-review`](../code-review/SKILL.md) — Deep PR review using the same 5 pillars
- [`first-principles-velocity`](../first-principles-velocity/SKILL.md) — Mission-focused execution discipline
- [`testing-and-regression-guardrails`](../testing-and-regression-guardrails/SKILL.md) — Test coverage requirements
