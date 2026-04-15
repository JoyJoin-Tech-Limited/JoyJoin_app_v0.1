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
- Use `.github/AI_WORKFLOW_POLICY.md` to decide when work should stay in direct delivery, when it should start with `Researcher` -> `Planner`, and when it should escalate into QA or launch review.
- Use `.github/ORCHESTRATION_GOVERNANCE.md` when changing agents, skills, hooks, orchestration scripts, or their contributor-facing documentation so the contract and discovery surfaces stay in sync.
- For broad, ambiguous, or multi-step work, start with `Researcher` to gather verified context, then `Planner` to return an approval-first execution plan before implementation begins.
- `Auto-Eval` remains the deterministic dirty-worktree gate. `Supervisor` is the manual routing surface across the core v1 agent graph.
- Use `Supervisor` after approval or when work needs to be rerouted across specialists midstream.
- Repo-managed local hooks live under `.githooks/`; contributors who want the local commit-time gate should set `git config core.hooksPath .githooks`.

### Turn Reporting

- When acting as a repo custom agent under `.github/agents/`, read `.git/.orchestration/context.json` when it exists and use the last 5 relevant summaries plus supervisor feedback to refine the current turn.
- Use `.github/skills/orchestration-turn-reporting/SKILL.md` as the canonical schema for turn-end summary JSON and supervisor consolidation.
- End every completed agent turn with a compact JSON summary that captures: what was delivered, files changed, decisions, blockers, what was learned, 1-2 self-suggested improvements for the next turn, categorized next steps, confidence, and unresolved assumptions.
- If the active agent has execute access and is responsible for persistence, append the summary through `node scripts/orchestration-supervisor.mjs record-summary`.
- If the active agent does not have execute access, or a parent agent is brokering persistence, still emit the JSON summary and let the caller record it.
- `Supervisor` must consolidate child summaries into one turn-end report with key bullets, cross-agent insights, per-agent feedback, and actionable task-level recommendations.
- Turn summaries are operational workflow state only. Keep them under `.git/.orchestration/`; never treat them as durable repo memory.

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