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
