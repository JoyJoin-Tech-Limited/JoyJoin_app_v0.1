# Reviewer Guide

## Severity labels

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

## Author-facing summary (optional)

When the author or team wants a **stakeholder-readable** one-pager outside the GitHub comment thread, you may use the same narrative shape as the orchestration **executive briefing** in [`orchestration-turn-reporting`](../orchestration-turn-reporting/SKILL.md): one-line header, **Observation**, **Implication / Context**, **Next Step**, optional **Bottom Line**. For PR threads, the structured **Final verdict format** below remains the default.

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

## Harness pillar evaluation questions

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

## PR smells

Flag these patterns for closer inspection:

- **Missing tests** — correctness changes without regression coverage
- **Side effects before persistence** — emails sent, events emitted, or external calls made before the DB write commits
- **Boundary violations** — logic in the wrong layer, shared code importing app-specific modules
- **Hidden scalability issues** — queries inside loops, unbounded list scans, missing indexes
- **Missing observability** — new failure paths with no logs or metrics
- **Security regressions** — removed auth checks, weakened fail-closed behaviour, new unauthenticated endpoints
- **Architecture drift** — patterns inconsistent with repo skills without documented justification
- **Mini-program visual drift** — unspecced odd rpx spacing, or spec-backed screens that diverge without `pixel-precision.md` exception + evidence

## Domain-specific skill loading

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
