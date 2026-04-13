# Contribution Guidelines

1. Follow coding standards.
2. Write meaningful commit messages.
3. Document your code properly.

### Skills

- Reusable project skills live under `.github/skills/`.
- Start with `.github/skills/README.md` to find the relevant skill for architecture, reliability, testing, observability, monorepo governance, and core product domains.
- These skills complement the canonical source-of-truth docs in this file, `DEVELOPER_QUICK_REFERENCE.md`, and active architecture docs; they do not replace them.
- When creating or updating files under `.github/skills/`, follow the skill authoring standard in `.github/skills/skill-authoring-governance/SKILL.md`. Ensure correct frontmatter, trigger phrases, progressive disclosure, examples, troubleshooting, and a review checklist are present where appropriate.

### Agents

- Focused workflow agents live under `.github/agents/`.
- Start with `.github/agents/README.md` to choose the right agent for debugging, frontend delivery, platform parity, prompt work, or product scoping.
- Skills define the rules and boundaries; agents help execute a workflow within those boundaries.

### Orchestration

- The native agent orchestration contract lives in `.github/orchestration.yaml`.
- Use `.github/ORCHESTRATION.md` for the human-readable graph, support-agent coverage, and tooling sufficiency audit.
- For broad, ambiguous, or multi-step work, start with `Researcher` to gather verified context, then `Planner` to return an approval-first execution plan before implementation begins.
- `Auto-Eval` remains the deterministic dirty-worktree gate. `Supervisor` is the manual routing surface across the core v1 agent graph.
- Use `Supervisor` after approval or when work needs to be rerouted across specialists midstream.
- Repo-managed local hooks live under `.githooks/`; contributors who want the local commit-time gate should set `git config core.hooksPath .githooks`.

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