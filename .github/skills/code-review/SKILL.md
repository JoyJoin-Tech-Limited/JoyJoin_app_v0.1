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

---

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

---

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

---

## Sequential review workflow

Follow these steps in order:

**1. Understand the change**
- Read the PR description and diff fully before forming opinions.
- Identify what problem is being solved and what design choices were made.

**2. Identify impacted domains and load relevant skills**
- Determine which areas of the codebase are affected.
- Load the relevant repo skills from `.github/skills/` for those domains (see Related skills/docs below).

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

**6. Provide constructive feedback and final verdict**
- Group findings by severity.
- Use the standard verdict format at the end of this skill.

---

## Harness Engineering Framework evaluation

This section is **mandatory** for every review. Evaluate each pillar explicitly.

### Reliability
- Does the change introduce partial-failure risk (e.g., side effects before a commit)?
- Are retries, timeouts, and failure modes handled?
- Does it maintain atomicity for multi-step operations?
- Does it respect idempotency where needed?

### Scalability
- Does the change perform correctly under high concurrency?
- Are there N+1 queries, unbounded loops, or missing pagination?
- Does it introduce lock contention or single-threaded bottlenecks?
- Does it scale with data size, user count, or request volume?

### Security
- Does it weaken authentication or authorization gates?
- Does it violate fail-closed defaults?
- Does it expose sensitive data in logs, responses, or error messages?
- Does it handle secret/credential material correctly?
- Are trust boundaries (user vs admin, internal vs external) respected?

### Observability
- Are errors, warnings, and key decisions logged with structured fields?
- Are new operations traceable via request IDs or correlation headers?
- Are new failure paths observable through metrics or alerts?
- Are audit-worthy actions (auth, data mutation, payment events) recorded?

### Maintainability / Architecture fit
- Is code placed in the correct layer (route, domain, repository, shared)?
- Does it respect existing domain boundaries from the repo's skills?
- Is the abstraction level appropriate — not too thin, not too deep?
- Does it drift from established patterns without justification?

---

## Mandatory review checklist

Work through these explicitly before submitting your verdict:

- [ ] Does this change degrade reliability or introduce partial-failure risk?
- [ ] Is the change observable through logs, metrics, tracing, or audit records where needed?
- [ ] Does the design scale appropriately with traffic, data size, or concurrency?
- [ ] Does it weaken auth, permissions, trust boundaries, or secret handling?
- [ ] Does it preserve maintainable architecture and correct code placement?
- [ ] Are tests adequate for the regression/invariant risk?
- [ ] Are CI guardrails still passing?

---

## Review focus and PR smells

Flag these patterns for closer inspection:

- **Missing tests** — correctness changes without regression coverage
- **Side effects before persistence** — emails sent, events emitted, or external calls made before the DB write commits
- **Boundary violations** — logic in the wrong layer, shared code importing app-specific modules
- **Hidden scalability issues** — queries inside loops, unbounded list scans, missing indexes
- **Missing observability** — new failure paths with no logs or metrics
- **Security regressions** — removed auth checks, weakened fail-closed behaviour, new unauthenticated endpoints
- **Architecture drift** — patterns inconsistent with repo skills without documented justification

## Quick examples

- **Payment or webhook PR** — start with this skill, then load `reliability-and-state-integrity` and `auth-session-and-safety-boundaries`; verify idempotency, retry safety, and fail-closed auth around money movement.
- **Frontend component PR** — start with this skill, then load `frontend-component-architecture` and `design-system-governance`; check whether the component belongs in the app or shared package and whether accessibility/token usage are preserved.
- **Onboarding routing PR** — start with this skill, then load `onboarding-state-architecture`; confirm server-owned `nextStep` remains the authority and that tests cover fallback/loop regressions.

---

## Reviewer guidelines

- **Be constructive and specific.** Name the line, explain why it is risky, and suggest a concrete fix.
- **Explain the risk, not just the rule.** "This can cause a double-charge on retry" is more useful than "missing idempotency".
- **Prefer high-signal comments.** Skip stylistic nitpicks unless they affect readability significantly.
- **Connect findings to docs.** When possible, reference the relevant repo skill or source-of-truth doc (e.g., "see `reliability-and-state-integrity` skill").
- **Calibrate severity.** Distinguish blocking issues (must fix before merge) from suggestions (can follow up).
- **Prefer questions over commands.** “What happens if `items` is empty?” lands better than “This will fail if the list is empty.”
- **Use collaborative language.** “Would it make sense to extract this?” invites discussion; “You must change this” closes it.
- **Acknowledge good work.** A brief note on a well-designed section costs nothing and builds reviewer trust.
- **PR size.** If the diff is above ~400 meaningful lines, ask the author to split it before deep review.

### Severity labels

Use inline labels to make priority explicit and reduce author guesswork:

| Label | Meaning |
|-------|---------|
| `[blocking]` | Must fix before merge. Correctness, security, or reliability risk. |
| `[concern]` | Should fix or discuss. Non-trivial risk that can be addressed in a follow-up with agreement. |
| `[nit]` | Minor style or clarity point. Not blocking. Author can ignore with a short note. |
| `[suggestion]` | Alternative approach worth considering. No action required. |
| `[praise]` | Something done well. Acknowledge it explicitly. |

What to review manually versus leave to tooling:
- **Review manually:** logic correctness, edge cases, security, scalability, architecture fit, test coverage intent.
- **Leave to tooling:** code formatting, import ordering, simple linting violations, spelling in non-user-facing identifiers.

---

## Author-facing summary (optional)

When the author or team wants a **stakeholder-readable** one-pager outside the GitHub comment thread (chat, standup, or async handoff), you may use the same narrative shape as the orchestration **executive briefing** in [`orchestration-turn-reporting`](../orchestration-turn-reporting/SKILL.md): one-line header, **Observation**, **Implication / Context**, **Next Step**, optional **Bottom Line**. For PR threads, the structured **Final verdict format** below remains the default.

---

## Final verdict format

End every review with this summary shape:

```
## Review verdict

**Key findings:**
- [finding 1 — severity: blocking / concern / minor]
- [finding 2 — severity: ...]

**Requested changes / recommendations:**
- [specific, actionable request]
- [specific, actionable request]

**Test / validation note:**
[Are tests adequate? What coverage is missing or required?]

**Harness pillar verdicts:**
- reliability: Pass / Concern / Fail
- scalability: Pass / Concern / Fail
- security: Pass / Concern / Fail
- observability: Pass / Concern / Fail
- maintainability / architecture fit: Pass / Concern / Fail
```

## Troubleshooting

Common review pitfalls to watch for:

- **Code looks correct locally but is not observable** — a change can be functionally correct and still leave the system blind in production; always check logs/metrics/tracing coverage.
- **Code passes tests but violates architecture boundaries** — tests validate behaviour, not structure; check placement against the repo's domain skills regardless of test results.
- **Code is safe for one user but unsafe under concurrency** — single-user correctness does not imply concurrent safety; check for race conditions, missing transactions, and shared mutable state.
- **Feature works but weakens fail-closed security behaviour** — a feature that "works" by relaxing an auth or permission check introduces risk even if no test fails.
- **Change adds hidden operational burden** — a change may be deployable today but introduce unmaintainable complexity, missing runbook coverage, or invisible failure modes.

---

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
