# Contribution Guidelines

1. Follow coding standards.
2. Write meaningful commit messages.
3. Document your code properly.

### Skills

- Reusable project skills live under `.github/skills/`.
- Start with `.github/skills/README.md` to find the relevant skill for architecture, reliability, testing, observability, monorepo governance, and core product domains.
- These skills complement the canonical source-of-truth docs in this file, `DEVELOPER_QUICK_REFERENCE.md`, and active architecture docs; they do not replace them.

## Pull Request Review Standard

When reviewing pull requests, evaluate not only local correctness but also:
- **Reliability** — partial-failure risk, atomicity, idempotency
- **Scalability** — concurrency safety, query efficiency, data-size bounds
- **Security** — auth gates, fail-closed behaviour, trust boundaries, secret handling
- **Observability** — structured logs, metrics, tracing, and audit records for significant actions
- **Maintainability / architecture fit** — correct code placement, domain boundary respect, pattern consistency
- **Regression risk** — adequate test coverage for the change

The **Harness Engineering Framework** is the default review lens for these dimensions. Apply it to every PR, not just high-risk changes.

**Start with:** `.github/skills/code-review/SKILL.md`
**Then load** domain-specific skills from `.github/skills/README.md` for the areas affected by the change.

---

## Debugging Tips

- Always check for errors in your code.
- Use print statements for debugging.