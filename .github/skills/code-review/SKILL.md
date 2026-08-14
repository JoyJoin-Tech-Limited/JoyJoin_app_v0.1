---
name: code-review
description: >
  Performs structured pull request review using the Harness Engineering Framework as the default review lens.
  Use when asked to review a PR, audit code changes, or evaluate engineering quality.
  Trigger phrases: "review this PR", "check this code", "review my changes", "look for issues",
  "code review", "audit this pull request", "evaluate against Harness framework".
  Reviews correctness AND system-level quality: reliability, scalability, security, observability,
  and maintainability/architecture fit. Loads domain-specific repo skills for deeper review in affected areas.
---

# Code Review Skill

**Core rule:** Strong PR review checks both local code quality and system-level engineering quality. Every review must evaluate the change against Harness pillars — not just whether the code is functionally correct.

## When to use this skill

Use when asked to:
- "review this PR"
- "check this code"
- "review my changes"
- "look for issues"
- "code review"
- "audit this pull request"
- "evaluate against Harness framework"

This skill applies to all PR reviews and code audit requests in this repository.

## Review scope

Every review must consider:

| Dimension | What to check |
|-----------|---------------|
| **Correctness** | Does the change do what it claims? Are edge cases handled? |
| **Regression risk** | Can this silently break existing behaviour? |
| **Maintainability** | Is the code readable, appropriately placed, and easy to change? |
| **Repo conventions** | Does it follow the patterns established in this repo's skills and docs? |
| **Security** | Does it weaken auth, permissions, trust boundaries, or secret handling? |
| **Performance / scalability** | Does it scale with traffic, data size, or concurrency? |
| **Reliability / failure handling** | Does it handle partial failures, retries, and rollbacks correctly? |
| **Observability / auditability** | Is the change visible through logs, metrics, tracing, or audit records? |
| **Architecture fit** | Does it place code in the right layer and respect domain boundaries? |

## Sequential review workflow

1. **Understand the change** — Read the PR description and diff fully before forming opinions.
2. **Identify impacted domains and load relevant skills** — Determine which areas of the codebase are affected and load the relevant repo skills from `.github/skills/`.
3. **Review correctness and code quality** — Verify the change does what it claims; check edge cases, error paths, readability, and repo conventions.
4. **Evaluate Harness Engineering Framework pillars** — Work through each pillar against the canonical checklist in [`harness-completion-gate/references/harness-pillars.md`](../harness-completion-gate/references/harness-pillars.md) (single source of truth). This is mandatory. See [`references/reviewer-guide.md`](./references/reviewer-guide.md) for full questions and verdict format.
5. **Verify tests and guardrails** — Are tests present and adequate? Do CI guardrails still pass?

## Reviewer guidelines

- Be constructive and specific. Name the line, explain the risk, and suggest a concrete fix.
- Explain the risk, not just the rule.
- Prefer high-signal comments. Skip stylistic nitpicks unless they affect readability significantly.
- Connect findings to docs. Reference the relevant repo skill or source-of-truth doc.
- Calibrate severity. Distinguish blocking issues from suggestions.
- Prefer questions over commands.
- Use collaborative language.
- Acknowledge good work.
- If the diff is above ~400 meaningful lines, ask the author to split it before deep review.

## Quick examples

- **Payment or webhook PR** — start with this skill, then load `reliability-and-state-integrity` and `auth-session-and-safety-boundaries`; verify idempotency, retry safety, and fail-closed auth around money movement.
- **Admin-client PR** — start with this skill, then load `admin-client-frontend` and `design-system-governance`; check RBAC UI gating matches server roles, mutations are audit-logged, and token discipline (ops-tier surface — no emotional-rubric requirement).
- **Mini-program UI PR** — start with this skill, then load `mini-program-frontend-excellence` (especially `references/pixel-precision.md`) and `design-system-governance`; **block** avoidable spec drift, missing 8rpx rhythm when unspecced, or absent WeChat DevTools / screenshot evidence for user-visible layout changes.
- **Realtime surface PR (gathering room / icebreaker session)** — start with this skill, then load `social-icebreaker-domain` (or `docs/agent-context/gathering-room.md`); check hooks above every early return, WS reconnect/heartbeat, generation progress monotonicity + terminal-state guards, and the top-level `/api/miniscript/*` path contract.
- **Onboarding routing PR** — start with this skill, then load `onboarding-state-architecture`; confirm server-owned `nextStep` remains the authority and that tests cover fallback/loop regressions.

## Troubleshooting

- **Code looks correct locally but is not observable** — a change can be functionally correct and still leave the system blind in production; always check logs/metrics/tracing coverage.
- **Code passes tests but violates architecture boundaries** — tests validate behaviour, not structure; check placement against the repo's domain skills regardless of test results.
- **Code is safe for one user but unsafe under concurrency** — single-user correctness does not imply concurrent safety; check for race conditions, missing transactions, and shared mutable state.
- **Feature works but weakens fail-closed security behaviour** — a feature that "works" by relaxing an auth or permission check introduces risk even if no test fails.
- **Change adds hidden operational burden** — a change may be deployable today but introduce unmaintainable complexity, missing runbook coverage, or invisible failure modes.

## Review checklist

Before approving a PR, verify:

- [ ] Correctness: the change does what it claims and edge cases are handled
- [ ] Harness pillars evaluated with a verdict (Pass / Concern / Fail) for each
- [ ] Regression risk is covered by tests or explicitly documented
- [ ] Security: auth is fail-closed, inputs validated, no secrets in code/logs
- [ ] Scalability: no queries in loops, unbounded scans, or missing rate limits
- [ ] Observability: new paths have logs/metrics and failures are diagnosable
- [ ] Architecture fit: code is in the right domain/layer with no boundary violations
- [ ] Tests pass and CI guardrails are green

For deeper examples, see [`references/examples.md`](./references/examples.md).
