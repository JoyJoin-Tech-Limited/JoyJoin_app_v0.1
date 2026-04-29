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

## Purpose

Strong PR review checks both local code quality and system-level engineering quality. Reviewing only for correctness misses the failure modes that cause production incidents and accumulate technical debt.

This skill implements the **Harness Engineering Framework** as the mandatory review lens. Every PR review must evaluate the change against Harness pillars — not just whether the code is functionally correct.

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

Follow these steps in order:

**1. Understand the change**
- Read the PR description and diff fully before forming opinions.
- Identify what problem is being solved and what design choices were made.

**2. Identify impacted domains and load relevant skills**
- Determine which areas of the codebase are affected.
- Load the relevant repo skills from `.github/skills/` for those domains.

**3. Review correctness and code quality**
- Verify the change does what it claims.
- Check for edge cases, error paths, and off-by-one risks.
- Assess readability and maintainability.
- Check for consistency with repo conventions.

**4. Evaluate Harness Engineering Framework pillars**
- Work through each pillar as described in the next section.
- This is mandatory — not optional.

**5. Verify tests and guardrails**
- Are tests present and adequate for the regression/invariant risk introduced?
- Do CI guardrails still pass?
- Are new or changed behaviours covered?

## Harness pillar evaluation (mandatory)

For each pillar, ask the questions below and record a verdict: **Pass**, **Concern**, or **Fail**.

### Reliability
- Are failure paths handled? (timeouts, retries, partial failures, degraded modes)
- Is the change idempotent where it needs to be?
- Are transactions or atomic operations used for multi-step writes?
- Could this change introduce a new single point of failure?

### Scalability
- Does it add queries inside loops or unbounded scans?
- Are new endpoints protected by rate limiting or resource caps?
- Does it scale with user count, data size, or concurrency?
- Are caches used appropriately?

### Security
- Are auth checks present and fail-closed?
- Are permissions checked at the right layer?
- Are inputs validated and sanitized?
- Are secrets or credentials exposed in code, logs, or error messages?

### Observability
- Are new code paths instrumented with logs or metrics?
- Can failures be diagnosed from logs alone?
- Are request IDs or trace contexts propagated?
- Is there a metric or alert that would catch a regression?

### Maintainability / Architecture fit
- Is the code placed in the right domain/layer?
- Does it follow repo conventions and skill guidance?
- Is it easy to test and change?
- Does it introduce unnecessary coupling or duplication?

## Review focus and PR smells

Flag these patterns for closer inspection:

- **Missing tests** — correctness changes without regression coverage
- **Side effects before persistence** — emails sent, events emitted, or external calls made before the DB write commits
- **Boundary violations** — logic in the wrong layer, shared code importing app-specific modules
- **Hidden scalability issues** — queries inside loops, unbounded list scans, missing indexes
- **Missing observability** — new failure paths with no logs or metrics
- **Security regressions** — removed auth checks, weakened fail-closed behaviour, new unauthenticated endpoints
- **Architecture drift** — patterns inconsistent with repo skills without documented justification
- **Mini-program visual drift** — unspecced odd rpx spacing, or spec-backed screens that diverge without `pixel-precision.md` exception + evidence

## Quick examples

- **Payment or webhook PR** — start with this skill, then load `reliability-and-state-integrity` and `auth-session-and-safety-boundaries`; verify idempotency, retry safety, and fail-closed auth around money movement.
- **Frontend component PR (web)** — start with this skill, then load `frontend-component-architecture` and `design-system-governance`; check whether the component belongs in the app or shared package, whether accessibility/token usage are preserved, and whether spacing matches spec or the 8px token rhythm.
- **Mini-program UI PR** — start with this skill, then load `mini-program-frontend-excellence` (especially `references/pixel-precision.md`) and `design-system-governance`; **block** avoidable spec drift, missing 8rpx rhythm when unspecced, or absent WeChat DevTools / screenshot evidence for user-visible layout changes.
- **Onboarding routing PR** — start with this skill, then load `onboarding-state-architecture`; confirm server-owned `nextStep` remains the authority and that tests cover fallback/loop regressions.

## Reviewer guidelines

- **Be constructive and specific.** Name the line, explain why it is risky, and suggest a concrete fix.
- **Explain the risk, not just the rule.** "This can cause a double-charge on retry" is more useful than "missing idempotency".
- **Prefer high-signal comments.** Skip stylistic nitpicks unless they affect readability significantly.
- **Connect findings to docs.** When possible, reference the relevant repo skill or source-of-truth doc.
- **Calibrate severity.** Distinguish blocking issues from suggestions.
- **Prefer questions over commands.** “What happens if `items` is empty?” lands better than “This will fail if the list is empty.”
- **Use collaborative language.** “Would it make sense to extract this?” invites discussion.
- **Acknowledge good work.** A brief note on a well-designed section costs nothing and builds reviewer trust.
- **PR size.** If the diff is above ~400 meaningful lines, ask the author to split it before deep review.

See [`references/reviewer-guide.md`](./references/reviewer-guide.md) for severity labels, author-facing summary format, and final verdict template.

## Troubleshooting

Common review pitfalls to watch for:

- **Code looks correct locally but is not observable** — a change can be functionally correct and still leave the system blind in production; always check logs/metrics/tracing coverage.
- **Code passes tests but violates architecture boundaries** — tests validate behaviour, not structure; check placement against the repo's domain skills regardless of test results.
- **Code is safe for one user but unsafe under concurrency** — single-user correctness does not imply concurrent safety; check for race conditions, missing transactions, and shared mutable state.
- **Feature works but weakens fail-closed security behaviour** — a feature that "works" by relaxing an auth or permission check introduces risk even if no test fails.
- **Change adds hidden operational burden** — a change may be deployable today but introduce unmaintainable complexity, missing runbook coverage, or invisible failure modes.

## Related skills / docs

Load these skills for deeper review in the relevant domain:

| Domain | Skill |
|--------|-------|
| Auth, sessions, and safety gates | [`auth-session-and-safety-boundaries`](../auth-session-and-safety-boundaries/SKILL.md) |
| Transactions, idempotency, retries | [`reliability-and-state-integrity`](../reliability-and-state-integrity/SKILL.md) |
| Logging, metrics, tracing, audit | [`platform-observability-and-ops`](../platform-observability-and-ops/SKILL.md) |
| Route and domain layering | [`server-domain-architecture`](../server-domain-architecture/SKILL.md) |
| Onboarding state and routing | [`onboarding-state-architecture`](../onboarding-state-architecture/SKILL.md) |
| Pool matching and scoring | [`matching-domain`](../matching-domain/SKILL.md) |
| Icebreaker sessions and phases | [`social-icebreaker-domain`](../social-icebreaker-domain/SKILL.md) |
| UI tokens and component variants | [`design-system-governance`](../design-system-governance/SKILL.md) |
| Shared vs app-local components | [`frontend-component-architecture`](../frontend-component-architecture/SKILL.md) |
| Monorepo dependencies and scripts | [`monorepo-workspace-governance`](../monorepo-workspace-governance/SKILL.md) |

For deeper examples of applying this skill, see [`references/examples.md`](./references/examples.md).
